import type { ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '../theme/ThemeProvider'

export interface ScreenProps {
  readonly children: ReactNode
  /**
   * Экран внутри таббара: снизу отступ не нужен, его держит сам таббар.
   * Для экранов поверх стека — нужен, иначе кнопка уезжает под жест «домой».
   */
  readonly withBottomInset?: boolean
  readonly testID?: string
}

/**
 * Контейнер экрана с безопасными зонами. Заголовки навигации у нас скрыты
 * (`headerShown: false`), поэтому статус-бар и жестовую полосу разводит именно он.
 */
export function Screen({ children, withBottomInset = true, testID }: ScreenProps) {
  const insets = useSafeAreaInsets()
  const { colors } = useTheme()

  return (
    <View
      testID={testID}
      style={[
        styles.root,
        {
          backgroundColor: colors.bg,
          paddingTop: insets.top,
          paddingBottom: withBottomInset ? insets.bottom : 0,
          paddingLeft: insets.left,
          paddingRight: insets.right,
        },
      ]}
    >
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
})
