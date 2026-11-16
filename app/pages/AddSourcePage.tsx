// Settings → Sources → Add: what kind of source. Mail accounts come from Add
// account; the chat bots arrive with the server's bot connections.
import { t } from "nsh/i18n";
import type { SourceKind } from "agentinbox/native";
import { List, ListTile, Section } from "cupertino";
import { BarSpace, Page } from "../components/Page";
import { kindIcon } from "../components/SourceMark";
import { NavContext } from "../nav";

/** The kinds a person can add now; the chats need the server's bot connections (M2). */
const kinds: { kind: SourceKind; enabled: boolean }[] = [
  { kind: "webhook", enabled: true },
  { kind: "gotify", enabled: true },
  { kind: "ntfy", enabled: true },
  { kind: "telegram", enabled: false },
  { kind: "discord", enabled: false },
  { kind: "slack", enabled: false },
  { kind: "feishu", enabled: false },
  { kind: "dingtalk", enabled: false },
  { kind: "wecom", enabled: false },
];

export function AddSourcePage() {
  const nav = NavContext();
  return (
    <Page title={t("sources.add")} back={t("common.back")} onBack={nav.close} testID="add-source">
      <List>
        <BarSpace />
        <Section footer={t("sources.chooseKind")}>
          <Each of={kinds} key={(k) => k.kind}>
            {(entry, index) => (
              <ListTile
                title={t(`source.kind.${entry().kind}`)}
                subtitle={entry().enabled ? t(`source.hint.${entry().kind}`) : t("sources.comingSoon")}
                leading={kindIcon(entry().kind)}
                accessory={entry().enabled ? "chevron" : "none"}
                disabled={!entry().enabled}
                separator={index() < kinds.length - 1}
                onPress={entry().enabled ? () => nav.stack.push({ name: "sourceForm", kind: entry().kind }) : undefined}
                testID={entry().enabled ? `kind-${entry().kind}` : undefined}
              />
            )}
          </Each>
        </Section>
      </List>
    </Page>
  );
}
