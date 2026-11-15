// The paths whose actions have a shortcut, listed by `?` and from Settings:
// the keys as this platform shows them (`keymap.label`), with what they do.
import { keymap, Text, View } from "nsh";
import { t } from "nsh/i18n";
import { List, ListTile, Section, Sheet } from "cupertino";

interface Row {
  keys: string[];
  label: string;
}

const mail = (): Row[] => [
  { keys: ["c"], label: t("actions.compose") },
  { keys: ["r"], label: t("actions.reply") },
  { keys: ["/"], label: t("search.label") },
  { keys: ["j"], label: t("actions.nextMessage") },
  { keys: ["k"], label: t("actions.previousMessage") },
  { keys: ["e"], label: t("actions.archive") },
  { keys: ["shift+3"], label: t("actions.delete") },
];

const composing = (): Row[] => [
  { keys: ["mod+enter"], label: t("compose.send") },
  { keys: ["escape"], label: t("shortcuts.closeDialog") },
  { keys: ["shift+/"], label: t("shortcuts.title") },
];

function Keys(props: { keys: string[] }) {
  return (
    <View class="flex-row items-center gap-1">
      <Each of={props.keys} key={(k) => k}>
        {(k) => (
          <Text class="rounded-[5px] border border-separator bg-fill px-1.5 py-0.5 text-caption1 tabular-nums text-secondary-label">{keymap.label(k())}</Text>
        )}
      </Each>
    </View>
  );
}

function Rows(props: { rows: Row[] }) {
  return (
    <>
      <Each of={props.rows} key={(r) => r.keys.join("+")}>
        {(row) => (
          <ListTile title={row().label} accessory="none" separator>
            <Keys keys={row().keys} />
          </ListTile>
        )}
      </Each>
    </>
  );
}

export function ShortcutsDialog(props: { open: boolean; onClose: () => void }) {
  return (
    <Sheet
      open={props.open}
      detent="large"
      title={t("shortcuts.title")}
      trailing={t("common.done")}
      onOpenChange={({ open }: { open: boolean }) => {
        if (!open) props.onClose();
      }}
      onTrailing={() => props.onClose()}
    >
      <View testID="shortcuts">
        <List scroll={false}>
          <Section header={t("shortcuts.mail")}>
            <Rows rows={mail()} />
          </Section>
          <Section header={t("shortcuts.composing")} footer={t("shortcuts.help")}>
            <Rows rows={composing()} />
          </Section>
        </List>
      </View>
    </Sheet>
  );
}
