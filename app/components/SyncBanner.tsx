// A sync that failed, under the bar: what happened and a retry. It stays
// until a sync succeeds, since the mail on screen may be out of date.
import { Text, View } from "nsh";
import { t } from "nsh/i18n";
import { Button, Icon } from "cupertino";
import { errorInfoText, mailStatus, refresh } from "../store";

export function SyncBanner() {
  return (
    <If when={mailStatus().error}>
      {(error) => (
        <View role="alert" testID="sync-banner" class="mx-3 mb-1 flex-row items-center gap-2 rounded-row bg-system-red/10 px-3 py-2">
          <Icon name="exclamationmark.triangle" size={18} tint="system-red" />
          <View class="min-w-0 flex-1">
            <Text class="text-footnote font-semibold text-system-red">{t("sync.failed")}</Text>
            <Text class="line-clamp-2 text-caption1 text-secondary-label">{errorInfoText(error())}</Text>
          </View>
          <Button title={t("actions.retry")} variant="plain" size="small" onPress={() => void refresh()} testID="sync-retry" />
        </View>
      )}
    </If>
  );
}
