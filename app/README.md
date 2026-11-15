# AgentInbox app

The client: TSX screens over a Rust crate that exports `agentinbox/native` (the `Mail` module of
[docs/design.md](../docs/design.md) §3). Design system and motion: [DESIGN.md](DESIGN.md) — Cupertino, from the
[`nsh-cupertino`](https://github.com/markbang/nsh-cupertino) library vendored as `vendor/nsh-cupertino`.

```
App.tsx          shell: onboarding, split view (wide) or tab bar (phones, narrow web), the sheet, keys, toasts
store.ts         TSX state: mirrors of Rust's status, accounts and messages; mailbox, selection, search
nav.ts           the tab stacks and the wide layout's sheet stack
resident.ts      tray, close-to-tray, new-mail notifications
pages/           one Page each
components/      what pages share (message list, reader, sidebar), built from `cupertino`
locales/app.yml  en and zh-CN
src/             the crate: Mail, the Backend trait, LocalBackend, CloudBackend, DemoBackend (debug builds)
tests/           local mode end to end against GreenMail
web/sw.js        the Web Push service worker, copied next to the web build's index.html
.e2e/            cloud mode end to end against agentinbox-server and GreenMail (`nsh test` skips it)
```

`Mail` runs on a `Backend` and speaks `mail_core::types` (as JSON, declared for TSX in `src/types.rs`).
`LocalBackend` (Linux, Windows, Android) is mail-core on the device: `mail.sqlite` in the app's data directory,
passwords in the OS keyring or, without one (and on Android), in an encrypted file beside it. `CloudBackend` (every
platform) talks to an AgentInbox server: REST through NSH's `fetch`, events over a WebSocket that reconnects with backoff
(tokio-tungstenite natively, the browser's through NSH on the web), the session token in the same secret stores or, on
the web, in the page's storage. A provider's sign-in opens the server's `/v1/oauth/{provider}/start` in the browser and
comes back on `nshmail://oauth-done` (on the web, in a window that hands the result over a `BroadcastChannel`). On the
web it subscribes to Web Push once notifications are allowed. It does not cache lists and bodies on the device yet.
`DemoBackend` keeps a few weeks of mail in memory for the UI tests (`nshmail.mode` = `demo` in `Storage`); release
builds do not contain it. Gmail and Outlook sign-in in local mode need `AGENTINBOX_GOOGLE_CLIENT_ID` (and
`AGENTINBOX_GOOGLE_CLIENT_SECRET`) and `AGENTINBOX_MS_CLIENT_ID` at build time (their older
`NSHMAIL_*` spellings still work); without them, pressing one says so.

HTML mail shows in NSH's `WebView` (`components/MailView.tsx`), so where the app runs it needs a web engine: WebKitGTK
6.0 on Linux (`libwebkitgtk-6.0-4` on Debian and Ubuntu; GNOME desktops have it), the WebView2 Runtime on Windows
(part of Windows 11; Edge installs it on Windows 10) and the system WebView on Android. Without one the reader shows
the mail's text.

```sh
nsh check                   # cargo check, then tsc against the generated declarations
nsh test                    # cargo test, then App.test.tsx headless
                            # GREENMAIL_HOST=127.0.0.1 also runs tests/greenmail.rs against a GreenMail
                            # (java -Dgreenmail.setup.test.all -Dgreenmail.auth.disabled -jar greenmail-standalone.jar)
nsh run                     # this machine; --target web needs wasm32-unknown-unknown, clang and llvm-ar
nsh package --target web    # needs wasm-bindgen-cli of the version Cargo.toml pins
cp web/sw.js .nsh/out/AgentInbox/  # nsh ships no extra files; the server serves it as /sw.js
nsh package --target android --abi arm64-v8a  # preview APK; releases are the AAB (--format aab), see android/README.md
GREENMAIL_JAR=… .e2e/run.sh # cloud mode end to end; or with GreenMail already on 3993 / 3465
```

Run `nsh package` from this directory: release builds take their size profile from `.cargo/config.toml` (z, fat LTO).

The web client is meant to be served by its server (`AGENTINBOX_WEB_DIR`; the old `NSHMAIL_WEB_DIR`
still works), so it signs in to the page's own origin by
default and needs no CORS.

## Names kept for upgrades

The rename to AgentInbox leaves what existing installs depend on untouched: the Android id
`top.bangwu.nshmail`, the `nshmail://` URL scheme (the server's OAuth return URLs and the Android
manifest use it), the `Storage` keys (`nshmail.mode`, `nshmail.threads`, … the user's settings),
the `nshmail_demo` build cfg and the OS keyring entry `nsh-mail` (where local mode stored
credentials).
