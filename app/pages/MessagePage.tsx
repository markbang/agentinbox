// A message on a page of its own (phones and narrow windows): the reader,
// with its actions at the foot and its menu beside the subject.
import { t } from "nsh/i18n";
import { Button } from "cupertino";
import { Page } from "../components/Page";
import { Empty, Loading } from "../components/Empty";
import { Reader } from "../components/Reader";
import { NavContext, openCompose } from "../nav";
import { conversation, current, setFlags, shownMessage } from "../store";
import type { ComposeMode } from "../lib/format";

export function MessagePage(props: { id: string }) {
  const nav = NavContext();
  const message = () => shownMessage();
  const compose = (mode: ComposeMode) => openCompose({ mode, source: message() });
  return (
    <Page
      scroll={false}
      title={message()?.subject ?? ""}
      back={t("common.back")}
      onBack={nav.close}
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
    </Page>
  );
}
