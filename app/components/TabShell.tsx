// Phones and narrow windows: iOS's floating tab bar over a navigation stack per
// section (Mail, Notifications, Search, Mailboxes, Settings), each kept while
// another shows. The bar is a capsule of glass inset from the edges, so the
// pages scroll behind and around it, and it minimises to a pill around the
// chosen tab as the page scrolls down. Pushed pages cover it, as they do on iOS.
import { effect, platform, signal, untracked, View, type JSX } from "nsh";
import { BackHandler } from "nsh/mobile";
import { NavStack } from "nsh/base";
import { t } from "nsh/i18n";
import { GlassButton, GlassTabBar } from "cupertino";
import { NavContext, openCompose, selectedTab, selectTab, tabs, TAB, type Route } from "../nav";
import { pageOffset, resetOffset } from "../scroll";
import { picking } from "../store";
import { Toasts } from "./Toasts";

const navIcons = { mail: "tray", notifications: "bell", search: "magnifyingglass", folders: "folder", settings: "slider.horizontal.3" } as const;

export function TabShell(props: { page: (route: Route) => JSX.Element }) {
  const depth = () => tabs[selectedTab()].stack.routes().length;
  // Android back on a tab's first page goes to Mail first; the stacks pop before that. A browser has no back button to hear.
  if (platform.os === "ios" || platform.os === "android") {
    BackHandler.on("press", () => {
      if (selectedTab() === TAB.mail || depth() > 1) return false;
      selectTab(TAB.mail);
      return true;
    });
  }
  const choose = (index: number) => {
    // Choosing the tab already shown goes back to its first page.
    if (index === selectedTab()) tabs[index].stack.popToRoot();
    selectTab(index);
  };
  const opened = signal<Record<number, boolean>>({ 0: true });
  effect(() => {
    const index = selectedTab();
    if (!untracked(opened)[index]) opened.update((o) => ({ ...o, [index]: true }));
  });
  const covered = () => depth() > 1;
  // A page that comes back, or a tab's first page, is at its top: the bar expands.
  effect(() => {
    tabs[selectedTab()].stack.routes().length;
    resetOffset();
  });
  return (
    <View class="h-full flex-col overflow-hidden bg-system-background">
      {/* min-h-0: a long list must scroll inside the pane, not push the bar off the screen. */}
      <View class="min-h-0 flex-1">
        <Each of={tabs} key={(tab) => tab.name}>
          {(tab, index) => (
            <View class={index() === selectedTab() ? "flex-1" : "hidden"}>
              <If when={opened()[index()]}>
                <NavContext.Provider value={tab().navigator}>
                  <NavStack state={tab().stack} class="flex-1" testID={`tab-${tab().name}`}>
                    {props.page}
                  </NavStack>
                </NavContext.Provider>
              </If>
            </View>
          )}
        </Each>
        <Toasts class={covered() ? "bottom-4" : "bottom-28"} />
      </View>
      {/* Mail's compose control floats above the bar, in the same stack so neither covers the other's taps. */}
      <If when={!covered()}>
        <If when={selectedTab() === TAB.mail && !picking()}>
          <View class="absolute bottom-0 left-0 right-0 items-end pr-5 pb-[calc(env(safe-area-inset-bottom)+88px)]">
            <View class="h-14 w-14">
              <GlassButton class="h-full w-full" icon="square.and.pencil" label={t("actions.compose")} onPress={() => openCompose({ mode: "new" })} testID="compose" />
            </View>
          </View>
        </If>
        <GlassTabBar
          items={tabs.map((tab) => ({
            value: tab.name,
            title: t(`tabs.${tab.name}`),
            icon: navIcons[tab.name],
          }))}
          value={tabs[selectedTab()].name}
          scrollOffset={pageOffset()}
          onChange={({ value, index }: { value: string; index: number }) => choose(index)}
          label={t("tabs.label")}
          testID="tab-bar"
        />
      </If>
    </View>
  );
}
