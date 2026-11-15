// iOS's pull-to-refresh spinner over a list the app draws itself: it follows
// the list's pull value (`refreshIndicator`), so the platform never draws its
// own — one indicator, and the Cupertino one.
import { createAnimatedValue, View } from "nsh";
import { ActivityIndicator } from "cupertino";

/** The room a pull keeps above the list's content, in points (iOS's spinner). */
export const PULL_HEIGHT = 60;

/** The value a list follows, given to `pullValue`. */
export const pullValue = () => createAnimatedValue(0);

export function PullIndicator(props: { pull: ReturnType<typeof pullValue>; color?: string }) {
  const translate = props.pull.interpolate({ inputRange: [0, PULL_HEIGHT], outputRange: [-PULL_HEIGHT, 0], extrapolate: "clamp" });
  const opacity = props.pull.interpolate({ inputRange: [0, 24], outputRange: [0, 1], extrapolate: "clamp" });
  const scale = props.pull.interpolate({ inputRange: [0, PULL_HEIGHT], outputRange: [0.55, 1], extrapolate: "clamp" });
  return (
    <View
      accessibilityElementsHidden
      testID="pull-indicator"
      class="pointer-events-none absolute left-0 right-0 top-0 items-center justify-center"
      style={{ height: PULL_HEIGHT, opacity, transform: [{ translateY: translate }, { scale }] }}
    >
      <ActivityIndicator size={20} color={props.color ?? "tertiary-label"} />
    </View>
  );
}
