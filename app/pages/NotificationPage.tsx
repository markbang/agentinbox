// One notification on a page of its own: its source, sender, tags, body and
// actions.
import { t } from "nsh/i18n";
import { Page } from "../components/Page";
import { Empty } from "../components/Empty";
import { NotificationReader } from "../components/NotificationReader";
import { NavContext, phoneStack, selectTab, TAB } from "../nav";
import { archiveNotifications, markNotifications, notifications, sourceById } from "../notify";
import { openMessage } from "../store";

export function NotificationPage(props: { id: string }) {
  const nav = NavContext();
  const note = () => notifications().find((n) => n.id === props.id);
  const source = () => sourceById(note()?.sourceId);
  const openMail = () => {
    openMessage(props.id);
    selectTab(TAB.mail);
    phoneStack.setRoutes([{ name: "inbox" }, { name: "message", id: props.id }]);
  };
  return (
    <Page title={source()?.name ?? t("notify.title")} back={t("common.back")} onBack={nav.close} testID="notification-page">
      <If when={note()} else={<Empty icon="bell" title={t("notify.gone")} description={t("notify.goneHint")} />}>
        {(n) => (
          <NotificationReader
            note={n()}
            source={source()}
            onToggleRead={() => void markNotifications([n().id], !n().read)}
            onArchive={() => {
              archiveNotifications([n().id]);
              nav.close();
            }}
            onOpenMail={n().threadId ? openMail : undefined}
          />
        )}
      </If>
    </Page>
  );
}
