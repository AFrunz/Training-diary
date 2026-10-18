import { useEffect, useMemo, useRef } from 'react'
import type { ReactNode } from 'react'
import { Animated, Modal, PanResponder, Pressable, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useT } from '../i18n/I18nProvider'
import { useTheme } from '../theme/ThemeProvider'
import { palette, radii } from '../theme/tokens'
import { KeyboardAvoider } from './KeyboardAvoider'

/**
 * Шторка снизу: затемнение, выезд и полоска-ручка.
 *
 * Анимация своя, а не `animationType="slide"` у `Modal`: системная съезжает
 * вместе с затемнением и не умеет останавливаться на полпути, а ручку нужно
 * тянуть пальцем — нарисованная, но мёртвая полоска обманывает.
 *
 * Жест висит на шапке шторки, а не на всём содержимом: иначе он отбирал бы
 * прокрутку у списка внутри.
 */

/** Ниже этого порога шторка возвращается на место, выше — закрывается. */
const DISMISS_DISTANCE = 90
const DISMISS_VELOCITY = 0.6

/**
 * Отпущенный жест: закрывать или возвращать. Короткий, но резкий рывок вниз
 * закрывает так же, как медленная протяжка на треть экрана.
 */
export const shouldDismiss = (gesture: { readonly dy: number; readonly vy: number }): boolean =>
  gesture.dy > DISMISS_DISTANCE || gesture.vy > DISMISS_VELOCITY
const OPEN_MS = 220
const CLOSE_MS = 160

export interface BottomSheetProps {
  readonly visible: boolean
  readonly onClose: () => void
  readonly children: ReactNode
  /** Высота шторки неизвестна заранее: для анимации хватает запаса сверху. */
  readonly testID?: string
}

export function BottomSheet({ visible, onClose, children, testID = 'bottom-sheet' }: BottomSheetProps) {
  const insets = useSafeAreaInsets()
  const { colors } = useTheme()
  const { t } = useT()

  const offset = useRef(new Animated.Value(0)).current
  const shown = useRef(false)

  /** Закрытие сначала доигрывает выезд вниз, и только потом снимает шторку. */
  const close = useMemo(
    () => () => {
      Animated.timing(offset, {
        toValue: SHEET_TRAVEL,
        duration: CLOSE_MS,
        useNativeDriver: true,
      }).start(() => onClose())
    },
    [offset, onClose],
  )

  useEffect(() => {
    if (!visible) {
      shown.current = false
      return
    }
    if (shown.current) return

    shown.current = true
    offset.setValue(SHEET_TRAVEL)
    Animated.timing(offset, { toValue: 0, duration: OPEN_MS, useNativeDriver: true }).start()
  }, [visible, offset])

  const pan = useMemo(
    () =>
      PanResponder.create({
        // жест перехватывается только на явном движении вниз, тап проходит насквозь
        onMoveShouldSetPanResponder: (_event, gesture) => gesture.dy > 4,
        onPanResponderMove: (_event, gesture) => {
          offset.setValue(Math.max(0, gesture.dy))
        },
        onPanResponderRelease: (_event, gesture) => {
          if (shouldDismiss(gesture)) {
            close()
            return
          }
          Animated.spring(offset, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start()
        },
      }),
    [offset, close],
  )

  if (!visible) return null

  return (
    <Modal visible transparent animationType="none" onRequestClose={close} testID={testID}>
      <View style={styles.root}>
        <Pressable
          testID={`${testID}-scrim`}
          accessibilityRole="button"
          accessibilityLabel={t('common.cancel')}
          onPress={close}
          style={[StyleSheet.absoluteFill, styles.scrim, { backgroundColor: palette.dark.bg }]}
        />

        <KeyboardAvoider style={styles.avoider}>
          <Animated.View
            style={[
              styles.sheet,
              {
                backgroundColor: colors.surface,
                paddingBottom: 20 + insets.bottom,
                transform: [{ translateY: offset }],
              },
            ]}
          >
            <View
              testID={`${testID}-grabber`}
              accessibilityRole="adjustable"
              accessibilityLabel={t('common.close')}
              accessibilityActions={DISMISS_ACTIONS}
              onAccessibilityAction={close}
              style={styles.grabberWrap}
              {...pan.panHandlers}
            >
              <View style={[styles.grabber, { backgroundColor: colors.border }]} />
            </View>

            {children}
          </Animated.View>
        </KeyboardAvoider>
      </View>
    </Modal>
  )
}

/** Экранному диктору жест недоступен: закрытие вешается отдельным действием. */
const DISMISS_ACTIONS = [{ name: 'decrement' as const }]

/** Запас хода: больше любой шторки, чтобы выезд начинался за краем экрана. */
const SHEET_TRAVEL = 900

const styles = StyleSheet.create({
  root: { flex: 1 },
  avoider: { justifyContent: 'flex-end' },
  scrim: { opacity: 0.7 },
  sheet: {
    // выше 85 % шторка превращается в экран: длинный список внутри прокручивается
    maxHeight: '85%',
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    gap: 18,
    paddingTop: 12,
    paddingHorizontal: 20,
  },
  // площадь под палец: сама полоска тонкая, попасть в неё трудно
  grabberWrap: { alignItems: 'center', paddingVertical: 6, marginTop: -6 },
  grabber: { width: 40, height: 4, borderRadius: radii.pill },
})
