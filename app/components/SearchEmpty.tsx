// What a search shows: the hint before anything is typed, the spinner while
// it runs, the failure with a retry, and nothing found with a way back.
import { View } from "nsh";
import { t } from "nsh/i18n";
import { Button } from "cupertino";
import { Empty, Loading } from "./Empty";
import { clearSearch, runSearch, searchError, searchQuery, searchStatus } from "../store";

export function SearchEmpty() {
  const state = () =>
    !searchQuery().trim() ? "hint" : searchStatus() === "loading" ? "loading" : searchStatus() === "error" ? "error" : "none";
  return (
    <View class="flex-1" testID="search-empty">
      <If when={state() === "hint"}>
        <Empty icon="magnifyingglass" title={t("search.hint")} description={t("search.hintDetail")} />
      </If>
      <If when={state() === "loading"}>
        <Loading label={t("search.running")} />
      </If>
      <If when={state() === "error"}>
        <Empty
          icon="exclamationmark.triangle"
          title={t("search.failed")}
          description={searchError() ?? undefined}
          action={<Button title={t("actions.retry")} variant="tinted" icon="arrow.clockwise" onPress={() => void runSearch(searchQuery())} testID="search-retry" />}
        />
      </If>
      {/* A status region: what the search found (or didn't) is announced as it changes. */}
      <View role="summary" class="flex-1">
        <If when={state() === "none"}>
          <Empty
            icon="magnifyingglass"
            title={t("search.none", { query: searchQuery().trim() })}
            description={t("search.noneHint")}
            action={<Button title={t("search.clear")} variant="plain" onPress={clearSearch} testID="search-clear" />}
          />
        </If>
      </View>
    </View>
  );
}
