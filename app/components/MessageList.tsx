// The list of conversations or messages, as Mail draws it on iOS: unread by
// weight and a blue dot, the sender and time, the subject with its
// attachments and flag, and a preview. Pointer devices and wide windows get
// one preview line, phones two. Touch screens swipe a row right to archive
// it, left to delete it, and long-press it to select.
import { List, Text, View, type JSX } from "nsh";
import { Haptics } from "nsh/mobile";
import { t } from "nsh/i18n";
import { Icon, SwipeRow } from "cupertino";
import { displayName, listDate, participantNames } from "../lib/format";
import { wide } from "../layout";
import { AccountMark, Count } from "./Marks";
import { accountIndex, accounts, ownAddresses, type Row as ListRow } from "../store";

export interface MessageListProps {
  items: ListRow[];
  selectedId?: string | null;
  onOpen: (id: string) => void;
  refreshing?: boolean;
  onRefresh?: () => void;
  onLoadMore?: () => void;
  loadingMore?: boolean;
  /** Show whose account each message is in (the unified view, search). */
  showAccount?: boolean;
  /** Show the recipients instead of the sender (Sent, Drafts). */
  showRecipients?: boolean;
  /** Search words to mark in subjects and previews. */
  highlight?: string;
  empty?: JSX.Element;
  /** What screen readers call the list (its rows name themselves). */
  label?: string;
  testID?: string;
  /** Swipe actions (touch screens). */
  onArchive?: (id: string) => void;
  onDelete?: (id: string) => void;
  /** Long-press selection (touch screens): `picked` marks rows, `onPick` toggles one. */
  picked?: (id: string) => boolean;
  picking?: boolean;
  onPick?: (id: string) => void;
}

export function MessageList(props: MessageListProps) {
  const oneLine = () => !wide();
  const terms = () => (props.highlight ?? "").split(/\s+/).filter(Boolean);
  const swiping = () => !props.picking && !!(props.onArchive || props.onDelete);
  const pick = (id: string) => {
    Haptics.impact("medium");
    props.onPick?.(id);
  };
  return (
    <List
      role="list"
      accessibilityLabel={props.label}
      each={props.items}
      keyExtractor={(m) => m.key}
      estimatedItemSize={oneLine() ? 86 : 76}
      refreshing={props.refreshing ?? false}
      onRefresh={props.onRefresh}
      onLoadMore={props.onLoadMore}
      testID={props.testID}
      empty={props.empty}
      class="flex-1"
      contentClass="pb-[env(safe-area-inset-bottom)]"
    >
      {(m) => (
        <If
          when={swiping()}
          else={
            <Row
              message={m()}
              selected={props.selectedId === m().key || !!props.picked?.(m().key)}
              onPress={() => (props.picking ? props.onPick?.(m().key) : props.onOpen(m().key))}
              onLongPress={props.onPick ? () => pick(m().key) : undefined}
              showAccount={!!props.showAccount && accounts().length > 1}
              showRecipients={!!props.showRecipients}
              oneLine={oneLine()}
              terms={terms()}
            />
          }
        >
          <SwipeRow
            leading={props.onArchive ? [{ id: "archive", title: t("actions.archive"), icon: "archivebox", tint: "system-teal" }] : []}
            trailing={props.onDelete ? [{ id: "delete", title: t("actions.delete"), icon: "trash", destructive: true }] : []}
            fullSwipe={props.onArchive ? "archive" : props.onDelete ? "delete" : undefined}
            onAction={({ id }: { id: string }) => {
              if (id === "archive") props.onArchive?.(m().key);
              else if (id === "delete") props.onDelete?.(m().key);
            }}
          >
            <Row
              message={m()}
              selected={props.selectedId === m().key || !!props.picked?.(m().key)}
              onPress={() => (props.picking ? props.onPick?.(m().key) : props.onOpen(m().key))}
              onLongPress={props.onPick ? () => pick(m().key) : undefined}
              showAccount={!!props.showAccount && accounts().length > 1}
              showRecipients={!!props.showRecipients}
              oneLine={oneLine()}
              terms={terms()}
            />
          </SwipeRow>
        </If>
      )}
    </List>
  );
}

/** Who a row names: the recipients (Sent, Drafts), a conversation's writers, or the sender. */
const writers = (r: ListRow, recipients: boolean) =>
  recipients
    ? r.latest.to.map(displayName).join(", ") || t("compose.noRecipients")
    : r.thread
      ? participantNames(r.participants, ownAddresses()) || displayName(r.latest.from)
      : displayName(r.latest.from);

const rowLabel = (r: ListRow, who: string) =>
  [
    r.unread ? t("list.unread") : "",
    who,
    r.count > 1 ? t("list.messages", { count: r.count }) : "",
    r.subject || t("reader.noSubject"),
    listDate(r.latest.date),
    r.flagged ? t("list.flagged") : "",
  ]
    .filter(Boolean)
    .join(", ");

function Row(props: {
  message: ListRow;
  selected: boolean;
  onPress: () => void;
  onLongPress?: () => void;
  showAccount: boolean;
  showRecipients: boolean;
  oneLine: boolean;
  terms: string[];
}) {
  const m = () => props.message;
  const unread = () => m().unread > 0;
  const who = () => writers(m(), props.showRecipients);
  return (
    <View
      role="button"
      accessibilityLabel={rowLabel(m(), who())}
      accessibilityState={{ selected: props.selected }}
      onPress={() => props.onPress()}
      onLongPress={props.onLongPress}
      testID={`message-${m().key}`}
      class={`w-full flex-row items-center bg-system-background active:bg-fill ${props.selected ? "bg-fill" : ""}`}
    >
      <If when={props.showAccount}>
        <View class="h-full items-center pl-1.5">
          <AccountMark index={accountIndex(m().latest.accountId)} shape="bar" />
        </View>
      </If>
      <View class="min-w-0 flex-1 flex-row gap-2.5 pl-3 pr-4">
        <View class="w-2 pt-6">
          <If when={unread()}>
            <View accessibilityElementsHidden class="size-2 rounded-full bg-system-blue" />
          </If>
        </View>
        <View class={`min-w-0 flex-1 gap-0.5 border-b border-separator py-2.5 ${unread() ? "" : ""}`}>
          <View class="flex-row items-baseline gap-1.5">
            <Text class={`line-clamp-1 shrink text-body ${unread() ? "font-semibold text-label" : "text-label"}`}>{who()}</Text>
            <Count value={m().count} bold={unread()} />
            <View class="flex-1" />
            <Text class={`shrink-0 text-footnote tabular-nums ${unread() ? "font-semibold text-label" : "text-secondary-label"}`}>
              {listDate(m().latest.date)}
            </Text>
          </View>
          <View class="flex-row items-center gap-1.5">
            <Marked text={m().subject || t("reader.noSubject")} terms={props.terms} class="line-clamp-1 flex-1 text-subheadline text-label" />
            <If when={m().hasAttachments}>
              <Icon name="paperclip" size={14} tint="secondary-label" />
            </If>
            <If when={m().flagged}>
              <Icon name="flag.fill" size={14} tint="system-orange" label={t("list.flagged")} />
            </If>
          </View>
          <Marked
            text={m().latest.snippet}
            terms={props.terms}
            class={`${props.oneLine ? "line-clamp-2" : "line-clamp-1"} text-subheadline text-secondary-label`}
          />
        </View>
      </View>
    </View>
  );
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** `text` with each occurrence of `terms` marked, as a search result shows them. */
function Marked(props: { text: string; terms: string[]; class: string }) {
  const parts = () => {
    const pattern = new RegExp(`(${props.terms.map(escapeRegExp).join("|")})`, "giu");
    return props.text
      .split(pattern)
      .map((text, i) => ({ key: i, text, hit: i % 2 === 1 }))
      .filter((p) => p.text);
  };
  return (
    <If when={props.terms.length} else={<Text class={props.class}>{props.text}</Text>}>
      <Text class={props.class}>
        <Each of={parts()} key={(p) => p.key}>
          {(p) => <Text class={p().hit ? "rounded-[3px] bg-system-yellow/40 font-semibold text-label" : ""}>{p().text}</Text>}
        </Each>
      </Text>
    </If>
  );
}
