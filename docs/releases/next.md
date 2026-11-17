English | [简体中文](next.zh-CN.md)

## Added

- **Liquid Glass, as iOS 26 has it.** The floating layer is Apple's glass from
  `nsh-cupertino` 0.4.1 — the tab bar, the page's navigation controls, sheets,
  action sheets, alerts and the search field where it floats — bending, blurring
  and tinting what is behind them on the GPU, with a lit rim that follows the
  light. Content stays on solid paper: a list row, a message body, the reader's
  white mail card and the page backgrounds are never glass.
- **A tab bar that floats.** The bar is a capsule inset from the edges — 64 pt
  tall, 20 pt in from the sides, 12 pt above the home indicator — so lists
  scroll behind *and around* it. The chosen tab sits in a capsule of its own; a
  scroll down shrinks the bar to a small pill around that tab, a scroll up brings
  it back, and the top of a page always expands it. Mail's floating compose
  button sits above it.
- **An unread count on the Notifications tab**, as iOS badges a tab: the count
  of unread notifications in the feed, capped at 99+.
- **A floating navigation group on every page**: a circle of glass for Back, the
  title in the middle (press it to scroll to the top), the page's actions in a
  capsule of glass beside it, and nothing but the page under them. A large title
  scrolls away and the compact title fades into the group — Settings and
  Mailboxes keep theirs.
- **The scroll edge.** Content passing under those controls dissolves through a
  graduated blur and fade — 20 pt of blur at the edge, sharp 110 pt in, fading
  into the page's own background — and the effect is off while a page rests at
  its top.
- **Compose is a sheet** on every shell, as Mail has it, with the app's glass
  behind it on a phone.

## Improved

- Search on a large mailbox: about five times faster at 50,000 messages (1–3 ms for a word that matches thousands of them, 10 ms for one that matches every message), with paging past the first 50 results (`before`) and quoted phrases. CJK substrings, prefixes and accented words are covered by tests.
- The lists keep the room the floating bars need: 44 pt at the top of a page and
  64 + 12 + the safe area at the foot of a tab's own page, so the first row sits
  below the group, the last clears the bar, and rows in between pass behind both.
- Typing hides the tab bar instead of the bar riding up on the keyboard, and the
  composer's footer (attach, discard) rides on the keyboard rather than under it.
- The reader's toolbar has a hairline, so it reads as a bar on the white mail card.
- The search field is glass where it floats over results (the Search tab).
- The Android screenshots that check every release come from a run that stops at the first broken
  screen and names it, in a fraction of the time it took.

## Fixed

- The snackbar sat under the floating compose button: a tap meant for Undo
  opened the composer instead. It sits above both now.
- A composer opened before the accounts had loaded (right after signing in) no
  longer answers "Add an account before sending mail." over an account that is
  already on its way: the draft takes the first account that arrives.
- Push reaches every source, not only mail: a webhook, Gotify or ntfy notification
  now arrives on your phones and browsers while the app is closed, with the
  source, sender, title and link. A paused source, or one whose minimum priority
  is above the notification's, keeps it in the feed. A notification read or
  archived on another device is not pushed.
- `GET /healthz` reports the release's version and the commit it was built from,
  not the server crate's `0.1.0`.

---
- **GitHub, Uptime Kuma and Sentry sources keep every real event.** An issue that opens and closes is two notifications, a second outage of the same monitor is not swallowed, and Sentry's issue webhook no longer arrives as ": " with priority 0. Gotify clients may now authenticate with `X-Gotify-Key` or basic auth and post forms (`curl -F`), ntfy publishes without a priority arrive as the normal priority 3, and Uptime Kuma's ntfy notifier works when its URL points at the server root.
