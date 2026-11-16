// Settings → Notifications → Per source and priority: what each source's
// notifications do — a system notification, a line in the feed only, or
// nothing. The app's own switch stays the master switch.
import { Text, View } from "nsh";
import { t } from "nsh/i18n";
import { ActionSheet, Icon, List, ListTile, Section } from "cupertino";
import { signal } from "nsh";
import { Page } from "../components/Page";
import { SourceMark } from "../components/SourceMark";
import { NavContext } from "../nav";
import { band, rulesOf, setRule, sources, type Band, type NotifyMode } from "../notify";

const bands: Band[] = ["high", "normal", "low"];
const modes: NotifyMode[] = ["notify", "silent", "off"];

export function NotifyRulesPage() {
  const nav = NavContext();
  const editing = signal<{ source: string; at: Band } | null>(null);
  const rule = () => {
    const e = editing();
    return e ? rulesOf(e.source)[e.at] : "notify";
  };
  return (
    <Page background="system-grouped-background" title={t("rules.title")} back={t("common.back")} onBack={nav.close} testID="notify-rules">
      <List scroll={false}>
        <Section footer={t("rules.intro")}>
          <Each of={sources()} key={(s) => s.id}>
            {(source) => (
              <>
                <ListTile title={source().name} accessory="none" separator>
                  <SourceMark source={source()} size="sm" />
                </ListTile>
                <Each of={bands} key={(b) => b}>
                  {(at) => (
                    <View
                      role="button"
                      accessibilityLabel={`${t(`band.${at()}`)}: ${t(`notifyMode.${rulesOf(source().id)[at()]}`)}`}
                      onPress={() => editing.set({ source: source().id, at: at() })}
                      testID={`rule-${source().id}-${at()}`}
                      class={`min-h-11 flex-row items-center gap-3 border-b border-separator px-4 py-2 active:bg-fill ${at() === "low" ? "border-b-0" : ""}`}
                    >
                      <View class="flex-1">
                        <Text class="text-body text-label">{t(`band.${at()}`)}</Text>
                        <Text class="text-footnote text-secondary-label">{t(`notifyMode.${rulesOf(source().id)[at()]}`)}</Text>
                      </View>
                      <Icon name="chevron.right" size={13} tint="tertiary-label" />
                    </View>
                  )}
                </Each>
              </>
            )}
          </Each>
        </Section>
        <If when={!sources().length}>
          <Section>
            <View class="px-4 py-3">
              <Text class="text-subheadline text-secondary-label" testID="rules-empty">
                {t("rules.empty")}
              </Text>
            </View>
          </Section>
        </If>
      </List>
      <ActionSheet
        open={!!editing()}
        title={editing() ? t("rules.label", { source: sources().find((s) => s.id === editing()?.source)?.name ?? "", priority: t(`band.${editing()?.at ?? "normal"}`) }) : undefined}
        actions={modes.map((mode) => ({ id: mode, title: t(`notifyMode.${mode}`) }))}
        cancel={t("common.cancel")}
        onOpenChange={({ open }: { open: boolean }) => {
          if (!open) editing.set(null);
        }}
        onAction={({ id: mode }: { id: string }) => {
          const e = editing();
          editing.set(null);
          if (e) void setRule(e.source, e.at, mode as NotifyMode);
        }}
        testID="rule-sheet"
      />
    </Page>
  );
}
