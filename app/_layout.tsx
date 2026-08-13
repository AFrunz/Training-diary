import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import {
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from "@expo-google-fonts/space-grotesk";
import {
  MutationCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StatusBar, View } from "react-native";
import { createServices } from "../src/app/container";
import type { Services } from "../src/app/container";
import { createAppPorts } from "../src/infra/bootstrap";
import { I18nProvider } from "../src/ui/i18n/I18nProvider";
import { ServicesProvider } from "../src/ui/providers/ServicesProvider";
import { SettingsProvider } from "../src/ui/providers/SettingsProvider";
import { ThemeProvider } from "../src/ui/theme/ThemeProvider";
import { palette } from "../src/ui/theme/tokens";

/**
 * Корень приложения: открывает базу, применяет миграции и поднимает провайдеры.
 * Единственное место, где сходятся infra и ui (ARCHITECTURE.md §1).
 */

const queryClient: QueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // данные лежат на устройстве: перезапрашивать их по таймеру незачем
      staleTime: Infinity,
      retry: false,
    },
  },
  /**
   * Любая запись сбрасывает весь кэш. Данных мало, они локальные, а одна и та же
   * сущность видна сразу на нескольких экранах: точечная инвалидация уже трижды
   * приводила к тому, что созданное не появлялось в списке.
   */
  mutationCache: new MutationCache({ onSuccess: () => queryClient.invalidateQueries() }),
});

const Splash = () => (
  <View
    style={{
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: palette.light.bg,
    }}
  >
    <ActivityIndicator color={palette.light.accent} />
  </View>
);

export default function RootLayout() {
  const [services, setServices] = useState<Services | null>(null);
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
  });

  useEffect(() => {
    let cancelled = false;
    createAppPorts().then((ports) => {
      if (cancelled) return;
      const created = createServices(ports);
      setServices(created);
      // базовый набор упражнений на пустой базе: без него первую программу
      // не из чего собрать. Язык фиксируется в момент заполнения — дальше это
      // пользовательские данные, и переводить их нельзя (FR-7.6)
      void created
        .seedPresetExercises(getSystemLanguage().toLowerCase().startsWith("ru") ? "ru" : "en")
        // автобэкап снимается после набора, чтобы копия была осмысленной (FR-7.3)
        .then(() => created.runBackup());
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!services || !fontsLoaded) return <Splash />;

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ServicesProvider services={services}>
          <SettingsProvider fallback={<Splash />}>
            {(settings) => (
              <ThemeProvider mode={settings.theme}>
                <I18nProvider
                  mode={settings.language}
                  systemLanguage={getSystemLanguage()}
                >
                  <StatusBar />
                  <Stack screenOptions={{ headerShown: false }} />
                </I18nProvider>
              </ThemeProvider>
            )}
          </SettingsProvider>
        </ServicesProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

/** Язык устройства: по нему выбирается словарь в системном режиме (FR-7.6). */
const getSystemLanguage = (): string => {
  const locale = Intl.DateTimeFormat().resolvedOptions().locale;
  return locale || "en";
};
