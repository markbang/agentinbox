// The split view's sidebar, as Mail draws it on an iPad: the sections of the
// app (notifications, mailboxes, folders), the sync status at the foot.
import { Scroll, Text, View } from "nsh";
import { t } from "nsh/i18n";
import { ActivityIndicator, Icon } from "cupertino";
import { AccountMark, Badge } from "./Marks";
import { notificationsSection, showMail, showNotifications, unreadNotifications } from "../notify";
import { accountName, accounts, clearSearch, mailbox, mailStatus, openMailbox, refresh, unreadCount, type Mailbox } from "../store";

const folders: { folder: Mailbox["folder"]; icon: string }[] = [
  { folder: "sent", icon: "paperplane" },
  { folder: "scheduled", icon: "clock" },
  { folder: "drafts", icon: "pencil" },
  { folder: "archive", icon: "archivebox" },
  { folder: "trash", icon: "trash" },
];

export interface SidebarProps {
  onSettings: () => void;
  onMailboxes?: () => void;
}

function Row(props: {
  label: string;
  icon?: string;
  account?: number;
  badge?: number;
  selected: boolean;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <View
      role="button"
      accessibilityLabel={props.label}
      accessibilityState={{ selected: props.selected }}
      onPress={props.onPress}
      testID={props.testID}
      class={`min-h-11 flex-row items-center gap-3 rounded-[8px] px-3 active:bg-fill ${props.selected ? "bg-fill" : ""}`}
    >
      <View class="w-6 items-center">
        <If when={props.account !== undefined} else={<Icon name={props.icon ?? "envelope"} size={20} tint={props.selected ? "label" : "system-blue"} />}>
          <AccountMark index={props.account ?? 0} />
        </If>
      </View>
      <Text class={`line-clamp-1 flex-1 text-body ${props.selected ? "font-semibold text-label" : "text-label"}`}>{props.label}</Text>
      <Badge value={props.badge ?? 0} />
    </View>
  );
}

function Heading(props: { label: string }) {
  return (
    <Text role="header" class="px-3 pb-1 pt-5 text-footnote font-semibold uppercase text-secondary-label">
      {props.label}
    </Text>
  );
}

export function Sidebar(props: SidebarProps) {
  const busy = () => mailStatus().syncing;
  return (
    <View class="h-full flex-col border-r border-separator bg-system-grouped-background" testID="sidebar">
      <Scroll class="flex-1"><View class="px-2 pb-3">
        <View class="px-3 pb-1 pt-3">
          <Text role="header" class="text-title2 font-bold text-label">
            {t("tabs.folders")}
          </Text>
        </View>
        <Row
          label={t("notify.allTitle")}
          icon="bell"
          badge={unreadNotifications()}
          selected={notificationsSection()}
          onPress={() => showNotifications()}
          testID="rail-notifications"
        />
        <Heading label={t("mailbox.mail")} />
        <Row
          label={t("mailbox.allInboxes")}
          icon="tray"
          badge={unreadCount(null)}
          selected={!notificationsSection() && mailbox().account === null && mailbox().folder === "inbox"}
          onPress={() => {
            showMail();
            clearSearch();
            openMailbox({ account: null, folder: "inbox" });
          }}
          testID="mailbox-all"
        />
        <Each of={accounts()} key={(a) => a.id}>
          {(account, index) => (
            <Row
              label={accountName(account().id) ?? account().email}
              account={index()}
              badge={unreadCount(account().id)}
              selected={!notificationsSection() && mailbox().account === account().id && mailbox().folder === "inbox"}
              onPress={() => {
                showMail();
                clearSearch();
                openMailbox({ account: account().id, folder: "inbox" });
              }}
              testID={`mailbox-account-${index()}`}
            />
          )}
        </Each>
        <Heading label={t("mailbox.folders")} />
        <Each of={folders} key={(f) => f.folder}>
          {(f) => (
            <Row
              label={t(`folder.${f().folder}`)}
              icon={f().icon}
              selected={!notificationsSection() && mailbox().folder === f().folder}
              onPress={() => {
                showMail();
                clearSearch();
                openMailbox({ account: mailbox().account, folder: f().folder });
              }}
              testID={`mailbox-${f().folder}`}
            />
          )}
        </Each>
      </View></Scroll>
      <View class="flex-row items-center gap-2 border-t border-separator px-2 py-2">
        <View class="min-w-0 flex-1 flex-row items-center gap-2">
          <If when={busy()}>
            <ActivityIndicator size={16} label={t("sync.running")} />
          </If>
          <Text class="line-clamp-1 text-footnote text-secondary-label" testID="sync-status">
            {busy()
              ? mailStatus().progress?.messages
                ? t("sync.progress", { count: mailStatus().progress?.messages ?? 0 })
                : t("sync.running")
              : mailStatus().error
                ? t("sync.failed")
                : t(`mode.${mailStatus().mode}`)}
          </Text>
        </View>
        <View
          role="button"
          accessibilityLabel={t("actions.refresh")}
          onPress={() => void refresh()}
          class="size-9 items-center justify-center rounded-full active:bg-fill"
          testID="refresh-all"
        >
          <Icon name="arrow.clockwise" size={18} tint="system-blue" />
        </View>
        <View
          role="button"
          accessibilityLabel={t("settings.title")}
          onPress={() => props.onSettings()}
          class="size-9 items-center justify-center rounded-full active:bg-fill"
          testID="open-settings"
        >
          <Icon name="slider.horizontal.3" size={18} tint="system-blue" />
        </View>
      </View>
    </View>
  );
}
