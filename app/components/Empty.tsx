// What a list, a reader or a page shows with nothing in it: an icon, a
// sentence, a hint, and the one thing to do next.
import { Text, View, type JSX } from "nsh";
import { ActivityIndicator, Icon } from "cupertino";

export interface EmptyProps {
  /** A name from `cupertino`'s icons. */
  icon: string;
  title: string;
  description?: string;
  action?: JSX.Element;
  testID?: string;
}

export function Empty(props: EmptyProps) {
  return (
    <View class="flex-1 items-center justify-center gap-2 px-8 py-12" testID={props.testID}>
      <Icon name={props.icon} size={40} tint="tertiary-label" />
      <Text role="header" class="pt-1 text-center text-title3 font-semibold text-label">
        {props.title}
      </Text>
      <If when={props.description}>
        <Text class="max-w-[340px] text-center text-subheadline text-secondary-label">{props.description ?? ""}</Text>
      </If>
      <View class="pt-2">{props.action}</View>
    </View>
  );
}

/** A spinner in the middle of an empty area, with what it is doing. */
export function Loading(props: { label: string; testID?: string }) {
  return (
    <View class="flex-1 items-center justify-center gap-3 px-8 py-12" testID={props.testID}>
      <ActivityIndicator label={props.label} />
    </View>
  );
}
