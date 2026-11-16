// The Scheduled mailbox: messages waiting in the outbox for their time, and
// those that could not be sent. A row opens the message to edit; cancel takes
// it out, with Undo.
import { Text, View } from "nsh";
import { t } from "nsh/i18n";
import { Button, Icon, ScrollView } from "cupertino";
import { Mail, type Outgoing } from "agentinbox/native";
import { Empty, Loading } from "./Empty";
import { AccountMark } from "./Marks";
import { displayName, sendDate } from "../lib/format";
import { openCompose } from "../nav";
import { cancelScheduled, loadOutbox, outboxLoaded, waiting } from "../outbox";
import { accountIndex, errorText, mailbox, mailStatus, showToast } from "../store";

async function edit(o: Outgoing) {
  try {
    const back = await Mail.cancel(o.id);
    openCompose({ mode: "edit", outgoing: back });
  } catch (e) {
    showToast(errorText(e), "error");
    void loadOutbox();
  }
}

function ScheduledRow(props: { outgoing: Outgoing; showAccount: boolean }) {
  const o = () => props.outgoing;
  const to = () => o().draft.to.map(displayName).join(", ");
  const subject = () => o().draft.subject || t("reader.noSubject");
  const preview = () => o().draft.text.replace(/\s+/g, " ").trim();
  const when = () => sendDate(o().sendAt);
  return (
    <View
      role="button"
      accessibilityLabel={[to(), subject(), o().error ? t("outbox.notSent", { detail: o().error!.message }) : t("outbox.sends", { when: when() })].join(", ")}
      onPress={() => void edit(o())}
      class="flex-row items-center gap-2 border-b border-separator py-2.5 pl-3 pr-2 active:bg-fill"
      testID="scheduled-row"
    >
      <If when={props.showAccount}>
        <AccountMark index={accountIndex(o().draft.accountId)} shape="bar" />
      </If>
      <View class="min-w-0 flex-1 gap-0.5">
        <View class="flex-row items-center gap-2">
          <If when={o().error}>
            <Icon name="exclamationmark.triangle" size={14} tint="system-red" />
          </If>
          <Text class="line-clamp-1 flex-1 text-body text-label">{to()}</Text>
          <Text class={`shrink-0 text-footnote tabular-nums ${o().error ? "text-system-red" : "text-secondary-label"}`}>{when()}</Text>
        </View>
        <Text class="line-clamp-1 text-subheadline text-label">{subject()}</Text>
        <If
          when={o().error}
          else={<If when={preview()}><Text class="line-clamp-1 text-subheadline text-secondary-label">{preview()}</Text></If>}
        >
          {(e) => <Text class="line-clamp-2 text-subheadline text-system-red">{t("outbox.notSent", { detail: e().message })}</Text>}
        </If>
      </View>
      <Button icon="xmark" label={t("outbox.cancel")} variant="plain" onPress={() => void cancelScheduled(o().id)} testID="scheduled-cancel" />
    </View>
  );
}

export function ScheduledList() {
  void loadOutbox();
  const items = () => waiting(mailbox().account);
  return (
    <If
      when={items().length}
      else={
        <If when={outboxLoaded()} else={<Loading label={t("reader.loading")} />}>
          <Empty
            icon="clock"
            title={t("outbox.empty")}
            description={mailStatus().mode === "local" ? t("outbox.localHint") : t("outbox.emptyHint")}
          />
        </If>
      }
    >
      <ScrollView class="flex-1" testID="scheduled">
        <View class="pb-6">
          <Each of={items()} key={(o) => o.id}>
            {(o) => <ScheduledRow outgoing={o()} showAccount={mailbox().account === null} />}
          </Each>
          <If when={mailStatus().mode === "local"}>
            <Text class="px-4 py-3 text-footnote text-secondary-label">{t("outbox.localHint")}</Text>
          </If>
        </View>
      </ScrollView>
    </If>
  );
}
