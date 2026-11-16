// A page's frame: the navigation bar, and the content under it. Pages push
// from the right on phones and narrow windows and sit in a sheet on wide
// ones; the bar's back button is the app's history either way.
//
// The bar is Liquid Glass and floats: the page's content passes under it (a
// list with `pt-11` of content padding, a form with a `BarSpace` first), so
// the material bends the rows as they scroll by. Nothing else in a page is
// glass: content keeps its solid background (nsh-cupertino, glass.md, "Where
// it belongs").
import { Button, NavigationBar } from "cupertino";
import { View, type JSX } from "nsh";
import { t } from "nsh/i18n";
import { NavContext } from "../nav";

export interface PageProps {
  title?: string;
  /** The id UI tests find the title by (a count the selection changes, say). */
  titleTestID?: string;
  /** The back button's label; without it there is no back button. */
  back?: string;
  onBack?: () => void;
  /** Buttons at the trailing edge, after the title. */
  trailing?: JSX.Element;
  children?: JSX.Element;
  testID?: string;
}

export function Page(props: PageProps) {
  const nav = NavContext();
  // A sheet's first page leaves the flow with Done, as iOS's sheets do.
  const done = () => nav.modal && nav.stack.routes().length === 1;
  // A page the list already titles (its column header) gets no bar of its own.
  const bar = () => !!(props.title || props.back || props.trailing || done());
  return (
    <View class="flex-1 bg-system-background pt-[env(safe-area-inset-top)]" testID={props.testID}>
      <View class="min-h-0 flex-1">{props.children}</View>
      <If when={bar()}>
        <View class="absolute left-0 right-0 top-0 z-10">
          {/* collapsed 1: a compact title, always there; nothing here tracks a scroll. */}
          <NavigationBar title={props.title} back={props.back} onBack={props.onBack} collapsed={1} material="regular" testID={props.titleTestID}>
            <If when={props.trailing} else={<If when={done()}><Button title={t("common.done")} variant="plain" onPress={nav.done} testID="modal-done" /></If>}>
              {props.trailing}
            </If>
          </NavigationBar>
        </View>
      </If>
    </View>
  );
}

/** The room a page starts with under the floating bar, for content that cannot scroll under it. */
export function BarSpace() {
  return <View class="h-11 shrink-0" />;
}
