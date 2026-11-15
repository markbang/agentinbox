// Schedule send: a day from the calendar and a time from two wheels, in the
// user's time zone, refusing a time that has passed. It is a sheet with
// Cancel and Schedule in its header, as iOS asks for a date.
import { signal, Text, View } from "nsh";
import { t } from "nsh/i18n";
import { DatePicker, Picker, Sheet } from "cupertino";
import { sendDate } from "../lib/format";

const pad = (n: number) => String(n).padStart(2, "0");
const isoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
// Local midnight of an ISO date, then the time of day: the user's zone throughout.
const localTime = (date: string, time: string) => {
  const [y, m, d] = date.split("-").map(Number);
  const [h, min] = time.split(":").map(Number);
  return new Date(y, m - 1, d, h, min).getTime();
};

const hours = Array.from({ length: 24 }, (_, h) => ({ value: pad(h), title: pad(h) }));
const minutes = Array.from({ length: 12 }, (_, i) => ({ value: pad(i * 5), title: pad(i * 5) }));

export function ScheduleDialog(props: { open: boolean; onClose: () => void; onPick: (at: number) => void }) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const date = signal(isoDate(tomorrow));
  const hour = signal("08");
  const minute = signal("00");
  const time = () => `${hour()}:${minute()}`;
  const at = () => localTime(date(), time());
  const past = () => at() <= Date.now();
  return (
    <Sheet
      open={props.open}
      detent="large"
      title={t("schedule.pick")}
      leading={t("common.cancel")}
      trailing={t("compose.schedule")}
      onOpenChange={({ open }: { open: boolean }) => {
        if (!open) props.onClose();
      }}
      onLeading={() => props.onClose()}
      onTrailing={() => {
        if (!past()) props.onPick(at());
      }}
    >
      <View class="gap-3 px-4 pb-8 pt-2" testID="schedule-dialog">
        <DatePicker value={date()} onChange={({ value: day }: { value: string }) => date.set(day)} label={t("schedule.date")} testID="schedule-date" />
        <View class="flex-row items-center justify-center gap-4">
          <View class="w-20">
            <Picker items={hours} value={hour()} onChange={({ value }: { value: string }) => hour.set(value)} label={t("schedule.time")} height={120} itemHeight={32} />
          </View>
          <Text class="text-title2 text-label">:</Text>
          <View class="w-20">
            <Picker items={minutes} value={minute()} onChange={({ value }: { value: string }) => minute.set(value)} label={t("schedule.time")} height={120} itemHeight={32} />
          </View>
        </View>
        <Text class={`text-center text-subheadline ${past() ? "text-system-red" : "text-secondary-label"}`} testID="schedule-summary">
          {past() ? t("schedule.past") : t("outbox.sends", { when: sendDate(at()) })}
        </Text>
      </View>
    </Sheet>
  );
}
