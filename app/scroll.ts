// Where a page is scrolled, in points. The floating layer reads it: the page's
// navigation group collapses its large title and dissolves the content under it
// with the scroll edge, and the tab bar minimises on the way down and expands on
// the way up.
//
// Each page keeps its own offset (`PageScroll`), so a tab that is hidden keeps
// the place it was left at, and only the page in front moves the tab bar.
import { context, signal } from "nsh";

/** The tab bar's own numbers (nsh-cupertino's `GlassTabBar`): 64 pt, 12 pt above the home indicator. */
export const TAB_BAR_HEIGHT = 64;
export const TAB_BAR_LIFT = 12;
/** The room the tab bar keeps at the foot of a list: its height, its lift and the gesture area. */
export const TAB_BAR_ROOM = "pb-[calc(env(safe-area-inset-bottom)+76px)]";
/** The room a page's floating group keeps at the top of its content: the bar's 44 pt. */
export const PAGE_BAR_ROOM = "pt-11";
/** A list under both: what MessageList and NotificationList take as their `contentClass`. */
export const LIST_ROOM = `${PAGE_BAR_ROOM} ${TAB_BAR_ROOM}`;

/** The scroll edge is absent at rest and full after this much scrolling. */
export const REVEAL_DISTANCE = 26;
/** The large title's block: the compact title takes over over its last 10 pt. */
export const LARGE_TITLE = 52;
export const COLLAPSE_FROM = 44;
export const COLLAPSE_OVER = 10;

/** How a page's scroller reports where it is: its own `Scroll`, or a list that scrolls instead. */
export const PageScroll = context<(points: number) => void>(() => {});

const current = signal(0);

/** The offset of the page in front: what the tab bar follows. */
export const pageOffset = () => current();

/** A still finger sets nothing: halves of a point are all the bars can show. */
export function reportOffset(points: number) {
  const next = Math.round(points * 2) / 2;
  if (next !== current()) current.set(next);
}

/** Back to the top of the page: a new tab, or a page that came back. It reads
 * nothing, so an effect that resets also does not follow every scroll. */
export function resetOffset() {
  current.set(0);
}

/** 0 at rest at the top, 1 once the content has gone under the bar. */
export const revealAt = (points: number) => Math.min(1, Math.max(0, points / REVEAL_DISTANCE));

/** The compact title's opacity: out of the way until the large title has nearly gone. */
export const fadeAt = (points: number) => Math.min(1, Math.max(0, (points - COLLAPSE_FROM) / COLLAPSE_OVER));
