// Writing a message: a new one, a reply (quoted), a forward, or one taken out
// of the outbox to edit. What is typed is a draft (../drafts.ts): closing the
// composer keeps it (an edited outbox message goes back to the outbox),
// Cancel asks first. Send waits out the undo delay with Undo; the clock
// schedules it (../outbox.ts).
import { cleanup, effect, keymap, Picker, platform, signal, Text, untracked, View } from "nsh";
import { Input } from "nsh/base";
import { t } from "nsh/i18n";
import { Mail, type Draft as MailDraft, type Outgoing } from "agentinbox/native";
import { ActionSheet, AlertDialog, Button } from "cupertino";
import { Page } from "../components/Page";
import { ChoiceRow, FormNote, TextRow } from "../components/Fields";
import { AttachmentChips } from "../components/Attachments";
import { ScheduleDialog } from "../components/ScheduleDialog";
import { onPageDrop, type Incoming } from "../lib/attachments";
import { endDraft, holdDraft, isEnded, useDraft } from "../drafts";
import { isAddress, parseRecipient, sendDate, splitRecipients, type ComposeInit } from "../lib/format";
import { queueDraft, schedulePresets, undoDelay } from "../outbox";
import { bodyHtml, signatureMode, swapSignature } from "../lib/signature";
import { accountById, accounts, errorText, mailbox, showToast } from "../store";
import { isModalOpen, NavContext, show } from "../nav";
import { wide } from "../layout";

export function ComposePage(props: { init: ComposeInit }) {
  const nav = NavContext();
  const draft = useDraft(props.init, accounts(), mailbox().account ?? accounts()[0]?.id ?? null);
  const { start, from, to, cc, bcc, subject, files } = draft;
  const body = draft.text;
  const showCc = signal(!!cc() || !!bcc());
  const sending = signal(false);
  const error = signal<string | null>(null);
  const confirming = signal(false);
  const picking = signal(false);
  const dragging = signal(false);
  const editing = props.init.mode === "edit" ? props.init.outgoing : undefined;
  const signing = signatureMode(props.init);
  // Another account's signature replaces this one's, unless the user changed it.
  const changeFrom = (id: string) => {
    body.set(swapSignature(body(), start.text, accountById(from()), accountById(id), signing));
    from.set(id);
  };
  const attach = (list: Incoming[]) => files.add(list);
  onPageDrop((on) => dragging.set(on), attach);
  const pick = async () => {
    try {
      attach((await Picker.pickFiles({ multiple: true })).map((p) => p.file));
    } catch (e) {
      files.setError(errorText(e));
    }
  };

  const discard = () => {
    confirming.set(false);
    endDraft(draft, "discarded");
    nav.close();
  };
  // Only an explicit Cancel throws typed text away, and only after asking.
  const askDiscard = () => {
    if (!draft.edited() && !editing) return nav.close();
    confirming.set(true);
  };

  const title = () =>
    ({ new: t("compose.new"), reply: t("compose.reply"), replyAll: t("compose.reply"), forward: t("compose.forward"), edit: t("compose.editTitle") })[props.init.mode];

  const message = (): MailDraft => ({
    accountId: from() ?? "",
    to: splitRecipients(to()).map(parseRecipient),
    cc: splitRecipients(cc()).map(parseRecipient),
    bcc: splitRecipients(bcc()).map(parseRecipient),
    subject: subject(),
    text: body(),
    html: bodyHtml(body(), accountById(from()), signing),
    inReplyTo: start.inReplyTo,
    references: start.references,
    attachments: files.draft(),
  });
  /** The message to send, or null with the reason shown. */
  const ready = (): MailDraft | null => {
    const recipients = [...splitRecipients(to()), ...splitRecipients(cc()), ...splitRecipients(bcc())];
    const bad = recipients.find((r) => !isAddress(r));
    if (!from()) return error.set(t("compose.noAccount")), null;
    if (!splitRecipients(to()).length) return error.set(t("compose.needRecipient")), null;
    if (bad) return error.set(t("compose.badAddress", { address: bad })), null;
    error.set(null);
    if (files.pending()) return files.setError(t("compose.stillUploading")), null;
    if (files.items().some((a) => a.failed)) return files.setError(t("compose.removeFailed")), null;
    if (files.overLimit()) return files.setError(files.limitText()), null;
    files.setError(null);
    return message();
  };

  // Undo brings this draft back as it was, in a composer of its own context.
  const reopen = (hold: ReturnType<typeof holdDraft>, back: Outgoing) => {
    hold.restore();
    // A forward's files came back as uploads; the draft still names the originals.
    const mine = new Set(files.draft().flatMap((a) => (a.kind === "upload" ? [a.id] : [])));
    for (const f of back.files) if (!mine.has(f.id)) void Mail.unstage(f.id).catch(() => {});
    // The sheet it came from is closed: the wide layout opens a new one, a phone pushes the page.
    if (wide()) show({ name: "compose", init: props.init }, true);
    else nav.stack.push({ name: "compose", init: props.init });
  };

  /** Sends now (no undo delay), after the undo delay (`at` null), or at `at`. */
  const go = async (at: number | null) => {
    if (sending()) return;
    const d = ready();
    if (!d) return;
    sending.set(true);
    try {
      if (at === null && undoDelay() === 0) {
        await Mail.send(d);
        endDraft(draft, "sent");
        showToast(t("compose.sent"));
      } else {
        let hold: ReturnType<typeof holdDraft> | undefined;
        await queueDraft(d, at, { onUndo: (back) => hold && reopen(hold, back), onKept: () => hold?.release() });
        hold = holdDraft(draft);
      }
      nav.done();
    } catch (e) {
      error.set(errorText(e));
    } finally {
      sending.set(false);
    }
  };
  const send = () => go(null);
  keymap.bind("mod+enter", () => void send(), { when: "always" });

  // An outbox message being edited goes back when the composer closes without Send or Discard:
  // by its Close button, by the sheet's backdrop or Escape, or by a phone's back gesture.
  const putBack = () => {
    if (isEnded(draft)) return;
    endDraft(draft, "sent");
    Mail.queue(message(), { sendAt: Math.max(editing!.sendAt, Date.now()) }).catch((e) => showToast(t("compose.notKept", { detail: errorText(e) }), "error"));
  };
  if (editing) {
    cleanup(putBack);
    // The wide layout's sheet may close without the page: the backdrop, Escape.
    let wasOpen = untracked(isModalOpen);
    effect(() => {
      const open = isModalOpen();
      if (wasOpen && !open) putBack();
      wasOpen = open;
    });
  }
  const close = () => {
    if (editing) putBack();
    nav.close();
  };

  const schedule = (at: number | null) => {
    picking.set(false);
    if (at) void go(at);
  };
  // The clock asks how soon: iOS's presets, or a day and a time of its own.
  const choosing = signal(false);
  const scheduleAt = (id: string) => {
    choosing.set(false);
    if (id === "pick") return picking.set(true);
    const preset = schedulePresets().find((p) => p.id === id);
    if (preset) void go(preset.at);
  };
  const actions = () => (
    <View class="flex-row items-center gap-1">
      <Button icon="clock" label={t("compose.schedule")} variant="plain" disabled={sending()} onPress={() => choosing.set(true)} testID="send-later" />
      <Button
        title={sending() ? t("compose.sending") : t("compose.send")}
        variant="plain"
        disabled={sending()}
        onPress={() => void send()}
        testID="send"
      />
    </View>
  );
  const replying = props.init.mode === "reply" || props.init.mode === "replyAll";
  // What the user writes goes above the quote and the signature.
  const caretAtTop = replying || !draft.edited();
  return (
    <Page title={title()} back={t("common.close")} onBack={close} trailing={actions()} testID="compose">
      <View
        class="min-h-0 flex-1 bg-system-background"
        onFileDragEnter={() => dragging.set(true)}
        onFileDragLeave={() => dragging.set(false)}
        onFileDrop={(e: { uris: string[]; mimeTypes: string[] }) => {
          dragging.set(false);
          attach(e.uris.map((path, i) => ({ kind: "path", path, type: e.mimeTypes[i] ?? "" })));
        }}
      >
        <If when={accounts().length > 1}>
          <ChoiceRow
            label={t("compose.from")}
            value={from()}
            options={accounts().map((a) => ({ value: a.id, title: a.name ? `${a.name} <${a.email}>` : a.email }))}
            onChange={changeFrom}
            testID="compose-from"
          />
        </If>
        <TextRow
          label={t("compose.to")}
          value={to()}
          onChange={(v) => to.set(v)}
          kind="email"
          autoFocus={props.init.mode === "new" || props.init.mode === "forward"}
          returnKey="next"
          testID="compose-to"
          trailing={
            <If when={!showCc()}>
              <Button title={t("compose.ccBcc")} variant="plain" size="small" onPress={() => showCc.set(true)} testID="compose-cc-toggle" />
            </If>
          }
        />
        <If when={showCc()}>
          <TextRow label={t("compose.cc")} value={cc()} onChange={(v) => cc.set(v)} kind="email" testID="compose-cc" />
          <TextRow label={t("compose.bcc")} value={bcc()} onChange={(v) => bcc.set(v)} kind="email" testID="compose-bcc" />
        </If>
        <TextRow label={t("compose.subject")} value={subject()} onChange={(v) => subject.set(v)} testID="compose-subject" />
        <If when={editing}>
          {(o) => (
            <FormNote
              text={o().error ? t("compose.editFailed", { detail: o().error!.message }) : t("compose.editScheduled", { when: sendDate(o().sendAt) })}
              error={!!o().error}
              testID="compose-scheduled"
            />
          )}
        </If>
        <FormNote text={error()} error testID="compose-error" />
        <View class="min-h-0 flex-1 px-4 py-3">
          <Input
            value={body()}
            onChange={({ value }) => body.set(value)}
            multiline
            autoFocus={replying}
            ref={(input) => caretAtTop && setTimeout(() => input.setSelection(0), 0)}
            accessibilityLabel={t("compose.body")}
            testID="compose-body"
            class="min-h-40 flex-1 bg-transparent text-body leading-relaxed text-label caret-system-blue selection:bg-system-blue/30"
            onPaste={(e: { files: File[]; uris: string[] }) => {
              if (e.files.length) attach(e.files);
              else if (e.uris.length && platform.os !== "web") attach(e.uris.map((path) => ({ kind: "path", path, type: "" })));
            }}
          />
        </View>
        <AttachmentChips files={files} error={files.error()} />
        <View class="flex-row items-center gap-2 border-t border-separator px-4 py-2 pb-[env(safe-area-inset-bottom)]">
          <Button icon="paperclip" label={t("compose.attach")} variant="tinted" size="small" onPress={() => void pick()} testID="compose-attach" />
          <Button title={t("compose.discard")} variant="plain" size="small" onPress={askDiscard} testID="compose-discard" />
          <View class="flex-1" />
          <Text class="text-caption1 text-secondary-label">{t("compose.sendHint", { keys: keymap.label("mod+enter") })}</Text>
        </View>
        <If when={dragging()}>
          <View class="absolute inset-2 items-center justify-center rounded-row border-2 border-dashed border-system-blue bg-system-blue/10" style={{ pointerEvents: "none" }} testID="compose-drop">
            <Text class="text-headline font-semibold text-system-blue">{t("compose.dropHere")}</Text>
          </View>
        </If>
      </View>
      <ActionSheet
        open={choosing()}
        title={t("compose.schedule")}
        actions={[
          ...schedulePresets().map((p) => ({ id: p.id, title: t(`schedule.${p.id}`) })),
          { id: "pick", title: t("schedule.pick") },
        ]}
        cancel={t("common.cancel")}
        onOpenChange={({ open }: { open: boolean }) => {
          if (!open) choosing.set(false);
        }}
        onAction={({ id }: { id: string }) => scheduleAt(id)}
        testID="schedule-menu"
      />
      <ScheduleDialog open={picking()} onClose={() => picking.set(false)} onPick={(at) => schedule(at)} />
      <AlertDialog
        open={confirming()}
        title={editing ? t("compose.deleteScheduledTitle") : t("compose.discardTitle")}
        message={editing ? t("compose.deleteScheduledBody") : t("compose.discardBody")}
        actions={[
          { id: "keep", title: t("compose.keepEditing") },
          { id: "discard", title: t("compose.discard"), destructive: true },
        ]}
        onOpenChange={({ open }: { open: boolean }) => {
          if (!open) confirming.set(false);
        }}
        onAction={({ id }: { id: string }) => {
          confirming.set(false);
          if (id === "discard") discard();
        }}
        testID="discard-confirm"
      />
    </Page>
  );
}
