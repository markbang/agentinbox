// The feed's list: one row per notification under the day it arrived on,
// grouped by day, the source's mark leading it, unread in emphasized type
// with a dot, a high priority's in red, tags after the snippet. Touch
// screens swipe right to archive, left to toggle read, and long-press for
// the actions.
import { List, signal, Text, View, type JSX } from "nsh";
import { Haptics } from "nsh/mobile";
import { t } from "nsh/i18n";
import type { Notification } from "agentinbox/native";
import { ActionSheet, Icon, SwipeRow } from "cupertino";
import { dayLabel, dayOf, relativeDate } from "../lib/format";
import { wide } from "../layout";
import { archiveNotifications, markNotifications, sourceById } from "../notify";
import { PullIndicator, PULL_HEIGHT, pullValue } from "./PullIndicator";
import { PriorityDot, SourceMark, Tags } from "./SourceMark";

/** A heading for a day, or a notification under it. */
interface FeedRow {
  key: string;
  /** A day heading's local midnight. */
  day?: number;
  note?: Notification;
}

/** The feed's rows: a heading for each day, its notifications under it. */
function rows(items: Notification[]): FeedRow[] {
  const out: FeedRow[] = [];
  let day: number | null = null;
  for (const note of items) {
    const at = dayOf(note.receivedAt);
    if (at !== day) {
      day = at;
      out.push({ key: `day-${at}`, day: at });
    }
    out.push({ key: note.id, note });
  }
  return out;
}

export function NotificationList(props: {
  items: Notification[];
  selectedId?: string | null;
  onOpen: (id: string) => void;
  loadingMore?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  onLoadMore?: () => void;
  empty: JSX.Element;
  testID?: string;
}) {
  const oneLine = () => !wide();
  // The pull indicator follows this; the platform's own spinner stays off.
  const pull = pullValue();
  const actions = signal<Notification | null>(null);
  const find = (id: string) => props.items.find((n) => n.id === id);
  const archive = (id: string) => {
    const n = find(id);
    if (n) archiveNotifications([n.id]);
  };
  const toggleRead = (id: string) => {
    const n = find(id);
    if (n) void markNotifications([n.id], !n.read);
  };
  return (
    <View class="relative flex-1">
      <List
        role="list"
        accessibilityLabel={t("notify.list")}
        each={rows(props.items)}
        keyExtractor={(row) => row.key}
        estimatedItemSize={oneLine() ? 96 : 88}
        refreshing={props.refreshing ?? false}
        onRefresh={props.onRefresh}
        pullValue={pull}
        refreshIndicator={{ height: PULL_HEIGHT }}
        onLoadMore={props.onLoadMore}
        testID={props.testID}
        empty={props.empty}
        class="flex-1"
        contentClass="pb-[env(safe-area-inset-bottom)]"
      >
        {(row) => (
          <If
            when={row().note}
            else={
              <View class="bg-system-grouped-background px-4 pb-1 pt-5">
                <Text role="header" class="text-footnote font-semibold uppercase text-secondary-label">
                  {dayLabel(row().day ?? 0)}
                </Text>
              </View>
            }
          >
            {(note) => (
              <SwipeRow
                leading={[{ id: "archive", title: t("actions.archive"), icon: "archivebox", tint: "system-teal" }]}
                trailing={[{ id: "read", title: note().read ? t("actions.markUnread") : t("actions.markRead"), icon: "envelope.open", tint: "system-blue" }]}
                fullSwipe="archive"
                onAction={({ id }: { id: string }) => {
                  if (id === "archive") archive(note().id);
                  if (id === "read") toggleRead(note().id);
                }}
              >
                <Row
                  note={note()}
                  selected={props.selectedId === row().key}
                  oneLine={oneLine()}
                  onPress={() => props.onOpen(row().key)}
                  onLongPress={() => {
                    Haptics.impact("medium");
                    actions.set(note());
                  }}
                />
              </SwipeRow>
            )}
          </If>
        )}
      </List>
      <PullIndicator pull={pull} />
      <ActionSheet
        open={!!actions()}
        title={actions()?.title}
        actions={[
          { id: "read", title: actions()?.read ? t("actions.markUnread") : t("actions.markRead") },
          { id: "archive", title: t("actions.archive") },
        ]}
        cancel={t("common.cancel")}
        onOpenChange={({ open }: { open: boolean }) => {
          if (!open) actions.set(null);
        }}
        onAction={({ id }: { id: string }) => {
          const n = actions();
          actions.set(null);
          if (!n) return;
          if (id === "read") void markNotifications([n.id], !n.read);
          if (id === "archive") archiveNotifications([n.id]);
        }}
      />
    </View>
  );
}

function Row(props: { note: Notification; selected: boolean; oneLine: boolean; onPress: () => void; onLongPress?: () => void }) {
  const n = () => props.note;
  const source = () => sourceById(n().sourceId);
  const label = () =>
    [n().read ? "" : t("list.unread"), source()?.name ?? "", n().sender, n().title, n().priority >= 7 ? t("notify.highPriority") : "", relativeDate(n().receivedAt)]
      .filter(Boolean)
      .join(", ");
  return (
    <View
      role="button"
      accessibilityLabel={label()}
      accessibilityState={{ selected: props.selected }}
      onPress={() => props.onPress()}
      onLongPress={props.onLongPress}
      testID={`notify-${n().id}`}
      class={`w-full flex-row items-start gap-2.5 bg-system-background pl-3 pr-4 active:bg-fill ${props.selected ? "bg-fill" : ""}`}
    >
      <View class="pt-3">
        <If when={source()}>{(s) => <SourceMark source={s()} size="md" />}</If>
      </View>
      <View class={`min-w-0 flex-1 gap-0.5 border-b border-separator py-2.5`}>
        <View class="flex-row items-baseline gap-1.5">
          <Text class={`line-clamp-1 shrink text-footnote ${n().read ? "text-secondary-label" : "font-semibold text-label"}`}>{n().sender}</Text>
          <Text class="line-clamp-1 text-caption1 text-tertiary-label">{source()?.name === n().sender ? "" : (source()?.name ?? "")}</Text>
          <View class="flex-1" />
          <Text class="shrink-0 text-caption1 tabular-nums text-secondary-label">{relativeDate(n().receivedAt)}</Text>
          <If when={!n().read}>
            <View accessibilityElementsHidden class="size-2 rounded-full bg-system-blue" />
          </If>
        </View>
        <View class="flex-row items-center gap-1.5">
          <PriorityDot priority={n().priority} />
          <Text class={`line-clamp-1 flex-1 text-subheadline ${n().read ? "text-label" : "font-semibold text-label"}`}>{n().title}</Text>
          <If when={n().link}>
            <Icon name="arrow.up.right" size={12} tint="tertiary-label" />
          </If>
        </View>
        <Text class={`${props.oneLine ? "line-clamp-2" : "line-clamp-1"} text-subheadline text-secondary-label`}>{n().body.replace(/\s+/g, " ")}</Text>
        <Tags tags={n().tags} />
      </View>
    </View>
  );
}
