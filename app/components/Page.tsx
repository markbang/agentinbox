// A page's frame: the navigation bar, and the content under it. Pages push
// from the right on phones and narrow windows and sit in a sheet on wide
// ones; the bar's back button is the app's history either way.
import { Button, ScrollView, NavigationBar } from "cupertino";
import { Text, View, type JSX } from "nsh";
import { t } from "nsh/i18n";
import { NavContext } from "../nav";

export interface PageProps {
  title?: string;
  /** The back button's label; without it there is no back button. */
  back?: string;
  onBack?: () => void;
  /** Buttons at the trailing edge, after the title. */
  trailing?: JSX.Element;
  /** A large title under the bar, for a page's heading. */
  largeTitle?: string;
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
    <View class="flex-1 bg-system-background pt-[env(safe-area-inset-top)]">
      <If when={bar()}>
        <NavigationBar title={props.title} back={props.back} onBack={props.onBack}>
          <If when={props.trailing} else={<If when={done()}><Button title={t("common.done")} variant="plain" onPress={nav.done} testID="modal-done" /></If>}>
            {props.trailing}
          </If>
        </NavigationBar>
      </If>
      <If when={props.largeTitle}>
        <View class="px-4 pb-2 pt-1">
          <Text role="header" class="text-largeTitle font-bold text-label">
            {props.largeTitle ?? ""}
          </Text>
        </View>
      </If>
      <View class="min-h-0 flex-1" testID={props.testID}>
        {props.children}
      </View>
    </View>
  );
}

/** A page's scrolling content: a plain background, padded at the sides. */
export function PageScroll(props: { children?: JSX.Element; class?: string; testID?: string }) {
  return (
    <ScrollView class="flex-1" testID={props.testID}>
      <View class={`gap-5 px-4 py-4 pb-[env(safe-area-inset-bottom)] ${props.class ?? ""}`}>{props.children}</View>
    </ScrollView>
  );
}
