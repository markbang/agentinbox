// Phones and narrow windows: iOS's tab bar over a navigation stack per
// section (Mail, Notifications, Search, Mailboxes, Settings), each kept while
// another shows. Pushed pages cover the bar, as they do on iOS.
import { effect, signal, untracked, View, type JSX } from "nsh";
import { BackHandler } from "nsh/mobile";
import { NavStack } from "nsh/base";
import { t } from "nsh/i18n";
import { TabBar } from "cupertino";
import { NavContext, selectedTab, selectTab, tabs, TAB, type Route } from "../nav";
import { unreadNotifications } from "../notify";
import { picking, unreadCount } from "../store";
import { Toasts } from "./Toasts";

const navIcons = { mail: "tray", notifications: "bell", search: "magnifyingglass", folders: "folder", settings: "slider.horizontal.3" } as const;

export function TabShell(props: { page: (route: Route) => JSX.Element }) {
  const depth = () => tabs[selectedTab()].stack.routes().length;
  // Android back on a tab's first page goes to Mail first; the stacks pop before that.
  BackHandler.on("press", () => {
    if (selectedTab() === TAB.mail || depth() > 1) return false;
    selectTab(TAB.mail);
    return true;
  });
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
  return (
    <View class="flex-1 bg-system-background">
      <View class="flex-1">
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
        <Toasts class={covered() ? "bottom-4" : "bottom-16"} />
      </View>
      <If when={!covered()}>
        <TabBar
          items={tabs.map((tab) => ({
            value: tab.name,
            title: t(`tabs.${tab.name}`),
            icon: navIcons[tab.name],
            badge:
              tab.name === "mail" && unreadCount(null) > 0
                ? unreadCount(null) > 999
                  ? "999+"
                  : String(unreadCount(null))
                : tab.name === "notifications" && unreadNotifications() > 0
                  ? unreadNotifications() > 999
                    ? "999+"
                    : String(unreadNotifications())
                  : undefined,
          }))}
          value={tabs[selectedTab()].name}
          onChange={({ value, index }: { value: string; index: number }) => choose(index)}
          label={t("tabs.label")}
          testID="tab-bar"
        />
      </If>
      <If when={covered() && picking()}>
        <View />
      </If>
    </View>
  );
}
