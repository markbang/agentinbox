// The notification inbox's list column: the feed with its filters and search,
// the sources and the refresh at the top.
import { Text, View } from "nsh";
import { t } from "nsh/i18n";
import { ActivityIndicator, Button } from "cupertino";
import { FeedEmpty } from "./FeedEmpty";
import { FeedFilters, FeedSearch } from "./FeedFilters";
import { NotificationList } from "./NotificationList";
import { feedRefreshFrom, feedStatus, loadMoreFeed, notifications, openNotification, openNotificationAt, reloadFeed, setFeedFilter } from "../notify";

export function NotificationsPane(props: { onAddSource: () => void; onAddAccount: () => void; onOpenSources: () => void; onMailboxes?: () => void; testID?: string }) {
  return (
    <View class="h-full flex-col bg-system-background" testID={props.testID ?? "notifications"}>
      <View class="flex-row items-center gap-1 px-3 pb-1 pt-2">
        <If when={props.onMailboxes}>
          <Button icon="tray" label={t("tabs.folders")} variant="plain" onPress={() => props.onMailboxes?.()} testID="open-mailboxes" />
        </If>
        <Text role="header" class="line-clamp-1 flex-1 text-title2 font-bold text-label">
          {t("notify.allTitle")}
        </Text>
        <If
          when={feedStatus() === "refreshing" && feedRefreshFrom() !== "pull"}
          else={<Button icon="arrow.clockwise" label={t("actions.refresh")} variant="plain" onPress={() => void reloadFeed("refreshing")} testID="notify-refresh" />}
        >
          <ActivityIndicator size={20} label={t("sync.running")} testID="notify-refreshing" />
        </If>
        <Button icon="bell" label={t("sources.title")} variant="plain" onPress={() => props.onOpenSources()} testID="notify-sources" />
      </View>
      <FeedFilters />
      <FeedSearch />
      <View class="min-h-0 flex-1">
        <NotificationList
          items={notifications()}
          selectedId={openNotification()?.id ?? null}
          onOpen={openNotificationAt}
          refreshing={feedStatus() === "refreshing" && feedRefreshFrom() === "pull"}
          onRefresh={() => void reloadFeed("refreshing", "pull")}
          onLoadMore={() => void loadMoreFeed()}
          empty={<FeedEmpty onAddSource={props.onAddSource} onAddAccount={props.onAddAccount} onClearFilters={() => setFeedFilter(null)} />}
          testID="notify-list"
        />
      </View>
    </View>
  );
}
