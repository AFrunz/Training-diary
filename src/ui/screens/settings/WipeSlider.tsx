import { useMemo, useState } from 'react'
import { PanResponder, Pressable, StyleSheet, Text, View } from 'react-native'
import type { AccessibilityActionEvent, LayoutChangeEvent } from 'react-native'
import { Icon } from '../../components/Icon'
import { useT } from '../../i18n/I18nProvider'
import { useTheme } from '../../theme/ThemeProvider'
import { radii, uiFont } from '../../theme/tokens'
import { isSlideComplete, sliderProgress } from './slider'

/**
 * Опасная зона настроек (FR-7.4): удаление всех данных прячется за жестом.
 * Одно случайное касание ничего не стирает — ручку нужно протянуть до правого
 * края, и только после этого появляется кнопка подтверждения.
 *
 * Ручку не протянуть без зрения и точной моторики, поэтому у дорожки роль
 * `adjustable`: экранный диктор доводит ползунок действием «увеличить».
 */

const TRACK_HEIGHT = 52
const KNOB_SIZE = 44
const TRACK_PADDING = 4

export interface WipeSliderProps {
  readonly onConfirmed?: () => void
}

export function WipeSlider({ onConfirmed }: WipeSliderProps) {
  const { colors } = useTheme()
  const { t } = useT()

  const [trackWidth, setTrackWidth] = useState(0)
  const [progress, setProgress] = useState(0)
  const [confirmed, setConfirmed] = useState(false)

  /** Ход ручки: дорожка без самой ручки и полей по краям. */
  const travel = Math.max(0, trackWidth - KNOB_SIZE - TRACK_PADDING * 2)

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderMove: (_event, gesture) => setProgress(sliderProgress(gesture.dx, travel)),
        onPanResponderRelease: (_event, gesture) => {
          const next = sliderProgress(gesture.dx, travel)
          if (isSlideComplete(next)) {
            setConfirmed(true)
            return
          }
          // не дотянули: ручка возвращается назад, ничего не происходит
          setProgress(0)
        },
        onPanResponderTerminate: () => setProgress(0),
      }),
    [travel],
  )

  const onAccessibilityAction = (event: AccessibilityActionEvent) => {
    if (event.nativeEvent.actionName === 'increment') {
      setProgress(1)
      setConfirmed(true)
      return
    }
    setProgress(0)
  }

  if (confirmed) {
    return (
      <Pressable
        testID="settings-wipe-confirm"
        accessibilityRole="button"
        onPress={onConfirmed}
        style={[styles.confirm, { backgroundColor: colors.danger }]}
      >
        <Text style={[styles.confirmLabel, { color: colors.onAccent }]}>{t('common.delete')}</Text>
      </Pressable>
    )
  }

  return (
    <View
      testID="settings-wipe-slider"
      accessibilityRole="adjustable"
      accessibilityLabel={t('settings.wipe')}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={onAccessibilityAction}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}
      onLayout={(event: LayoutChangeEvent) => setTrackWidth(event.nativeEvent.layout.width)}
      style={[styles.track, { backgroundColor: colors.surface2 }]}
      {...responder.panHandlers}
    >
      <Text style={[styles.hint, { color: colors.textMuted }]}>{t('settings.wipeSlide')}</Text>

      <View
        testID="settings-wipe-knob"
        style={[styles.knob, { backgroundColor: colors.danger, left: TRACK_PADDING + progress * travel }]}
      >
        <Icon name="arrow-right" size={18} color={colors.onAccent} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  track: {
    height: TRACK_HEIGHT,
    borderRadius: radii.pill,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  hint: {
    fontSize: 11,
    fontWeight: '600',
    fontFamily: uiFont('600'),
    textAlign: 'center',
    paddingLeft: KNOB_SIZE,
  },
  knob: {
    position: 'absolute',
    width: KNOB_SIZE,
    height: KNOB_SIZE,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirm: {
    height: TRACK_HEIGHT,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmLabel: { fontSize: 15, fontWeight: '700', fontFamily: uiFont('700') },
})
