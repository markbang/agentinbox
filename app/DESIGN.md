# AgentInbox client design

Calm, dense and quiet: a mail app people keep open all day. Content carries the
screen; colour is spent on unread, flags, the account a message belongs to, and
the one action that matters.

The client is **Cupertino** on every platform — one design system, the shared
[`nsh-cupertino`](https://github.com/markbang/nsh-cupertino) library (pinned as
the `vendor/nsh-cupertino` submodule). The app does not restyle anything the
library draws: it composes the library's components and tokens, and keeps its own
compositions to mail-specific parts (a conversation row, an account mark) built
from the same tokens.

## Targets

One look everywhere; only the shell changes with the window.

| Width | Shell |
| --- | --- |
| 1080 pt and up | **Split view**, as Mail on an iPad: the sidebar (286 pt: notifications, mailboxes, folders, sync status), the list column (380 pt: the mailbox's rows or the feed, with the search field) and the reader (the rest). Columns are separated by hairlines on `system-grouped-background`. |
| 840–1080 pt | Split view without the sidebar: the list column and the reader; the mailboxes open in a large sheet from the tray button in the list's bar. |
| Below 840 pt (phones and narrow windows) | **Tab bar** (Mail, Notifications, Search, Mailboxes, Settings) over a navigation stack per tab. Pages push from the right with a back button, cover the bar, and keep the reader's toolbar at the foot. The bar floats over the lists, and the Mail tab carries a floating compose button above it. |

Pages that are tasks rather than places — compose, settings, adding an account,
sources, keys, rules, shortcuts — open as a **sheet** with a stack of their own:
Done at the root, back inside. Compose is a sheet on every shell, as Mail has it;
the other tasks push on a phone's tab.

Android keeps the platform's back gesture and hardware button: the app registers
no back handler, so a page never swallows them; the tabs' Mail tab is the first
stop. Nothing Material remains: no ripples, no M3 shapes.

## Liquid Glass

Liquid Glass is the app's design language, not a material: the floating layer
moves out of the content's way as the page scrolls. It comes from `nsh-cupertino`
0.4.0 (`Glass`, `GlassTabBar`, `ScrollEdge`, the floating navigation group).

- **The tab bar is a capsule that floats** (`GlassTabBar`): 64 pt tall, radius
  32, 20 pt in from the sides and 12 pt above the home indicator, so the page
  scrolls behind *and around* it. The chosen tab sits in a capsule of its own; a
  20 pt scroll down minimises the bar to a 50 pt pill around that tab, a 12 pt
  scroll up expands it, and the top of a page always expands it (UIKit's
  `MinimizeBehavior.on-scroll-down`). Mail's floating compose button sits above
  it, in the same stack.
- **A page's bar is a floating group**: a 40 pt circle of glass for Back, the
  compact title in the middle (press it to scroll to the top), a capsule of
  glass for the page's actions, 16 pt in from the edges, 44 pt tall. A page with
  a large title (Settings, Mailboxes) scrolls it away under the group and fades
  the compact title in over its last 10 pt, as `NavPage` does.
- **Content dissolves under the group** (`ScrollEdge`): progressive blur, 20 pt
  at the edge and sharp 110 pt in, fading into the page's background, and a
  reveal that runs 0 → 1 over the first 26 pt of scroll, so at rest at the top
  there is nothing to dissolve.
- **Where it may be used**: those two bars, the floating compose control,
  sheets, action sheets, alerts, and the search field where it floats over
  results. Bars are `regular`, sheets and alerts `thick`.
- **Where it may not**: never on content. A list row, a message body, a form, the
  reader's white card and the page backgrounds stay solid — the HIG's rule, and
  what keeps text legible.
- **The room it takes**: a page's content keeps 44 pt at the top (`pt-11`, the
  page's own padding, or the list's `contentClass`) so the first row sits below
  the group and later rows pass behind it; a tab's own page keeps
  `TAB_BAR_ROOM` (64 + 12 + the safe area) at the foot, and a pushed page or a
  sheet keeps only the safe area and 24 pt, since the bar is not over it.
- **One scroller per page reports where it is** (`app/scroll.ts`): the page's own
  scroll view, or the virtualized list that scrolls instead. The group, its large
  title and the scroll edge read that offset, and so does the tab bar; a page
  that appears starts at 0.
- **Fallbacks are the library's**: without a GPU the material's fill and backdrop
  blur draw instead; Increased Contrast makes the fills near opaque; Reduce
  Motion drops the press springs, the squash and the minimise spring. The app
  adds no path of its own.
- **The app draws its own group**, from the library's parts (`Glass`,
  `ScrollEdge`, `Icon`, `Button`) at the library's numbers: a 40 pt circle, a
  44 pt row 16 pt in from the edges, a 40 pt capsule for the actions. A page here
  scrolls with its own virtualized list — or the composer's fixed layout — and
  carries up to four trailing controls, and the library's `NavPage` takes one
  scroll view and one trailing label. Settings ran on `NavPage` before this, so
  the two were compared frame by frame; the group is the same shape.
- **The web needs the runtime patch** (`vendor/nsh-cupertino/tools/patch-runtime.mjs`)
  until NSH binds both stages' shader blocks; CI runs it after `nsh package --target web`.

## The list

Rows are iOS Mail's: an unread dot in a lane of its own, the sender (semibold
while unread), the conversation's message count, the date at the trailing edge,
the subject with its attachment and flag marks, and a preview. Wide windows show
one preview line, phones two. The account is a 3 pt bar in its colour on the
leading edge of a unified row. A selected row takes `fill`; a press flashes it.
Swiping right reveals Archive (teal), left Delete (red), a full swipe fires the
first. **Select** in the bar starts a selection (a long press does too, where
the gesture reaches the row), and the bar turns into the selection's actions.

The list is virtualized (`nsh`'s `List`): a 10,000-message mailbox keeps the rows
on screen bounded (the large-mailbox test holds it to 300 texts). That is the one
place the app keeps its own scroll container instead of the library's `List`,
which is for settings pages; its rows are drawn with the library's tokens.

## The reader

The subject in title 2, the sender with a monogram, the recipients, the date and
account, then the body: HTML in a web view on a white card (mail is designed on
white and its colours are not inverted in dark mode), or plain text. Remote
images stay blocked until the reader asks. A conversation lists its older
messages above the open one and its newer ones below, a page at a time. Attachments
are 160 pt tiles with an icon or a thumbnail. The actions sit in the bar at the
foot: reply, forward, flag, read, archive, delete.

## The composer

A sheet (a pushed page on a phone) with Close, the title, the clock and Send in
its bar: From, To, Cc/Bcc, Subject as labelled lines, the body as the page, the
attachments as tiles at the foot. Closing keeps the draft; Discard asks. The clock
offers Tomorrow morning, Monday morning, or a day and a time of its own in a
sheet with the calendar and two wheels. Send waits out the undo delay with Undo.

## Tokens

The library's, unmodified, generated from its `src/tokens.rs` into
`theme/theme.json`:

- **Colour**: Apple's semantic roles. The app's own `app/theme.json` is that file
  with exactly three light-appearance overrides, as the library's
  [issue #3](https://github.com/markbang/nsh-cupertino/issues/3) records:
  `system-blue` `#0062d6`, `system-red` `#d70015`, `secondary-label` at 72 %
  alpha. `scripts/theme-check.py` keeps the copy honest and `scripts/contrast.py`
  gates what the app draws (4.5:1 for text, 3:1 for marks) in both appearances.
- **Type**: largeTitle 34, title1 28, title2 22, title3 20, headline 17, body 17,
  callout 16, subheadline 15, footnote 13, caption1 12, caption2 11 — as classes
  from `nsh.json`'s `fontSize` (`text-title2` …), never raw sizes.
- **Layout**: `space-1…6`, `row-height` 44, the 0.33 pt hairline, `rounded-row`
  10, `rounded-sheet` 14, `rounded-button` 12, `rounded-search` 9.
- **Motion**: the library's springs and durations (push 500 ms 0.86/300, sheet
  0.8/400, pressed opacity 0.4, quick 150, base 300); reduce motion is honoured by
  the library.
- **Materials**: `regular` for the navigation bar, the tab bar and the toasts,
  `thick` for sheets and alerts, `chrome` for the reader's toolbar; the glass
  fills (`glass-regular`, `glass-clear`, `glass-thick`) follow the appearance
  and Increased Contrast.

## The app's own parts

`app/components/` holds only compositions of library components and tokens:
`MessageList` (the virtualized rows), `MailboxPane` (bar, search, list), `Reader`,
`Sidebar`, `Toolbar`, `Marks` (account tones, unread dot, count, monogram),
`SourceMark` (a source's tone and icon), `Empty` / `Loading`, `Toasts`, `Fields`
(labelled rows and a choice row that opens an action sheet), `Page` (a navigation
bar and its content), `ScheduleDialog`, `ShortcutsDialog`. Identity tones are
system roles (`system-indigo`, `-purple`, `-pink`, `-blue`, `-red`), each at least
3:1 on the surfaces a mark sits on.

Nothing outside `app/components/` and `app/pages/` draws a colour, a size or a
radius: features pass variants and states.

## States

Every list, the reader and a form say what they are doing:

| Where | Empty | Loading | Failed |
| --- | --- | --- | --- |
| A mailbox | the folder's icon, what it is, the one action that fills it (compose / add account) | `ActivityIndicator` with the task's name | the error, and Retry |
| The reader | "No message selected" | spinner | the error, and Retry |
| Search | the hint before typing, "Nothing found" after | spinner | the error, and Retry |
| The feed | no sources / no accounts / filter found nothing, each with its next step | spinner | the error, and Retry |
| Sync | — | the spinner and progress in the sidebar's foot | a red strip under the bar with Retry |

## Accessibility

- Every row is a button whose name carries its state ("Unread, Jonas Weber,
  Q4 roadmap draft, 12:33 AM"); lists and groups are labelled; headers are
  headers.
- Icon-only controls always have a name (archive, delete, flag, mark read); the
  marks are hidden from screen readers.
- Tab reaches every control with the library's focus ring; Escape and the Android
  back gesture go back through the stacks.
- Text follows the user's text size; the library's components lay out at large
  sizes.

## Keys

`c` compose, `r` reply, `/` search, `j`/`k` next/previous message, `e` archive,
`shift+3` delete, `?` the shortcut sheet, `mod+enter` send, `escape` close. Bound
through `nsh`'s `keymap`, never while typing or with a sheet open.
