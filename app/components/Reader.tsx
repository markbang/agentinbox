// One message, or a conversation: its older messages above the expanded one
// (the latest when it opens) and its newer ones below; a tap on a collapsed
// message expands it. For the expanded message: who and when, the body (its
// HTML in a web view, or its text) and its attachments. Remote images stay
// blocked until the reader asks for them. Archive, delete, read and flag act
// on the whole conversation; reply and forward on the message.
import { createMotion, Image, reduceMotion, signal, Text, View } from "nsh";
import { t } from "nsh/i18n";
import { ActionSheet, Button, Icon, ScrollView } from "cupertino";
import { Mail, type Attachment, type Message, type Summary } from "agentinbox/native";
import { AccountMark, Monogram } from "./Marks";
import { MailView, webViewAvailable } from "./MailView";
import { Toolbar, type ToolbarAction } from "./Toolbar";
import { displayName, fileSize, fullDate, listDate, type ComposeMode } from "../lib/format";
import { accountById, accountIndex, accounts, conversationsEnabled, errorText, isLeaving, moveMessages, openMessage, ownAddresses, selectedId, setFlags, setThreadFlags, showToast } from "../store";

export interface ReaderProps {
  message: Message;
  /** Its conversation, oldest first, while conversations are on. */
  conversation?: Summary[];
  onCompose: (mode: ComposeMode) => void;
  /** The actions sit in a bar at the reader's foot. */
  toolbar?: boolean;
  /** Phones: the bar's actions are the reader's whole set. */
  phone?: boolean;
  /** Leaves the page (a phone, after archiving or deleting). */
  onLeave?: () => void;
}

// Per message: the reader chose to load its images.
const imagesShown = signal<Record<string, boolean>>({});
// Per conversation: how many of its messages are listed past the first and the last.
const revealed = signal<Record<string, number>>({});

/** What the actions act on: the conversation shown, or the message alone. */
export interface Target {
  message: Message;
  /** The conversation's messages on screen (more than one), oldest first. */
  thread: Summary[] | null;
}

/** The messages of `conversation` the reader lists around `m`: none when it is alone. What is in
 * Trash stays out unless the reader is in Trash; what is being deleted leaves at once. */
export function threadOf(m: Message, conversation: Summary[] | undefined): Summary[] | null {
  if (!conversation?.some((s) => s.id === m.id)) return null;
  const shown = conversation.filter((s) => s.id === m.id || ((s.folder !== "trash" || m.folder === "trash") && !isLeaving(s.id)));
  return shown.length > 1 ? shown : null;
}

const seen = (x: Target) => (x.thread ? x.thread.every((s) => s.seen) : x.message.seen);
const flagged = (x: Target) => (x.thread ? x.thread.some((s) => s.flagged) : x.message.flagged);

/** Archive or delete the conversation (or message): `before` runs first (a phone leaves the page). */
function move(x: Target, folder: "archive" | "trash", before?: () => void) {
  before?.();
  // The list's row is the conversation even when it holds this message alone.
  if (conversationsEnabled()) moveMessages([x.message.threadId], folder, true);
  else moveMessages([x.message.id], folder);
}

function mark(x: Target, flags: { seen?: boolean; flagged?: boolean }) {
  if (x.thread) void setThreadFlags(x.message.threadId, flags);
  else void setFlags(x.message.id, flags);
}

/** The actions the reader's bar offers, in Mail's order. */
export function readerActions(props: {
  message: Message;
  conversation?: Summary[];
  onCompose: (mode: ComposeMode) => void;
  onLeave?: () => void;
  wide?: boolean;
}): ToolbarAction[] {
  const x = (): Target => ({ message: props.message, thread: threadOf(props.message, props.conversation) });
  const m = () => props.message;
  const actions: ToolbarAction[] = [
    { icon: "arrowshape.turn.up.left", label: t("actions.reply"), onPress: () => props.onCompose("reply"), testID: "reply" },
    { icon: "arrowshape.turn.up.right", label: t("actions.forward"), onPress: () => props.onCompose("forward"), testID: "forward" },
  ];
  if (props.wide) {
    actions.push({
      icon: flagged(x()) ? "flag.fill" : "flag",
      label: flagged(x()) ? t("actions.unflag") : t("actions.flag"),
      onPress: () => mark(x(), { flagged: !flagged(x()) }),
      testID: "toggle-flag",
    });
    actions.push({
      icon: seen(x()) ? "envelope" : "envelope.open",
      label: seen(x()) ? t("actions.markUnread") : t("actions.markRead"),
      onPress: () => mark(x(), { seen: !seen(x()) }),
      testID: "toggle-seen",
    });
  }
  if (m().folder !== "archive" && m().folder !== "trash") {
    actions.push({ icon: "archivebox", label: t("actions.archive"), onPress: () => move(x(), "archive", props.onLeave), testID: "archive" });
  }
  if (m().folder !== "trash") {
    actions.push({ icon: "trash", label: t("actions.delete"), onPress: () => move(x(), "trash", props.onLeave), testID: "delete" });
  }
  return actions;
}

/** A message of the conversation that is not expanded: who, when and how it starts; a tap expands it. */
function Collapsed(props: { message: Summary }) {
  const m = () => props.message;
  const who = () => (ownAddresses().has(m().from?.email.toLowerCase() ?? "") ? t("list.me") : displayName(m().from));
  const note = () => (m().folder === "drafts" ? t("thread.draft") : m().folder === "trash" ? t("thread.inTrash") : "");
  return (
    <View
      role="button"
      accessibilityLabel={[m().seen ? "" : t("list.unread"), who(), note(), listDate(m().date), m().snippet].filter(Boolean).join(", ")}
      onPress={() => openMessage(m().id)}
      testID={`thread-message-${m().id}`}
      class="flex-row items-center gap-2.5 px-4 py-2.5 active:bg-fill"
    >
      <Monogram name={displayName(m().from)} size="sm" />
      <View class="min-w-0 flex-1">
        <View class="flex-row items-center gap-2">
          <Text class={`line-clamp-1 shrink ${m().seen ? "text-subheadline text-label" : "text-subheadline font-semibold text-label"}`}>{who()}</Text>
          <If when={note()}>
            <Text class="text-caption1 text-system-red">{note()}</Text>
          </If>
          <View class="flex-1" />
          <If when={m().hasAttachments}>
            <Icon name="paperclip" size={12} tint="secondary-label" />
          </If>
          <If when={m().flagged}>
            <Icon name="flag.fill" size={12} tint="system-orange" />
          </If>
          <Text class="text-caption1 tabular-nums text-secondary-label">{listDate(m().date)}</Text>
        </View>
        <Text class="line-clamp-1 text-footnote text-secondary-label">{m().snippet}</Text>
      </View>
      <If when={selectedId() === m().id}>
        <Icon name="arrow.clockwise" size={12} tint="tertiary-label" />
      </If>
    </View>
  );
}

/** How many messages one press of More adds: a long conversation stays a bounded amount of work. */
const REVEAL = 25;

/** Collapsed messages: past three, the first, how many more, and the last. */
function CollapsedList(props: { messages: Summary[]; threadId: string; testID: string }) {
  const total = () => props.messages.length;
  const extra = () => revealed()[props.threadId] ?? 0;
  const shown = () => Math.min(total(), 3 + extra());
  const hidden = () => total() - shown();
  const set = (count: number) => revealed.update((r) => ({ ...r, [props.threadId]: count }));
  return (
    <View testID={props.testID} class="border-y border-separator">
      <If
        when={hidden() > 0}
        else={
          <Each of={props.messages} key={(s) => s.id}>
            {(s) => <Collapsed message={s()} />}
          </Each>
        }
      >
        <Collapsed message={props.messages[0]} />
        <View class="items-center py-1">
          <Button title={t("thread.more", { count: hidden() })} variant="plain" size="small" onPress={() => set(extra() + REVEAL)} testID="thread-more" />
        </View>
        <Each of={props.messages.slice(total() - shown() + 1)} key={(s) => s.id}>
          {(s) => <Collapsed message={s()} />}
        </Each>
      </If>
      <If when={total() > 3 && hidden() === 0}>
        <View class="items-center py-1">
          <Button title={t("thread.less")} variant="plain" size="small" onPress={() => set(0)} testID="thread-less" />
        </View>
      </If>
    </View>
  );
}

export function Reader(props: ReaderProps) {
  const m = () => props.message;
  const target = (): Target => ({ message: m(), thread: threadOf(m(), props.conversation) });
  const at = () => target().thread?.findIndex((s) => s.id === m().id) ?? -1;
  const older = () => target().thread?.slice(0, at()) ?? [];
  const newer = () => target().thread?.slice(at() + 1) ?? [];
  const enter = createMotion({ enter: reduceMotion() ? undefined : "fadeIn", duration: 150 });
  const account = () => accountById(m().accountId);
  const recipients = () => [...m().to, ...m().cc].map(displayName).join(", ");
  const showImages = () => !!imagesShown()[m().id];
  const html = () => (webViewAvailable() ? m().html : null);
  const subject = () => (target().thread?.[0].subject ?? m().subject) || t("reader.noSubject");
  const menu = signal(false);
  // One message of a conversation: the reader moves to its neighbour first, so the conversation stays.
  const deleteOne = () => {
    const thread = target().thread ?? [];
    const next = thread[at() + 1] ?? thread[at() - 1];
    if (next) openMessage(next.id);
    moveMessages([m().id], "trash");
  };

  return (
    <View class="flex-1">
      <ScrollView class="flex-1" testID="reader">
        <View class="gap-3 pb-8 pt-3" style={enter.style}>
          <View class="flex-row items-start gap-2 px-4">
            <Text role="header" class="flex-1 text-title2 font-semibold text-label">
              {subject()}
            </Text>
            <Button icon="ellipsis" label={t("thread.messageActions")} variant="plain" onPress={() => menu.set(true)} testID="message-more" />
          </View>
          <If when={older().length > 0}>
            <CollapsedList messages={older()} threadId={m().threadId} testID="thread-older" />
          </If>
          <View class="flex-row items-start gap-2.5 px-4">
            <Monogram name={displayName(m().from)} />
            <View class="min-w-0 flex-1 gap-0.5">
              <View class="flex-row flex-wrap items-baseline gap-x-2">
                <Text class="text-headline font-semibold text-label">{displayName(m().from)}</Text>
                <Text class="text-subheadline text-secondary-label">{m().from?.email ?? ""}</Text>
              </View>
              <Text class="line-clamp-2 text-footnote text-secondary-label">
                {t("reader.toList", { names: recipients() || t("compose.noRecipients") })}
              </Text>
              <View class="flex-row flex-wrap items-center gap-1.5">
                <If when={accounts().length > 1 && account()}>
                  <AccountMark index={accountIndex(m().accountId)} />
                  <Text class="text-caption1 text-secondary-label">{account()?.email}</Text>
                  <Text class="text-caption1 text-tertiary-label">·</Text>
                </If>
                <Text class="text-caption1 tabular-nums text-secondary-label">{fullDate(m().date)}</Text>
              </View>
            </View>
          </View>
          <If when={m().remoteImages.length > 0 && !showImages()}>
            <View class="mx-4 flex-row items-center gap-2 rounded-row bg-fill px-3 py-2">
              <Icon name="photo" size={16} tint="secondary-label" />
              <Text class="flex-1 text-footnote text-secondary-label">{t("reader.imagesBlocked")}</Text>
              <Button title={t("reader.loadImages")} variant="plain" size="small" onPress={() => imagesShown.update((s) => ({ ...s, [m().id]: true }))} />
            </View>
          </If>
          <If when={m().attachments.length}>
            <View class="gap-1.5 px-4">
              <Text class="text-footnote font-semibold text-secondary-label">{t("reader.attachments")}</Text>
              <ScrollView horizontal class="shrink-0" style={{ height: 64 }} testID="attachments">
                <View class="flex-row items-start gap-2 px-0.5">
                  <Each of={m().attachments} key={(a) => `${m().id}:${a.index}`}>
                    {(attachment) => <AttachmentTile messageId={m().id} attachment={attachment()} />}
                  </Each>
                </View>
              </ScrollView>
            </View>
          </If>
          <If
            when={html()}
            else={
              <View class="px-4" selectable>
                <Text class="text-body leading-relaxed text-label" testID="body-text">
                  {m().text ?? ""}
                </Text>
              </View>
            }
          >
            {(source) => (
              // The mail card stays white in both appearances on purpose: mail is designed on white and its colors are not inverted.
              <View class="h-[560px] overflow-hidden border-y border-separator bg-white">
                <MailView html={source()} remote={showImages()} onUnavailable={() => webViewAvailable.set(false)} class="flex-1" />
              </View>
            )}
          </If>
          <If when={newer().length > 0}>
            <CollapsedList messages={newer()} threadId={m().threadId} testID="thread-newer" />
          </If>
        </View>
      </ScrollView>
      <ActionSheet
        open={menu()}
        title={t("thread.messageActions")}
        actions={[
          { id: "flag", title: m().flagged ? t("actions.unflag") : t("actions.flag") },
          { id: "reply", title: t("actions.reply") },
          { id: "forward", title: t("actions.forward") },
          { id: "seen", title: m().seen ? t("actions.markUnread") : t("actions.markRead") },
          ...(m().folder === "trash" ? [] : [{ id: "delete", title: t("thread.deleteMessage"), destructive: true }]),
        ]}
        cancel={t("common.cancel")}
        onOpenChange={({ open }: { open: boolean }) => menu.set(open)}
        onAction={({ id }: { id: string }) => {
          menu.set(false);
          if (id === "flag") void setFlags(m().id, { flagged: !m().flagged });
          if (id === "reply") props.onCompose("reply");
          if (id === "forward") props.onCompose("forward");
          if (id === "seen") void setFlags(m().id, { seen: !m().seen });
          if (id === "delete") deleteOne();
        }}
        testID="message-menu"
      />
      <If when={props.toolbar}>
        <Toolbar
          label={t("reader.actions")}
          actions={readerActions({ message: m(), conversation: props.conversation, onCompose: props.onCompose, onLeave: props.onLeave, wide: !props.phone })}
        />
      </If>
    </View>
  );
}

// Keyed by message and index: one tile per attachment, its preview fetched once.
function AttachmentTile(props: { messageId: string; attachment: Attachment }) {
  const a = () => props.attachment;
  const busy = signal(false);
  const thumbnail = signal<string | null>(null);
  if (a().mimeType.startsWith("image/")) {
    Mail.attachmentPreview(props.messageId, a()).then(
      (uri) => thumbnail.set(uri),
      () => {},
    );
  }
  const open = async () => {
    busy.set(true);
    try {
      const saved = await Mail.openAttachment(props.messageId, a());
      if (saved) showToast(t("reader.savedTo", { path: saved }));
    } catch (e) {
      showToast(errorText(e), "error");
    } finally {
      busy.set(false);
    }
  };
  return (
    <View
      role="button"
      accessibilityLabel={`${a().filename ?? t("reader.untitledAttachment")}, ${fileSize(a().size)}`}
      onPress={() => void open()}
      testID={`attachment-${a().index}`}
      class="w-48 flex-row items-center gap-2 rounded-row border border-separator bg-secondary-system-background px-2 py-2 active:bg-fill"
    >
      <If when={thumbnail()} else={<Icon name={a().mimeType.startsWith("image/") ? "photo" : "doc"} size={22} tint="system-blue" />}>
        <Image src={thumbnail() ?? ""} class="size-8 rounded-[6px]" />
      </If>
      <View class="min-w-0 flex-1">
        <Text class="line-clamp-1 text-footnote text-label">{a().filename ?? t("reader.untitledAttachment")}</Text>
        <Text class="text-caption2 text-secondary-label">{busy() ? t("reader.openingAttachment") : fileSize(a().size)}</Text>
      </View>
    </View>
  );
}
