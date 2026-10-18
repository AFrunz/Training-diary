import DateTimePicker from '@react-native-community/datetimepicker'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { Id, Instant } from '../../../domain/model/types'
import { instant } from '../../../domain/model/types'
import { formatDuration } from '../../../domain/rules/format'
import { BottomSheet } from '../../components/BottomSheet'
import { useT } from '../../i18n/I18nProvider'
import { useServices } from '../../providers/ServicesProvider'
import { useTheme } from '../../theme/ThemeProvider'
import { numFont, radii, uiFont } from '../../theme/tokens'

/**
 * Правка времени начала и окончания (FR-4.7).
 *
 * Меняются только часы и минуты: дата у тренировки своя и правится переносом,
 * а не здесь. Пустой конец означает незавершённую тренировку — его можно и
 * проставить, и снять.
 */

export interface WorkoutTimesSheetProps {
  readonly workoutId: Id
  readonly startedAt: Instant
  /** Ручное время окончания либо вычисленное по отметкам; null — ещё идёт. */
  readonly finishedAt: Instant | null
  readonly timeZone: string
  readonly onClose: () => void
}

const timeFormatters = new Map<string, Intl.DateTimeFormat>()

/** Часы и минуты в зоне устройства — тот же формат, что в шапке тренировки. */
export const formatClock = (at: Instant, timeZone: string): string => {
  let formatter = timeFormatters.get(timeZone)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
    timeFormatters.set(timeZone, formatter)
  }
  return formatter.format(new Date(at))
}

/** Подставляет выбранные часы и минуты в прежний день. */
export const withTimeOf = (base: Instant, picked: Date): Instant => {
  const next = new Date(base)
  next.setHours(picked.getHours(), picked.getMinutes(), 0, 0)
  return instant(next.getTime())
}

export function WorkoutTimesSheet({
  workoutId,
  startedAt,
  finishedAt,
  timeZone,
  onClose,
}: WorkoutTimesSheetProps) {
  const services = useServices()
  const { colors } = useTheme()
  const { t, locale } = useT()

  const [start, setStart] = useState<Instant>(startedAt)
  const [finish, setFinish] = useState<Instant | null>(finishedAt)
  const [picking, setPicking] = useState<'start' | 'finish' | null>(null)

  const save = useMutation({
    mutationFn: () =>
      services.editWorkoutTimes({
        workoutId,
        manualStartedAt: start,
        manualFinishedAt: finish,
      }),
    onSuccess: onClose,
  })

  const inverted = finish !== null && finish < start
  const durationMs = finish === null || inverted ? null : finish - start

  const field = (
    kind: 'start' | 'finish',
    label: string,
    value: Instant | null,
    onPick: (next: Instant) => void,
  ) => (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>

      <Pressable
        testID={`workout-time-${kind}`}
        accessibilityRole="button"
        accessibilityValue={{ text: value === null ? t('common.empty') : formatClock(value, timeZone) }}
        onPress={() => setPicking(kind)}
        style={[styles.input, { backgroundColor: colors.surface2, borderColor: colors.border }]}
      >
        <Text style={[styles.value, { color: value === null ? colors.textMuted : colors.textPrimary }]}>
          {value === null ? t('common.empty') : formatClock(value, timeZone)}
        </Text>
      </Pressable>

      {picking === kind ? (
        <DateTimePicker
          testID={`workout-time-${kind}-picker`}
          value={new Date(value ?? start)}
          mode="time"
          is24Hour
          onChange={(_event, picked) => {
            setPicking(null)
            if (picked) onPick(withTimeOf(value ?? start, picked))
          }}
        />
      ) : null}
    </View>
  )

  return (
    <BottomSheet visible onClose={onClose} testID="workout-times-sheet">
      <View style={styles.titles}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{t('workout.timesTitle')}</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {t('workout.timesHint')}
        </Text>
      </View>

      <View style={styles.row}>
        {field('start', t('workout.timeStart'), start, setStart)}
        {field('finish', t('workout.timeFinish'), finish, setFinish)}
      </View>

      <View style={styles.footer}>
        <Text
          testID="workout-times-duration"
          style={[styles.duration, { color: inverted ? colors.danger : colors.textSecondary }]}
        >
          {inverted ? t('absence.errorInverted') : formatDuration(durationMs, locale)}
        </Text>

        {/* снять конец = вернуть тренировку в «идёт»: иначе ошибку не исправить */}
        {finish === null ? null : (
          <Pressable
            testID="workout-time-clear-finish"
            accessibilityRole="button"
            onPress={() => setFinish(null)}
          >
            <Text style={[styles.clear, { color: colors.accent }]}>{t('workout.timeClearFinish')}</Text>
          </Pressable>
        )}
      </View>

      <Pressable
        testID="workout-times-save"
        accessibilityRole="button"
        accessibilityState={{ disabled: inverted }}
        disabled={inverted || save.isPending}
        onPress={() => save.mutate()}
        style={[styles.submit, { backgroundColor: colors.accent, opacity: inverted ? 0.5 : 1 }]}
      >
        <Text style={[styles.submitLabel, { color: colors.onAccent }]}>{t('common.save')}</Text>
      </Pressable>
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  titles: { gap: 2 },
  title: { fontFamily: uiFont('700'), fontSize: 18, fontWeight: '700' },
  subtitle: { fontFamily: uiFont('500'), fontSize: 12, fontWeight: '500' },
  row: { flexDirection: 'row', gap: 12 },
  field: { flex: 1, gap: 6 },
  label: { fontFamily: uiFont('500'), fontSize: 11, fontWeight: '500' },
  input: {
    borderRadius: radii.md,
    borderWidth: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // время — число, поэтому числовая гарнитура, как у счётчика
  value: { fontFamily: numFont('700'), fontSize: 20, fontWeight: '700' },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  duration: { fontFamily: uiFont('500'), fontSize: 12, fontWeight: '500' },
  clear: { fontFamily: uiFont('600'), fontSize: 12, fontWeight: '600' },
  submit: { borderRadius: radii.md, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  submitLabel: { fontFamily: uiFont('700'), fontSize: 15, fontWeight: '700' },
})
