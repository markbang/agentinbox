// What the feed shows with nothing in it, and the next step: no sources yet,
// a filter or search that found nothing, or a load that failed.
import { View } from "nsh";
import { t } from "nsh/i18n";
import { Button } from "cupertino";
import { Empty, Loading } from "./Empty";
import { clearFeedQuery, feedError, feedFilter, feedQuery, feedStatus, reloadFeed, serverInbox, sources } from "../notify";

export function FeedEmpty(props: { onAddSource: () => void; onAddAccount: () => void; onClearFilters: () => void }) {
  const filtered = () => !!feedQuery().trim() || !!feedFilter();
  const clear = () => {
    clearFeedQuery();
    props.onClearFilters();
  };
  return (
    <If when={feedStatus() !== "loading"} else={<Loading label={t("notify.loading")} />}>
      <If
        when={feedStatus() === "error"}
        else={
          <If
            when={sources().length}
            else={
              <Empty
                icon="bell"
                title={serverInbox() ? t("notify.noSources") : t("notify.noAccounts")}
                description={serverInbox() ? t("notify.noSourcesHint") : t("notify.noAccountsHint")}
                action={
                  <Button
                    title={serverInbox() ? t("sources.add") : t("accounts.add")}
                    icon="plus"
                    onPress={serverInbox() ? props.onAddSource : props.onAddAccount}
                    testID="empty-add-source"
                  />
                }
              />
            }
          >
            <If
              when={filtered()}
              else={
                <Empty
                  icon="bell"
                  title={t("notify.empty")}
                  description={t("notify.emptyHint")}
                  action={<Button title={t("sources.add")} icon="plus" onPress={props.onAddSource} testID="empty-add-source" />}
                />
              }
            >
              <Empty
                icon="line.3.horizontal.decrease"
                title={t("notify.nothing")}
                description={t("notify.nothingHint")}
                action={<Button title={t("notify.clearFilters")} variant="tinted" icon="xmark" onPress={clear} testID="empty-clear-filters" />}
              />
            </If>
          </If>
        }
      >
        <Empty
          icon="exclamationmark.triangle"
          title={t("notify.failed")}
          description={feedError() ?? t("notify.failedHint")}
          action={<Button title={t("actions.retry")} variant="tinted" icon="arrow.clockwise" onPress={() => void reloadFeed()} testID="feed-retry" />}
        />
      </If>
    </If>
  );
}
