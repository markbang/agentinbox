// The marks mail draws: an account's colour, an unread dot, a count, and the
// initials of a person. Colours are the theme's system roles, so light, dark and
// high contrast follow the tokens.
import { Text, View } from "nsh";

// The identity palette: system roles, so light, dark and high contrast follow the
// tokens; each is at least 3:1 on the surfaces a mark sits on.
export const tones = [
  { dot: "bg-system-indigo", ink: "system-indigo" },
  { dot: "bg-system-purple", ink: "system-purple" },
  { dot: "bg-system-pink", ink: "system-pink" },
  { dot: "bg-system-blue", ink: "system-blue" },
  { dot: "bg-system-red", ink: "system-red" },
] as const;

/** The account at `index`'s tone. */
export const toneOf = (index: number) => tones[Math.max(0, index) % tones.length];

/** An account's colour, by the account's place in the list. */
export function AccountMark(props: { index: number; shape?: "bar" | "dot"; class?: string }) {
  const tone = () => toneOf(props.index).dot;
  return (
    <View
      accessibilityElementsHidden
      class={`${tone()} ${props.shape === "bar" ? "h-8 w-[3px] rounded-full" : "size-2.5 rounded-full"} ${props.class ?? ""}`}
    />
  );
}

/** Unread: iOS Mail's blue dot. */
export function UnreadDot(props: { show: boolean; class?: string }) {
  return <View accessibilityElementsHidden class={`size-2 rounded-full bg-system-blue ${props.show ? "" : "opacity-0"} ${props.class ?? ""}`} />;
}

/** A count beside a name ("3" messages in a conversation), quiet. */
export function Count(props: { value: number; bold?: boolean }) {
  return (
    <If when={props.value > 1}>
      <Text class={`text-footnote ${props.bold ? "font-semibold text-label" : "text-secondary-label"}`} testID="thread-count">
        {props.value}
      </Text>
    </If>
  );
}

/** A badge on a row or a tab: the count as a quiet capsule. */
export function Badge(props: { value: number; class?: string }) {
  return (
    <If when={props.value > 0}>
      <View class={`min-w-[20px] items-center rounded-full bg-system-blue/15 px-1.5 py-0.5 ${props.class ?? ""}`}>
        <Text class="text-caption1 font-semibold tabular-nums text-system-blue">{props.value > 999 ? "999+" : String(props.value)}</Text>
      </View>
    </If>
  );
}

/** A person's initials, as an avatar or a tile shows them. */
export function initials(name: string) {
  return name
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => [...word][0]?.toUpperCase() ?? "")
    .join("");
}

/** A person's monogram: an initials tile on the account's tone. */
export function Monogram(props: { name: string; index?: number; size?: "sm" | "md" }) {
  const size = () => (props.size === "sm" ? "size-7 text-caption1" : "size-9 text-footnote");
  return (
    <View accessibilityElementsHidden class={`items-center justify-center rounded-full bg-fill ${size()}`}>
      <Text class="font-semibold text-secondary-label">{initials(props.name)}</Text>
    </View>
  );
}
