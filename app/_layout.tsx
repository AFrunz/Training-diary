import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Stack } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, StatusBar, View } from 'react-native'
import { createServices } from '../src/app/container'
import type { Services } from '../src/app/container'
import { createAppPorts } from '../src/infra/bootstrap'
import { I18nProvider } from '../src/ui/i18n/I18nProvider'
import { ServicesProvider } from '../src/ui/providers/ServicesProvider'
import { SettingsProvider } from '../src/ui/providers/SettingsProvider'
import { ThemeProvider } from '../src/ui/theme/ThemeProvider'
import { palette } from '../src/ui/theme/tokens'

/**
 * Корень приложения: открывает базу, применяет миграции и поднимает провайдеры.
 * Единственное место, где сходятся infra и ui (ARCHITECTURE.md §1).
 */

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // данные лежат на устройстве: перезапрашивать их по таймеру незачем
      staleTime: Infinity,
      retry: false,
    },
  },
})

const Splash = () => (
  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.light.bg }}>
    <ActivityIndicator color={palette.light.accent} />
  </View>
)

export default function RootLayout() {
  const [services, setServices] = useState<Services | null>(null)

  useEffect(() => {
    let cancelled = false
    createAppPorts().then((ports) => {
      if (!cancelled) setServices(createServices(ports))
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (!services) return <Splash />

  return (
    <QueryClientProvider client={queryClient}>
      <ServicesProvider services={services}>
        <SettingsProvider fallback={<Splash />}>
          {(settings) => (
            <ThemeProvider mode={settings.theme}>
              <I18nProvider mode={settings.language} systemLanguage={getSystemLanguage()}>
                <StatusBar />
                <Stack screenOptions={{ headerShown: false }} />
              </I18nProvider>
            </ThemeProvider>
          )}
        </SettingsProvider>
      </ServicesProvider>
    </QueryClientProvider>
  )
}

/** Язык устройства: по нему выбирается словарь в системном режиме (FR-7.6). */
const getSystemLanguage = (): string => {
  const locale = Intl.DateTimeFormat().resolvedOptions().locale
  return locale || 'en'
}
