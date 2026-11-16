// The Mailboxes tab: every inbox, each account's, and the folders; choosing
// one shows it in the Mail tab.
import { Text, View } from "nsh";
import { t } from "nsh/i18n";
import { ActivityIndicator, Button, Icon, List, ListTile, Section } from "cupertino";
import { BarSpace, Page } from "../components/Page";
import { AccountMark, Badge } from "../components/Marks";
import { NavContext, selectTab, TAB, tabs } from "../nav";
import { notificationsSection, showMail, showNotifications, unreadNotifications } from "../notify";
import { accountName, accounts, clearSearch, mailbox, mailStatus, openMailbox, refresh, unreadCount, type Mailbox } from "../store";

const folders: { folder: Mailbox["folder"]; icon: string }[] = [
  { folder: "sent", icon: "paperplane" },
  { folder: "scheduled", icon: "clock" },
  { folder: "drafts", icon: "pencil" },
  { folder: "archive", icon: "archivebox" },
  { folder: "trash", icon: "trash" },
];

export function FoldersPage() {
  const nav = NavContext();
  const choose = (account: string | null, folder: Mailbox["folder"]) => {
    clearSearch();
    showMail();
    openMailbox({ account, folder });
    tabs[0].stack.popToRoot();
    selectTab(TAB.mail);
  };
  return (
    <Page
      title={t("tabs.folders")}
      trailing={
        <If when={mailStatus().syncing}>
          <ActivityIndicator size={20} label={t("sync.running")} />
        </If>
      }
      testID="mailboxes"
    >
      <List>
        <BarSpace />
        <Section>
          <ListTile
            title={t("notify.allTitle")}
            leading="bell"
            accessory="chevron"
            checked={notificationsSection()}
            onPress={() => (showNotifications(), tabs[TAB.notifications].stack.popToRoot(), selectTab(TAB.notifications))}
            testID="mailbox-notifications"
          >
            <Badge value={unreadNotifications()} />
          </ListTile>
        </Section>
        <Section header={t("mailbox.mail")}>
          <ListTile
            title={t("mailbox.allInboxes")}
            leading="tray"
            accessory="checkmark"
            checked={!notificationsSection() && mailbox().account === null && mailbox().folder === "inbox"}
            onPress={() => choose(null, "inbox")}
            testID="mailbox-all"
          >
            <Badge value={unreadCount(null)} />
          </ListTile>
          <Each of={accounts()} key={(a) => a.id}>
            {(account, index) => (
              <ListTile
                title={accountName(account().id) ?? account().email}
                subtitle={account().email}
                accessory="checkmark"
                checked={!notificationsSection() && mailbox().account === account().id && mailbox().folder === "inbox"}
                onPress={() => choose(account().id, "inbox")}
                testID={`mailbox-account-${index()}`}
              >
                <View class="flex-row items-center gap-2">
                  <AccountMark index={index()} />
                  <Badge value={unreadCount(account().id)} />
                </View>
              </ListTile>
            )}
          </Each>
        </Section>
        <Section header={t("mailbox.folders")}>
          <Each of={folders} key={(f) => f.folder}>
            {(f, index) => (
              <ListTile
                title={t(`folder.${f().folder}`)}
                leading={f().icon}
                accessory="checkmark"
                checked={!notificationsSection() && mailbox().folder === f().folder}
                separator={index() < folders.length - 1}
                onPress={() => choose(mailbox().account, f().folder)}
                testID={`mailbox-${f().folder}`}
              />
            )}
          </Each>
        </Section>
        <Section>
          <View class="flex-row items-center gap-3 px-4 py-3">
            <Icon name="circle.lefthalf.filled" size={18} tint="secondary-label" />
            <Text class="flex-1 text-footnote text-secondary-label" testID="sync-status">
              {mailStatus().syncing
                ? mailStatus().progress?.messages
                  ? t("sync.progress", { count: mailStatus().progress?.messages ?? 0 })
                  : t("sync.running")
                : mailStatus().error
                  ? t("sync.failed")
                  : t(`mode.${mailStatus().mode}`)}
            </Text>
            <Button icon="arrow.clockwise" label={t("actions.refresh")} variant="plain" onPress={() => void refresh()} testID="refresh-all" />
            <Button icon="slider.horizontal.3" label={t("settings.title")} variant="plain" onPress={() => selectTab(TAB.settings)} testID="open-settings" />
          </View>
        </Section>
        {/* The tab bar floats over the list: its 49 pt of room at the end. */}
        <View class="h-12" />
      </List>
    </Page>
  );
}
