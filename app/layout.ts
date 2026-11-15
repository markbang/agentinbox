// Which shell shows: the split view from this width up (with the sidebar from
// SIDEBAR_WIDE), the tab bar and pushed pages below it.
import { windowSize } from "nsh";

export const WIDE = 840;
export const SIDEBAR_WIDE = 1080;

export const wide = () => windowSize().width >= WIDE;
export const sidebar = () => windowSize().width >= SIDEBAR_WIDE;
