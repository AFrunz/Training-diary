import { Tabs } from 'expo-router'
import { Text } from 'react-native'
import type { ColorValue } from 'react-native'
import { useT } from '../../src/ui/i18n/I18nProvider'
import { useTheme } from '../../src/ui/theme/ThemeProvider'

/** Таббар из макета: пять разделов, активный красится акцентом. */
export default function TabsLayout() {
  const { colors } = useTheme()
  const { t } = useT()

  const icon = (glyph: string) => {
    const Icon = ({ color }: { color: ColorValue }) => <Text style={{ color, fontSize: 18 }}>{glyph}</Text>
    Icon.displayName = `TabIcon(${glyph})`
    return Icon
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '500' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: t('tab.calendar'), tabBarButtonTestID: 'tab-calendar', tabBarIcon: icon('▦') }}
      />
      <Tabs.Screen
        name="workouts"
        options={{ title: t('tab.workouts'), tabBarButtonTestID: 'tab-workouts', tabBarIcon: icon('≡') }}
      />
      <Tabs.Screen
        name="library"
        options={{ title: t('tab.library'), tabBarButtonTestID: 'tab-library', tabBarIcon: icon('☰') }}
      />
      <Tabs.Screen
        name="stats"
        options={{ title: t('tab.stats'), tabBarButtonTestID: 'tab-stats', tabBarIcon: icon('◔') }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: t('tab.settings'), tabBarButtonTestID: 'tab-settings', tabBarIcon: icon('⚙') }}
      />
    </Tabs>
  )
}
