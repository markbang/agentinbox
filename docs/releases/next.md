English | [简体中文](next.zh-CN.md)

## Added

## Improved

## Fixed

- Sources: `POST /v1/sources` and `PATCH /v1/sources/{id}` take `preset` at the top level as well as in `config`, and refuse a field or preset name they do not know with `400` instead of storing a source that maps nothing.
- Sources and the empty feed described chat bots as a source even though chat sources are not in the app yet; the copy now names only what works today: webhook, Gotify, ntfy and mail.
- Sign out always lands on onboarding: the session ends on this device first, so a backend that cannot finish its teardown (an unreachable server, a stuck task) can no longer leave the app on Settings with every action failing until a restart.
