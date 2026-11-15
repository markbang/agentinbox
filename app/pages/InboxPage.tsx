// The Mail tab's first page: the chosen mailbox, its rows swiped and
// long-pressed as iOS Mail does, and the selection's actions in the bar.
import { Text, View } from "nsh";
import { BackHandler } from "nsh/mobile";
import { t } from "nsh/i18n";
import { Button } from "cupertino";
import { Page } from "../components/Page";
import { MailboxPane, mailboxTitle } from "../components/MailboxPane";
import { NavContext, selectTab, TAB } from "../nav";
import { clearPicked, mailbox, moveMessages, openRow, pickedIds, picking, refresh, rows, setFlags, setThreadFlags, type Row } from "../store";

export function InboxPage() {
  const nav = NavContext();
  const open = (row: Row) => {
    openRow(row);
    nav.stack.push({ name: "message", id: row.latest.id });
  };
  // Android back ends a selection.
  BackHandler.on("press", () => {
    if (!picking()) return false;
    clearPicked();
    return true;
  });
  const picked = () => rows().filter((r) => pickedIds().includes(r.key));
  const move = (folder: "archive" | "trash") => {
    const chosen = picked();
    clearPicked();
    moveMessages(
      chosen.map((r) => r.key),
      folder,
      chosen.some((r) => r.thread),
    );
  };
  const mark = () => {
    const unread = picked().some((r) => r.unread > 0);
    for (const r of picked()) void (r.thread ? setThreadFlags(r.key, { seen: unread }) : setFlags(r.key, { seen: unread }));
    clearPicked();
  };
  const selectionBar = () => (
    <View class="flex-row items-center gap-1 border-b border-separator bg-secondary-system-background px-2 py-1">
      <Button title={t("common.cancel")} variant="plain" size="small" onPress={clearPicked} testID="end-selection" />
      <Text role="header" class="flex-1 text-center text-subheadline font-semibold text-label" testID="selection-count">
        {t("actions.selected", { count: pickedIds().length })}
      </Text>
      <If when={mailbox().folder !== "archive" && mailbox().folder !== "trash"}>
        <Button icon="archivebox" label={t("actions.archive")} variant="plain" onPress={() => move("archive")} testID="picked-archive" />
      </If>
      <If when={mailbox().folder !== "trash"}>
        <Button icon="trash" label={t("actions.delete")} variant="plain" onPress={() => move("trash")} testID="picked-delete" />
      </If>
      <Button
        icon={picked().some((r) => r.unread > 0) ? "envelope.open" : "envelope"}
        label={picked().some((r) => r.unread > 0) ? t("actions.markRead") : t("actions.markUnread")}
        variant="plain"
        onPress={mark}
        testID="picked-seen"
      />
    </View>
  );
  return (
    <Page
      title={picking() ? t("actions.selected", { count: pickedIds().length }) : mailboxTitle()}
      testID="inbox"
    >
      <If when={picking()}>
        {selectionBar()}
      </If>
      <View class="min-h-0 flex-1">
        <MailboxPane
          onOpen={open}
          onAddAccount={() => nav.stack.push({ name: "addAccount" })}
          onCompose={() => nav.stack.push({ name: "compose", init: { mode: "new" } })}
          searchable={false}
          touchActions
        />
      </View>
    </Page>
  );
}
