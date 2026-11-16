// Navigation. Wide windows keep a split view (sidebar, list, reader) and open
// compose, settings and the rest in a sheet with a stack of its own; phones
// and narrow windows push every screen on its tab's stack.
import { context, signal } from "nsh";
import { createNavStack, type NavStackState } from "nsh/base";
import type { ApiKey, Source, SourceKind } from "agentinbox/native";
import type { ComposeInit } from "./lib/format";

export type Route =
  | { name: "inbox" }
  | { name: "notifications" }
  | { name: "notification"; id: string }
  | { name: "sources" }
  | { name: "addSource" }
  | { name: "sourceForm"; kind: SourceKind }
  | { name: "sourceIngest"; source: Source; url: string; created: boolean }
  | { name: "apiKeys" }
  | { name: "newKey" }
  | { name: "keyCreated"; key: ApiKey; token: string }
  | { name: "notifyRules" }
  | { name: "message"; id: string }
  | { name: "compose"; init: ComposeInit }
  | { name: "search" }
  | { name: "folders" }
  | { name: "settings" }
  | { name: "addAccount" }
  | { name: "signature"; account: string }
  | { name: "imap" };

/** The phone's stack: the only one in a narrow browser, the Mail tab's on iOS and Android. */
export const phoneStack = createNavStack<Route>([{ name: "inbox" }]);
/** The wide layout's sheet: compose, settings and the pages they open. */
export const modalStack = createNavStack<Route>([{ name: "settings" }]);

const modalOpen = signal(false);
export const isModalOpen = () => modalOpen();

export interface Navigator {
  stack: NavStackState<Route>;
  /** Leaves the screen: pops it, or closes the sheet at its root. */
  close: () => void;
  /** Leaves the whole flow: back to the inbox, or the sheet closed. */
  done: () => void;
  /** Screens in a sheet draw a close button instead of back at their root. */
  modal: boolean;
}

export const NavContext = context<Navigator>({
  stack: phoneStack,
  close: () => phoneStack.pop(),
  done: () => phoneStack.popToRoot(),
  modal: false,
});

export const phoneNavigator: Navigator = {
  stack: phoneStack,
  close: () => phoneStack.pop(),
  done: () => phoneStack.popToRoot(),
  modal: false,
};

export const modalNavigator: Navigator = {
  stack: modalStack,
  close: () => (modalStack.routes().length > 1 ? modalStack.pop() : modalOpen.set(false)),
  done: () => modalOpen.set(false),
  modal: true,
};

function stackNavigator(stack: NavStackState<Route>): Navigator {
  return { stack, close: () => stack.pop(), done: () => stack.popToRoot(), modal: false };
}

/** The tabs' positions, as the screens switch between them. */
export const TAB = { mail: 0, notifications: 1, search: 2, folders: 3, settings: 4 } as const;

/** The tab bar's sections in order, each with its own stack, so each keeps its pages and scroll position. */
export const tabs = (["mail", "notifications", "search", "folders", "settings"] as const).map((name) => {
  const stack = name === "mail" ? phoneStack : createNavStack<Route>([{ name }]);
  return { name, stack, navigator: name === "mail" ? phoneNavigator : stackNavigator(stack) };
});

const tabIndex = signal(0);
export const selectedTab = () => tabIndex();
export function selectTab(index: number) {
  tabIndex.set(index);
}

/** Opens `route` as the wide layout or the narrow layout shows it. */
export function show(route: Route, wide: boolean) {
  if (!wide) {
    tabIndex.set(0);
    phoneStack.push(route);
    return;
  }
  modalStack.setRoutes([route]);
  modalOpen.set(true);
}

/** Compose opens as a sheet on every shell, as Mail does: a task, not a place on a tab's stack. */
export function openCompose(init: ComposeInit) {
  modalStack.setRoutes([{ name: "compose", init }]);
  modalOpen.set(true);
}

export function closeModal() {
  modalOpen.set(false);
}
