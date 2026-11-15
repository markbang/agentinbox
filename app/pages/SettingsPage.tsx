// Settings, as iOS writes it: grouped lists of rows, switches, and the
// accounts' own pages. Signing out and removing an account ask first.
import { appInfo, Notifications, platform, signal, Text, View } from "nsh";
import { t } from "nsh/i18n";
import { Mail, type Account } from "agentinbox/native";
import { ActionSheet, Icon, List, ListTile, Section, Switch } from "cupertino";
import { Page } from "../components/Page";
import { NavContext } from "../nav";
import { sources } from "../notify";
import { providerName as named } from "../lib/format";
import { shortcutsOpen } from "../lib/shortcuts";
import { setUndoDelay, UNDO_DELAYS, undoDelay } from "../outbox";
import {
  accounts,
  conversationsEnabled,
  errorText,
  mailStatus,
  notificationsEnabled,
  sessionChanged,
  setConversationsEnabled,
  setNotificationsEnabled,
  showToast,
} from "../store";

/** "QQ Mail", "IMAP": who runs the account, as people know it. */
const providerName = (a: Account) => named(a.provider, t("provider.imap"));

export function SettingsPage() {
  const nav = NavContext();
  const menuFor = signal<string | null>(null);
  const confirm = signal<{ kind: "remove" | "signOut"; account?: Account } | null>(null);
  const undoFor = signal(false);

  const remove = async (a: Account) => {
    try {
      await Mail.removeAccount(a.id);
      showToast(t("accounts.removed", { email: a.email }));
    } catch (e) {
      showToast(errorText(e), "error");
    }
  };

  const signOut = async () => {
    // The screen changes whatever the backend ends up saying: it has ended the session on this
    // device already, and a teardown that fails must not leave the sheet up with no way back.
    let failure: unknown;
    try {
      await Mail.signOut();
    } catch (e) {
      failure = e;
    }
    nav.done();
    await sessionChanged();
    if (failure) showToast(errorText(failure), "error");
  };

  const toggleNotifications = async (on: boolean) => {
    if (on) {
      const permission = await Notifications.requestPermission().catch(() => "unavailable" as const);
      if (permission === "denied") showToast(t("settings.notificationsDenied"), "error");
    }
    await setNotificationsEnabled(on);
  };

  const account = () => accounts().find((a) => a.id === menuFor());
  return (
    <Page title={t("settings.title")} testID="settings">
      <List>
        <Section header={t("settings.accounts")}>
          <Each of={accounts()} key={(a) => a.id}>
            {(a, index) => (
              <ListTile
                title={a().email}
                subtitle={a().name ? `${a().name} · ${providerName(a())}` : providerName(a())}
                leading="person.crop.circle"
                accessory="none"
                separator
                testID={`account-${index()}`}
              >
                <View
                  role="button"
                  accessibilityLabel={t("accounts.actions", { email: a().email })}
                  onPress={() => menuFor.set(a().id)}
                  class="size-9 items-center justify-center rounded-full active:bg-fill"
                  testID={`account-more-${index()}`}
                >
                  <Icon name="ellipsis" size={18} tint="system-blue" />
                </View>
              </ListTile>
            )}
          </Each>
          <ListTile title={t("accounts.add")} leading="plus" accessory="none" separator={false} onPress={() => nav.stack.push({ name: "addAccount" })} testID="add-account" />
        </Section>

        <Section header={t("settings.sync")} footer={mailStatus().mode === "local" ? t("settings.localDetail") : (mailStatus().server ?? "")}>
          <ListTile
            title={t(`mode.${mailStatus().mode}`)}
            subtitle={mailStatus().mode === "cloud" && mailStatus().user ? t("settings.signedInAs", { email: mailStatus().user ?? "" }) : undefined}
            leading={mailStatus().mode === "cloud" ? "cloud" : "circle.lefthalf.filled"}
            accessory="none"
            separator
            testID="signed-in-as"
          />
          <ListTile
            title={t("settings.signOut")}
            leading="arrow.up.right"
            leadingColor="system-red"
            destructive
            accessory="none"
            separator={false}
            onPress={() => confirm.set({ kind: "signOut" })}
            testID="sign-out"
          />
        </Section>

        <Section header={t("settings.notifications")}>
          <ListTile
            title={t("settings.newMailNotifications")}
            subtitle={t("settings.notificationsDetail")}
            accessory="none"
            separator
            onPress={() => void toggleNotifications(!notificationsEnabled())}
            testID="notifications"
          >
            <Switch checked={notificationsEnabled()} label={t("settings.newMailNotifications")} onChange={({ value: on }: { value: boolean }) => void toggleNotifications(on)} />
          </ListTile>
          <ListTile
            title={t("sources.title")}
            subtitle={t("settings.sourcesDetail", { count: sources().length })}
            leading="bell"
            onPress={() => nav.stack.push({ name: "sources" })}
            testID="settings-sources"
          />
          <ListTile title={t("rules.title")} subtitle={t("rules.summary")} leading="line.3.horizontal.decrease" onPress={() => nav.stack.push({ name: "notifyRules" })} testID="settings-rules" />
          <ListTile
            title={t("keys.title")}
            subtitle={t("settings.keysDetail")}
            leading="key"
            accessory="chevron"
            separator={false}
            onPress={() => nav.stack.push({ name: "apiKeys" })}
            testID="settings-keys"
          />
        </Section>

        <Section header={t("settings.reading")}>
          <ListTile
            title={t("settings.conversations")}
            subtitle={t("settings.conversationsDetail")}
            accessory="none"
            separator={false}
            onPress={() => void setConversationsEnabled(!conversationsEnabled())}
            testID="conversations"
          >
            <Switch checked={conversationsEnabled()} label={t("settings.conversations")} onChange={({ value: on }: { value: boolean }) => void setConversationsEnabled(on)} />
          </ListTile>
        </Section>

        <Section header={t("settings.sending")} footer={t("settings.undoSendDetail")}>
          <ListTile
            title={t("settings.undoSend")}
            subtitle={undoDelay() ? t("settings.seconds", { n: undoDelay() }) : t("settings.undoOff")}
            accessory="none"
            separator={false}
            onPress={() => undoFor.set(true)}
            testID="undo-send"
          />
        </Section>

        <Section
          header={t("settings.help")}
          footer={`${t("settings.about", { version: appInfo().version ?? "" })}${mailStatus().mode === "local" && platform.os === "android" ? ` · ${t("settings.androidLocal")}` : ""}`}
        >
          <ListTile
            title={t("shortcuts.title")}
            subtitle={t("shortcuts.summary")}
            leading="list.bullet"
            accessory="none"
            separator={false}
            onPress={() => (nav.done(), shortcutsOpen.set(true))}
            testID="open-shortcuts"
          />
        </Section>
      </List>

      <ActionSheet
        open={!!menuFor()}
        title={account()?.email}
        actions={[
          { id: "signature", title: t("signature.menu") },
          { id: "remove", title: t("accounts.removeMenu"), destructive: true },
        ]}
        cancel={t("common.cancel")}
        onOpenChange={({ open }: { open: boolean }) => {
          if (!open) menuFor.set(null);
        }}
        onAction={({ id }: { id: string }) => {
          const a = account();
          menuFor.set(null);
          if (!a) return;
          if (id === "signature") nav.stack.push({ name: "signature", account: a.id });
          if (id === "remove") confirm.set({ kind: "remove", account: a });
        }}
      />
      <ActionSheet
        open={undoFor()}
        title={t("settings.undoSend")}
        actions={UNDO_DELAYS.map((s) => ({ id: String(s), title: s ? t("settings.seconds", { n: s }) : t("settings.undoOff") }))}
        cancel={t("common.cancel")}
        onOpenChange={({ open }: { open: boolean }) => {
          if (!open) undoFor.set(false);
        }}
        onAction={({ id }: { id: string }) => {
          undoFor.set(false);
          void setUndoDelay(Number(id));
        }}
      />
      <ActionSheet
        open={!!confirm()}
        title={confirm()?.kind === "remove" ? t("accounts.removeTitle", { email: confirm()?.account?.email ?? "" }) : t("settings.signOutTitle")}
        message={
          confirm()?.kind === "remove"
            ? t("accounts.removeBody")
            : mailStatus().mode === "local"
              ? t("settings.signOutLocal")
              : t("settings.signOutCloud")
        }
        actions={[{ id: "go", title: confirm()?.kind === "remove" ? t("accounts.remove") : t("settings.signOut"), destructive: true }]}
        cancel={t("common.cancel")}
        onOpenChange={({ open }: { open: boolean }) => {
          if (!open) confirm.set(null);
        }}
        onAction={({ id }: { id: string }) => {
          const c = confirm();
          confirm.set(null);
          if (id !== "go" || !c) return;
          if (c.kind === "remove" && c.account) void remove(c.account);
          else void signOut();
        }}
        testID="confirm-dialog"
      />
    </Page>
  );
}
