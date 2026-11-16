// Settings → Sources: where notifications come from, one row each. Pausing
// keeps a source's history and stops new notifications; the menu sends a test
// message, shows the ingest URL again (a new one) and deletes the source.
import { signal, Text, View } from "nsh";
import { t } from "nsh/i18n";
import type { Source } from "agentinbox/native";
import { ActionSheet, AlertDialog, Button, Icon, List, ListTile, Section } from "cupertino";
import { Page } from "../components/Page";
import { SourceMark } from "../components/SourceMark";
import { NavContext } from "../nav";
import { deleteSource, rotateSource, serverInbox, setSourceEnabled, sources, testSource } from "../notify";

export function SourcesPage() {
  const nav = NavContext();
  const menuFor = signal<string | null>(null);
  const deleting = signal<Source | null>(null);
  const source = () => sources().find((s) => s.id === menuFor());
  const remove = async (s: Source) => {
    try {
      await deleteSource(s);
    } catch {
      // `deleteSource` said why.
    }
  };
  const showUrl = async (s: Source) => {
    try {
      const rotated = await rotateSource(s);
      if (rotated.ingestUrl) nav.stack.push({ name: "sourceIngest", source: rotated.source, url: rotated.ingestUrl, created: false });
    } catch (e) {
      void e;
    }
  };
  const add = () => nav.stack.push({ name: "addSource" });
  return (
    <Page
      background="system-grouped-background"
      title={t("sources.title")}
      back={t("common.back")}
      onBack={nav.close}
      trailing={
        <If when={serverInbox()}>
          <Button icon="plus" label={t("sources.add")} variant="plain" onPress={add} testID="sources-add-top" />
        </If>
      }
      testID="sources"
    >
      <List scroll={false}>
        <If
          when={serverInbox()}
          else={
            <Section header={t("sources.localTitle")}>
              <View class="px-4 py-3">
                <Text class="text-subheadline text-secondary-label">{t("sources.localBody")}</Text>
              </View>
            </Section>
          }
        >
          <Section>
            <View class="px-4 py-3">
              <Text class="text-footnote text-secondary-label" testID="sources-intro">
                {t("sources.intro")}
              </Text>
            </View>
          </Section>
        </If>
        <Section header={t("sources.list")}>
          <If
            when={sources().length}
            else={
              <View class="gap-2 px-4 py-4" testID="sources-local-empty">
                <Text class="text-body text-label">{serverInbox() ? t("sources.empty") : t("sources.localEmpty")}</Text>
                <Text class="text-subheadline text-secondary-label">{serverInbox() ? t("sources.emptyHint") : t("sources.localEmptyHint")}</Text>
                <If
                  when={serverInbox()}
                  else={<Button title={t("accounts.add")} icon="plus" onPress={() => nav.stack.push({ name: "addAccount" })} class="self-start" testID="sources-local-add" />}
                >
                  <Button title={t("sources.add")} icon="plus" onPress={add} class="self-start" testID="sources-add-empty" />
                </If>
              </View>
            }
          >
            <Each of={sources()} key={(s) => s.id}>
              {(s, index) => (
                <ListTile
                  title={s().name}
                  subtitle={[
                    t(`source.kind.${s().kind}`),
                    s().enabled ? "" : t("sources.paused"),
                    s().minPriority > 0 ? t("sources.fromPriority", { priority: t(`priority.${s().minPriority >= 7 ? "high" : "normal"}`) }) : "",
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                  accessory="none"
                  separator
                  onPress={() => menuFor.set(s().id)}
                  testID={`source-${s().id}`}
                >
                  <View class="flex-row items-center gap-2">
                    <SourceMark source={s()} />
                    <View
                      role="button"
                      accessibilityLabel={t("sources.actions", { name: s().name })}
                      onPress={() => menuFor.set(s().id)}
                      class="size-9 items-center justify-center rounded-full active:bg-fill"
                      testID={`source-more-${index()}`}
                    >
                      <Icon name="ellipsis" size={18} tint="system-blue" />
                    </View>
                  </View>
                </ListTile>
              )}
            </Each>
          </If>
        </Section>
        <If when={serverInbox() && sources().length}>
          <Section>
            <ListTile title={t("sources.add")} leading="plus" accessory="none" separator={false} onPress={add} testID="sources-add" />
          </Section>
        </If>
      </List>
      <ActionSheet
        open={!!menuFor()}
        title={source()?.name}
        actions={[
          ...(serverInbox() ? [{ id: "test", title: t("sources.test") }] : []),
          { id: "toggle", title: source()?.enabled ? t("sources.pause") : t("sources.resume") },
          ...(serverInbox() && source()?.kind !== "mail" ? [{ id: "url", title: t("sources.showUrl") }] : []),
          ...(serverInbox() && source()?.kind !== "mail" ? [{ id: "delete", title: t("sources.delete"), destructive: true }] : []),
        ]}
        cancel={t("common.cancel")}
        onOpenChange={({ open }: { open: boolean }) => {
          if (!open) menuFor.set(null);
        }}
        onAction={({ id }: { id: string }) => {
          const s = source();
          menuFor.set(null);
          if (!s) return;
          if (id === "test") void testSource(s);
          if (id === "toggle") void setSourceEnabled(s, !s.enabled);
          if (id === "url") void showUrl(s);
          if (id === "delete") deleting.set(s);
        }}
      />
      <AlertDialog
        open={!!deleting()}
        title={t("sources.deleteTitle", { name: deleting()?.name ?? "" })}
        message={t("sources.deleteBody")}
        actions={[
          { id: "cancel", title: t("common.cancel") },
          { id: "delete", title: t("sources.delete"), destructive: true },
        ]}
        onOpenChange={({ open }: { open: boolean }) => {
          if (!open) deleting.set(null);
        }}
        onAction={({ id }: { id: string }) => {
          const s = deleting();
          deleting.set(null);
          if (id === "delete" && s) void remove(s);
        }}
        testID="source-delete-confirm"
      />
    </Page>
  );
}
