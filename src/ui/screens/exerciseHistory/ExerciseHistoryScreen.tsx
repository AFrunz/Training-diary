import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import type { Exercise } from '../../../domain/model/entities'
import type { Id, LocalDate, WeightKg, WeightUnit } from '../../../domain/model/types'
import { localDate } from '../../../domain/model/types'
import { toLocalDate } from '../../../domain/rules/dates'
import { EMPTY_VALUE, formatSet, formatWeight } from '../../../domain/rules/format'
import { epley1RM } from '../../../domain/rules/metrics'
import { toDisplayWeight } from '../../../domain/rules/units'
import { ScreenHeader } from '../../components/ScreenHeader'
import { useT } from '../../i18n/I18nProvider'
import type { TranslationKey } from '../../i18n/dictionaries'
import { useServices } from '../../providers/ServicesProvider'
import { useTheme } from '../../theme/ThemeProvider'
import { numFont, radii, uiFont } from '../../theme/tokens'

export interface ExerciseHistoryScreenProps {
  readonly exerciseId: Id
  readonly onBack?: () => void
}

/** История упражнения не ограничена периодом: берём все тренировки. */
const ALL_TIME = { from: localDate('1900-01-01'), to: localDate('2999-12-31') }

/** Сколько последних тренировок помещается в столбчатый график макета. */
const CHART_COLUMNS = 7
const BAR_MAX_HEIGHT = 90
const BAR_MIN_HEIGHT = 8

type Metric = 'weight' | 'oneRm'

interface HistorySet {
  readonly id: Id
  readonly weightKg: WeightKg | null
  readonly reps: number
}

interface HistoryEntry {
  readonly workoutId: Id
  readonly date: LocalDate
  readonly sets: readonly HistorySet[]
  readonly maxWeightKg: number | null
  readonly best1RM: number | null
}

interface WeightRecord {
  readonly date: LocalDate
  readonly weightKg: number
  /** Прибавка к прошлому рекорду; у самого первого рекорда её нет. */
  readonly deltaKg: number | null
}

interface RepsRecord {
  readonly date: LocalDate
  readonly reps: number
  readonly weightKg: number | null
}

interface HistoryView {
  readonly exercise: Exercise
  readonly unit: WeightUnit
  readonly today: LocalDate
  readonly entries: readonly HistoryEntry[]
  readonly weightRecord: WeightRecord | null
  readonly repsRecord: RepsRecord | null
}

const maxOrNull = (values: readonly (number | null)[]): number | null => {
  const known = values.filter((value): value is number => value !== null)
  return known.length === 0 ? null : Math.max(...known)
}

const findWeightRecord = (entries: readonly HistoryEntry[]): WeightRecord | null => {
  let record: WeightRecord | null = null
  let best: number | null = null

  for (const entry of entries) {
    if (entry.maxWeightKg === null) continue
    if (best === null || entry.maxWeightKg > best) {
      record = {
        date: entry.date,
        weightKg: entry.maxWeightKg,
        deltaKg: best === null ? null : entry.maxWeightKg - best,
      }
      best = entry.maxWeightKg
    }
  }
  return record
}

const findRepsRecord = (entries: readonly HistoryEntry[]): RepsRecord | null => {
  let record: RepsRecord | null = null

  for (const entry of entries) {
    for (const set of entry.sets) {
      if (record === null || set.reps > record.reps) {
        record = { date: entry.date, reps: set.reps, weightKg: set.weightKg }
      }
    }
  }
  return record
}

const monthKey = (prefix: 'date.monthGenitive' | 'date.monthShort', month: number): TranslationKey =>
  `${prefix}.${month}` as TranslationKey

/**
 * Экран «08 · История упражнения»: рекорды, динамика и разбивка по тренировкам.
 *
 * Данные собираются из портов: список тренировок за всё время, затем подходы
 * нужного упражнения из каждой. Вес показывается в единицах из настроек (FR-7.5).
 */
export function ExerciseHistoryScreen({ exerciseId, onBack }: ExerciseHistoryScreenProps) {
  const { ports } = useServices()
  const { colors } = useTheme()
  const { t, count, locale } = useT()
  const [metric, setMetric] = useState<Metric>('weight')

  const { data } = useQuery<HistoryView | null>({
    queryKey: ['exercise-history', exerciseId],
    queryFn: async () => {
      const exercise = await ports.exercises.byId(exerciseId)
      if (!exercise) return null

      const settings = await ports.settings.get()
      const workouts = await ports.workouts.listRange(ALL_TIME)
      const aggregates = await Promise.all(workouts.map((workout) => ports.workouts.byId(workout.id)))

      const entries: HistoryEntry[] = []
      for (const aggregate of aggregates) {
        if (!aggregate) continue

        const sets: HistorySet[] = aggregate.items
          .filter((item) => item.exerciseId === exerciseId)
          .flatMap((item) =>
            item.sets.map((set) => ({ id: set.id, weightKg: set.weightKg ?? null, reps: set.reps })),
          )
        if (sets.length === 0) continue

        entries.push({
          workoutId: aggregate.workout.id,
          date: aggregate.workout.date,
          sets,
          maxWeightKg: maxOrNull(sets.map((set) => set.weightKg)),
          best1RM: maxOrNull(sets.map((set) => epley1RM(set.weightKg, set.reps))),
        })
      }

      return {
        exercise,
        unit: settings.unit,
        today: toLocalDate(ports.clock.now(), ports.timeZone),
        entries,
        weightRecord: findWeightRecord(entries),
        repsRecord: findRepsRecord(entries),
      }
    },
  })

  if (!data) {
    return <View testID="exercise-history-screen" style={[styles.root, { backgroundColor: colors.bg }]} />
  }

  const { exercise, unit, today, entries, weightRecord, repsRecord } = data

  const formatDate = (date: LocalDate, short: boolean): string => {
    const [, month, day] = date.split('-')
    return t('date.dayMonth', {
      day: Number(day),
      month: t(monthKey(short ? 'date.monthShort' : 'date.monthGenitive', Number(month))),
    })
  }

  /** Дата рекорда: сегодняшнюю подписываем словом, как в макете. */
  const recordDate = (date: LocalDate): string =>
    date === today ? t('calendar.today').toLocaleLowerCase(locale) : formatDate(date, false)

  const chartValue = (entry: HistoryEntry): number | null =>
    metric === 'weight' ? entry.maxWeightKg : entry.best1RM

  const columns = entries
    .map((entry) => ({ date: entry.date, value: chartValue(entry) }))
    .filter((column): column is { date: LocalDate; value: number } => column.value !== null)
    .slice(-CHART_COLUMNS)

  const peak = columns.length === 0 ? null : Math.max(...columns.map((column) => column.value))

  const subtitle = exercise.muscleGroup
    ? t('history.subtitle', {
        group: exercise.muscleGroup,
        workouts: count('workouts', entries.length),
      })
    : count('workouts', entries.length)

  return (
    <View testID="exercise-history-screen" style={[styles.root, { backgroundColor: colors.bg }]}>
      <ScreenHeader title={exercise.name} subtitle={subtitle} {...(onBack ? { onBack } : {})} />

      {entries.length === 0 ? (
        <View style={styles.content}>
          <View
            testID="history-empty"
            style={[styles.card, styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>{t('history.empty')}</Text>
            <Text style={[styles.emptyHint, { color: colors.textMuted }]}>{t('history.emptyHint')}</Text>
          </View>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.recordsRow}>
            <View
              testID="history-record-weight"
              style={[styles.card, styles.recordCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <Text style={[styles.recordLabel, { color: colors.textMuted }]}>{t('history.maxWeight')}</Text>
              <Text testID="history-record-weight-value" style={[styles.recordValue, { color: colors.textPrimary }]}>
                {weightRecord === null ? EMPTY_VALUE : formatWeight(weightRecord.weightKg, unit, locale)}
              </Text>
              {weightRecord ? (
                <Text
                  testID="history-record-weight-note"
                  style={[
                    styles.recordNote,
                    { color: weightRecord.deltaKg === null ? colors.textMuted : colors.success },
                  ]}
                >
                  {weightRecord.deltaKg === null
                    ? recordDate(weightRecord.date)
                    : t('history.recordNote', {
                        date: recordDate(weightRecord.date),
                        value: t('history.deltaUp', {
                          value: formatWeight(weightRecord.deltaKg, unit, locale),
                        }),
                      })}
                </Text>
              ) : null}
            </View>

            <View
              testID="history-record-reps"
              style={[styles.card, styles.recordCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <Text style={[styles.recordLabel, { color: colors.textMuted }]}>{t('history.maxReps')}</Text>
              <Text testID="history-record-reps-value" style={[styles.recordValue, { color: colors.textPrimary }]}>
                {repsRecord === null ? EMPTY_VALUE : String(repsRecord.reps)}
              </Text>
              {repsRecord ? (
                <Text testID="history-record-reps-note" style={[styles.recordNote, { color: colors.textMuted }]}>
                  {repsRecord.weightKg === null
                    ? recordDate(repsRecord.date)
                    : t('history.recordNote', {
                        date: recordDate(repsRecord.date),
                        value: formatWeight(repsRecord.weightKg, unit, locale),
                      })}
                </Text>
              ) : null}
            </View>
          </View>

          <View style={[styles.card, styles.chartCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.chartHeader}>
              <Text style={[styles.chartTitle, { color: colors.textPrimary }]}>{t('history.dynamics')}</Text>

              <View style={styles.segment}>
                {(
                  [
                    ['weight', t('history.metricMaxWeight')],
                    ['oneRm', t('history.metricOneRM')],
                  ] as const
                ).map(([value, label]) => (
                  <Pressable
                    key={value}
                    testID={`history-metric-${value}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: metric === value }}
                    onPress={() => setMetric(value)}
                    style={[
                      styles.segmentChip,
                      metric === value ? { backgroundColor: colors.surface2 } : null,
                    ]}
                  >
                    <Text
                      style={[
                        styles.segmentLabel,
                        { color: metric === value ? colors.textPrimary : colors.textSecondary },
                      ]}
                    >
                      {label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View testID="history-chart" style={styles.bars}>
              {columns.map((column, index) => {
                const isPeak = peak !== null && column.value === peak
                const height =
                  peak === null || peak === 0
                    ? BAR_MIN_HEIGHT
                    : Math.max(BAR_MIN_HEIGHT, Math.round((column.value / peak) * BAR_MAX_HEIGHT))

                return (
                  <View key={column.date} style={styles.barColumn}>
                    {isPeak ? (
                      <Text testID={`history-bar-peak-${index}`} style={[styles.barPeak, { color: colors.accent }]}>
                        {String(toDisplayWeight(column.value, unit))}
                      </Text>
                    ) : null}

                    <View
                      testID={`history-bar-${index}`}
                      style={[
                        styles.bar,
                        { height, backgroundColor: isPeak ? colors.accent : colors.accentSoft },
                      ]}
                    />
                    <Text style={[styles.barDate, { color: colors.textMuted }]}>
                      {formatDate(column.date, true)}
                    </Text>
                  </View>
                )
              })}
            </View>
          </View>

          <View style={styles.workoutsBlock}>
            <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{t('history.byWorkouts')}</Text>

            {[...entries].reverse().map((entry, index) => {
              const previous = entries[entries.length - index - 2]
              const delta =
                previous && previous.maxWeightKg !== null && entry.maxWeightKg !== null
                  ? entry.maxWeightKg - previous.maxWeightKg
                  : null

              return (
                <View
                  key={entry.workoutId}
                  testID={`history-workout-${index}`}
                  style={[styles.card, styles.workoutCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                >
                  <View style={styles.workoutTop}>
                    <Text style={[styles.workoutDate, { color: colors.textPrimary }]}>
                      {formatDate(entry.date, false)}
                    </Text>

                    {delta === null ? null : (
                      <View
                        testID={`history-delta-${index}`}
                        style={[
                          styles.deltaChip,
                          { backgroundColor: delta > 0 ? colors.accentSoft : colors.surface2 },
                        ]}
                      >
                        <Text
                          style={[
                            styles.deltaLabel,
                            { color: delta > 0 ? colors.accent : colors.textMuted },
                          ]}
                        >
                          {delta === 0
                            ? t('history.noChange')
                            : t(delta > 0 ? 'history.deltaUp' : 'history.deltaDown', {
                                value: formatWeight(Math.abs(delta), unit, locale),
                              })}
                        </Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.setsRow}>
                    {entry.sets.map((set) => (
                      <View key={set.id} style={[styles.setChip, { backgroundColor: colors.surface2 }]}>
                        <Text style={[styles.setLabel, { color: colors.textPrimary }]}>
                          {formatSet(set, unit)}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              )
            })}
          </View>
        </ScrollView>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingTop: 8, paddingHorizontal: 20, paddingBottom: 24, gap: 14 },

  card: { borderRadius: radii.lg, borderWidth: 1 },

  recordsRow: { flexDirection: 'row', gap: 12 },
  recordCard: { flex: 1, padding: 14, gap: 4 },
  recordLabel: { fontSize: 11, fontFamily: uiFont('500'), fontWeight: '500' },
  // значение рекорда — числовая гарнитура ($font-num в макете)
  recordValue: { fontSize: 22, fontFamily: numFont('700'), fontWeight: '700' },
  recordNote: { fontSize: 11, fontFamily: uiFont('500'), fontWeight: '500' },

  chartCard: { padding: 16, gap: 14 },
  chartHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chartTitle: { fontSize: 14, fontFamily: uiFont('600'), fontWeight: '600' },
  segment: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  segmentChip: { borderRadius: 7, paddingVertical: 4, paddingHorizontal: 9 },
  segmentLabel: { fontSize: 11, fontFamily: uiFont('600'), fontWeight: '600' },

  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 130 },
  barColumn: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 6 },
  barPeak: { fontSize: 10, fontFamily: numFont('700'), fontWeight: '700' },
  bar: { width: '100%', borderRadius: 6 },
  barDate: { fontSize: 9, fontFamily: uiFont('500'), fontWeight: '500' },

  workoutsBlock: { gap: 10 },
  sectionTitle: {
    fontSize: 12,
    fontFamily: uiFont('700'),
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  workoutCard: { padding: 14, gap: 10 },
  workoutTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  workoutDate: { fontSize: 14, fontFamily: uiFont('600'), fontWeight: '600' },
  deltaChip: { borderRadius: radii.pill, paddingVertical: 3, paddingHorizontal: 8 },
  deltaLabel: { fontSize: 11, fontFamily: uiFont('600'), fontWeight: '600' },
  setsRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 7 },
  setChip: { borderRadius: radii.sm, paddingVertical: 5, paddingHorizontal: 9 },
  // подписи подходов — числовая гарнитура
  setLabel: { fontSize: 12, fontFamily: numFont('600'), fontWeight: '600' },

  emptyCard: { padding: 16, gap: 4 },
  emptyTitle: { fontSize: 15, fontFamily: uiFont('600'), fontWeight: '600' },
  emptyHint: { fontSize: 12, fontFamily: uiFont('400'), fontWeight: '400' },
})
