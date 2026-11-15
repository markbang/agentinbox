// The chosen mailbox: its conversations (or the search's results), under a
// bar with the mailbox's name, refresh and compose, and a search field, as
// Mail's list column has them.
import { Text, View, type JSX } from "nsh";
import { t } from "nsh/i18n";
import { ActivityIndicator, Button, SearchField } from "cupertino";
import { Empty, Loading } from "./Empty";
import { MessageList } from "./MessageList";
import { SearchEmpty } from "./SearchEmpty";
import { ScheduledList } from "./ScheduledList";
import { SyncBanner } from "./SyncBanner";
import {
  accountName,
  accounts,
  isPicked,
  listStatus,
  loadMore,
  mailbox,
  moveMessages,
  beginPicking,
  picking,
  refresh,
  refreshingFrom,
  reload,
  rows,
  SEARCH_LIMIT,
  searchActive,
  runSearch,
  searchQuery,
  searchResults,
  typeSearch,
  selectedKey,
  togglePicked,
  type Mailbox,
  type Row,
} from "../store";
import type { InputRef } from "nsh";

/** The chosen mailbox's name. */
export function mailboxTitle() {
  const box = mailbox();
  return box.folder === "inbox"
    ? box.account
      ? (accountName(box.account) ?? t("folder.inbox"))
      : t("mailbox.allInboxes")
    : t(`folder.${box.folder}`);
}

/** How many messages a search found, as the list's header says it. */
export function resultCount(count: number) {
  if (count >= SEARCH_LIMIT) return t("search.countMore", { count: SEARCH_LIMIT });
  return count === 1 ? t("search.countOne") : t("search.count", { count });
}

// An empty Sent, Drafts or Inbox is one message away from not being empty; the other two are places to look.
const canCompose = (folder: Mailbox["folder"]) => folder !== "archive" && folder !== "trash";

export interface MailboxPaneProps {
  onOpen: (row: Row) => void;
  onAddAccount: () => void;
  onCompose: () => void;
  /** The search field's ref, for the `/` shortcut. */
  searchRef?: (ref: InputRef) => void;
  /** Highlights the open conversation (the wide split view). */
  highlight?: boolean;
  /** Searches on a page of its own (phones): the list here stays the mailbox's. */
  searchable?: boolean;
  /** Swipe and long-press actions (touch screens). */
  touchActions?: boolean;
  /** The bar's trailing buttons; the pane draws refresh and compose by default. */
  trailing?: JSX.Element;
  /** Opens the mailboxes (the split view without its sidebar). */
  onMailboxes?: () => void;
  testID?: string;
}

export function MailboxPane(props: MailboxPaneProps) {
  const searching = () => props.searchable !== false && searchActive();
  const folder = () => mailbox().folder;
  const open = (list: () => Row[]) => (key: string) => {
    const row = list().find((r) => r.key === key);
    if (row) props.onOpen(row);
  };
  const move = (target: "archive" | "trash") => (key: string) => {
    const row = rows().find((r) => r.key === key);
    if (row) moveMessages([key], target, row.thread);
  };
  const empty = () => (
    <If
      when={listStatus() !== "loading"}
      else={<Loading label={t("reader.loading")} />}
    >
      <If
        when={listStatus() === "error"}
        else={
          <If
            when={accounts().length}
            else={
              <Empty
                icon="tray"
                title={t("empty.noAccounts")}
                description={t("empty.noAccountsHint")}
                action={<Button title={t("accounts.add")} icon="plus" onPress={props.onAddAccount} />}
              />
            }
          >
            <Empty
              icon="tray"
              title={t(`empty.${folder()}.title`)}
              description={t(`empty.${folder()}.hint`)}
              action={
                <If when={canCompose(folder())}>
                  <Button title={t("actions.compose")} icon="square.and.pencil" onPress={props.onCompose} testID="empty-compose" />
                </If>
              }
            />
          </If>
        }
      >
        <Empty
          icon="exclamationmark.triangle"
          title={t("empty.loadFailed")}
          description={t("empty.loadFailedHint")}
          action={<Button title={t("actions.retry")} variant="tinted" icon="arrow.clockwise" onPress={() => void reload()} testID="list-retry" />}
        />
      </If>
    </If>
  );
  return (
    <View class="h-full flex-col bg-system-background" testID={props.testID}>
      <View class="flex-row items-center gap-1 pe-1.5 ps-3 pb-1 pt-2">
        <If when={props.onMailboxes}>
          <Button icon="tray" label={t("tabs.folders")} variant="plain" onPress={() => props.onMailboxes?.()} testID="open-mailboxes" />
        </If>
        <If
          when={searching()}
          else={
            <Text role="header" class="line-clamp-1 flex-1 text-title2 font-bold text-label">
              {mailboxTitle()}
            </Text>
          }
        >
          <Text role="header" class="line-clamp-1 flex-1 text-title2 font-bold text-label" testID="results-title">
            {t("search.title", { query: searchQuery().trim() })}
          </Text>
        </If>
        <If
          when={listStatus() === "refreshing" && refreshingFrom() !== "pull"}
          else={
            <Button icon="arrow.clockwise" label={t("actions.refresh")} variant="plain" onPress={() => void refresh()} testID="refresh" />
          }
        >
          <ActivityIndicator size={20} label={t("sync.running")} testID="refreshing" />
        </If>
        <If when={props.touchActions && !picking() && rows().length > 0}>
          <Button title={t("actions.select")} variant="plain" onPress={() => beginPicking()} testID="select-rows" />
        </If>
        <Button icon="square.and.pencil" label={t("actions.compose")} variant="plain" onPress={() => props.onCompose()} testID="compose" />
      </View>
      <View class="px-3 pb-2">
        <SearchField
          value={searchQuery()}
          onChange={({ value }: { value: string }) => typeSearch(value)}
          onSubmit={() => void runSearch(searchQuery())}
          placeholder={t("search.placeholder")}
          label={t("search.label")}
          testID="search"
        />
      </View>
      <If when={searching()}>
        <Text role="summary" class="px-4 pb-1 text-footnote tabular-nums text-secondary-label">
          {resultCount(searchResults()?.length ?? 0)}
        </Text>
      </If>
      <SyncBanner />
      <View class="min-h-0 flex-1">
        <If when={searching()} else={<If when={folder() === "scheduled"} else={mailList()}><ScheduledList /></If>}>
          <If when={searchResults()?.length} else={<SearchEmpty />}>
            <MessageList
              items={searchResults() ?? []}
              selectedId={props.highlight ? selectedKey() : null}
              onOpen={open(() => searchResults() ?? [])}
              showAccount
              highlight={searchQuery()}
              label={t("search.results")}
              testID="results"
              empty={<SearchEmpty />}
            />
          </If>
        </If>
      </View>
    </View>
  );

  function mailList() {
    return (
      <MessageList
        items={rows()}
        selectedId={props.highlight ? selectedKey() : null}
        onOpen={open(rows)}
        refreshing={listStatus() === "refreshing" && refreshingFrom() === "pull"}
        onRefresh={() => void refresh("pull")}
        onLoadMore={() => void loadMore()}
        loadingMore={listStatus() === "more"}
        showAccount={mailbox().account === null}
        showRecipients={mailbox().folder === "sent" || mailbox().folder === "drafts"}
        label={t("list.conversations")}
        testID="messages"
        onArchive={props.touchActions && folder() !== "archive" && folder() !== "trash" ? move("archive") : undefined}
        onDelete={props.touchActions && folder() !== "trash" ? move("trash") : undefined}
        picked={isPicked}
        picking={!!props.touchActions && picking()}
        onPick={props.touchActions ? (id) => togglePicked(id) : undefined}
        empty={empty()}
      />
    );
  }
}
