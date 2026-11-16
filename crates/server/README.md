English | [简体中文](README.zh-CN.md)

# agentinbox-server

Cloud-mode backend for AgentInbox: accounts, mail sync, REST + WebSocket API, push (FCM, Web Push), and the web client's static files. API and design: [docs/design.md](../../docs/design.md) §4–§7.

## Run

```sh
echo "AGENTINBOX_MASTER_KEY=$(openssl rand -base64 32)" > .env
docker compose up -d          # repository root
curl localhost:8080/healthz   # {"ok":true,"version":"0.0.6","sha":"<commit>"}
```

`GET /healthz` reports the release (`app/nsh.json`'s version, baked into the image by CI) and the commit as `sha`; `AGENTINBOX_VERSION` and `AGENTINBOX_GIT_SHA` override either at run time. `cargo run` reports the crate's own version.

Images: `ghcr.io/markbang/agentinbox-server` (API only) and `ghcr.io/markbang/agentinbox` (also serves the web client at `/`), both `latest` and `sha-<commit>` from `main`. The old `ghcr.io/markbang/nsh-mail*` tags stay published for one release cycle, so a deployment can roll back. The container health check runs `agentinbox-server healthcheck` (GET `/healthz`).

Without Docker: `AGENTINBOX_MASTER_KEY=… cargo run -p agentinbox-server`.

Back up `data/` and the master key together; without the key the stored mail credentials cannot be decrypted.

## Configuration

Every setting also answers to its old `NSHMAIL_*` name, so an existing `.env` keeps working.

| Variable | Default | Meaning |
|---|---|---|
| `AGENTINBOX_MASTER_KEY` | required | Base64 of 32 random bytes; encrypts mail credentials (AES-256-GCM). Never change it after accounts exist. |
| `AGENTINBOX_BIND` | `0.0.0.0:8080` | Listen address. |
| `AGENTINBOX_DATA_DIR` | `data` (`/data` in Docker) | `server.sqlite` (users, sessions, devices and every user's mail), per user `users/<id>.secrets.json` (encrypted credentials), generated VAPID key. Old per-user `users/<id>.sqlite` files are imported at start and renamed `*.migrated`; a file that fails to import stops the server and stays untouched. |
| `AGENTINBOX_PUBLIC_URL` | `http://localhost:8080` | External URL; OAuth redirect URIs and the web return page are built from it. |
| `AGENTINBOX_WEB_DIR` | unset | Web client build to serve at `/`, with `app/web/sw.js` copied next to its `index.html` (served with `Service-Worker-Allowed: /`; Web Push needs it). |
| `AGENTINBOX_CORS_ORIGINS` | empty (same origin only) | Comma-separated origins allowed cross-origin, for development. |
| `AGENTINBOX_ALLOW_SIGNUP` | `true` | `false` closes sign-up. |
| `AGENTINBOX_MAX_ATTACHMENTS_MB` | `25` | Most a message's attachments may add up to (1–1024); staged uploads (`uploads/`) expire after a day. |
| `AGENTINBOX_GOOGLE_CLIENT_ID` / `_SECRET` | unset | Google OAuth web client; redirect URI `<PUBLIC_URL>/v1/oauth/google/callback`. |
| `AGENTINBOX_MS_CLIENT_ID` / `_SECRET` | unset | Microsoft OAuth web app; redirect URI `<PUBLIC_URL>/v1/oauth/microsoft/callback`. |
| `AGENTINBOX_FCM_SERVICE_ACCOUNT` | unset (no FCM) | Path to the Firebase service account JSON. |
| `AGENTINBOX_VAPID_PRIVATE_KEY` | generated in data dir | Base64url 32-byte P-256 private key for Web Push. |
| `AGENTINBOX_VAPID_SUBJECT` | `AGENTINBOX_PUBLIC_URL` | `mailto:` or `https:` contact sent to push services (Apple rejects `http:`). |
| `AGENTINBOX_VERSION` | the release baked into the image | What `GET /healthz` reports; a plain `cargo run` reports the crate's own version. |
| `AGENTINBOX_GIT_SHA` | the commit baked into the image | Reported as `sha` by `GET /healthz`; left out when unknown. |
| `RUST_LOG` | `info` | Log filter. Paths only, never query strings or bodies. |

## API additions

- `GET /v1/me`, `PATCH /v1/me {hideContent}` — notification privacy: when on, pushes carry only the kind and the message id.
- `GET /v1/detect?email=` — provider presets and Mozilla autoconfig for the add-account form (`null` when unknown).
- `POST /v1/sync` — sync every account now (pull to refresh).
- `GET /v1/events?device=<id>` — while this socket is open, that device gets no push.
- `GET /v1/oauth/{provider}/start?token=…&return=native|web` — ends at `nshmail://oauth-done?account=<id>` or `<PUBLIC_URL>/?oauth-done&account=<id>`; failures carry `error=<message>`.
- Push data: `{type, id, source, account?, from?, subject?, link?}` — `type` is `newMail` for a mail account's source and `notification` for every other source; a client routes on it (mail message or feed row) and `id` is the feed's id either way. See [Push](#push).
- `GET|POST /v1/sources`, `GET|PATCH|DELETE /v1/sources/{id}`, `POST /v1/sources/{id}/token`, `POST /v1/sources/{id}/test` — notification sources (see [docs/design/notification-inbox.md](../../docs/design/notification-inbox.md)). A mail account is a `kind: "mail"` source created and deleted with the account. Creating a webhook/Gotify/ntfy source answers `{source, token, ingestUrl}` once; `/token` rotates it and the old URL stops working. Create takes `kind`, `name`, `icon`, `color`, `config`, `minPriority`, `preset`, `secret`; patch the same without `kind`, plus `enabled`. A field the API does not know answers `400` with the accepted names, because a field that is silently dropped is a lost mapping. Every mail message is also projected into the feed (`feed_messages`) by triggers in `mail_core`, so list and search behave the same for mail and for ingested notifications.

## Ingestion

Notifications arrive on URLs outside `/v1`; each one is a source, and the token in the URL is shown once:

| Front end | URL | Notes |
|---|---|---|
| Webhook | `POST /hooks/{token}` | JSON, form-encoded or multipart; a preset — `preset` at the top level of the source or `config.preset` (`github`, `gitlab`, `sentry`, `grafana`, `uptime-kuma`) — or `config.mapping` (`sender`, `title`, `body`, `bodyHtml`, `link`, `priority`, `tags`, `externalId` as a path, `a || b` chain, `{{template}}` or literal). Answers `202 {"id": …}`. |
| Gotify | `POST /message` | The token as `?token=`, `X-Gotify-Key` or basic auth (`token` as the password); a JSON, form-encoded or multipart body with `title`, `message`, `priority`, `extras`. Gotify's JSON back. |
| ntfy | `PUT|POST /{topic}` | The topic is the token; ntfy headers, JSON publish or plain body. `GET /{topic}/json` streams NDJSON, replaying from `?since=<seq>`. `POST /` accepts the JSON publish form with `topic` in the body, for clients that post to the server root (Uptime Kuma's ntfy notifier). |

The web client's files sit at the same level as a topic (`/app.<hash>.js`, `/nsh.<hash>.wasm`), so `GET /` and `GET /{topic}` serve them from `AGENTINBOX_WEB_DIR`; only `PUT` and `POST` on those paths are publishes.

Limits per source: 256 KiB a request, 60 messages a minute with a burst of 120. A source's `secret` (write-only, `hasSecret` in responses) turns on the `X-Hub-Signature-256` check for its webhook; it is stored AES-256-GCM in `users/notify.secrets.json`, which key rotation covers like the mail secrets. Ingested HTML goes through the same sanitizer as mail, with remote images removed; `externalId` makes a sender's retry a no-op; duplicates still answer `202` with the existing id.

## Push

Every new notification the feed stores is pushed to the user's devices, whatever its source: mail, webhook, Gotify and ntfy today, and IM sources as they land. Mail's own sync event is one entry and the feed's stream the other; both go through the same payload and a row is sent to a device once.

- **Devices**: FCM tokens (`POST /v1/devices {kind:"fcm", token}`) and Web Push subscriptions (`{kind:"webpush", subscription, vapidKey}`). A device that holds `GET /v1/events?device=<id>` gets nothing — the app shows the notification live — and an endpoint that answers 404/410 is removed.
- **Rules**: a paused source (`enabled: false`) and a message below the source's `minPriority` are stored in the feed and **not** pushed. The per-priority choices in the app (Settings → Notifications → Per source and priority: notify / silent / off) belong to the device and are not yet known to the server, so pausing a source or raising its `minPriority` is what stops its pushes.
- **Privacy**: with `hideContent` on, the push carries `type` and `id` only; the client fetches the rest.
- **Cloud mode only**: local mode has no server, so a phone or browser gets notifications only while the app is open. This is also why push needs a registered device: without one the server has nowhere to send.

## Notification feed

`server.sqlite` gains `sources` and `feed_messages` at start; the migration is idempotent and verifies that the projection holds exactly one row per mail message (drafts and trash excluded). The projection is derived data:

```sh
docker compose exec server agentinbox-server rebuild-feed   # prints counts as JSON
```

Use it if the feed is ever wrong; mail rows are only read. `AGENTINBOX_DATA_DIR` selects the database.

## Agents

Everything that reaches the inbox is one feed; agents read it with an API key, people with their session. Both work on the same routes, so the two cannot disagree.

- **Keys** — `GET|POST /v1/keys`, `DELETE /v1/keys/{id}` (session only). A key is `nb_…`, answered once; only its SHA-256, its first 8 characters (`prefix`), its scope (`read`, plus `write` for marking read and archiving), its sources (empty = all) and its expiry are stored. `lastUsedAt` is stamped at most once a minute; revocation applies to the next request. Send it as `Authorization: Bearer nb_…` or `X-API-Key`.
- **Feed** — `GET /v1/feed?unread=1&source=src_…&q=…&since=…&limit=50&cursor=…` answers `{messages, nextCursor?, more, unread, counts}`; `GET /v1/feed/{id}`, `POST /v1/feed/{id}/read`, `POST /v1/feed/{id}/archive`, and the batches `POST /v1/feed/read` (`{ids, read?}`) and `POST /v1/feed/archive` (`{ids}`) for the app. `since=` takes RFC 3339, milliseconds or a message id; `archived=0|1|any` selects the archived view. Archiving a mail notification moves the message to Archive with the mail engine and hides it from the feed, the same thing the app's Archive button does.
- **Live** — `GET /v1/stream` is SSE (`message`, `read`, `archived`, keep-alive every 15 s); `?format=ws` gives a WebSocket. `message` events carry the feed's `seq` as their id, so `Last-Event-ID` or `?since=` resumes without a gap. `?source=` narrows the stream; a key's scope always applies.
- **MCP** — `POST /mcp` speaks streamable HTTP MCP (`agentinbox-mcp`'s tools) with the same key, answered from this server's own store. The standalone `agentinbox-mcp` binary talks to `/v1` instead.
- **OpenAPI** — `/openapi.json` (generated by `utoipa` from the routes) and `/docs` (Swagger UI, assets built in, so it works without internet). `docs/openapi.json` is committed for agents that have no server to ask:

```sh
cargo run -p agentinbox-server -- openapi > docs/openapi.json   # CI fails when it is stale
```
