English | [简体中文](next.zh-CN.md)

## Added

## Improved

- AgentInbox now looks like iOS on every platform: the shell, lists, reader,
  composer, search, settings and the notification inbox are drawn with the shared
  [Cupertino design system](https://github.com/markbang/nsh-cupertino) (`nsh-cupertino`
  0.2.1) — the Material 3 Expressive layer is gone.
- The list's **Select** button starts a selection — rows, their count and Archive,
  Delete and Read — so the actions no longer depend on a long press alone.
- Wide windows are an iPad Mail split view (sidebar, list, reader); narrow windows
  and phones are a tab bar over pushed pages with sheets for compose and settings.

## Fixed

- Sources: `POST /v1/sources` and `PATCH /v1/sources/{id}` take `preset` at the top level as well as in `config`, and refuse a field or preset name they do not know with `400` instead of storing a source that maps nothing.
- Sources and the empty feed described chat bots as a source even though chat sources are not in the app yet; the copy now names only what works today: webhook, Gotify, ntfy and mail.
- Sign out always lands on onboarding: the session ends on this device first, so a backend that cannot finish its teardown (an unreachable server, a stuck task) can no longer leave the app on Settings with every action failing until a restart.
