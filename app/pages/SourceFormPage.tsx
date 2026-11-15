// A new source: its name, the colour and icon it shows in the feed, and the
// priority it pushes from. Webhooks, Gotify and ntfy then show their URL once.
import { signal, Text, View } from "nsh";
import { t } from "nsh/i18n";
import type { SourceKind } from "agentinbox/native";
import { ActionSheet, Button, List, ListTile, Section } from "cupertino";
import { Page } from "../components/Page";
import { FieldRow, FormNote } from "../components/Fields";
import { kindIcon, sourceColours } from "../components/SourceMark";
import { NavContext } from "../nav";
import { createSource } from "../notify";
import { errorText, showToast } from "../store";

const icons = ["link", "bell", "envelope", "list.bullet", "paperplane", "sparkles", "person.crop.circle", "exclamationmark.triangle"];

const priorities = [
  { value: "0", key: "all" },
  { value: "3", key: "normal" },
  { value: "7", key: "high" },
];

export function SourceFormPage(props: { kind: SourceKind }) {
  const nav = NavContext();
  const name = signal("");
  const icon = signal<string>(kindIcon(props.kind));
  const color = signal<string>(sourceColours[0].id);
  const minPriority = signal("0");
  const error = signal<string | null>(null);
  const saving = signal(false);
  const pickingIcon = signal(false);
  const pickingPriority = signal(false);

  const save = async () => {
    if (!name().trim()) {
      error.set(t("sources.nameRequired"));
      return;
    }
    error.set(null);
    saving.set(true);
    try {
      const created = await createSource({ kind: props.kind, name: name().trim(), icon: icon(), color: color(), minPriority: Number(minPriority()) });
      if (created.ingestUrl) {
        nav.stack.replace({ name: "sourceIngest", source: created.source, url: created.ingestUrl, created: true });
      } else {
        showToast(t("sources.added", { name: created.source.name }));
        nav.close();
      }
    } catch (e) {
      error.set(errorText(e));
    } finally {
      saving.set(false);
    }
  };

  return (
    <Page title={t("sources.new")} back={t("common.back")} onBack={nav.close} testID="source-form">
      <List>
        <Section footer={t(`source.hint.${props.kind}`)}>
          <FieldRow label={t("sources.name")} value={name()} onChange={name.set} autoFocus testID="source-name" />
          <Text class="px-4 pb-1 text-footnote text-secondary-label">{t("sources.nameHint")}</Text>
          <ListTile
            title={t("sources.icon")}
            subtitle={icon()}
            accessory="chevron"
            separator={false}
            onPress={() => pickingIcon.set(true)}
            testID="source-icon"
          />
        </Section>
        <Section header={t("sources.color")}>
          <View class="flex-row flex-wrap items-center gap-3 px-4 py-3" testID="source-colors">
            <Each of={sourceColours} key={(c) => c.id}>
              {(c) => (
                <View
                  role="radio"
                  accessibilityLabel={c().id}
                  accessibilityState={{ checked: color() === c().id }}
                  onPress={() => color.set(c().id)}
                  class={`size-10 items-center justify-center rounded-full ${c().mark} ${color() === c().id ? "border-2 border-label" : ""}`}
                  testID={`source-color-${c().id}`}
                >
                  <View class={`size-5 rounded-full ${c().dot}`} />
                </View>
              )}
            </Each>
          </View>
        </Section>
        <Section header={t("sources.minPriority")} footer={t("sources.minPriorityHint")}>
          <ListTile
            title={t("sources.minPriority")}
            subtitle={t(`priority.${priorities.find((p) => p.value === minPriority())?.key ?? "all"}`)}
            accessory="chevron"
            separator={false}
            onPress={() => pickingPriority.set(true)}
            testID="source-priority"
          />
        </Section>
        <FormNote text={error()} error testID="source-error" />
        <Section>
          <View class="px-4 py-3">
            <Button title={t("sources.create")} icon="checkmark" disabled={saving()} onPress={() => void save()} class="w-full" testID="source-create" />
          </View>
        </Section>
      </List>
      <ActionSheet
        open={pickingIcon()}
        title={t("sources.icon")}
        actions={icons.map((name) => ({ id: name, title: name }))}
        cancel={t("common.cancel")}
        onOpenChange={({ open }: { open: boolean }) => {
          if (!open) pickingIcon.set(false);
        }}
        onAction={({ id }: { id: string }) => {
          pickingIcon.set(false);
          icon.set(id);
        }}
      />
      <ActionSheet
        open={pickingPriority()}
        title={t("sources.minPriority")}
        actions={priorities.map((p) => ({ id: p.value, title: t(`priority.${p.key}`) }))}
        cancel={t("common.cancel")}
        onOpenChange={({ open }: { open: boolean }) => {
          if (!open) pickingPriority.set(false);
        }}
        onAction={({ id }: { id: string }) => {
          pickingPriority.set(false);
          minPriority.set(id);
        }}
      />
    </Page>
  );
}
