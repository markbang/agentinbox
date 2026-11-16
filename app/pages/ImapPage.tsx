// An IMAP account: the address first, then its servers (found from the
// address, editable) and an app password.
import { openUrl, signal, Text, View } from "nsh";
import { t } from "nsh/i18n";
import { Mail, type Endpoint, type Security, type ServerSettings } from "agentinbox/native";
import { ActionSheet, Button, Icon, List, ListTile, Section } from "cupertino";
import { BarSpace, Page } from "../components/Page";
import { FieldRow } from "../components/Fields";
import { NavContext } from "../nav";
import { isAddress, providerName } from "../lib/format";
import { errorText, showToast } from "../store";

const guess = (email: string): ServerSettings => {
  const domain = email.split("@")[1] ?? "";
  return {
    username: email,
    imap: { host: domain ? `imap.${domain}` : "", port: 993, security: "tls" },
    smtp: { host: domain ? `smtp.${domain}` : "", port: 465, security: "tls" },
    auth: { kind: "password" },
    appPassword: true,
  };
};

export function ImapPage() {
  const nav = NavContext();
  const step = signal<"address" | "servers">("address");
  const email = signal("");
  const name = signal("");
  const password = signal("");
  const settings = signal<ServerSettings>(guess(""));
  const known = signal(false);
  const busy = signal(false);
  const securityFor = signal<"imap" | "smtp" | null>(null);
  // The failure, with its code: a refused sign-in also explains app passwords.
  const error = signal<{ text: string; code?: string } | null>(null);

  const set = (server: "imap" | "smtp", change: Partial<Endpoint>) => settings.update((s) => ({ ...s, [server]: { ...s[server], ...change } }));
  const port = (text: string) => Number.parseInt(text.replace(/\D/g, ""), 10) || 0;

  const fail = (e: unknown) => error.set({ text: errorText(e), code: (e as { code?: string })?.code });
  const detect = async () => {
    if (!isAddress(email())) return error.set({ text: t("imap.badEmail") });
    error.set(null);
    busy.set(true);
    try {
      const found = await Mail.detect(email().trim());
      known.set(!!found);
      settings.set(found ? { ...found, username: found.username || email().trim() } : guess(email().trim()));
      step.set("servers");
    } catch (e) {
      fail(e);
    } finally {
      busy.set(false);
    }
  };

  const add = async () => {
    const s = settings();
    if (!s.imap.host.trim() || !s.smtp.host.trim()) return error.set({ text: t("imap.needServers") });
    if (!password()) return error.set({ text: t("imap.needPassword") });
    error.set(null);
    busy.set(true);
    try {
      const account = await Mail.addImap({
        email: email().trim(),
        name: name().trim() || null,
        username: s.username.trim() || null,
        password: password(),
        imap: s.imap,
        smtp: s.smtp,
        provider: s.provider ?? null,
      });
      showToast(t("accounts.added", { email: account.email }));
      nav.done();
    } catch (e) {
      fail(e);
    } finally {
      busy.set(false);
    }
  };

  const provider = () => providerName(settings().provider, settings().displayName ?? "");
  const applySecurity = ({ id: value }: { id: string }) => {
    const which = securityFor();
    securityFor.set(null);
    if (which) set(which, { security: value as Security });
  };
  return (
    <Page title={t("accounts.other")} back={t("common.back")} onBack={nav.close} testID="imap">
      <List>
        <BarSpace />
        <Section footer={t("imap.nameHint")}>
          <FieldRow label={t("imap.email")} value={email()} onChange={(v) => (email.set(v), step.set("address"))} placeholder="you@example.com" keyboard="email" returnKey="next" onSubmit={() => void detect()} autoFocus testID="imap-email" />
          <FieldRow label={t("imap.name")} value={name()} onChange={(v) => name.set(v)} testID="imap-name" />
        </Section>

        <If when={step() === "servers"}>
          <Section
            header={t("imap.incoming")}
            footer={known() ? t("imap.found", { provider: provider() }) : t("imap.notFound")}
          >
            <FieldRow label={t("imap.imapHost")} value={settings().imap.host} onChange={(v) => set("imap", { host: v.trim() })} keyboard="url" testID="imap-host" />
            <FieldRow label={t("imap.port")} value={String(settings().imap.port || "")} onChange={(v) => set("imap", { port: port(v) })} keyboard="number" testID="imap-port" />
            <ListTile
              title={t("imap.security")}
              subtitle={settings().imap.security === "tls" ? t("imap.tls") : t("imap.starttls")}
              accessory="chevron"
              separator={false}
              onPress={() => securityFor.set("imap")}
              testID="imap-security"
            />
          </Section>
          <Section header={t("imap.outgoing")}>
            <FieldRow label={t("imap.smtpHost")} value={settings().smtp.host} onChange={(v) => set("smtp", { host: v.trim() })} keyboard="url" testID="smtp-host" />
            <FieldRow label={t("imap.port")} value={String(settings().smtp.port || "")} onChange={(v) => set("smtp", { port: port(v) })} keyboard="number" testID="smtp-port" />
            <ListTile
              title={t("imap.security")}
              subtitle={settings().smtp.security === "tls" ? t("imap.tls") : t("imap.starttls")}
              accessory="chevron"
              separator={false}
              onPress={() => securityFor.set("smtp")}
              testID="smtp-security"
            />
          </Section>
          <Section header={t("imap.password")} footer={t("imap.appPasswordHint")}>
            <FieldRow label={t("imap.username")} value={settings().username} onChange={(v) => settings.update((s) => ({ ...s, username: v.trim() }))} keyboard="email" />
            <FieldRow label={t("imap.password")} value={password()} onChange={(v) => password.set(v)} secure returnKey="done" onSubmit={() => void add()} testID="imap-password" />
          </Section>
          <If when={settings().auth.kind === "oauth"}>
            <Text class="px-4 pt-2 text-footnote text-secondary-label" testID="imap-oauth">
              {t("imap.useOAuth", { provider: provider() })}
            </Text>
          </If>
          <If when={settings().helpUrl}>
            {(url) => (
              <View class="px-4 pt-2">
                <Button
                  title={t("imap.appPasswordLink", { provider: provider() })}
                  variant="plain"
                  icon="arrow.up.right"
                  onPress={() => void openUrl(url())}
                  testID="imap-app-password"
                />
              </View>
            )}
          </If>
        </If>

        <If when={error()}>
          {(failure) => (
            <Section>
              <View role="alert" class="gap-1 px-4 py-3" testID="imap-error">
                <View class="flex-row items-start gap-2">
                  <Icon name="exclamationmark.triangle" size={16} tint="system-red" />
                  <Text class="flex-1 text-subheadline text-system-red">{failure().text}</Text>
                </View>
                <If when={failure().code === "ERR_AUTH"}>
                  <Text class="text-subheadline text-system-red">{t("imap.authFailed")}</Text>
                  <If when={settings().helpUrl}>
                    {(url) => (
                      <Button
                        title={t("imap.appPasswordLink", { provider: provider() })}
                        variant="plain"
                        size="small"
                        onPress={() => void openUrl(url())}
                        testID="imap-auth-help"
                      />
                    )}
                  </If>
                </If>
              </View>
            </Section>
          )}
        </If>

        <Section>
          <View class="px-4 py-3">
            <Button
              title={step() === "servers" ? (busy() ? t("imap.connecting") : t("imap.add")) : t("imap.continue")}
              disabled={busy()}
              onPress={() => void (step() === "servers" ? add() : detect())}
              class="w-full"
              testID={step() === "servers" ? "imap-add" : "imap-continue"}
            />
          </View>
        </Section>
      </List>
      <ActionSheet
        open={!!securityFor()}
        title={t("imap.security")}
        actions={[
          { id: "tls", title: t("imap.tls") },
          { id: "starttls", title: t("imap.starttls") },
        ]}
        cancel={t("common.cancel")}
        onOpenChange={({ open }: { open: boolean }) => {
          if (!open) securityFor.set(null);
        }}
        onAction={applySecurity}
      />
    </Page>
  );
}
