// The bar at the bottom of the reader, as Mail draws it on iOS: the message's
// actions, evenly spread, on the chrome material over a hairline.
import { View } from "nsh";
import { Button } from "cupertino";

export interface ToolbarAction {
  /** A name from `cupertino`'s icons. */
  icon: string;
  label: string;
  onPress: () => void;
  testID?: string;
  disabled?: boolean;
}

export function Toolbar(props: { label: string; actions: ToolbarAction[]; class?: string }) {
  return (
    <View
      role="toolbar"
      accessibilityLabel={props.label}
      class={`flex-row items-center gap-0.5 border-t border-separator bg-material-chrome px-2 pb-[env(safe-area-inset-bottom)] shadow-sm backdrop-blur-xl ${props.class ?? ""}`}
    >
      <Each of={props.actions} key={(a) => a.label}>
        {(action) => (
          <Button
            icon={action().icon}
            label={action().label}
            variant="plain"
            disabled={action().disabled}
            onPress={() => action().onPress()}
            class="flex-1"
            testID={action().testID}
          />
        )}
      </Each>
    </View>
  );
}
