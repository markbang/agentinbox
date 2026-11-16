// A source's ingest URL, the one moment it is shown: copy it into the
// service's webhook field (or a script), send a test message, done.
import { Clipboard, Text, View } from "nsh";
import { t } from "nsh/i18n";
import type { Source } from "agentinbox/native";
import { Button, Icon, List, Section } from "cupertino";
import { Page } from "../components/Page";
import { SourceMark } from "../components/SourceMark";
import { NavContext } from "../nav";
import { testSource } from "../notify";
import { showToast } from "../store";

export function SourceIngestPage(props: { source: Source; url: string; created: boolean }) {
  const nav = NavContext();
  const back = () => {
    const routes = nav.stack.routes();
    const at = routes.map((route) => route.name).lastIndexOf("sources");
    if (at >= 0) nav.stack.pop(routes.length - 1 - at);
    else nav.close();
  };
  const copy = async () => {
    try {
      await Clipboard.writeText(props.url);
      showToast(t("sources.copied"));
    } catch {
      showToast(t("errors.clipboard"), "error");
    }
  };
  return (
    <Page background="system-grouped-background" title={t("sources.ingest")} back={t("common.back")} onBack={back} testID="source-ingest">
      <List scroll={false}>
        <Section>
          <View class="flex-row items-center gap-3 px-4 py-3">
            <SourceMark source={props.source} />
            <View class="min-w-0 flex-1">
              <Text class="line-clamp-1 text-body font-medium text-label">{props.source.name}</Text>
              <Text class="text-footnote text-secondary-label">{t(`source.kind.${props.source.kind}`)}</Text>
            </View>
          </View>
        </Section>
        <If when={props.created}>
          <Section>
            <View class="flex-row items-start gap-2 px-4 py-3">
              <Icon name="exclamationmark.triangle" size={16} tint="system-orange" />
              <Text class="flex-1 text-subheadline text-label">{t("sources.onlyOnce")}</Text>
            </View>
          </Section>
        </If>
        <Section header={t("sources.url")} footer={t(`source.send.${props.source.kind}`)}>
          <View class="gap-3 px-4 py-3">
            <View class="rounded-[8px] bg-fill px-3 py-2.5">
              <Text class="text-footnote text-label" testID="source-url">

                {props.url}
              </Text>
            </View>
            <View class="flex-row items-center gap-2">
              <Button title={t("sources.copy")} icon="doc" variant="tinted" onPress={() => void copy()} testID="source-copy" />
              <Button title={t("sources.test")} icon="bell" variant="plain" onPress={() => void testSource(props.source)} testID="source-test" />
            </View>
          </View>
        </Section>
        <Section>
          <View class="px-4 py-3">
            <Button title={t("common.done")} onPress={back} class="w-full" testID="source-done" />
          </View>
        </Section>
      </List>
    </Page>
  );
}
