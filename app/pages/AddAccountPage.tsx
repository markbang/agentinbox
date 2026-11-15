// Adding an account: Gmail and Outlook sign in with OAuth, anything else
// with IMAP and an app password.
import { Image, signal, Text, View, type ImageAsset } from "nsh";
import { t } from "nsh/i18n";
import { Mail, type OAuthProvider } from "agentinbox/native";
import { ActivityIndicator, Icon } from "cupertino";
import { Page } from "../components/Page";
import { NavContext } from "../nav";
import { errorText, showToast } from "../store";
import google from "../assets/google.svg";
import microsoft from "../assets/microsoft.svg";

function Choice(props: { title: string; detail: string; mark?: ImageAsset; icon?: string; busy: boolean; disabled: boolean; onPress: () => void; testID: string }) {
  return (
    <View
      role="button"
      accessibilityLabel={props.title}
      disabled={props.disabled}
      onPress={() => props.onPress()}
      testID={props.testID}
      class={`min-h-14 flex-row items-center gap-3 rounded-row border border-separator bg-secondary-system-background px-4 py-3 active:bg-fill ${props.disabled ? "opacity-40" : ""}`}
    >
      <If when={props.mark} else={<Icon name={props.icon ?? "envelope"} size={22} tint="system-blue" />}>
        <Image src={props.mark} class="size-6" />
      </If>
      <View class="min-w-0 flex-1">
        <Text class="text-body font-medium text-label">{props.title}</Text>
        <Text class="text-footnote text-secondary-label">{props.detail}</Text>
      </View>
      <If when={props.busy} else={<Icon name="chevron.right" size={13} tint="tertiary-label" />}>
        <ActivityIndicator size={18} label={props.title} />
      </If>
    </View>
  );
}

export function AddAccountPage() {
  const nav = NavContext();
  const busy = signal<OAuthProvider | null>(null);
  const oauth = async (provider: OAuthProvider) => {
    busy.set(provider);
    try {
      const account = await Mail.addOAuth(provider);
      showToast(t("accounts.added", { email: account.email }));
      nav.done();
    } catch (e) {
      showToast(errorText(e), "error");
    } finally {
      busy.set(null);
    }
  };
  return (
    <Page title={t("accounts.add")} back={t("common.back")} onBack={nav.close} testID="add-account">
      <View class="gap-4 px-4 py-4">
        <View class="gap-1">
          <Text role="header" class="text-title3 font-semibold text-label">
            {t("accounts.addTitle")}
          </Text>
          <Text class="text-subheadline text-secondary-label">{t("accounts.addHint")}</Text>
        </View>
        <Choice
          title={t("accounts.google")}
          detail={t("provider.gmail")}
          mark={google}
          busy={busy() === "google"}
          disabled={!!busy()}
          onPress={() => void oauth("google")}
          testID="add-google"
        />
        <Choice
          title={t("accounts.microsoft")}
          detail={t("provider.outlook")}
          mark={microsoft}
          busy={busy() === "microsoft"}
          disabled={!!busy()}
          onPress={() => void oauth("microsoft")}
          testID="add-microsoft"
        />
        <Choice
          title={t("accounts.other")}
          detail={t("accounts.otherHint")}
          icon="envelope"
          busy={false}
          disabled={!!busy()}
          onPress={() => nav.stack.push({ name: "imap" })}
          testID="add-imap"
        />
      </View>
    </Page>
  );
}
