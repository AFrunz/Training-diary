import { Screen } from "../../src/ui/components/Screen";
import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Alert } from "react-native";
import type { ImportMode } from "../../src/domain/transfer/types";
import { useT } from "../../src/ui/i18n/I18nProvider";
import { useServices } from "../../src/ui/providers/ServicesProvider";
import { SettingsScreen } from "../../src/ui/screens/settings/SettingsScreen";

export default function SettingsTab() {
  const queryClient = useQueryClient();
  const services = useServices();
  const { t } = useT();

  const runImport = async (mode: ImportMode) => {
    const result = await services.importFromFile(mode);
    if (result.cancelled) return;
    await queryClient.invalidateQueries();
    Alert.alert(
      t("settings.import"),
      t("settings.importDone", {
        added: result.summary?.added ?? 0,
        updated: result.summary?.updated ?? 0,
      }),
    );
  };

  return (
    <Screen withBottomInset={false}>
      <SettingsScreen
        // единицы веса и первый день недели участвуют в расчётах на всех экранах,
        // а кэш живёт вечно (staleTime: Infinity) — после правки настроек сбрасываем весь кэш,
        // иначе открытая тренировка останется в старых единицах
        onSettingsChange={() => queryClient.invalidateQueries()}
        onImportRequested={() =>
          // режим импорта выбирается до диалога выбора файла (FR-7.2)
          Alert.alert(t("settings.import"), t("settings.importHint"), [
            {
              text: t("settings.replaceAll"),
              onPress: () => void runImport("replace"),
            },
            {
              text: t("settings.mergeInto"),
              onPress: () => void runImport("merge"),
            },
            { text: t("common.cancel"), style: "cancel" },
          ])
        }
        onBackupsRequested={() => router.push("/settings/backups")}
        onWipeConfirmed={async () => {
          await services.wipeAllData();
          await queryClient.invalidateQueries();
        }}
      />
    </Screen>
  );
}
