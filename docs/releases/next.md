English | [简体中文](next.zh-CN.md)

## Added

- **The floating tab bar, as iOS 26 draws it.** The bar is now a capsule of
  glass inset from the edges — 64 pt tall, 20 pt in from the sides, 12 pt above
  the home indicator — so lists scroll behind *and around* it, the chosen tab
  sits in a capsule of its own, and a scroll down shrinks it to a small pill
  around that tab while a scroll up brings it back (`nsh-cupertino` 0.4.0's
  `GlassTabBar`).
- **A floating navigation group** on every page: a circle of glass for Back, the
  title in the middle, the page's actions in a capsule of glass beside it, with
  nothing but the page under them.
- **The scroll edge.** Content passing under those controls now dissolves
  through a graduated blur and fade (20 pt of blur at the edge, sharp 110 pt in)
  instead of being cut off, and the effect is off while the page is at its top.

- **Liquid Glass.** The floating layer is now Apple's iOS 26 material from
  `nsh-cupertino` 0.4.0: the navigation bar, the tab bar, sheets, action sheets,
  alerts and the search field bend and blur what is behind them on the GPU, with
  a specular rim that follows the light. Content stays on solid paper and
  scrolls under the bars; nothing in a list row or a message is glass.
- **Compose is a sheet** on every shell, as Mail has it, with the app's glass
  behind it on a phone.
- **A floating compose button** of glass over the inbox, above the tab bar.
- **Settings and Mailboxes have a large title** that scrolls away under the
  floating group, as iOS's pages do.

## Improved

- Search on a large mailbox: about five times faster at 50,000 messages (1–3 ms for a word that matches thousands of them, 10 ms for one that matches every message), with paging past the first 50 results (`before`) and quoted phrases. CJK substrings, prefixes and accented words are covered by tests.
- The tab bar and the page's bar float over the content, as iOS 26 has them:
  rows pass under both, the labels and the title never sit over a hard cut, and
  the lists keep the room they need at either end.
- The search field is glass where it floats over results (the Search tab).

## Fixed

- Push reaches every source, not only mail: a webhook, Gotify or ntfy notification
  now arrives on your phones and browsers while the app is closed, with the
  source, sender, title and link. A paused source, or one whose minimum priority
  is above the notification's, keeps it in the feed. A notification read or
  archived on another device is not pushed.
- `GET /healthz` reports the release's version and the commit it was built from,
  not the server crate's `0.1.0`.

---
- **GitHub, Uptime Kuma and Sentry sources keep every real event.** An issue that opens and closes is two notifications, a second outage of the same monitor is not swallowed, and Sentry's issue webhook no longer arrives as ": " with priority 0. Gotify clients may now authenticate with `X-Gotify-Key` or basic auth and post forms (`curl -F`), ntfy publishes without a priority arrive as the normal priority 3, and Uptime Kuma's ntfy notifier works when its URL points at the server root.
