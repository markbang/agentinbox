// Settings → API keys: the keys agents read and write the feed with. A key's
// token is shown once, when it is created; revoking stops its agent at once.
import { signal, Text, View } from "nsh";
import { t } from "nsh/i18n";
import type { ApiKey } from "agentinbox/native";
import { ActionSheet, Button, Icon, List, ListTile, Section } from "cupertino";
import { Page } from "../components/Page";
import { fullDate } from "../lib/format";
import { NavContext } from "../nav";
import { apiKeys, apiKeysState, keySources, loadKeys, revokeKey, serverInbox } from "../notify";

/** What a key may do, in a line. */
export function keyScopes(key: ApiKey) {
  return key.write ? t("keys.scopeWrite") : t("keys.scopeRead");
}

export function keyExpiry(key: ApiKey) {
  return key.expiresAt ? t("keys.expires", { date: fullDate(key.expiresAt) }) : t("keys.noExpiry");
}

/** A revoked key's line: it stays in the list as the server's record, disabled. */
export function keyRevoked(key: ApiKey) {
  return t("keys.revokedAt", { date: fullDate(key.revokedAt ?? 0) });
}

export function ApiKeysPage() {
  const nav = NavContext();
  const busy = signal<string | null>(null);
  const revoking = signal<ApiKey | null>(null);
  // The list loads when the page first shows, once per visit.
  const asked = signal(false);
  if (!asked()) {
    asked.set(true);
    void loadKeys();
  }
  const revoke = async (key: ApiKey) => {
    busy.set(key.id);
    try {
      await revokeKey(key);
    } catch {
      // `revokeKey` said why.
    } finally {
      busy.set(null);
    }
  };
  const lastUsed = (key: ApiKey) => (key.lastUsedAt ? t("keys.lastUsed", { date: fullDate(key.lastUsedAt) }) : t("keys.neverUsed"));
  const create = () => nav.stack.push({ name: "newKey" });
  return (
    <Page
      background="system-grouped-background"
      title={t("keys.title")}
      back={t("common.back")}
      onBack={nav.close}
      trailing={
        <If when={serverInbox()}>
          <Button icon="plus" label={t("keys.create")} variant="plain" onPress={create} testID="keys-add-top" />
        </If>
      }
      testID="api-keys"
    >
      <List scroll={false}>
        <Section footer={t("keys.intro")}>
          <If when={!serverInbox()}>
            <View class="gap-1 px-4 py-3" testID="keys-local">
              <Text class="text-body font-medium text-label">{t("keys.localTitle")}</Text>
              <Text class="text-subheadline text-secondary-label">{t("keys.localBody")}</Text>
            </View>
          </If>
        </Section>
        <If when={serverInbox()}>
          <Section header={t("keys.list")}>
            <If
              when={apiKeys().length}
              else={
                <View class="gap-2 px-4 py-4">
                  <Text class="text-body text-label">{t("keys.empty")}</Text>
                  <Text class="text-subheadline text-secondary-label">{t("keys.emptyHint")}</Text>
                  <Button title={t("keys.create")} icon="plus" onPress={create} class="self-start" testID="keys-add-empty" />
                </View>
              }
            >
              <Each of={apiKeys()} key={(k) => k.id}>
                {(k, index) => (
                  <If
                    when={!k().revokedAt}
                    else={
                      <ListTile
                        title={k().name}
                        subtitle={`${k().prefix}… · ${keyRevoked(k())}`}
                        accessory="none"
                        disabled={true}
                        separator
                        testID={`key-${k().id}`}
                      />
                    }
                  >
                    <ListTile
                      title={k().name}
                      subtitle={`${k().prefix}… · ${keyScopes(k())} · ${keySources(k())}`}
                      accessory="none"
                      separator
                      onPress={() => revoking.set(k())}
                      testID={`key-${k().id}`}
                    >
                      <View class="flex-row items-center gap-2">
                        <Text class="text-caption1 text-secondary-label">{lastUsed(k())}</Text>
                        <View
                          role="button"
                          accessibilityLabel={t("keys.actions", { name: k().name })}
                          onPress={() => revoking.set(k())}
                          class="size-9 items-center justify-center rounded-full active:bg-fill"
                          testID={`key-more-${index()}`}
                        >
                          <Icon name="ellipsis" size={18} tint="system-blue" />
                        </View>
                      </View>
                    </ListTile>
                  </If>
                )}
              </Each>
            </If>
          </Section>
          <If when={apiKeys().length}>
            <Section>
              <ListTile title={t("keys.create")} leading="plus" accessory="none" separator={false} onPress={create} testID="keys-add" />
            </Section>
          </If>
        </If>
        <If when={apiKeysState() === "error"}>
          <Section>
            <ListTile title={t("keys.loadFailed")} subtitle={t("keys.loadFailedHint")} leading="exclamationmark.triangle" onPress={() => void loadKeys()} testID="keys-retry" />
          </Section>
        </If>
      </List>
      <ActionSheet
        open={!!revoking()}
        title={t("keys.revokeTitle", { name: revoking()?.name ?? "" })}
        message={t("keys.revokeBody")}
        actions={[{ id: "revoke", title: t("keys.revoke"), destructive: true }]}
        cancel={t("common.cancel")}
        onOpenChange={({ open }: { open: boolean }) => {
          if (!open) revoking.set(null);
        }}
        onAction={({ id }: { id: string }) => {
          const k = revoking();
          revoking.set(null);
          if (id === "revoke" && k) void revoke(k);
        }}
        testID="key-revoke-confirm"
      />
    </Page>
  );
}
