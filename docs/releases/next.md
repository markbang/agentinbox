English | [简体中文](next.zh-CN.md)

## Added

- **Liquid Glass.** The floating layer is now Apple's iOS 26 material from
  `nsh-cupertino` 0.3.5: the navigation bar, the tab bar, sheets, action sheets,
  alerts and the search field bend and blur what is behind them on the GPU, with
  a specular rim that follows the light. Content stays on solid paper and
  scrolls under the bars; nothing in a list row or a message is glass.
- **Compose is a sheet** on every shell, as Mail has it, with the app's glass
  behind it on a phone.
- **A floating compose button** of glass over the inbox, above the tab bar.
- **Settings has a large title** that scrolls away under its bar, as iOS's pages
  do (the library's `NavPage`).

## Improved

- Search on a large mailbox: about five times faster at 50,000 messages (1–3 ms for a word that matches thousands of them, 10 ms for one that matches every message), with paging past the first 50 results (`before`) and quoted phrases. CJK substrings, prefixes and accented words are covered by tests.
- The tab bar floats over the lists, as Mail's does: rows pass under it, and its
  labels sit above the gesture area, with the bar's glass behind both.
- The search field is glass where it floats over results (the Search tab).

## Fixed

---
