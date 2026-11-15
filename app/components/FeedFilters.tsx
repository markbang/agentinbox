// The feed's filter row and search field: every source with its unread count,
// and All. The chosen filter is a filled capsule, as Mail's filter row is.
import { Text, View, type InputRef, type JSX } from "nsh";
import { Icon, ScrollView, SearchField } from "cupertino";
import { t } from "nsh/i18n";
import { clearFeedQuery, feedFilter, feedQuery, setFeedFilter, sourceCounts, sources, submitFeedQuery, typeFeedQuery } from "../notify";
import { SourceMark } from "./SourceMark";

function Capsule(props: { label: string; count: number; selected: boolean; onPress: () => void; mark?: JSX.Element; testID?: string }) {
  return (
    <View
      role="button"
      accessibilityLabel={props.label}
      accessibilityState={{ selected: props.selected }}
      onPress={props.onPress}
      testID={props.testID}
      class={`h-8 shrink-0 flex-row items-center gap-1.5 rounded-full px-3 ${props.selected ? "bg-system-blue" : "bg-fill"} active:opacity-60`}
    >
      {props.mark}
      <Text class={`text-footnote ${props.selected ? "font-semibold text-white" : "font-medium text-label"}`}>{props.label}</Text>
      <If when={props.count > 0}>
        <Text class={`text-caption1 tabular-nums ${props.selected ? "text-white/80" : "text-secondary-label"}`}>
          {props.count > 999 ? "999+" : String(props.count)}
        </Text>
      </If>
    </View>
  );
}

export function FeedFilters() {
  const all = () => Object.values(sourceCounts()).reduce((sum, n) => sum + n, 0);
  return (
    <ScrollView horizontal class="w-full shrink-0" style={{ height: 44 }} indicator={false} testID="notify-filters">
      <View class="flex-row items-center gap-2 px-4">
        <Capsule label={t("notify.all")} count={all()} selected={feedFilter() === null} onPress={() => setFeedFilter(null)} testID="notify-filter-all" />
        <Each of={sources()} key={(s) => s.id}>
          {(s) => (
            <Capsule
              label={s().name}
              count={sourceCounts()[s().id] ?? 0}
              selected={feedFilter() === s().id}
              onPress={() => setFeedFilter(s().id)}
              mark={<SourceMark source={s()} size="sm" />}
              testID={`notify-filter-${s().id}`}
            />
          )}
        </Each>
      </View>
    </ScrollView>
  );
}

export function FeedSearch(props: { ref?: (ref: InputRef) => void }) {
  return (
    <View class="relative px-3 pb-2 pt-1">
      <SearchField
        value={feedQuery()}
        onChange={({ value }: { value: string }) => typeFeedQuery(value)}
        onSubmit={() => submitFeedQuery(feedQuery())}
        placeholder={t("notify.searchPlaceholder")}
        label={t("notify.search")}
        testID="notify-search"
      />
      <If when={feedQuery()}>
        <View
          role="button"
          accessibilityLabel={t("search.clear")}
          onPress={clearFeedQuery}
          class="absolute bottom-3.5 right-5 size-5 items-center justify-center rounded-full"
          testID="notify-search-clear"
        >
          <Icon name="xmark.circle.fill" size={14} tint="secondary-label" />
        </View>
      </If>
    </View>
  );
}
