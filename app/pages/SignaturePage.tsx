// An account's signature: plain text with a little formatting, shown as it
// will look, and whether new messages and replies get it.
import { signal, Text, untracked, View } from "nsh";
import { Input } from "nsh/base";
import { TextView } from "nsh/base";
import { t } from "nsh/i18n";
import { Button, List, ListTile, Section, Switch } from "cupertino";
import { Page } from "../components/Page";
import { NavContext } from "../nav";
import { renderSignature } from "../lib/signature";
import { accountById, errorText, setSignature, showToast } from "../store";

export function SignaturePage(props: { accountId: string }) {
  const nav = NavContext();
  const account = () => accountById(props.accountId);
  const kept = untracked(() => account()?.signature) ?? { text: "", newMessages: true, replies: true };
  const text = signal(kept.text);
  const newMessages = signal(kept.newMessages);
  const replies = signal(kept.replies);
  const saving = signal(false);
  const error = signal<string | null>(null);

  const save = async () => {
    saving.set(true);
    error.set(null);
    try {
      await setSignature(props.accountId, { text: text().trim() ? text() : "", newMessages: newMessages(), replies: replies() });
      showToast(t("signature.saved"));
      nav.close();
    } catch (e) {
      error.set(errorText(e));
    } finally {
      saving.set(false);
    }
  };

  return (
    <Page background="system-grouped-background" title={t("signature.title")} back={t("common.back")} onBack={nav.close} testID="signature">
      <List scroll={false}>
        <Section header={account()?.email ?? undefined} footer={t("signature.hint")}>
          <View class="px-4 py-3">
            <Input
              value={text()}
              onChange={({ value }) => text.set(value)}
              multiline
              autoFocus
              placeholder={t("signature.placeholder")}
              accessibilityLabel={t("signature.text")}
              testID="signature-text"
              class="min-h-32 flex-1 bg-transparent text-body leading-relaxed text-label caret-system-blue selection:bg-system-blue/30 placeholder:text-tertiary-label"
            />
          </View>
        </Section>
        <If when={text().trim()}>
          <Section header={t("signature.preview")}>
            <View class="gap-1 px-4 py-3">
              <Text class="text-body text-secondary-label">--</Text>
              <TextView html={renderSignature(text()).html} links="open" class="text-body text-label" testID="signature-preview" />
            </View>
          </Section>
        </If>
        <Section>
          <ListTile title={t("signature.newMessages")} accessory="none" separator onPress={() => newMessages.set(!newMessages())} testID="signature-new">
            <Switch checked={newMessages()} label={t("signature.newMessages")} onChange={({ value: on }: { value: boolean }) => newMessages.set(on)} />
          </ListTile>
          <ListTile title={t("signature.replies")} subtitle={t("signature.repliesDetail")} accessory="none" separator={false} onPress={() => replies.set(!replies())} testID="signature-replies">
            <Switch checked={replies()} label={t("signature.replies")} onChange={({ value: on }: { value: boolean }) => replies.set(on)} />
          </ListTile>
        </Section>
        <If when={error()}>
          {(text) => (
            <Text role="alert" class="px-4 text-subheadline text-system-red" testID="signature-error">
              {text()}
            </Text>
          )}
        </If>
        <Section>
          <View class="px-4 py-3">
            <Button title={t("signature.save")} disabled={saving()} onPress={() => void save()} class="w-full" testID="signature-save" />
          </View>
        </Section>
      </List>
    </Page>
  );
}
