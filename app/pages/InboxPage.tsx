// The Mail tab's first page: the chosen mailbox, its rows swiped and
// long-pressed as iOS Mail does, and the selection's actions in the bar. The
// bar is glass over the rows, and the compose button is a floating control of
// glass at the foot, as Mail draws it.
import { platform, View } from "nsh";
import { BackHandler } from "nsh/mobile";
import { t } from "nsh/i18n";
import { ActivityIndicator, Button } from "cupertino";
import { Page } from "../components/Page";
import { MailboxPane, mailboxTitle } from "../components/MailboxPane";
import { NavContext, openCompose } from "../nav";
import { beginPicking, clearPicked, listStatus, mailbox, moveMessages, openRow, pickedIds, picking, refresh, refreshingFrom, rows, setFlags, setThreadFlags, type Row } from "../store";

export function InboxPage() {
  const nav = NavContext();
  const open = (row: Row) => {
    openRow(row);
    nav.stack.push({ name: "message", id: row.latest.id });
  };
  // Android back ends a selection; a browser has no back button to hear.
  if (platform.os === "ios" || platform.os === "android") {
    BackHandler.on("press", () => {
      if (!picking()) return false;
      clearPicked();
      return true;
    });
  }
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
  const compose = () => openCompose({ mode: "new" });
  // The selection's actions are the bar's: glass over the rows, as Mail has them.
  const selectionActions = () => (
    <>
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
    </>
  );
  const barActions = () => (
    <>
      <If
        when={listStatus() === "refreshing" && refreshingFrom() !== "pull"}
        else={<Button icon="arrow.clockwise" label={t("actions.refresh")} variant="plain" onPress={() => void refresh()} testID="refresh" />}
      >
        <ActivityIndicator size={20} label={t("sync.running")} testID="refreshing" />
      </If>
      <If when={rows().length > 0}>
        <Button title={t("actions.select")} variant="plain" onPress={() => beginPicking()} testID="select-rows" />
      </If>
    </>
  );
  return (
    <Page
      scroll={false}
      // A selection leaves with Cancel at the leading edge; the actions take the trailing capsule.
      leading={picking() ? <Button title={t("common.cancel")} variant="plain" size="medium" onPress={clearPicked} testID="end-selection" /> : undefined}
      title={picking() ? t("actions.selected", { count: pickedIds().length }) : mailboxTitle()}
      titleTestID={picking() ? "selection-count" : undefined}
      trailing={picking() ? selectionActions() : barActions()}
      testID="inbox"
    >
      <View class="min-h-0 flex-1">
        <MailboxPane
          onOpen={open}
          onAddAccount={() => nav.stack.push({ name: "addAccount" })}
          onCompose={compose}
          searchable={false}
          touchActions
          floating
        />
      </View>
    </Page>
  );
}
