[English](README.md) | 简体中文

# agentinbox-server

AgentInbox 云端模式的服务端：账号、邮件同步、REST + WebSocket API、推送（FCM、Web Push），并托管 Web 客户端静态文件。接口与设计见 [docs/design.zh-CN.md](../../docs/design.zh-CN.md) §4–§7。

## 运行

```sh
echo "AGENTINBOX_MASTER_KEY=$(openssl rand -base64 32)" > .env
docker compose up -d          # repository root
curl localhost:8080/healthz   # {"ok":true,"version":"0.0.6","sha":"<commit>"}
```

`GET /healthz` 报告这次发布（`app/nsh.json` 里的版本，由 CI 打进镜像）和提交号 `sha`；运行时可用 `AGENTINBOX_VERSION`、`AGENTINBOX_GIT_SHA` 覆盖。`cargo run` 报告 crate 自己的版本。

镜像：`ghcr.io/markbang/agentinbox-server`（仅接口）和 `ghcr.io/markbang/agentinbox`（同时在 `/` 托管 Web 客户端），都从 `main` 构建，标签为 `latest` 和 `sha-<commit>`。旧的 `ghcr.io/markbang/nsh-mail*` 标签继续发布一个版本周期，便于回滚。容器健康检查运行 `agentinbox-server healthcheck`（GET `/healthz`）。

不用 Docker：`AGENTINBOX_MASTER_KEY=… cargo run -p agentinbox-server`。

`data/` 与主密钥要一起备份；丢了主密钥，已存的邮箱凭据无法解密。

## 配置

所有设置也都接受旧的 `NSHMAIL_*` 名字，已有的 `.env` 无需修改。

| 变量 | 默认值 | 说明 |
|---|---|---|
| `AGENTINBOX_MASTER_KEY` | 必填 | 32 字节随机数的 base64，加密邮箱凭据（AES-256-GCM）。有账号后不能更换。 |
| `AGENTINBOX_BIND` | `0.0.0.0:8080` | 监听地址。 |
| `AGENTINBOX_DATA_DIR` | `data`（Docker 中为 `/data`） | `server.sqlite`（用户、会话、设备和所有用户的邮件）、每个用户的 `users/<id>.secrets.json`（加密的凭据）、自动生成的 VAPID 密钥。旧版每用户的 `users/<id>.sqlite` 启动时导入并改名为 `*.migrated`；导入失败的文件会让服务端拒绝启动，文件保持不动。 |
| `AGENTINBOX_PUBLIC_URL` | `http://localhost:8080` | 对外地址；OAuth 回调地址和 Web 返回页由它生成。 |
| `AGENTINBOX_WEB_DIR` | 未设置 | 在 `/` 托管的 Web 客户端构建目录，需把 `app/web/sw.js` 复制到它的 `index.html` 旁边（带 `Service-Worker-Allowed: /` 响应头；Web Push 需要）。 |
| `AGENTINBOX_CORS_ORIGINS` | 空（仅同源） | 允许跨域的来源，逗号分隔，开发用。 |
| `AGENTINBOX_ALLOW_SIGNUP` | `true` | 设为 `false` 关闭注册。 |
| `AGENTINBOX_MAX_ATTACHMENTS_MB` | `25` | 一封信附件合计大小上限（1–1024）；暂存的上传（`uploads/`）一天后过期。 |
| `AGENTINBOX_GOOGLE_CLIENT_ID` / `_SECRET` | 未设置 | Google OAuth Web 客户端；回调地址 `<PUBLIC_URL>/v1/oauth/google/callback`。 |
| `AGENTINBOX_MS_CLIENT_ID` / `_SECRET` | 未设置 | Microsoft OAuth Web 应用；回调地址 `<PUBLIC_URL>/v1/oauth/microsoft/callback`。 |
| `AGENTINBOX_FCM_SERVICE_ACCOUNT` | 未设置（不发 FCM） | Firebase 服务账号 JSON 的路径。 |
| `AGENTINBOX_VAPID_PRIVATE_KEY` | 在数据目录中自动生成 | Web Push 用的 Base64url 编码 32 字节 P-256 私钥。 |
| `AGENTINBOX_VAPID_SUBJECT` | `AGENTINBOX_PUBLIC_URL` | 发给推送服务的 `mailto:` 或 `https:` 联系方式（Apple 拒绝 `http:`）。 |
| `AGENTINBOX_VERSION` | 镜像里打进的发布版本 | `GET /healthz` 报告的版本；直接 `cargo run` 时报告 crate 自己的版本。 |
| `AGENTINBOX_GIT_SHA` | 镜像里打进的提交号 | `GET /healthz` 以 `sha` 返回；未知时省略。 |
| `RUST_LOG` | `info` | 日志过滤。只记路径，从不记查询串或请求体。 |

## 补充接口

- `GET /v1/me`、`PATCH /v1/me {hideContent}` — 通知隐私：开启后推送只带类型和消息 id。
- `GET /v1/detect?email=` — 添加账号表单用的服务商预设和 Mozilla autoconfig（未知时为 `null`）。
- `POST /v1/sync` — 立即同步全部账号（下拉刷新）。
- `GET /v1/events?device=<id>` — 这个连接打开期间，该设备不再收推送。
- `GET /v1/oauth/{provider}/start?token=…&return=native|web` — 结束时跳到 `nshmail://oauth-done?account=<id>` 或 `<PUBLIC_URL>/?oauth-done&account=<id>`；失败时带 `error=<说明>`。
- 推送数据：`{type, id, source, account?, from?, subject?, link?}` —— 邮件账号的 source 用 `type:"newMail"`，其他来源用 `notification`，客户端按它决定打开邮件还是 feed 里的那条；`id` 两种情况下都是 feed 的 id。详见[推送](#推送)。
- `GET|POST /v1/sources`、`GET|PATCH|DELETE /v1/sources/{id}`、`POST /v1/sources/{id}/token`、`POST /v1/sources/{id}/test` — 通知来源（见 [docs/design/notification-inbox.zh-CN.md](../../docs/design/notification-inbox.zh-CN.md)）。邮件账号就是一个 `kind: "mail"` 的 source，随账号创建和删除。新建 webhook/Gotify/ntfy 来源时返回一次 `{source, token, ingestUrl}`；`/token` 用于轮换，旧地址立刻失效。创建接受 `kind`、`name`、`icon`、`color`、`config`、`minPriority`、`preset`、`secret`；patch 除 `kind` 外相同，另加 `enabled`。接口不认识的字段返回 `400` 并列出可用的字段名——被悄悄丢掉的字段就是丢掉的映射。每封邮件也会被 `mail_core` 里的触发器投影进 feed（`feed_messages`），所以邮件和接收来的通知在列表与搜索里表现一致。

## 接收

通知从 `/v1` 之外的地址进来；每个地址对应一个 source，地址里的 token 只显示一次：

| 入口 | 地址 | 说明 |
|---|---|---|
| Webhook | `POST /hooks/{token}` | JSON、表单或 multipart；用预设——source 顶层的 `preset` 或 `config.preset`（`github`、`gitlab`、`sentry`、`grafana`、`uptime-kuma`）——或 `config.mapping`（`sender`、`title`、`body`、`bodyHtml`、`link`、`priority`、`tags`、`externalId`，取值可以写路径、`a || b` 回退链、`{{模板}}` 或字面量）。返回 `202 {"id": …}`。 |
| Gotify | `POST /message` | token 可以是 `?token=`、`X-Gotify-Key`，或 HTTP basic auth 的密码；请求体可以是 JSON、表单或 multipart，字段 `title`、`message`、`priority`、`extras`。返回 Gotify 的 JSON 结构。 |
| ntfy | `PUT|POST /{topic}` | topic 就是 token；支持 ntfy 请求头、JSON 发布或直接正文。`GET /{topic}/json` 输出 NDJSON，可用 `?since=<seq>` 补发。`POST /` 接受 topic 写在 body 里的 JSON 发布格式，给直接发到服务根地址的客户端用（Uptime Kuma 的 ntfy 通知就是这样）。 |

Web 客户端的文件和 topic 在同一层（`/app.<hash>.js`、`/nsh.<hash>.wasm`），所以 `GET /` 和 `GET /{topic}` 从 `AGENTINBOX_WEB_DIR` 提供这些文件，只有这些路径上的 `PUT` 和 `POST` 才是发布。

每个 source 的限制：单次 256 KiB，每分钟 60 条、突发 120 条。source 的 `secret`（只写，响应里只有 `hasSecret`）会开启 webhook 的 `X-Hub-Signature-256` 校验；它和邮件密钥一样用主密钥 AES-256-GCM 存在 `users/notify.secrets.json`，密钥轮换同样覆盖。接收来的 HTML 走和邮件相同的清洗（远程图片一律去掉）；`externalId` 让发送方的重试变成空操作，重复时同样返回 `202` 和已有的 id。

## 推送

feed 里存下的每一条新通知都会推送到用户的设备，与来源无关：今天的邮件、webhook、Gotify、ntfy 都一样，IM 来源上线后同理。邮件自己的同步事件是一个入口，feed 的事件流是另一个；两者生成同一种负载，同一条通知对同一台设备只推一次。

- **设备**：FCM token（`POST /v1/devices {kind:"fcm", token}`）和 Web Push 订阅（`{kind:"webpush", subscription, vapidKey}`）。打开着 `GET /v1/events?device=<id>` 的设备不收推送（App 正在实时显示）；端点回 404/410 的设备会被删掉。
- **规则**：暂停的来源（`enabled: false`）和低于该来源 `minPriority` 的消息只存进 feed，**不推送**。App 里按优先级设的 notify / silent / off（设置 → 通知 → 按来源与优先级）属于设备自己，服务端还不知道，所以要让某个来源不再推送，请暂停它或提高它的 `minPriority`。
- **隐私**：开启 `hideContent` 后推送只带 `type` 和 `id`，其余由客户端自己取。
- **仅云端模式**：本地模式没有服务端，手机或浏览器只在 App 打开时看到通知。推送需要先注册设备，没有注册的设备服务端无处可发。

## 通知 feed

启动时 `server.sqlite` 会新增 `sources` 和 `feed_messages`；迁移可重复执行，并校验投影里正好每封邮件一行（草稿箱和垃圾箱除外）。投影是派生数据：

```sh
docker compose exec server agentinbox-server rebuild-feed   # 以 JSON 打印行数
```

feed 出错时用它重建，邮件表只读。`AGENTINBOX_DATA_DIR` 指定数据库位置。

## 面向 agent

进到收件箱的一切就是一条 feed；agent 用 API key 读，人用自己的会话读。两种身份走同一批路由，所以两边看到的东西不会不一致。

- **API key** —— `GET|POST /v1/keys`、`DELETE /v1/keys/{id}`（只接受会话）。key 是 `nb_…`，只在创建时返回一次；库里只有它的 SHA-256、前 8 个字符（`prefix`）、权限（`read`，带 `write` 才能标已读和归档）、可访问的 source（为空表示全部）和过期时间。`lastUsedAt` 最多每分钟写一次；撤销后下一个请求即失效。用 `Authorization: Bearer nb_…` 或 `X-API-Key` 发送。
- **Feed** —— `GET /v1/feed?unread=1&source=src_…&q=…&since=…&limit=50&cursor=…` 返回 `{messages, nextCursor?, more, unread, counts}`；另有 `GET /v1/feed/{id}`、`POST /v1/feed/{id}/read`、`POST /v1/feed/{id}/archive`，以及给 App 用的批量接口 `POST /v1/feed/read`（`{ids, read?}`）和 `POST /v1/feed/archive`（`{ids}`）。`since=` 接受 RFC 3339、毫秒或消息 id；`archived=0|1|any` 选择是否看已归档。归档一条邮件通知会用邮件引擎把邮件移到 Archive 并从 feed 里隐藏，和 App 上点“归档”完全一样。
- **实时** —— `GET /v1/stream` 是 SSE（`message`、`read`、`archived`，每 15 秒心跳）；`?format=ws` 给 WebSocket。`message` 事件把 feed 的 `seq` 作为事件 id，所以 `Last-Event-ID` 或 `?since=` 能无缝续传。`?source=` 收窄范围；key 的范围始终生效。
- **MCP** —— `POST /mcp` 用同一个 key 提供 streamable HTTP MCP（`agentinbox-mcp` 的工具），直接由本服务的存储回答。独立的 `agentinbox-mcp` 可执行文件则走 `/v1`。
- **OpenAPI** —— `/openapi.json`（`utoipa` 从路由生成）和 `/docs`（Swagger UI，资源内置，断网也能用）。`docs/openapi.json` 提交在仓库里，给没有服务器可问的 agent：

```sh
cargo run -p agentinbox-server -- openapi > docs/openapi.json   # 过期时 CI 会失败
```
