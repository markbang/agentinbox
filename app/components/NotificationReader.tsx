// One notification, whole: its source, sender and time, the tags, the body,
// and its actions (read, archive, open the link, open the mail it came from).
import { openUrl, Text, View } from "nsh";
import { t } from "nsh/i18n";
import type { Notification, Source } from "agentinbox/native";
import { Button, Icon, ScrollView } from "cupertino";
import { fullDate } from "../lib/format";
import { SourceMark, Tags } from "./SourceMark";

export function NotificationReader(props: {
  note: Notification;
  source?: Source;
  onToggleRead: () => void;
  onArchive: () => void;
  onOpenMail?: () => void;
}) {
  const n = () => props.note;
  return (
    <ScrollView class="flex-1" testID="notify-reader">
      <View class="gap-4 px-4 pb-10 pt-4" testID="notify-scroll">
        <View class="flex-row items-center gap-2">
          <If when={props.source}>{(s) => <SourceMark source={s()} size="sm" />}</If>
          <Text class="text-footnote font-semibold text-secondary-label" testID="notify-source">
            {props.source?.name ?? ""}
          </Text>
          <View class="flex-1" />
          <Text class="text-caption1 tabular-nums text-secondary-label">{fullDate(n().receivedAt)}</Text>
        </View>
        <Text role="header" class="text-title2 font-semibold text-label" testID="notify-title">
          {n().title}
        </Text>
        <Text class="text-subheadline text-secondary-label">{n().sender}</Text>
        <If when={n().priority >= 7}>
          <View class="flex-row items-center gap-1.5">
            <View accessibilityElementsHidden class="size-2 rounded-full bg-system-red" />
            <Text class="text-footnote font-medium text-system-red">{t("notify.highPriority")}</Text>
          </View>
        </If>
        <If when={n().tags.length}>
          <Tags tags={n().tags} />
        </If>
        <View class="flex-row flex-wrap items-center gap-2">
          <If when={n().link}>
            {(link) => <Button title={t("notify.openLink")} icon="arrow.up.right" variant="tinted" onPress={() => void openUrl(link()).catch(() => {})} testID="notify-open-link" />}
          </If>
          <If when={props.onOpenMail}>
            <Button title={t("notify.openMail")} icon="envelope" variant="plain" onPress={() => props.onOpenMail?.()} testID="notify-open-mail" />
          </If>
          <View class="flex-1" />
          <View
            role="button"
            accessibilityLabel={n().read ? t("actions.markUnread") : t("actions.markRead")}
            onPress={() => props.onToggleRead()}
            class="size-10 items-center justify-center rounded-full active:bg-fill"
            testID="notify-read"
          >
            <Icon name={n().read ? "envelope" : "envelope.open"} size={20} tint="system-blue" />
          </View>
          <View
            role="button"
            accessibilityLabel={t("actions.archive")}
            onPress={() => props.onArchive()}
            class="size-10 items-center justify-center rounded-full active:bg-fill"
            testID="notify-archive"
          >
            <Icon name="archivebox" size={20} tint="system-blue" />
          </View>
        </View>
        <View class="h-[0.33px] bg-separator" />
        <Text class="text-body leading-relaxed text-label" testID="notify-body">
          {n().body}
        </Text>
      </View>
    </ScrollView>
  );
}
