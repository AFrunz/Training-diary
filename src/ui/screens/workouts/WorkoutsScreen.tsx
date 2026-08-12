import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import type { WorkoutAggregate } from '../../../app/ports'
import type { Id, LocalDate } from '../../../domain/model/types'
import type { CompletionResult } from '../../../domain/rules/completion'
import { computeCompletion } from '../../../domain/rules/completion'
import { addDays, toLocalDate } from '../../../domain/rules/dates'
import { computeDuration } from '../../../domain/rules/duration'
import { formatDuration, formatElapsed } from '../../../domain/rules/format'
import { Chip } from '../../components/Chip'
import { Donut } from '../../components/Donut'
import type { TranslationKey } from '../../i18n/dictionaries'
import { useT } from '../../i18n/I18nProvider'
import { useServices } from '../../providers/ServicesProvider'
import { useTheme } from '../../theme/ThemeProvider'
import { programColors, radii } from '../../theme/tokens'

/**
 * Экран «05 · Тренировки» из макета: шапка с кнопкой создания, ряд фильтров по
 * программам, закреплённая активная тренировка и лента прошлых.
 *
 * Экран ничего не считает сам: завершённость приходит из `computeCompletion`,
 * длительность — из `computeDuration`, тексты — из словаря.
 */

/** Глубина ленты: год истории покрывает любой разумный экран прокрутки. */
const HISTORY_DAYS = 365

const MONTH_GENITIVE_KEYS = [
  'date.monthGenitive.1',
  'date.monthGenitive.2',
  'date.monthGenitive.3',
  'date.monthGenitive.4',
  'date.monthGenitive.5',
  'date.monthGenitive.6',
  'date.monthGenitive.7',
  'date.monthGenitive.8',
  'date.monthGenitive.9',
  'date.monthGenitive.10',
  'date.monthGenitive.11',
  'date.monthGenitive.12',
] as const satisfies readonly TranslationKey[]

/** Цвета программ лежат в токенах по ключу, снапшот тренировки хранит именно ключ. */
const PROGRAM_DOT: Record<string, string> = programColors

export interface WorkoutCardData {
  readonly id: Id
  readonly date: LocalDate
  readonly programId: Id
  readonly programName: string
  readonly programColor: string
  readonly startedAt: number
  readonly completion: CompletionResult
  readonly durationMs: number | null
}

const toCard = (aggregate: WorkoutAggregate, timeZone: string): WorkoutCardData => {
  const { workout, items } = aggregate

  const completion = computeCompletion(
    items.map((item) => ({ completedAt: item.completedAt ?? null, setCount: item.sets.length })),
  )
  const duration = computeDuration({
    date: workout.date,
    startedAt: workout.startedAt,
    finishedAt: workout.finishedAt ?? null,
    manualStartedAt: workout.manualStartedAt ?? null,
    manualFinishedAt: workout.manualFinishedAt ?? null,
    timeZone,
  })

  return {
    id: workout.id,
    date: workout.date,
    programId: workout.programId,
    programName: workout.programName,
    programColor: workout.programColor,
    startedAt: workout.startedAt,
    completion,
    durationMs: duration.ms,
  }
}

export interface WorkoutsScreenProps {
  readonly onCreateWorkout?: () => void
  readonly onOpenWorkout?: (workoutId: Id) => void
}

export function WorkoutsScreen({ onCreateWorkout, onOpenWorkout }: WorkoutsScreenProps = {}) {
  const { ports } = useServices()
  const { t, locale } = useT()
  const { colors } = useTheme()
  const [programFilter, setProgramFilter] = useState<Id | null>(null)

  const now = ports.clock.now()
  const today = toLocalDate(now, ports.timeZone)
  const range = useMemo(() => ({ from: addDays(today, -HISTORY_DAYS), to: today }), [today])

  const programsQuery = useQuery({
    queryKey: ['programs'],
    queryFn: () => ports.programs.list(),
  })

  const workoutsQuery = useQuery({
    queryKey: ['workouts', range],
    queryFn: async (): Promise<readonly WorkoutCardData[]> => {
      const summaries = await ports.workouts.listRange(range)
      const aggregates = await Promise.all(summaries.map((workout) => ports.workouts.byId(workout.id)))
      return aggregates
        .filter((aggregate): aggregate is WorkoutAggregate => aggregate !== null)
        .map((aggregate) => toCard(aggregate, ports.timeZone))
        .sort((a, b) => b.date.localeCompare(a.date))
    },
  })

  const programs = programsQuery.data ?? []
  const workouts = workoutsQuery.data ?? []

  const visible = programFilter === null ? workouts : workouts.filter((w) => w.programId === programFilter)
  // активная — сегодняшняя, в которой отмечены не все упражнения (§5.2)
  const active = visible.find((w) => w.date === today && w.completion.done < w.completion.total) ?? null
  const past = visible.filter((w) => w.id !== active?.id)

  const dotColor = (key: string): string => PROGRAM_DOT[key] ?? colors.textMuted

  const formatDayMonth = (date: LocalDate): string => {
    const month = Number(date.slice(5, 7))
    const monthKey = MONTH_GENITIVE_KEYS[month - 1] ?? MONTH_GENITIVE_KEYS[0]
    return t('date.dayMonth', { day: Number(date.slice(8, 10)), month: t(monthKey) })
  }

  return (
    <View testID="workouts-screen" style={[styles.root, { backgroundColor: colors.bg }]}>
      <View style={styles.header}>
        <Text testID="workouts-title" style={[styles.title, { color: colors.textPrimary }]}>
          {t('workouts.title')}
        </Text>
        <Pressable
          testID="add-button"
          accessibilityRole="button"
          accessibilityLabel={t('workouts.add')}
          onPress={onCreateWorkout}
          style={[styles.addButton, { backgroundColor: colors.accent }]}
        >
          <Text style={[styles.addGlyph, { color: colors.onAccent }]}>＋</Text>
        </Pressable>
      </View>

      <View style={styles.filters}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersRow}
        >
          <Chip
            testID="filter-chip-all"
            label={t('workouts.filterAll')}
            selected={programFilter === null}
            onPress={() => setProgramFilter(null)}
          />
          {programs.map((program) => (
            <Chip
              key={program.id}
              testID={`filter-chip-${program.id}`}
              label={program.name}
              dotColor={dotColor(program.color)}
              selected={programFilter === program.id}
              onPress={() => setProgramFilter(program.id)}
            />
          ))}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {active ? (
          <View style={styles.activeWrap}>
            <Pressable
              testID="active-workout-card"
              accessibilityRole="button"
              onPress={() => onOpenWorkout?.(active.id)}
              style={[styles.activeCard, { backgroundColor: colors.accentSoft }]}
            >
              <View style={styles.activeInfo}>
                <View style={[styles.badge, { backgroundColor: colors.accent }]}>
                  <Text style={[styles.badgeLabel, { color: colors.onAccent }]}>
                    {t('workout.inProgress')}
                  </Text>
                </View>
                <Text style={[styles.activeName, { color: colors.textPrimary }]}>
                  {active.programName}
                </Text>
                <Text testID="active-workout-meta" style={[styles.activeMeta, { color: colors.accent }]}>
                  {t('workouts.activeMeta', {
                    duration: formatElapsed(active.startedAt, now, locale),
                  })}
                </Text>
              </View>
              <Donut
                testID={`workout-donut-${active.date}`}
                done={active.completion.done}
                total={active.completion.total}
                tone={active.completion.tone}
              />
            </Pressable>
          </View>
        ) : null}

        {past.length > 0 ? (
          <View style={styles.list}>
            {past.map((workout) => (
              <Pressable
                key={workout.id}
                testID={`workout-card-${workout.date}`}
                accessibilityRole="button"
                onPress={() => onOpenWorkout?.(workout.id)}
                style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <View style={styles.cardInfo}>
                  <View style={styles.titleRow}>
                    <View
                      testID={`workout-dot-${workout.date}`}
                      style={[styles.programDot, { backgroundColor: dotColor(workout.programColor) }]}
                    />
                    <Text style={[styles.cardName, { color: colors.textPrimary }]}>
                      {workout.programName}
                    </Text>
                  </View>
                  <Text testID={`workout-meta-${workout.date}`} style={[styles.cardMeta, { color: colors.textSecondary }]}>
                    {t('workouts.cardMeta', {
                      date: formatDayMonth(workout.date),
                      duration: formatDuration(workout.durationMs, locale),
                    })}
                  </Text>
                  {workout.completion.done < workout.completion.total ? (
                    <Text style={[styles.cardNote, { color: colors.textMuted }]}>
                      {t('workout.notFinished')}
                    </Text>
                  ) : null}
                </View>
                <Donut
                  testID={`workout-donut-${workout.date}`}
                  done={workout.completion.done}
                  total={workout.completion.total}
                  tone={workout.completion.tone}
                />
              </Pressable>
            ))}
          </View>
        ) : null}

        {!workoutsQuery.isPending && visible.length === 0 ? (
          <View testID="workouts-empty" style={styles.empty}>
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>{t('workouts.empty')}</Text>
            <Text style={[styles.emptyHint, { color: colors.textMuted }]}>{t('workouts.emptyHint')}</Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  title: { fontSize: 26, fontWeight: '700' },
  addButton: { width: 36, height: 36, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center' },
  addGlyph: { fontSize: 18, fontWeight: '600' },

  filters: { paddingBottom: 14 },
  filtersRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 20 },

  content: { paddingBottom: 24 },

  activeWrap: { paddingHorizontal: 20, paddingBottom: 14 },
  activeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: radii.lg,
    padding: 16,
  },
  activeInfo: { gap: 7, flexShrink: 1 },
  badge: { alignSelf: 'flex-start', borderRadius: radii.pill, paddingVertical: 3, paddingHorizontal: 7 },
  badgeLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  activeName: { fontSize: 16, fontWeight: '700' },
  activeMeta: { fontSize: 12, fontWeight: '600' },

  list: { gap: 10, paddingHorizontal: 20 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: 14,
  },
  cardInfo: { gap: 5, flexShrink: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  programDot: { width: 9, height: 9, borderRadius: radii.pill },
  cardName: { fontSize: 15, fontWeight: '600' },
  cardMeta: { fontSize: 12, fontWeight: '500' },
  cardNote: { fontSize: 11, fontWeight: '500' },

  empty: { paddingHorizontal: 20, paddingTop: 40, gap: 6, alignItems: 'center' },
  emptyTitle: { fontSize: 15, fontWeight: '600' },
  emptyHint: { fontSize: 12, fontWeight: '500', textAlign: 'center' },
})
