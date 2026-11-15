// Toasts: one line of feedback over the bottom of the window, on the
// floating layer's material, with an action (Undo) when there is one.
import { Text, View } from "nsh";
import { toast } from "../store";

export function Toasts(props: { class?: string }) {
  return (
    <View class={`absolute inset-x-0 items-center px-4 ${props.class ?? ""}`} style={{ pointerEvents: "box-none" }}>
      <Each of={toast() ? [toast()!] : []} key={(x) => x.id}>
        {(x) => (
          <View
            role="alert"
            testID="toast"
            class="mb-2 w-full max-w-[440px] flex-row items-center gap-3 rounded-row bg-material-regular px-4 py-3 shadow-lg backdrop-blur-xl"
          >
            <Text class="line-clamp-2 flex-1 text-subheadline text-label">{x().text}</Text>
            <If when={x().action}>
              {(action) => (
                <View
                  role="button"
                  accessibilityLabel={action().label}
                  onPress={() => {
                    action().run();
                  }}
                  class="active:opacity-40"
                  testID="toast-action"
                >
                  <Text class="text-subheadline font-semibold text-system-blue">{action().label}</Text>
                </View>
              )}
            </If>
          </View>
        )}
      </Each>
    </View>
  );
}
