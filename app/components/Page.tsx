// A page's frame: the floating navigation group, the content that runs under
// it, and the scroll edge that dissolves what passes behind. The group is the
// library's floating layer — a 40 pt circle of glass for Back, the compact
// title, a capsule of glass for the actions — over a page whose own scroller
// reports where it is, so a large title collapses into the group and content
// leaves through a ramp rather than a cut.
//
// The tab bar floats over the page too: a tab's own page keeps its room at the
// foot (`TAB_BAR_ROOM`), a pushed page and a sheet do not.
import { effect, Scroll, signal, Text, untracked, View, type JSX, type ScrollRef } from "nsh";
import { t } from "nsh/i18n";
import { Button, Glass, Icon, ScrollEdge } from "cupertino";
import { isModalOpen, NavContext, selectedTab, tabs } from "../nav";
import { LARGE_TITLE, PAGE_BAR_ROOM, PageScroll, TAB_BAR_ROOM, fadeAt, reportOffset, resetOffset, revealAt } from "../scroll";

export interface PageProps {
  title?: string;
  titleTestID?: string;
  /** The 34 pt heading that scrolls away under the group; the compact title fades in over its last 10 pt. */
  largeTitle?: string;
  /** The back button's label; without it there is no back button. */
  back?: string;
  onBack?: () => void;
  /** Something in the back button's place (a selection's Cancel). */
  leading?: JSX.Element;
  /** Controls at the trailing edge, in a capsule of glass. */
  trailing?: JSX.Element;
  /**
   * The page provides its scroll view. `false` when the children scroll
   * themselves (a virtualized list, the composer): they report through
   * `PageScroll`.
   */
  scroll?: boolean;
  /** The page's surface: grouped rows sit on `system-grouped-background`. */
  background?: string;
  children?: JSX.Element;
  testID?: string;
}

export function Page(props: PageProps) {
  const nav = NavContext();
  // A sheet's first page leaves the flow with Done, as iOS's sheets do.
  const done = () => nav.modal && nav.stack.routes().length === 1;
  // The tab bar is over a tab's own page; a pushed page covers it.
  const tabRoom = () => !nav.modal && nav.stack.routes().length === 1;
  const actions = () => props.trailing ?? (done() ? <Button title={t("common.done")} variant="plain" size="medium" onPress={nav.done} testID="modal-done" /> : undefined);
  const leading = () => (props.leading ? props.leading : props.back ? backButton(props.back, props.onBack) : undefined);
  const pageFade = () => (props.largeTitle ? fadeAt(offset()) : 1);
  // This page's place: its own scroller feeds it, and only a page in front passes it on to the tab bar.
  const offset = signal(0);
  const inFront = () => (nav.modal ? isModalOpen() : tabs[selectedTab()].stack === nav.stack);
  const report = (points: number) => {
    offset.set(points);
    if (inFront()) reportOffset(points);
  };
  effect(() => {
    // A page that comes back is where it was left: tell the bar about it, once.
    if (inFront()) reportOffset(untracked(offset));
  });
  // A page that appears for the first time starts at its top.
  resetOffset();
  let scroller: ScrollRef | undefined;
  const toTop = () => scroller?.scrollTo({ y: 0, animated: true });

  return (
    <View class={`flex-1 pt-[env(safe-area-inset-top)] ${props.background === "system-grouped-background" ? "bg-system-grouped-background" : "bg-system-background"}`} testID={props.testID}>
      <PageScroll.Provider value={report}>
        <View class="relative min-h-0 flex-1">
          <If when={props.scroll !== false} else={props.children}>
            <Scroll ref={(ref: ScrollRef) => (scroller = ref)} class="flex-1" onScroll={(event: { offset: { y: number } }) => report(event.offset.y)}>
              <View class={`w-full ${PAGE_BAR_ROOM} ${tabRoom() ? TAB_BAR_ROOM : "pb-[calc(env(safe-area-inset-bottom)+24px)]"}`}>
                <If when={props.largeTitle}>
                  <View class="justify-end px-4" style={{ height: LARGE_TITLE }}>
                    <Text role="header" class="text-largeTitle font-bold text-label">
                      {props.largeTitle}
                    </Text>
                  </View>
                </If>
                {props.children}
              </View>
            </Scroll>
          </If>
          {/* Under the group: what passes behind the controls dissolves into the page. */}
          <View class="pointer-events-none absolute left-0 right-0 top-0 z-10">
            <ScrollEdge edge="top" height={110} reveal={revealAt(offset())} />
          </View>
          {/* The floating group, as iOS 26 draws it: the controls over the page, the title between them. */}
          <View class="absolute left-0 right-0 top-0 z-20">
            <View class="h-11 flex-row items-center gap-2.5 px-4">
              <If when={leading()}>{leading()}</If>
              <View class="flex-1 items-center justify-center" style={{ opacity: pageFade() }}>
                <Text testID={props.titleTestID} class="line-clamp-1 text-headline font-semibold text-label" onPress={toTop}>
                  {props.title ?? ""}
                </Text>
              </View>
              <If when={actions()}>
                <View class="relative h-10 flex-row items-center rounded-full px-1">
                  <View class="pointer-events-none absolute inset-0">
                    <Glass shape="capsule" variant="regular" />
                  </View>
                  {actions()}
                </View>
              </If>
            </View>
          </View>
        </View>
      </PageScroll.Provider>
    </View>
  );
}

/** Back: a circle of glass, its chevron in the tint, as the library draws it. */
function backButton(label: string, onBack?: () => void) {
  return (
    <View role="button" accessibilityLabel={label} onPress={() => onBack?.()} class="size-10 items-center justify-center rounded-full" testID="page-back">
      <View class="absolute inset-0">
        <Glass shape="circle" variant="regular" />
      </View>
      <Icon name="chevron.left" size={20} tint="system-blue" />
    </View>
  );
}
