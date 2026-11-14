// Settings → Sources: where notifications come from, one row each. Pausing
// keeps a source's history and stops new notifications; the menu sends a test
// message, shows the ingest URL again (a new one) and deletes the source.
import { Text, View } from "nsh";
import { AlertDialog } from "nsh/base";
import { t } from "nsh/i18n";
import type { Source } from "agentinbox/native";
import { AppBar, Button, Card, Divider, Icon, IconButton, Menu, Page, SectionLabel } from "../ui";
import { PageHeader, PageScroll } from "../components/PageHeader";
import { SourceMark } from "../components/SourceMark";
import { NavContext } from "../nav";
import { deleteSource, rotateSource, serverInbox, setSourceEnabled, sources, testSource } from "../notify";

export function SourcesPage() {
  const nav = NavContext();
  const remove = async (source: Source) => {
    const { action } = await AlertDialog.show({
      title: t("sources.deleteTitle", { name: source.name }),
      description: t("sources.deleteBody"),
      actions: [
        { id: "cancel", label: t("common.cancel"), role: "cancel" },
        { id: "delete", label: t("sources.delete"), role: "destructive" },
      ],
    });
    if (action !== "delete") return;
    try {
      await deleteSource(source);
    } catch {
      // `deleteSource` said why.
    }
  };
  const showUrl = async (source: Source) => {
    try {
      const rotated = await rotateSource(source);
      if (rotated.ingestUrl) nav.stack.push({ name: "sourceIngest", source: rotated.source, url: rotated.ingestUrl, created: false });
    } catch (e) {
      void e;
    }
  };
  const row = (source: Source, index: number) => (
    <View class="min-h-[72px] flex-row items-center gap-3 py-2 pe-2 ps-4">
      <SourceMark source={source} />
      <View class="min-w-0 flex-1">
        <Text class="line-clamp-1 text-body-large tracking-body-large text-on-surface" testID={`source-${source.id}`}>
          {source.name}
        </Text>
        <Text class="line-clamp-1 text-body-medium tracking-body-medium text-on-surface-variant">
          {t(`source.kind.${source.kind}`)}
          {source.enabled ? "" : ` · ${t("sources.paused")}`}
          {source.minPriority > 0 ? ` · ${t("sources.fromPriority", { priority: t(`priority.${source.minPriority >= 7 ? "high" : "normal"}`) })}` : ""}
        </Text>
      </View>
      <Menu
        label={t("sources.actions", { name: source.name })}
        trigger={<IconButton icon="more" label={t("sources.actions", { name: source.name })} testID={`source-more-${index}`} />}
        actions={[
          ...(serverInbox() ? [{ id: "test", label: t("sources.test"), icon: "bell" as const, onSelect: () => void testSource(source) }] : []),
          {
            id: "toggle",
            label: source.enabled ? t("sources.pause") : t("sources.resume"),
            icon: source.enabled ? "minus" : "check",
            onSelect: () => void setSourceEnabled(source, !source.enabled),
          },
          ...(serverInbox() && source.kind !== "mail" ? [{ id: "url", label: t("sources.showUrl"), icon: "key" as const, onSelect: () => void showUrl(source) }] : []),
          ...(serverInbox() && source.kind !== "mail"
            ? [{ id: "delete", label: t("sources.delete"), icon: "trash" as const, destructive: true, onSelect: () => void remove(source) }]
            : []),
        ]}
      />
    </View>
  );
  const add = () => nav.stack.push({ name: "addSource" });
  const addAction = () => (
    <If when={serverInbox()}>
      <IconButton icon="plus" label={t("sources.add")} onPress={add} testID="sources-add-top" />
    </If>
  );
  return (
    <Page
      title={t("sources.title")}
      header={<PageHeader title={t("sources.title")} actions={addAction()} />}
      appBar={<AppBar title={t("sources.title")} actions={addAction()} />}
    >
      <PageScroll contentClass="gap-6 p-4" testID="sources">
        <If
          when={serverInbox()}
          else={
            <Card class="items-start gap-1 p-4" testID="sources-local">
              <Text class="text-title-small font-medium tracking-title-small text-on-surface">{t("sources.localTitle")}</Text>
              <Text class="text-body-medium tracking-body-medium text-on-surface-variant">{t("sources.localBody")}</Text>
            </Card>
          }
        >
          <View class="flex-row items-start gap-3 rounded-large bg-surface-container-low p-4">
            <Icon name="bell" tone="on-surface-variant" />
            <Text class="flex-1 text-body-medium tracking-body-medium text-on-surface-variant" testID="sources-intro">{t("sources.intro")}</Text>
          </View>
        </If>
        <View class="gap-1">
          <SectionLabel label={t("sources.list")} class="px-1" />
          <If
            when={sources().length}
            else={
              <Card class="items-start gap-2 p-4" testID="sources-local-empty">
                <Text class="text-body-large tracking-body-large text-on-surface">
                  {serverInbox() ? t("sources.empty") : t("sources.localEmpty")}
                </Text>
                <Text class="text-body-medium tracking-body-medium text-on-surface-variant">
                  {serverInbox() ? t("sources.emptyHint") : t("sources.localEmptyHint")}
                </Text>
                <If
                  when={serverInbox()}
                  else={<Button icon="plus" label={t("accounts.add")} onPress={() => nav.stack.push({ name: "addAccount" })} class="mt-2" testID="sources-local-add" />}
                >
                  <Button icon="plus" label={t("sources.add")} onPress={add} class="mt-2" testID="sources-add-empty" />
                </If>
              </Card>
            }
          >
            <Card>
              <Each of={sources()} key={(s) => s.id}>
                {(source, index) => (
                  <>
                    <If when={index() > 0}>
                      <Divider inset />
                    </If>
                    {row(source(), index())}
                  </>
                )}
              </Each>
              <If when={serverInbox()}>
                <>
                  <Divider inset />
                  <View class="p-3">
                    <Button variant="text" icon="plus" label={t("sources.add")} onPress={add} class="self-start" testID="sources-add" />
                  </View>
                </>
              </If>
            </Card>
          </If>
        </View>
      </PageScroll>
    </Page>
  );
}
