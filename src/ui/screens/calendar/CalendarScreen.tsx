import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import type { FirstDayOfWeek, Id, LocalDate, WeekdayNumber } from '../../../domain/model/types'
import { localDate } from '../../../domain/model/types'
import type { CompletionResult } from '../../../domain/rules/completion'
import { computeCompletion } from '../../../domain/rules/completion'
import { addDays, toLocalDate, weeksOfRange } from '../../../domain/rules/dates'
import { computeDuration } from '../../../domain/rules/duration'
import { EMPTY_VALUE, formatCompletion, formatDuration, formatElapsed } from '../../../domain/rules/format'
import { Icon } from '../../components/Icon'
import type { TranslationKey } from '../../i18n/dictionaries'
import { useT } from '../../i18n/I18nProvider'
import { useServices } from '../../providers/ServicesProvider'
import { useTheme } from '../../theme/ThemeProvider'
import { numFont, programColors, radii, uiFont } from '../../theme/tokens'

/**
 * Экран «01 · Календарь — месяц» из макета: сетка месяца с точками программ,
 * серыми днями отсутствия и выделенным сегодня, легенда, мини-статистика и
 * карточка сегодняшнего дня.
 *
 * Расчёты берутся готовыми: недели — из weeksOfRange, завершённость — из
 * computeCompletion, сводка месяца — из сценария monthStats.
 */

const WEEKDAY_SHORT_KEYS = [
  'calendar.weekdayShort.1',
  'calendar.weekdayShort.2',
  'calendar.weekdayShort.3',
  'calendar.weekdayShort.4',
  'calendar.weekdayShort.5',
  'calendar.weekdayShort.6',
  'calendar.weekdayShort.7',
] as const satisfies readonly TranslationKey[]

const MONTH_KEYS = [
  'calendar.month.1',
  'calendar.month.2',
  'calendar.month.3',
  'calendar.month.4',
  'calendar.month.5',
  'calendar.month.6',
  'calendar.month.7',
  'calendar.month.8',
  'calendar.month.9',
  'calendar.month.10',
  'calendar.month.11',
  'calendar.month.12',
] as const satisfies readonly TranslationKey[]

/** Цвета программ лежат в токенах по ключу, снапшот тренировки хранит именно ключ. */
const PROGRAM_DOT: Record<string, string> = programColors

const yearOf = (date: LocalDate): number => Number(date.slice(0, 4))
const monthOf = (date: LocalDate): number => Number(date.slice(5, 7))
const dayOf = (date: LocalDate): number => Number(date.slice(8, 10))

const startOfMonth = (date: LocalDate): LocalDate => localDate(`${date.slice(0, 7)}-01`)

const addMonths = (monthStart: LocalDate, delta: number): LocalDate => {
  const shifted = monthOf(monthStart) - 1 + delta
  const year = yearOf(monthStart) + Math.floor(shifted / 12)
  const month = ((shifted % 12) + 12) % 12 + 1
  return localDate(`${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-01`)
}

const endOfMonth = (monthStart: LocalDate): LocalDate => addDays(addMonths(monthStart, 1), -1)

interface TodayCardData {
  readonly id: Id
  readonly programName: string
  readonly programColor: string
  readonly completion: CompletionResult
  readonly startedAt: number
  readonly durationMs: number | null
}

export interface CalendarScreenProps {
  readonly onOpenDay?: (date: LocalDate) => void
  /** Долгое нажатие по дню заводит отсутствие (FR-1.6). */
  readonly onAddAbsence?: (date: LocalDate) => void
  readonly onContinueWorkout?: (workoutId: Id) => void
  readonly onCreateWorkout?: (date: LocalDate) => void
}

export function CalendarScreen({
  onOpenDay,
  onAddAbsence,
  onContinueWorkout,
  onCreateWorkout,
}: CalendarScreenProps = {}) {
  const services = useServices()
  const { ports } = services
  const { t, locale } = useT()
  const { colors } = useTheme()

  const now = ports.clock.now()
  const today = toLocalDate(now, ports.timeZone)

  const [monthStart, setMonthStart] = useState<LocalDate>(() => startOfMonth(today))
  const [mode, setMode] = useState<'month' | 'year'>('month')

  const settingsQuery = useQuery({ queryKey: ['settings'], queryFn: () => ports.settings.get() })
  const firstDayOfWeek: FirstDayOfWeek = settingsQuery.data?.firstDayOfWeek ?? 1

  const weeks = useMemo(
    () =>
      weeksOfRange(monthStart, endOfMonth(monthStart), firstDayOfWeek).map((week) =>
        Array.from({ length: 7 }, (_, index) => addDays(week.start, index)),
      ),
    [monthStart, firstDayOfWeek],
  )

  const range = useMemo(() => {
    const first = weeks[0]?.[0] ?? monthStart
    const lastWeek = weeks[weeks.length - 1]
    const last = lastWeek?.[6] ?? endOfMonth(monthStart)
    return { from: first, to: last }
  }, [weeks, monthStart])

  const programsQuery = useQuery({ queryKey: ['programs'], queryFn: () => ports.programs.list() })

  const gridQuery = useQuery({
    queryKey: ['calendar-grid', range],
    queryFn: async () => {
      const [workouts, absences] = await Promise.all([
        ports.workouts.listRange(range),
        ports.absences.listRange(range),
      ])

      const colorByDate: Record<string, string> = {}
      for (const workout of workouts) colorByDate[workout.date] = workout.programColor

      const absentDates = new Set<string>()
      for (const absence of absences) {
        const from = absence.startDate < range.from ? range.from : absence.startDate
        const to = absence.endDate > range.to ? range.to : absence.endDate
        for (let day = from; day <= to; day = addDays(day, 1)) absentDates.add(day)
      }

      return { colorByDate, absentDates }
    },
    enabled: settingsQuery.isSuccess,
  })

  const statsQuery = useQuery({
    queryKey: ['month-stats', monthStart, today],
    queryFn: () => services.monthStats({ anyDateOfMonth: monthStart, today }),
  })

  const todayQuery = useQuery({
    queryKey: ['calendar-today', today],
    queryFn: async (): Promise<TodayCardData | null> => {
      const workout = await ports.workouts.byDate(today)
      if (!workout) return null

      const aggregate = await ports.workouts.byId(workout.id)
      if (!aggregate) return null

      const completion = computeCompletion(
        aggregate.items.map((item) => ({
          completedAt: item.completedAt ?? null,
          setCount: item.sets.length,
        })),
      )
      const duration = computeDuration({
        date: aggregate.workout.date,
        startedAt: aggregate.workout.startedAt,
        finishedAt: aggregate.workout.finishedAt ?? null,
        manualStartedAt: aggregate.workout.manualStartedAt ?? null,
        manualFinishedAt: aggregate.workout.manualFinishedAt ?? null,
        timeZone: ports.timeZone,
      })

      return {
        id: aggregate.workout.id,
        programName: aggregate.workout.programName,
        programColor: aggregate.workout.programColor,
        completion,
        startedAt: aggregate.workout.startedAt,
        durationMs: duration.ms,
      }
    },
  })

  const dotColor = (key: string): string => PROGRAM_DOT[key] ?? colors.textMuted
  const colorByDate = gridQuery.data?.colorByDate ?? {}
  const absentDates = gridQuery.data?.absentDates ?? new Set<string>()

  const monthKey = MONTH_KEYS[monthOf(monthStart) - 1] ?? MONTH_KEYS[0]
  const weekdayKey = (offset: number): TranslationKey => {
    const weekday = (((firstDayOfWeek - 1 + offset) % 7) + 1) as WeekdayNumber
    return WEEKDAY_SHORT_KEYS[weekday - 1] ?? WEEKDAY_SHORT_KEYS[0]
  }

  const todayWorkout = todayQuery.data ?? null
  const inProgress = todayWorkout !== null && todayWorkout.completion.done < todayWorkout.completion.total
  const stats = statsQuery.data ?? null

  return (
    <View testID="calendar-screen" style={[styles.root, { backgroundColor: colors.bg }]}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text testID="calendar-title" style={[styles.title, { color: colors.textPrimary }]}>
            {t('calendar.monthTitle', { month: t(monthKey), year: yearOf(monthStart) })}
          </Text>
          <Pressable
            testID="calendar-prev-month"
            accessibilityRole="button"
            accessibilityLabel={t('calendar.prevMonth')}
            onPress={() => setMonthStart((current) => addMonths(current, -1))}
            style={styles.monthArrow}
          >
            <Icon name="chevron-left" size={18} color={colors.textSecondary} />
          </Pressable>
          <Pressable
            testID="calendar-next-month"
            accessibilityRole="button"
            accessibilityLabel={t('calendar.nextMonth')}
            onPress={() => setMonthStart((current) => addMonths(current, 1))}
            style={styles.monthArrow}
          >
            <Icon name="chevron-right" size={18} color={colors.textSecondary} />
          </Pressable>
        </View>

        <View style={[styles.segmented, { backgroundColor: colors.surface2 }]}>
          {(['month', 'year'] as const).map((segment) => (
            <Pressable
              key={segment}
              testID={`calendar-mode-${segment}`}
              accessibilityRole="button"
              accessibilityState={{ selected: mode === segment }}
              onPress={() => setMode(segment)}
              style={[styles.segment, mode === segment ? { backgroundColor: colors.surface } : null]}
            >
              <Text
                style={[
                  styles.segmentLabel,
                  mode === segment
                    ? { color: colors.textPrimary, fontWeight: '600', fontFamily: uiFont('600') }
                    : { color: colors.textSecondary, fontWeight: '500', fontFamily: uiFont('500') },
                ]}
              >
                {t(segment === 'month' ? 'calendar.month' : 'calendar.year')}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {mode === 'month' && settingsQuery.isSuccess ? (
          <>
            <View style={styles.weekdays}>
              {Array.from({ length: 7 }, (_, offset) => (
                <View key={offset} testID={`calendar-weekday-${offset}`} style={styles.weekdayCell}>
                  <Text style={[styles.weekdayLabel, { color: colors.textMuted }]}>{t(weekdayKey(offset))}</Text>
                </View>
              ))}
            </View>

            <View style={styles.grid}>
              {weeks.map((week) => (
                <View key={week[0]} style={styles.week}>
                  {week.map((date) => {
                    const isToday = date === today
                    const isOtherMonth = monthOf(date) !== monthOf(monthStart)
                    const isAbsent = absentDates.has(date)
                    const program = colorByDate[date]

                    const background = isToday
                      ? colors.accentSoft
                      : isAbsent
                        ? colors.surface2
                        : 'transparent'
                    const numberColor = isToday
                      ? colors.accent
                      : isOtherMonth || isAbsent
                        ? colors.textMuted
                        : colors.textPrimary

                    return (
                      <Pressable
                        key={date}
                        testID={`calendar-day-${date}`}
                        accessibilityRole="button"
                        onPress={() => onOpenDay?.(date)}
                        onLongPress={() => onAddAbsence?.(date)}
                        style={[styles.day, { backgroundColor: background }]}
                      >
                        <Text
                          testID={`calendar-day-${date}-num`}
                          style={[
                            styles.dayNumber,
                            {
                              color: numberColor,
                              fontWeight: isToday ? '700' : '500',
                              fontFamily: numFont(isToday ? '700' : '500'),
                            },
                          ]}
                        >
                          {dayOf(date)}
                        </Text>
                        {program ? (
                          <View
                            testID={`calendar-dot-${date}`}
                            style={[styles.dayDot, { backgroundColor: dotColor(program) }]}
                          />
                        ) : (
                          <View style={styles.dayDotPlaceholder} />
                        )}
                      </Pressable>
                    )
                  })}
                </View>
              ))}
            </View>
          </>
        ) : (
          <View testID="calendar-year-placeholder" style={styles.yearPlaceholder} />
        )}

        <View testID="calendar-legend" style={styles.legend}>
          {(programsQuery.data ?? []).map((program) => (
            <View key={program.id} testID={`legend-item-${program.id}`} style={styles.legendItem}>
              <View
                testID={`legend-dot-${program.id}`}
                style={[styles.legendDot, { backgroundColor: dotColor(program.color) }]}
              />
              <Text style={[styles.legendLabel, { color: colors.textSecondary }]}>{program.name}</Text>
            </View>
          ))}
          <View testID="legend-absence" style={styles.legendItem}>
            <View style={[styles.legendDot, styles.legendDotAbsence, { backgroundColor: colors.textMuted }]} />
            <Text style={[styles.legendLabel, styles.legendLabelAbsence, { color: colors.textSecondary }]}>
              {t('calendar.absence')}
            </Text>
          </View>
        </View>

        {stats === null ? null : (
        <View testID="calendar-mini-stats" style={styles.miniStats}>
          <View testID="calendar-stat-workouts" style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.statValue, { color: colors.textPrimary }]}>{stats.workouts}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>{t('calendar.statWorkouts')}</Text>
          </View>
          <View testID="calendar-stat-per-week" style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.statValue, { color: colors.textPrimary }]}>
              {stats.perWeek === null ? EMPTY_VALUE : stats.perWeek.toFixed(1)}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>{t('calendar.statPerWeek')}</Text>
          </View>
          <View testID="calendar-stat-average" style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.statValue, { color: colors.textPrimary }]}>
              {formatDuration(stats.averageDurationMs, locale)}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>{t('calendar.statAverage')}</Text>
          </View>
        </View>
        )}

        {todayQuery.isSuccess ? (
        <View style={styles.todayWrap}>
          <View testID="calendar-today-card" style={[styles.todayCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.todayTop}>
              <View style={styles.todayLeft}>
                {todayWorkout ? (
                  <View
                    testID="calendar-today-dot"
                    style={[styles.todayDot, { backgroundColor: dotColor(todayWorkout.programColor) }]}
                  />
                ) : null}
                <View style={styles.todayTexts}>
                  <Text testID="calendar-today-title" style={[styles.todayTitle, { color: colors.textPrimary }]}>
                    {todayWorkout
                      ? t('calendar.todayWith', { program: todayWorkout.programName })
                      : t('calendar.noWorkoutToday')}
                  </Text>
                  {todayWorkout ? (
                    <Text testID="calendar-today-sub" style={[styles.todaySub, { color: colors.accent }]}>
                      {inProgress
                        ? t('calendar.todayInProgress', {
                            duration: formatElapsed(todayWorkout.startedAt, now, locale),
                          })
                        : formatDuration(todayWorkout.durationMs, locale)}
                    </Text>
                  ) : null}
                </View>
              </View>

              {todayWorkout ? (
                <View style={[styles.todayBadge, { backgroundColor: colors.accentSoft }]}>
                  <Text style={[styles.todayBadgeLabel, { color: colors.accent }]}>
                    {formatCompletion(todayWorkout.completion.done, todayWorkout.completion.total)}
                  </Text>
                </View>
              ) : null}
            </View>

            {inProgress && todayWorkout ? (
              <Pressable
                testID="calendar-continue-workout"
                accessibilityRole="button"
                onPress={() => onContinueWorkout?.(todayWorkout.id)}
                style={[styles.todayButton, { backgroundColor: colors.accent }]}
              >
                <Icon name="arrow-right" size={17} color={colors.onAccent} />
                <Text style={[styles.todayButtonLabel, { color: colors.onAccent }]}>
                  {t('calendar.continueWorkout')}
                </Text>
              </Pressable>
            ) : null}

            {todayWorkout === null ? (
              <Pressable
                testID="calendar-create-workout"
                accessibilityRole="button"
                onPress={() => onCreateWorkout?.(today)}
                style={[styles.todayButton, { backgroundColor: colors.accent }]}
              >
                <Text style={[styles.todayButtonLabel, { color: colors.onAccent }]}>
                  {t('calendar.startWorkout')}
                </Text>
              </Pressable>
            ) : null}
          </View>
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
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { fontSize: 22, fontWeight: '700', fontFamily: uiFont('700') },
  monthArrow: { width: 18, height: 18, alignItems: 'center', justifyContent: 'center' },

  segmented: { flexDirection: 'row', gap: 2, borderRadius: radii.sm, padding: 3 },
  segment: { borderRadius: 7, paddingVertical: 5, paddingHorizontal: 11 },
  segmentLabel: { fontSize: 12 },

  content: { paddingBottom: 24 },

  weekdays: { flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 6 },
  weekdayCell: { flex: 1, alignItems: 'center' },
  weekdayLabel: { fontSize: 11, fontWeight: '500', fontFamily: uiFont('500') },

  grid: { gap: 2, paddingHorizontal: 16 },
  week: { flexDirection: 'row', gap: 2 },
  day: {
    flex: 1,
    height: 52,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  dayNumber: { fontSize: 15 },
  dayDot: { width: 7, height: 7, borderRadius: radii.pill },
  dayDotPlaceholder: { width: 7, height: 7 },

  yearPlaceholder: { height: 52 * 6 + 2 * 5 },

  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 12,
    rowGap: 7,
    paddingTop: 14,
    paddingHorizontal: 20,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: radii.pill },
  legendDotAbsence: { opacity: 0.5 },
  legendLabel: { fontSize: 11, fontWeight: '600', fontFamily: uiFont('600') },
  legendLabelAbsence: { fontWeight: '500', fontFamily: uiFont('500') },

  miniStats: { flexDirection: 'row', gap: 10, paddingTop: 4, paddingHorizontal: 20 },
  statCard: {
    flex: 1,
    gap: 3,
    borderRadius: radii.md,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  statValue: { fontSize: 18, fontWeight: '700', fontFamily: numFont('700') },
  statLabel: { fontSize: 11, fontWeight: '500', fontFamily: uiFont('500') },

  todayWrap: { paddingVertical: 16, paddingHorizontal: 20 },
  todayCard: { gap: 14, borderRadius: radii.lg, borderWidth: 1, padding: 16 },
  todayTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  todayLeft: { flexDirection: 'row', alignItems: 'center', gap: 9, flexShrink: 1 },
  todayDot: { width: 10, height: 10, borderRadius: radii.pill },
  todayTexts: { gap: 2, flexShrink: 1 },
  todayTitle: { fontSize: 14, fontWeight: '600', fontFamily: uiFont('600') },
  todaySub: { fontSize: 12, fontWeight: '500', fontFamily: uiFont('500') },
  todayBadge: { borderRadius: radii.pill, paddingVertical: 5, paddingHorizontal: 10 },
  todayBadgeLabel: { fontSize: 12, fontWeight: '600', fontFamily: numFont('600') },
  todayButton: {
    flexDirection: 'row',
    gap: 8,
    borderRadius: radii.md,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayButtonLabel: { fontSize: 14, fontWeight: '600', fontFamily: uiFont('600') },
})
