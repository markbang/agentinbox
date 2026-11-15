// A message on a page of its own (phones and narrow windows): the reader
// with its actions at the foot, and the flag and message menu in the bar.
import { signal } from "nsh";
import { t } from "nsh/i18n";
import { ActionSheet, Button } from "cupertino";
import { Page } from "../components/Page";
import { Empty, Loading } from "../components/Empty";
import { Reader } from "../components/Reader";
import { NavContext } from "../nav";
import { conversation, current, setFlags, shownMessage } from "../store";
import type { ComposeMode } from "../lib/format";

export function MessagePage(props: { id: string }) {
  const nav = NavContext();
  const menu = signal(false);
  const message = () => shownMessage();
  const compose = (mode: ComposeMode) => nav.stack.push({ name: "compose", init: { mode, source: message() } });
  return (
    <Page
      title={message()?.subject ?? ""}
      back={t("common.back")}
      onBack={nav.close}
      trailing={
        <If when={message()}>
          {(m) => (
            <Button icon="ellipsis" label={t("thread.messageActions")} variant="plain" onPress={() => menu.set(true)} testID="message-more" />
          )}
        </If>
      }
    >
      <If
        when={message()}
        else={
          <If
            when={current.error()}
            else={<Loading label={t("reader.loading")} />}
          >
            <Empty
              icon="exclamationmark.triangle"
              title={t("reader.failed")}
              description={t("reader.failedHint")}
              action={<Button title={t("actions.retry")} variant="tinted" icon="arrow.clockwise" onPress={() => current.refetch()} testID="reader-retry" />}
            />
          </If>
        }
      >
        {(m) => <Reader message={m()} conversation={conversation()} onCompose={compose} toolbar phone onLeave={nav.close} />}
      </If>
      <ActionSheet
        open={menu()}
        title={message()?.subject}
        actions={[
          { id: "flag", title: message()?.flagged ? t("actions.unflag") : t("actions.flag") },
          { id: "seen", title: message()?.seen ? t("actions.markUnread") : t("actions.markRead") },
        ]}
        cancel={t("common.cancel")}
        onOpenChange={({ open }: { open: boolean }) => menu.set(open)}
        onAction={({ id }: { id: string }) => {
          const m = message();
          menu.set(false);
          if (!m) return;
          if (id === "flag") void setFlags(m.id, { flagged: !m.flagged });
          if (id === "seen") void setFlags(m.id, { seen: !m.seen });
        }}
        testID="message-menu"
      />
    </Page>
  );
}
