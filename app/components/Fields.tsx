// The composer's and the forms' rows: a label, the field beside it, a
// hairline between them; and a row that asks for one of a few values in an
// action sheet, as iOS asks.
import { signal, Text, View, type JSX } from "nsh";
import { Input } from "nsh/base";
import { ActionSheet, Icon, TextField } from "cupertino";

export interface TextRowProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  kind?: "text" | "email" | "url" | "number";
  autoFocus?: boolean;
  returnKey?: "next" | "done" | "go" | "search" | "send";
  masked?: boolean;
  multiline?: boolean;
  testID?: string;
  trailing?: JSX.Element;
  class?: string;
}

/** A labeled line of text, as the composer's To and Subject rows are. */
export function TextRow(props: TextRowProps) {
  const keyboard = { email: "email-address", url: "url", number: "number-pad", text: "default" } as const;
  return (
    <View class={`flex-row items-start gap-2 border-b border-separator px-4 ${props.multiline ? "py-2" : "min-h-11 py-2"} ${props.class ?? ""}`}>
      <Text class="w-[4.5rem] shrink-0 pt-0.5 text-body text-secondary-label">{props.label}</Text>
      <Input
        value={props.value}
        onChange={({ value }) => props.onChange(value)}
        onSubmit={() => props.onSubmit?.()}
        placeholder={props.placeholder}
        masked={props.masked}
        multiline={props.multiline}
        autoFocus={props.autoFocus}
        keyboardType={keyboard[props.kind ?? "text"]}
        autoCapitalize={props.kind && props.kind !== "text" ? "none" : "sentences"}
        autoCorrect={!props.kind || props.kind === "text"}
        returnKeyType={props.returnKey}
        accessibilityLabel={props.label}
        testID={props.testID}
        class="min-w-0 flex-1 bg-transparent text-body text-label caret-system-blue selection:bg-system-blue/30 placeholder:text-tertiary-label"
      />
      {props.trailing}
    </View>
  );
}

export interface ChoiceRowProps {
  label: string;
  value: string | null;
  options: { value: string; title: string }[];
  onChange: (value: string) => void;
  testID?: string;
  class?: string;
}

/** A row whose value is one of a few: a press opens an action sheet of them. */
export function ChoiceRow(props: ChoiceRowProps) {
  const open = signal(false);
  const title = () => props.options.find((o) => o.value === props.value)?.title ?? "";
  return (
    <View class={props.class ?? ""}>
      <View
        role="button"
        accessibilityLabel={`${props.label}: ${title()}`}
        onPress={() => open.set(true)}
        class="min-h-11 flex-row items-center gap-2 border-b border-separator px-4 py-2 active:bg-fill"
        testID={props.testID}
      >
        <Text class="text-body text-secondary-label">{props.label}</Text>
        <View class="flex-1" />
        <Text class="line-clamp-1 max-w-[60%] text-body text-label">{title()}</Text>
        <Icon name="chevron.down" size={12} tint="tertiary-label" />
      </View>
      <ActionSheet
        open={open()}
        title={props.label}
        actions={props.options.map((o) => ({ id: o.value, title: o.title }))}
        cancel=""
        onOpenChange={({ open: next }: { open: boolean }) => open.set(next)}
        onAction={({ id }: { id: string }) => {
          open.set(false);
          props.onChange(id);
        }}
      />
    </View>
  );
}

/** What a form says under its fields: a hint, or why the last try failed. */
export function FormNote(props: { text?: string | null; error?: boolean; testID?: string }) {
  return (
    <If when={props.text}>
      <Text class={`px-4 text-footnote ${props.error ? "text-system-red" : "text-secondary-label"}`} testID={props.testID}>
        {props.text ?? ""}
      </Text>
    </If>
  );
}

export interface FieldRowProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  secure?: boolean;
  keyboard?: "default" | "email" | "number" | "phone" | "url";
  returnKey?: "done" | "go" | "next" | "search" | "send";
  onSubmit?: () => void;
  autoFocus?: boolean;
  testID?: string;
}

/** A settings row whose value is typed: the label on the left, iOS's field on the right. */
export function FieldRow(props: FieldRowProps) {
  return (
    <View class="flex-row items-center gap-2 border-b border-separator px-4 py-2">
      <Text class="w-24 shrink-0 text-body text-secondary-label">{props.label}</Text>
      <TextField
        value={props.value}
        onChange={({ value }: { value: string }) => props.onChange(value)}
        placeholder={props.placeholder}
        secure={props.secure}
        keyboard={props.keyboard}
        returnKey={props.returnKey}
        onSubmit={() => props.onSubmit?.()}
        label={props.label}
        class="min-w-0 flex-1"
        testID={props.testID}
      />
    </View>
  );
}
