import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { ReactNode } from 'react'
import { useTheme } from '../theme/ThemeProvider'
import { radii } from '../theme/tokens'

export interface ScreenHeaderProps {
  readonly title: string
  readonly subtitle?: string | null
  readonly onBack?: () => void
  /** Правая кнопка действия: иконка или текст. */
  readonly action?: ReactNode
  readonly testID?: string
}

/** Шапка push-экрана из макета: кнопка «назад», заголовок с подписью, действие справа. */
export function ScreenHeader({ title, subtitle, onBack, action, testID = 'screen-header' }: ScreenHeaderProps) {
  const { colors } = useTheme()

  return (
    <View testID={testID} style={styles.root}>
      {onBack ? (
        <Pressable
          testID="header-back"
          accessibilityRole="button"
          onPress={onBack}
          style={[styles.round, { backgroundColor: colors.surface2 }]}
        >
          <Text style={{ color: colors.textPrimary }}>‹</Text>
        </Pressable>
      ) : null}

      <View style={styles.titles}>
        <Text testID="header-title" style={[styles.title, { color: colors.textPrimary }]}>
          {title}
        </Text>
        {subtitle ? (
          <Text testID="header-subtitle" style={[styles.subtitle, { color: colors.textSecondary }]}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {action}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, height: 56 },
  round: { width: 34, height: 34, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center' },
  titles: { flex: 1, gap: 1 },
  title: { fontSize: 17, fontWeight: '700' },
  subtitle: { fontSize: 12, fontWeight: '500' },
})
