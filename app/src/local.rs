//! `LocalBackend`: mail-core on this device (docs/design.md §4 local mode).
//! The database is `data_dir()/mail.sqlite`; passwords and tokens go to the
//! OS keyring, or an encrypted file beside the database where there is none
//! (always on Android). The engine's work runs on the tasks' runtime
//! (`background`), off the engine thread; its events come back here.

use std::{
    cell::RefCell,
    collections::HashMap,
    future::Future,
    rc::{Rc, Weak},
};

use mail_core::{
    Archived, Engine, Feed, ListFilter, StagedFile,
    secrets::{self, platform_store},
    types::*,
};
use nsh_core::prelude::*;
use tokio::sync::broadcast::error::RecvError;

use crate::backend::{
    Backend, Events, File, MailFuture, Progress, Staged, rename_upload, unavailable,
};
use crate::notify::{
    ApiKey, CreatedApiKey, CreatedSource, FeedPage, FeedQuery, NewApiKey, NewSource, Notification,
    Source, SourceKind,
};

type Slot = RefCell<Option<Engine>>;

#[derive(Default)]
pub struct LocalBackend {
    engine: Rc<Slot>,
    /// The engine's notification feed, beside mail: the store projects mail into it.
    feed: RefCell<Option<Feed>>,
    staged: Staged,
}

/// Runs `work` on the tasks' runtime: the engine needs tokio's.
async fn run<T: Send + 'static>(
    work: impl Future<Output = Result<T>> + Send + 'static,
) -> Result<T> {
    background(work)
        .await
        .map_err(|e| Error::new(ErrorCode::Internal, format!("mail task failed: {e}")))?
}

impl LocalBackend {
    fn engine(&self) -> Result<Engine> {
        self.engine
            .borrow()
            .clone()
            .ok_or_else(|| Error::new(ErrorCode::Internal, "the mail engine is not running"))
    }

    /// `f` with the engine, on the tasks' runtime.
    fn call<T, F>(&self, f: impl FnOnce(Engine) -> F) -> MailFuture<'_, T>
    where
        T: Send + 'static,
        F: Future<Output = Result<T>> + Send + 'static,
    {
        let work = self.engine().map(f);
        Box::pin(async move { run(work?).await })
    }

    fn feed(&self) -> Result<Feed> {
        self.feed
            .borrow()
            .clone()
            .ok_or_else(|| Error::new(ErrorCode::Internal, "the mail engine is not running"))
    }

    /// `f` with the feed, on the tasks' runtime: the reads are SQLite's and fast, and the engine
    /// thread stays free for the screen.
    fn db<T, F>(&self, f: F) -> MailFuture<'_, T>
    where
        T: Send + 'static,
        F: FnOnce(Feed) -> Result<T> + Send + 'static,
    {
        let feed = self.feed();
        Box::pin(async move {
            let feed = feed?;
            run(async move { f(feed) }).await
        })
    }
}

async fn open() -> Result<(Engine, secrets::Backend)> {
    let dir = data_dir().ok_or_else(|| {
        Error::new(
            ErrorCode::Unsupported,
            "this device keeps no files for the app: use an AgentInbox server",
        )
    })?;
    blocking(move || {
        std::fs::create_dir_all(&dir).map_err(|e| {
            Error::new(
                ErrorCode::Storage,
                format!("cannot create {}: {e}", dir.display()),
            )
        })?;
        let (secrets, kind) = platform_store(&dir)?;
        Ok((Engine::open(dir.join("mail.sqlite"), secrets)?, kind))
    })
    .await
    .map_err(|e| Error::new(ErrorCode::Internal, format!("opening mail failed: {e}")))?
}

/// Hands the engine's events to `events` on the engine thread until the
/// engine goes.
fn forward(engine: &Engine, slot: Weak<Slot>, events: Events) {
    let mut rx = engine.subscribe();
    Owner::detached().run(|| {
        spawn(async move {
            loop {
                match rx.recv().await {
                    Ok(event) => events(event),
                    Err(RecvError::Lagged(_)) => {
                        // Events were lost: every list reloads.
                        let Some(engine) = slot.upgrade().and_then(|s| s.borrow().clone()) else {
                            return;
                        };
                        let accounts = run(async move { engine.accounts().await }).await;
                        for a in accounts.unwrap_or_default() {
                            events(MailEvent::Changed {
                                account_id: a.id,
                                folder: FolderKind::Inbox,
                            });
                        }
                    }
                    Err(RecvError::Closed) => return,
                }
            }
        })
    });
}

impl LocalBackend {
    /// Copies of the files a draft's `upload`s name, for the engine.
    fn staged_files(&self, draft: &Draft) -> Result<HashMap<String, StagedFile>> {
        Ok(self
            .staged
            .of(draft)?
            .into_iter()
            .map(|(id, f)| {
                let file = StagedFile {
                    filename: f.name.clone(),
                    mime_type: f.mime_type.clone(),
                    data: f.data.clone(),
                };
                (id, file)
            })
            .collect())
    }
}

const CLOUD_ONLY_SOURCES: &str = "webhooks, Gotify and ntfy sources are set up on an AgentInbox \
     server: sign in to cloud mode to add one";
const CLOUD_ONLY_TOKENS: &str =
    "an ingest URL and its test message come from an AgentInbox server: sign in to cloud mode";
const CLOUD_ONLY_KEYS: &str = "API keys for agents are kept on an AgentInbox server: sign in to \
     cloud mode to create one";
const CLOUD_ONLY_DELETE: &str = "a mail account's notifications belong to the account: remove the \
     account in Settings instead";

/// Whether `id` is mail, which moves through the engine rather than the feed's own rows.
fn is_mail(feed: &Feed, id: &str) -> Result<bool> {
    let message = feed.message(id)?;
    Ok(feed.source(&message.source_id)?.is_mail())
}

/// A stored source as the app's type. A kind this build does not know (a newer server's)
/// shows as a webhook: the feed still lists its notifications, and nothing here sends to it.
fn source_of(source: &mail_core::Source) -> Source {
    Source {
        id: source.id.clone(),
        kind: serde_json::from_value(serde_json::Value::String(source.kind.clone()))
            .unwrap_or(SourceKind::Webhook),
        name: source.name.clone(),
        icon: source.icon.clone(),
        color: source.color.clone(),
        enabled: source.enabled,
        config: Some(source.config.clone()),
        min_priority: source.min_priority.clamp(0, 10) as u8,
        created_at: source.created_at,
    }
}

fn notification_of(message: &mail_core::FeedMessage) -> Notification {
    Notification {
        id: message.id.clone(),
        source_id: message.source_id.clone(),
        sender: message.sender.clone().unwrap_or_default(),
        title: message.title.clone(),
        body: message.body_text.clone().unwrap_or_default(),
        link: message.link.clone(),
        received_at: message.received_at,
        priority: message.priority.clamp(0, 10) as u8,
        tags: message.tags.clone(),
        read: message.read_at.is_some(),
        archived: message.archived_at.is_some(),
        thread_id: message.thread_id.clone(),
    }
}

impl Backend for LocalBackend {
    fn start(&self, events: Events) -> MailFuture<'_, ()> {
        Box::pin(async move {
            let (engine, secrets) = open().await?;
            forward(&engine, Rc::downgrade(&self.engine), events.clone());
            *self.feed.borrow_mut() = Some(engine.feed());
            let background_engine = engine.clone();
            run(async move { background_engine.run().await }).await?;
            *self.engine.borrow_mut() = Some(engine);
            if secrets == secrets::Backend::EncryptedFile && cfg!(not(target_os = "android")) {
                events(MailEvent::Error {
                    account_id: None,
                    error: Error::new(
                        ErrorCode::Secrets,
                        "no system keyring: passwords are kept encrypted in the app's folder",
                    ),
                });
            }
            Ok(())
        })
    }

    fn sign_out(&self) -> MailFuture<'_, ()> {
        Box::pin(async move {
            let engine = self.engine()?;
            engine.stop();
            run(async move {
                for a in engine.accounts().await? {
                    engine.remove_account(&a.id).await?;
                }
                Ok(())
            })
            .await?;
            self.engine.borrow_mut().take();
            self.feed.borrow_mut().take();
            Ok(())
        })
    }

    fn accounts(&self) -> MailFuture<'_, Vec<Account>> {
        self.call(|e| async move { e.accounts().await })
    }

    fn detect(&self, email: String) -> MailFuture<'_, Option<ServerSettings>> {
        // Without autoconfig the form still takes the servers by hand.
        self.call(|e| async move {
            match e.detect(&email).await {
                Err(err) if err.code == ErrorCode::Network => Ok(None),
                found => found,
            }
        })
    }

    fn add_imap(&self, input: ImapInput) -> MailFuture<'_, Account> {
        self.call(|e| async move { e.add_imap_account(input).await })
    }

    fn add_oauth(&self, provider: OAuthProvider) -> MailFuture<'_, Account> {
        Box::pin(async move {
            let engine = self.engine()?;
            let e = engine.clone();
            let sign_in = run(async move { e.start_oauth(provider, None).await }).await?;
            if !open_url(sign_in.url.clone()).await {
                return Err(Error::new(
                    ErrorCode::OAuth,
                    format!(
                        "could not open the browser; open {} to sign in",
                        sign_in.url
                    ),
                ));
            }
            run(async move {
                let grant = sign_in.finish().await?;
                engine.add_oauth_account(grant).await
            })
            .await
        })
    }

    fn remove_account(&self, id: String) -> MailFuture<'_, ()> {
        self.call(|e| async move { e.remove_account(&id).await })
    }

    fn set_signature(&self, id: String, signature: Signature) -> MailFuture<'_, Account> {
        self.call(|e| async move { e.set_signature(&id, signature).await })
    }

    fn list(&self, query: ListQuery) -> MailFuture<'_, Vec<Summary>> {
        self.call(|e| async move { e.list(query).await })
    }

    fn older(&self, folder: FolderKind, account: Option<String>) -> MailFuture<'_, Backfill> {
        self.call(|e| async move { e.backfill(account.as_deref(), folder).await })
    }

    fn threads(&self, query: ListQuery) -> MailFuture<'_, Vec<Thread>> {
        self.call(|e| async move { e.threads(query).await })
    }

    fn thread(&self, id: String) -> MailFuture<'_, Vec<Summary>> {
        self.call(|e| async move { e.thread(&id).await })
    }

    fn set_thread_flags(&self, id: String, flags: Flags) -> MailFuture<'_, ()> {
        self.call(|e| async move { e.set_thread_flags(&id, flags).await })
    }

    fn move_thread(&self, id: String, folder: FolderKind) -> MailFuture<'_, ()> {
        self.call(move |e| async move { e.move_thread(&id, folder).await })
    }

    fn get(&self, id: String) -> MailFuture<'_, Message> {
        self.call(|e| async move { e.get(&id).await })
    }

    fn attachment(&self, id: String, index: u32) -> MailFuture<'_, Vec<u8>> {
        self.call(move |e| async move { Ok(e.attachment(&id, index).await?.1) })
    }

    fn set_flags(&self, id: String, flags: Flags) -> MailFuture<'_, ()> {
        self.call(|e| async move { e.set_flags(&id, flags).await })
    }

    fn move_to(&self, id: String, folder: FolderKind) -> MailFuture<'_, ()> {
        self.call(move |e| async move { e.move_to(&id, folder).await })
    }

    fn send(&self, draft: Draft) -> MailFuture<'_, ()> {
        Box::pin(async move {
            let staged = self.staged_files(&draft)?;
            let engine = self.engine()?;
            let sending = draft.clone();
            run(async move { engine.send_with(sending, staged).await }).await?;
            self.staged.sent(&draft);
            Ok(())
        })
    }

    fn queue(&self, draft: Draft, when: SendAt) -> MailFuture<'_, Outgoing> {
        Box::pin(async move {
            let staged = self.staged_files(&draft)?;
            let engine = self.engine()?;
            let queued = draft.clone();
            let outgoing = run(async move { engine.queue(queued, staged, when).await }).await?;
            // The outbox keeps its own copy, in the database.
            self.staged.sent(&draft);
            Ok(outgoing)
        })
    }

    fn outbox(&self) -> MailFuture<'_, Vec<Outgoing>> {
        self.call(|e| async move { e.outbox().await })
    }

    fn cancel(&self, id: String) -> MailFuture<'_, Outgoing> {
        Box::pin(async move {
            let engine = self.engine()?;
            let (mut outgoing, files) = run(async move { engine.cancel(&id).await }).await?;
            for (id, f) in files {
                let file = File {
                    name: f.filename,
                    mime_type: f.mime_type,
                    data: f.data,
                };
                let staged = self.staged.restore(id.clone(), file);
                if staged != id {
                    rename_upload(&mut outgoing, &id, &staged);
                }
            }
            Ok(outgoing)
        })
    }

    fn stage(&self, file: File, progress: Progress) -> MailFuture<'_, Upload> {
        let size = file.data.len() as u64;
        let upload = self.staged.add(file);
        progress(size);
        Box::pin(async move { Ok(upload) })
    }

    fn unstage(&self, id: String) -> MailFuture<'_, ()> {
        self.staged.remove(&id);
        Box::pin(async { Ok(()) })
    }

    fn search(&self, text: String, limit: u32) -> MailFuture<'_, Vec<Summary>> {
        self.call(|e| async move { e.search(&text, limit).await })
    }

    fn unread(&self) -> MailFuture<'_, HashMap<AccountId, u32>> {
        self.call(|e| async move { e.unread().await })
    }

    fn refresh(&self) -> MailFuture<'_, ()> {
        self.call(|e| async move { e.sync_all().await })
    }

    // The notification inbox, as far as one device can serve it: the feed is the mail database's
    // (mail is projected into it), while sources beyond the mail accounts, their ingest URLs and
    // the agent API keys are the server's.

    fn sources(&self) -> MailFuture<'_, Vec<Source>> {
        self.db(|feed| Ok(feed.sources()?.iter().map(source_of).collect()))
    }

    fn feed(&self, query: FeedQuery) -> MailFuture<'_, FeedPage> {
        self.db(move |feed| {
            let before = match &query.before {
                Some(id) => Some(feed.cursor_of(id)?),
                None => None,
            };
            let text = query.text.trim();
            let page = feed.list(&ListFilter {
                source: query.source.clone(),
                unread: query.unread,
                archived: Archived::Hide,
                text: (!text.is_empty()).then(|| text.to_owned()),
                before,
                limit: query.limit.max(1),
                ..ListFilter::default()
            })?;
            let (unread, per_source) = feed.unread()?;
            Ok(FeedPage {
                items: page.messages.iter().map(notification_of).collect(),
                counts: per_source
                    .into_iter()
                    .map(|(id, n)| (id, n.max(0) as u32))
                    .collect(),
                unread: unread.max(0) as u32,
                more: page.more,
            })
        })
    }

    fn mark_read(&self, ids: Vec<String>, read: bool) -> MailFuture<'_, ()> {
        Box::pin(async move {
            let engine = self.engine()?;
            let feed = self.feed()?;
            let mail: Vec<bool> = ids
                .iter()
                .map(|id| is_mail(&feed, id))
                .collect::<Result<_>>()?;
            run(async move {
                for (id, mail) in ids.into_iter().zip(mail) {
                    if mail {
                        // Mail's own flag is the truth, and the server hears it from the engine.
                        let flags = Flags {
                            seen: Some(read),
                            flagged: None,
                        };
                        engine.set_flags(&id, flags).await?;
                    } else {
                        feed.set_read(&id, read)?;
                    }
                }
                Ok(())
            })
            .await
        })
    }

    fn archive(&self, ids: Vec<String>) -> MailFuture<'_, ()> {
        Box::pin(async move {
            let engine = self.engine()?;
            let feed = self.feed()?;
            let mail: Vec<bool> = ids
                .iter()
                .map(|id| is_mail(&feed, id))
                .collect::<Result<_>>()?;
            run(async move {
                for (id, mail) in ids.into_iter().zip(mail) {
                    if mail {
                        // The same move the mail list makes, so the app and an agent agree.
                        engine.move_to(&id, FolderKind::Archive).await?;
                    } else {
                        feed.set_archived(&id, true)?;
                    }
                }
                Ok(())
            })
            .await
        })
    }

    /// A source's own settings are in the local database too: pause, rename, recolour.
    fn update_source(&self, source: Source) -> MailFuture<'_, Source> {
        self.db(move |feed| {
            let patch = mail_core::SourcePatch {
                name: Some(source.name.clone()),
                icon: Some(source.icon.clone()),
                color: Some(source.color.clone()),
                config: source.config.clone(),
                min_priority: Some(i64::from(source.min_priority)),
                enabled: Some(source.enabled),
            };
            Ok(source_of(&feed.update_source(&source.id, &patch)?))
        })
    }

    fn create_source(&self, _input: NewSource) -> MailFuture<'_, CreatedSource> {
        unavailable(CLOUD_ONLY_SOURCES)
    }

    fn delete_source(&self, _id: String) -> MailFuture<'_, ()> {
        unavailable(CLOUD_ONLY_DELETE)
    }

    fn rotate_source_token(&self, _id: String) -> MailFuture<'_, CreatedSource> {
        unavailable(CLOUD_ONLY_TOKENS)
    }

    fn test_source(&self, _id: String) -> MailFuture<'_, ()> {
        unavailable(CLOUD_ONLY_TOKENS)
    }

    fn api_keys(&self) -> MailFuture<'_, Vec<ApiKey>> {
        unavailable(CLOUD_ONLY_KEYS)
    }

    fn create_api_key(&self, _input: NewApiKey) -> MailFuture<'_, CreatedApiKey> {
        unavailable(CLOUD_ONLY_KEYS)
    }

    fn revoke_api_key(&self, _id: String) -> MailFuture<'_, ()> {
        unavailable(CLOUD_ONLY_KEYS)
    }
}

impl Drop for LocalBackend {
    fn drop(&mut self) {
        if let Some(engine) = self.engine.borrow_mut().take() {
            engine.stop();
        }
    }
}
