// The Notifications tab: every source's notifications in one feed, the
// filters and search over it, and the open one on a page of its own.
import { signal, View } from "nsh";
import { t } from "nsh/i18n";
import { ActionSheet, Button } from "cupertino";
import { Page } from "../components/Page";
import { FeedEmpty } from "../components/FeedEmpty";
import { FeedFilters, FeedSearch } from "../components/FeedFilters";
import { NotificationList } from "../components/NotificationList";
import { NavContext } from "../nav";
import { feedRefreshFrom, feedStatus, loadMoreFeed, notifications, openNotificationAt, reloadFeed, serverInbox, setFeedFilter } from "../notify";

export function NotificationsPage() {
  const nav = NavContext();
  const menu = signal(false);
  const open = (id: string) => {
    openNotificationAt(id);
    nav.stack.push({ name: "notification", id });
  };
  return (
    <Page
      title={t("notify.title")}
      trailing={<Button icon="ellipsis" label={t("notify.actions")} variant="plain" onPress={() => menu.set(true)} testID="notify-more" />}
      testID="notifications"
    >
      <FeedFilters />
      <FeedSearch />
      <View class="min-h-0 flex-1">
        <NotificationList
          items={notifications()}
          onOpen={open}
          refreshing={feedStatus() === "refreshing" && feedRefreshFrom() === "pull"}
          onRefresh={() => void reloadFeed("refreshing", "pull")}
          onLoadMore={() => void loadMoreFeed()}
          empty={
            <FeedEmpty
              onAddSource={() => nav.stack.push({ name: "addSource" })}
              onAddAccount={() => nav.stack.push({ name: "addAccount" })}
              onClearFilters={() => setFeedFilter(null)}
            />
          }
          testID="notify-list"
        />
      </View>
      <ActionSheet
        open={menu()}
        title={t("notify.actions")}
        actions={[
          { id: "refresh", title: t("actions.refresh") },
          { id: "sources", title: t("sources.title") },
          ...(serverInbox() ? [{ id: "keys", title: t("keys.title") }] : []),
          { id: "rules", title: t("rules.title") },
        ]}
        cancel={t("common.cancel")}
        onOpenChange={({ open }: { open: boolean }) => menu.set(open)}
        onAction={({ id }: { id: string }) => {
          menu.set(false);
          if (id === "refresh") void reloadFeed("refreshing");
          if (id === "sources") nav.stack.push({ name: "sources" });
          if (id === "keys") nav.stack.push({ name: "apiKeys" });
          if (id === "rules") nav.stack.push({ name: "notifyRules" });
        }}
        testID="notify-menu"
      />
    </Page>
  );
}
