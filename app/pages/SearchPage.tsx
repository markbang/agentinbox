// Search on its own page (phones and narrow windows): the glass field under
// the bar, its results as the mail list draws them. The field floats, so the
// results pass under it.
import { cleanup, Text, View } from "nsh";
import { t } from "nsh/i18n";
import { Page } from "../components/Page";
import { resultCount } from "../components/MailboxPane";
import { MessageList } from "../components/MessageList";
import { SearchEmpty } from "../components/SearchEmpty";
import { NavContext } from "../nav";
import { clearSearch, openRow, runSearch, SEARCH_LIMIT, searchActive, searchQuery, searchResults, typeSearch } from "../store";
import { SearchField } from "cupertino";

export function SearchPage() {
  const nav = NavContext();
  cleanup(clearSearch);
  return (
    <Page title={t("search.label")} testID="search-page">
      <View class="min-h-0 flex-1">
        <View class="absolute left-0 right-0 top-11 z-10 px-3 pb-2 pt-1">
          <SearchField
            value={searchQuery()}
            onChange={({ value }: { value: string }) => typeSearch(value)}
            onSubmit={() => void runSearch(searchQuery())}
            placeholder={t("search.placeholder")}
            label={t("search.label")}
            glass
            testID="search"
          />
        </View>
        <If
          when={searchActive()}
          else={
            <View class="flex-1">
              <SearchEmpty />
            </View>
          }
        >
          <View class="min-h-0 flex-1">
            <MessageList
              items={searchResults() ?? []}
              onOpen={(id) => {
                const row = (searchResults() ?? []).find((r) => r.key === id);
                if (!row) return;
                openRow(row);
                nav.stack.push({ name: "message", id });
              }}
              showAccount
              highlight={searchQuery()}
              label={t("search.results")}
              testID="results"
              contentClass="pt-24 pb-[calc(env(safe-area-inset-bottom)+49px)]"
              header={
                <If when={searchResults()?.length}>
                  {(count) => (
                    <Text role="summary" class="px-4 pb-1 text-footnote tabular-nums text-secondary-label" testID="result-count">
                      {count() >= SEARCH_LIMIT ? resultCount(SEARCH_LIMIT) : resultCount(count())}
                    </Text>
                  )}
                </If>
              }
              empty={<SearchEmpty />}
            />
          </View>
        </If>
      </View>
    </Page>
  );
}
