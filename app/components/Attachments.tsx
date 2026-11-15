// The composer's attachments as tiles: name, size (or how much is uploaded),
// and a button that takes the file out of the draft.
import { Text, View } from "nsh";
import { t } from "nsh/i18n";
import { Icon } from "cupertino";
import { fileSize } from "../lib/format";
import type { Attachments } from "../lib/attachments";

export function AttachmentChips(props: { files: Attachments; error?: string | null }) {
  return (
    <>
      <If when={props.error}>
        <Text class="px-4 pb-1 text-footnote text-system-red" testID="compose-attachment-error">
          {props.error}
        </Text>
      </If>
      <If when={props.files.items().length}>
        <View class="flex-row flex-wrap gap-2 px-4 pb-2" testID="compose-attachments">
          <Each of={props.files.items()} key={(a) => a.key}>
            {(a) => {
              const staging = () => !a().ref && !a().failed;
              const share = () => (a().size ? Math.min(1, a().sent / a().size) : 1);
              return (
                <View
                  class={`relative h-8 max-w-72 flex-row items-center gap-1.5 overflow-hidden rounded-[8px] border pl-2 pr-1 ${
                    a().failed ? "border-system-red/40 bg-system-red/10" : "border-separator bg-secondary-system-background"
                  }`}
                  testID="compose-attachment"
                >
                  <Icon name="doc" size={14} tint={a().failed ? "system-red" : "secondary-label"} />
                  <Text class={`line-clamp-1 shrink text-footnote ${a().failed ? "text-system-red" : "text-label"}`}>{a().name}</Text>
                  <Text class="text-caption1 tabular-nums text-secondary-label">
                    {a().failed
                      ? t("compose.attachFailed")
                      : staging()
                        ? t("compose.uploading", { percent: Math.round(share() * 100) })
                        : fileSize(a().size)}
                  </Text>
                  <View
                    role="button"
                    accessibilityLabel={t("compose.removeAttachment", { name: a().name })}
                    onPress={() => props.files.remove(a().key)}
                    class="size-6 items-center justify-center rounded-full active:bg-fill"
                  >
                    <Icon name="xmark.circle.fill" size={14} tint="tertiary-label" />
                  </View>
                  <If when={staging()}>
                    <View class="absolute bottom-0 left-0 h-0.5 bg-system-blue" style={{ width: `${share() * 100}%` }} />
                  </If>
                </View>
              );
            }}
          </Each>
        </View>
      </If>
    </>
  );
}
