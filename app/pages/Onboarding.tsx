// The first screen: where mail comes from. A browser cannot reach mail
// servers, so on the web only a server (cloud mode) is offered.
import { Notifications, platform, signal, Text, UrlScheme, View } from "nsh";
import { t } from "nsh/i18n";
import { Mail } from "agentinbox/native";
import { ActivityIndicator, Button, Icon, List, ListTile, ScrollView, Section, SegmentedControl, TextField } from "cupertino";
import { errorText, sessionChanged } from "../store";

const web = platform.os === "web";

/** Our hosted server, prefilled for cloud mode on native platforms; the user may change it. */
const DEFAULT_SERVER = "https://mail-api.bangwu.me";

/** The web client is served by its server: the page's origin. */
function pageOrigin() {
  try {
    return new URL(UrlScheme.url() ?? "").origin;
  } catch {
    return "";
  }
}

export function Onboarding() {
  const mode = signal<"local" | "cloud">(web ? "cloud" : "local");
  const signUp = signal(false);
  const server = signal(web ? pageOrigin() : DEFAULT_SERVER);
  const email = signal("");
  const password = signal("");
  const busy = signal(false);
  const error = signal<string | null>(null);

  const finish = async () => {
    // Asked here, as the user acts: browsers refuse a prompt nobody caused.
    void Notifications.requestPermission().catch(() => undefined);
    await sessionChanged();
  };
  const go = async () => {
    error.set(null);
    busy.set(true);
    try {
      if (mode() === "local") await Mail.useLocal();
      else await Mail.signIn(server(), email().trim(), password(), signUp());
      await finish();
    } catch (e) {
      error.set(errorText(e));
    } finally {
      busy.set(false);
    }
  };

  return (
    <ScrollView class="flex-1" testID="onboarding">
      <View class="items-center px-6 pb-10 pt-12">
        <View class="w-full max-w-[440px] gap-6">
          <View class="items-center gap-3">
            <View class="size-[72px] items-center justify-center rounded-[18px] bg-system-blue/15">
              <Icon name="tray" size={38} tint="system-blue" />
            </View>
            <Text role="header" class="text-center text-largeTitle font-bold text-label">
              {t("onboarding.title")}
            </Text>
            <Text class="text-center text-body text-secondary-label">{web ? t("onboarding.subtitleWeb") : t("onboarding.subtitle")}</Text>
          </View>

          <If when={!web} else={<Text class="text-center text-subheadline text-secondary-label">{t("onboarding.webOnlyCloud")}</Text>}>
            <List scroll={false} background="system-background">
              <Section>
                <ListTile
                  title={t("onboarding.local")}
                  subtitle={t("onboarding.localDetail")}
                  leading="circle.lefthalf.filled"
                  accessory="checkmark"
                  checked={mode() === "local"}
                  onPress={() => mode.set("local")}
                  testID="mode-local"
                />
                <ListTile
                  title={t("onboarding.cloud")}
                  subtitle={t("onboarding.cloudDetail")}
                  leading="cloud"
                  accessory="checkmark"
                  checked={mode() === "cloud"}
                  separator={false}
                  onPress={() => mode.set("cloud")}
                  testID="mode-cloud"
                />
              </Section>
            </List>
          </If>

          <If when={mode() === "cloud"}>
            <View class="gap-2.5">
              <SegmentedControl
                items={[
                  { value: "in", title: t("onboarding.signIn") },
                  { value: "up", title: t("onboarding.signUp") },
                ]}
                value={signUp() ? "up" : "in"}
                onChange={({ value }: { value: string }) => signUp.set(value === "up")}
                label={t("onboarding.signIn")}
              />
              <TextField value={server()} onChange={({ value: v }: { value: string }) => server.set(v)} keyboard="url" placeholder="https://mail.example.com" label={t("onboarding.server")} testID="server" />
              <Text class="px-1 text-footnote text-secondary-label">{t("onboarding.serverHint")}</Text>
              <TextField value={email()} onChange={({ value: v }: { value: string }) => email.set(v)} keyboard="email" placeholder={t("onboarding.email")} label={t("onboarding.email")} testID="cloud-email" />
              <TextField
                value={password()}
                onChange={({ value: v }: { value: string }) => password.set(v)}
                secure
                placeholder={t("onboarding.password")}
                label={t("onboarding.password")}
                returnKey="go"
                onSubmit={() => void go()}
                testID="cloud-password"
              />
              <If when={signUp()}>
                <Text class="px-1 text-footnote text-secondary-label">{t("onboarding.passwordHint")}</Text>
              </If>
            </View>
          </If>

          <If when={error()}>
            <Text role="alert" class="text-center text-subheadline text-system-red" testID="onboarding-error">
              {error() ?? ""}
            </Text>
          </If>

          <View class="items-center gap-3">
            <Button
              title={mode() === "local" ? t("onboarding.useLocal") : signUp() ? t("onboarding.createAccount") : t("onboarding.signIn")}
              disabled={busy()}
              onPress={() => void go()}
              class="w-full"
              testID="onboarding-go"
            />
            <If when={busy()}>
              <ActivityIndicator label={t("onboarding.signIn")} />
            </If>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
