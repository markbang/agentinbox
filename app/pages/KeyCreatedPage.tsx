// The new key's token, shown once: copy it into the agent's configuration
// (REST, SSE or MCP), warning that it cannot be read again.
import { Clipboard, Text, View } from "nsh";
import { t } from "nsh/i18n";
import type { ApiKey } from "agentinbox/native";
import { Button, Icon, List, Section } from "cupertino";
import { Page } from "../components/Page";
import { keyExpiry, keyScopes } from "./ApiKeysPage";
import { NavContext } from "../nav";
import { showToast } from "../store";

export function KeyCreatedPage(props: { apiKey: ApiKey; token: string }) {
  const nav = NavContext();
  const back = () => {
    const routes = nav.stack.routes();
    const at = routes.map((route) => route.name).lastIndexOf("apiKeys");
    if (at >= 0) nav.stack.pop(routes.length - 1 - at);
    else nav.close();
  };
  const copy = async () => {
    try {
      await Clipboard.writeText(props.token);
      showToast(t("keys.copied"));
    } catch {
      showToast(t("errors.clipboard"), "error");
    }
  };
  return (
    <Page title={t("keys.created")} back={t("common.back")} onBack={back} testID="key-created">
      <List>
        <Section>
          <View class="flex-row items-start gap-2 px-4 py-3">
            <Icon name="exclamationmark.triangle" size={16} tint="system-orange" />
            <Text class="flex-1 text-subheadline text-label">{t("keys.onlyOnce")}</Text>
          </View>
        </Section>
        <Section header={props.apiKey.name} footer={`${keyScopes(props.apiKey)} · ${keyExpiry(props.apiKey)}${"\n"}${t("keys.usage")}`}>
          <View class="gap-3 px-4 py-3">
            <View class="rounded-[8px] bg-fill px-3 py-2.5">
              <Text class="text-footnote text-label" testID="key-token">
                {props.token}
              </Text>
            </View>
            <Button title={t("keys.copy")} icon="doc" variant="tinted" onPress={() => void copy()} class="self-start" testID="key-copy" />
          </View>
        </Section>
        <Section>
          <View class="px-4 py-3">
            <Button title={t("common.done")} onPress={back} class="w-full" testID="key-done" />
          </View>
        </Section>
      </List>
    </Page>
  );
}
