// A new API key: what it is called, whether its agent may mark read and
// archive, which sources it sees, and when it expires. The token comes next.
import { signal, View } from "nsh";
import { t } from "nsh/i18n";
import { ActionSheet, Button, List, ListTile, Section, Switch } from "cupertino";
import { Page } from "../components/Page";
import { FieldRow, FormNote } from "../components/Fields";
import { NavContext } from "../nav";
import { createKey, sources } from "../notify";
import { errorText } from "../store";

const expiry = [
  { value: "30", key: "days30" },
  { value: "90", key: "days90" },
  { value: "365", key: "year" },
  { value: "", key: "never" },
];

export function NewKeyPage() {
  const nav = NavContext();
  const name = signal("");
  const write = signal(false);
  const allSources = signal(true);
  const picked = signal<Record<string, boolean>>({});
  const expires = signal("90");
  const error = signal<string | null>(null);
  const saving = signal(false);
  const pickingExpiry = signal(false);

  const save = async () => {
    if (!name().trim()) {
      error.set(t("keys.nameRequired"));
      return;
    }
    error.set(null);
    saving.set(true);
    try {
      const created = await createKey({
        name: name().trim(),
        write: write(),
        sourceIds: allSources() ? [] : Object.keys(picked()).filter((id) => picked()[id]),
        expiresDays: expires() ? Number(expires()) : null,
      });
      nav.stack.replace({ name: "keyCreated", key: created.key, token: created.token });
    } catch (e) {
      error.set(errorText(e));
    } finally {
      saving.set(false);
    }
  };

  const expiryLabel = () => t(`keys.${expiry.find((e) => e.value === expires())?.key ?? "never"}`);
  return (
    <Page title={t("keys.new")} back={t("common.back")} onBack={nav.close} testID="new-key">
      <List>
        <Section footer={t("keys.nameHint")}>
          <FieldRow label={t("keys.name")} value={name()} onChange={name.set} autoFocus testID="key-name" />
        </Section>
        <Section>
          <ListTile title={t("keys.allowWrite")} subtitle={t("keys.allowWriteDetail")} accessory="none" separator={false} onPress={() => write.set(!write())} testID="key-write">
            <Switch checked={write()} label={t("keys.allowWrite")} onChange={({ value: on }: { value: boolean }) => write.set(on)} />
          </ListTile>
        </Section>
        <Section header={t("keys.sources")}>
          <ListTile
            title={t("keys.allSources")}
            accessory="checkmark"
            checked={allSources()}
            onPress={() => allSources.set(true)}
            testID="key-scope-all"
          />
          <ListTile
            title={t("keys.pickedSources")}
            accessory="checkmark"
            checked={!allSources()}
            separator={!allSources()}
            onPress={() => allSources.set(false)}
            testID="key-scope-picked"
          />
          <If when={!allSources()}>
            <Each of={sources()} key={(s) => s.id}>
              {(s) => (
                <ListTile title={s().name} accessory="none" separator testID={`key-source-${s().id}`}>
                  <Switch checked={!!picked()[s().id]} label={s().name} onChange={({ value: on }: { value: boolean }) => picked.update((p) => ({ ...p, [s().id]: on }))} />
                </ListTile>
              )}
            </Each>
          </If>
        </Section>
        <Section header={t("keys.expiry")}>
          <ListTile title={t("keys.expiry")} subtitle={expiryLabel()} accessory="chevron" separator={false} onPress={() => pickingExpiry.set(true)} testID="key-expiry" />
        </Section>
        <FormNote text={error()} error testID="key-error" />
        <Section>
          <View class="px-4 py-3">
            <Button title={t("keys.create")} icon="key" disabled={saving()} onPress={() => void save()} class="w-full" testID="key-create" />
          </View>
        </Section>
      </List>
      <ActionSheet
        open={pickingExpiry()}
        title={t("keys.expiry")}
        actions={expiry.map((e) => ({ id: e.value, title: t(`keys.${e.key}`) }))}
        cancel={t("common.cancel")}
        onOpenChange={({ open }: { open: boolean }) => {
          if (!open) pickingExpiry.set(false);
        }}
        onAction={({ id }: { id: string }) => {
          pickingExpiry.set(false);
          expires.set(id);
        }}
      />
    </Page>
  );
}
