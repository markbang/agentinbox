// The shell: onboarding until a mode is chosen, then the split view on wide
// windows, or the tab bar over a stack per section on phones and narrow
// windows; the sheet the wide layout opens pages in, the toasts, the
// shortcuts and the keys.
import { keymap, mount, View, type InputRef } from "nsh";
import { NavStack } from "nsh/base";
import { Sheet, Theme } from "cupertino";
import { Toasts } from "./components/Toasts";
import { TabShell } from "./components/TabShell";
import { ShortcutsDialog } from "./components/ShortcutsDialog";
import { Workspace } from "./components/Workspace";
import { wide } from "./layout";
import { closeModal, isModalOpen, modalNavigator, modalStack, NavContext, phoneStack, selectTab, show, tabs, TAB, type Route } from "./nav";
import { AddAccountPage } from "./pages/AddAccountPage";
import { AddSourcePage } from "./pages/AddSourcePage";
import { ApiKeysPage } from "./pages/ApiKeysPage";
import { KeyCreatedPage } from "./pages/KeyCreatedPage";
import { NewKeyPage } from "./pages/NewKeyPage";
import { NotificationPage } from "./pages/NotificationPage";
import { NotificationsPage } from "./pages/NotificationsPage";
import { NotifyRulesPage } from "./pages/NotifyRulesPage";
import { SourceFormPage } from "./pages/SourceFormPage";
import { SourceIngestPage } from "./pages/SourceIngestPage";
import { SourcesPage } from "./pages/SourcesPage";
import { ComposePage } from "./pages/ComposePage";
import { FoldersPage } from "./pages/FoldersPage";
import { ImapPage } from "./pages/ImapPage";
import { SignaturePage } from "./pages/SignaturePage";
import { InboxPage } from "./pages/InboxPage";
import { MessagePage } from "./pages/MessagePage";
import { Onboarding } from "./pages/Onboarding";
import { SearchPage } from "./pages/SearchPage";
import { SettingsPage } from "./pages/SettingsPage";
import { listenForPushToken } from "./push";
import { stayResident } from "./resident";
import { current, isStarted, mailStatus, moveOpen, openMessage, selectedId, start, stepMessage } from "./store";
import { notificationsSection, openNotificationAt, showMail, showNotifications } from "./notify";
import { shortcutsOpen } from "./lib/shortcuts";
import type { ComposeMode } from "./lib/format";

function page(route: Route) {
  switch (route.name) {
    case "inbox":
      return <InboxPage />;
    case "message":
      return <MessagePage id={route.id} />;
    case "compose":
      return <ComposePage init={route.init} />;
    case "search":
      return <SearchPage />;
    case "folders":
      return <FoldersPage />;
    case "settings":
      return <SettingsPage />;
    case "addAccount":
      return <AddAccountPage />;
    case "imap":
      return <ImapPage />;
    case "signature":
      return <SignaturePage accountId={route.account} />;
    case "notifications":
      return <NotificationsPage />;
    case "notification":
      return <NotificationPage id={route.id} />;
    case "sources":
      return <SourcesPage />;
    case "addSource":
      return <AddSourcePage />;
    case "sourceForm":
      return <SourceFormPage kind={route.kind} />;
    case "sourceIngest":
      return <SourceIngestPage source={route.source} url={route.url} created={route.created} />;
    case "apiKeys":
      return <ApiKeysPage />;
    case "newKey":
      return <NewKeyPage />;
    case "keyCreated":
      return <KeyCreatedPage apiKey={route.key} token={route.token} />;
    case "notifyRules":
      return <NotifyRulesPage />;
  }
}

function Main() {
  let search: InputRef | undefined;
  const compose = (mode: ComposeMode) => {
    const source = mode === "new" ? undefined : current();
    if (mode !== "new" && !source) return;
    show({ name: "compose", init: { mode, source } }, wide());
  };
  const openFromNotification = (id: string) => {
    showMail();
    openMessage(id);
    if (wide()) return;
    selectTab(TAB.mail);
    phoneStack.setRoutes([{ name: "inbox" }, { name: "message", id }]);
  };
  const openNotification = (id: string) => {
    openNotificationAt(id);
    if (wide()) {
      showNotifications();
      return;
    }
    selectTab(TAB.notifications);
    tabs[TAB.notifications].stack.setRoutes([{ name: "notifications" }, { name: "notification", id }]);
  };
  stayResident(openFromNotification, openNotification);

  // Single keys, as mail apps have them; never while typing or in a sheet.
  const key = (run: () => unknown) => () => {
    if (!isModalOpen()) run();
  };
  keymap.bind(
    {
      c: key(() => compose("new")),
      r: key(() => !notificationsSection() && wide() && selectedId() && compose("reply")),
      "/": key(() => (wide() ? (notificationsSection() ? undefined : search?.focus()) : selectTab(TAB.search))),
      e: key(() => !notificationsSection() && wide() && selectedId() && moveOpen("archive")),
      "shift+3": key(() => !notificationsSection() && wide() && selectedId() && moveOpen("trash")),
      j: key(() => !notificationsSection() && wide() && stepMessage(1)),
      k: key(() => !notificationsSection() && wide() && stepMessage(-1)),
      // "?": the list of shortcuts, as Gmail and its neighbours have it.
      "shift+/": key(() => shortcutsOpen.set(true)),
    },
    { when: "notEditing" },
  );

  return (
    <If
      when={wide()}
      else={<TabShell page={page} />}
    >
      <Workspace
        onCompose={compose}
        onSettings={() => show({ name: "settings" }, true)}
        onAddAccount={() => show({ name: "addAccount" }, true)}
        onAddSource={() => show({ name: "addSource" }, true)}
        onSources={() => show({ name: "sources" }, true)}
        searchRef={(ref) => (search = ref)}
      />
      {/* The wide layout opens pages in a sheet with a stack of its own. */}
      <Sheet open={isModalOpen()} detent="large" scroll={false} testID="modal" onOpenChange={({ open }: { open: boolean }) => (open ? undefined : closeModal())}>
        <NavContext.Provider value={modalNavigator}>
          <NavStack state={modalStack} class="flex-1">
            {page}
          </NavStack>
        </NavContext.Provider>
      </Sheet>
    </If>
  );
}

function App() {
  void start();
  return (
    <Theme contrast="normal">
      <View class="flex-1 bg-system-background">
        <If when={isStarted()}>
          <If when={mailStatus().mode !== "none"} else={<Onboarding />}>
            <Main />
          </If>
        </If>
        <If when={isStarted() && mailStatus().mode !== "none"}>
          <ShortcutsDialog open={shortcutsOpen()} onClose={() => shortcutsOpen.set(false)} />
        </If>
        {/* Under the tab bar on phones, over the reader's toolbar on wide windows. */}
        <If when={wide()}>
          <Toasts class="bottom-4" />
        </If>
      </View>
    </Theme>
  );
}

listenForPushToken();
mount(App);
