// A source's mark in the feed and in Settings: its icon on its own colour,
// the priority dot of a high-priority notification, and a tag's capsule.
// Colours are the theme's chart roles, so light and dark come from the same
// token.
import { Text, View } from "nsh";
import type { Source } from "agentinbox/native";
import { Icon } from "cupertino";

/** The icon of each kind, as its service is drawn everywhere. */
const kindIcons: Record<Source["kind"], string> = {
  mail: "envelope",
  webhook: "link",
  gotify: "bell",
  ntfy: "bell",
  telegram: "paperplane",
  discord: "sparkles",
  slack: "list.bullet",
  feishu: "sparkles",
  dingtalk: "bell",
  wecom: "person.crop.circle",
};

/** The icons a source may take over its kind's. */
const overrides = ["bell", "link", "exclamationmark.triangle", "list.bullet", "person.crop.circle", "paperplane", "clock", "envelope", "key"];

/** The icon of a kind, as a source takes it until it is given another. */
export const kindIcon = (kind: Source["kind"]): string => kindIcons[kind];

export const sourceIcon = (source: Source): string => (source.icon && overrides.includes(source.icon) ? source.icon : kindIcons[source.kind]);

/** A source's colour as classes: the theme's chart roles, never a raw hex. */
// The ids are what a source stores ("chart-1"…); the tones are the identity
// palette's system roles. A mark is always beside the source's name.
export const sourceColours = [
  { id: "chart-1", mark: "bg-system-indigo/15", ink: "system-indigo", dot: "bg-system-indigo" },
  { id: "chart-2", mark: "bg-system-purple/15", ink: "system-purple", dot: "bg-system-purple" },
  { id: "chart-3", mark: "bg-system-pink/15", ink: "system-pink", dot: "bg-system-pink" },
  { id: "chart-4", mark: "bg-system-blue/15", ink: "system-blue", dot: "bg-system-blue" },
  { id: "chart-5", mark: "bg-system-red/15", ink: "system-red", dot: "bg-system-red" },
] as const;

const colour = (source: Source) => sourceColours.find((c) => c.id === source.color) ?? sourceColours[0];

/** A source's icon in a rounded tile of its colour. */
export function SourceMark(props: { source: Source; size?: "sm" | "md" }) {
  const small = () => props.size === "sm";
  return (
    <View class={`items-center justify-center rounded-[8px] ${small() ? "size-7" : "size-9"} ${colour(props.source).mark}`}>
      <Icon name={sourceIcon(props.source)} size={small() ? 16 : 20} tint={colour(props.source).ink} />
    </View>
  );
}

/** A high-priority notification's dot: the error colour, as mail's unread dot is the tint. */
export function PriorityDot(props: { priority: number }) {
  return (
    <If when={props.priority >= 7}>
      <View accessibilityLabel="" class="size-2 rounded-full bg-system-red" />
    </If>
  );
}

/** A tag, as the feed and the reader list them: a small capsule. */
export function Tags(props: { tags: string[] }) {
  return (
    <If when={props.tags.length}>
      <View class="flex-row flex-wrap items-center gap-1">
        <Each of={props.tags} key={(tag) => tag}>
          {(tag) => (
            <View class="rounded-full bg-fill px-2 py-0.5">
              <Text class="text-caption2 text-secondary-label">{tag()}</Text>
            </View>
          )}
        </Each>
      </View>
    </If>
  );
}
