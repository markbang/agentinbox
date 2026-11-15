// The split view, as Mail draws it on an iPad: the sidebar, the list column
// and the reader. Windows narrower than the sidebar's breakpoint keep the
// list and the reader and open the mailboxes in a sheet.
import { signal, View, type InputRef } from "nsh";
import { t } from "nsh/i18n";
import { Button, Sheet } from "cupertino";
import { Empty, Loading } from "./Empty";
import { MailboxPane } from "./MailboxPane";
import { NotificationsPane } from "./NotificationsView";
import { NotificationReader } from "./NotificationReader";
import { Reader } from "./Reader";
import { Sidebar } from "./Sidebar";
import { sidebar } from "../layout";
import { notificationsSection, openNotification, showMail, sourceById } from "../notify";
import { archiveNotifications, markNotifications } from "../notify";
import { conversation, current, selectedId, shownMessage, openMessage } from "../store";
import type { ComposeMode } from "../lib/format";

export interface WorkspaceProps {
  onCompose: (mode: ComposeMode) => void;
  onSettings: () => void;
  onAddAccount: () => void;
  onAddSource: () => void;
  onSources: () => void;
  searchRef: (ref: InputRef) => void;
}

export function Workspace(props: WorkspaceProps) {
  const sheet = signal(false);
  const open = () => shownMessage();
  const mailboxes = () => (sidebar() ? undefined : () => sheet.set(true));
  return (
    <View class="flex-1 flex-row bg-system-grouped-background pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <If when={sidebar()}>
        <View class="w-[286px]">
          <Sidebar onSettings={props.onSettings} />
        </View>
      </If>
      <View class={`flex-row bg-system-background ${sidebar() ? "flex-1 rounded-l-[10px] overflow-hidden" : "flex-1"}`}>
        <View class="w-[380px] border-r border-separator">
          <If
            when={notificationsSection()}
            else={<MailboxPane onOpen={(row) => openMessage(row.latest.id)} onAddAccount={props.onAddAccount} onCompose={() => props.onCompose("new")} searchRef={props.searchRef} highlight onMailboxes={mailboxes()} testID="mail-list-pane" />}
          >
            <NotificationsPane onAddSource={props.onAddSource} onAddAccount={props.onAddAccount} onOpenSources={props.onSources} onMailboxes={mailboxes()} />
          </If>
        </View>
        <View class="min-w-0 flex-1">
          <If when={notificationsSection()} else={mailDetail()}>
            {notificationDetail()}
          </If>
        </View>
      </View>
      <Sheet open={sheet()} detent="large" title={t("tabs.folders")} onOpenChange={({ open }: { open: boolean }) => sheet.set(open)}>
        <Sidebar onSettings={() => (sheet.set(false), props.onSettings())} />
      </Sheet>
    </View>
  );

  function mailDetail() {
    return (
      <If
        when={open()}
        else={
          <If
            when={current.error()}
            else={
              <If when={selectedId()} else={<Empty icon="envelope.open" title={t("reader.none")} description={t("reader.noneHint")} />}>
                <Loading label={t("reader.loading")} />
              </If>
            }
          >
            <Empty
              icon="exclamationmark.triangle"
              title={t("reader.failed")}
              description={t("reader.failedHint")}
              action={<Button title={t("actions.retry")} variant="tinted" icon="arrow.clockwise" onPress={() => current.refetch()} testID="reader-retry" />}
            />
          </If>
        }
      >
        {(m) => (
          <Each of={[m()]} key={(x) => x.id}>
            {(message) => <Reader message={message()} conversation={conversation()} onCompose={props.onCompose} toolbar />}
          </Each>
        )}
      </If>
    );
  }

  function notificationDetail() {
    return (
      <If when={openNotification()} else={<Empty icon="bell" title={t("notify.noSelection")} description={t("notify.noSelectionHint")} />}>
        {(n) => (
          <Each of={[n()]} key={(x) => x.id}>
            {(note) => (
              <NotificationReader
                note={note()}
                source={sourceById(note().sourceId)}
                onToggleRead={() => void markNotifications([note().id], !note().read)}
                onArchive={() => archiveNotifications([note().id])}
                onOpenMail={note().threadId ? () => (showMail(), openMessage(note().id)) : undefined}
              />
            )}
          </Each>
        )}
      </If>
    );
  }
}
