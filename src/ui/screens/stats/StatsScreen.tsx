import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import type { LocalDate } from '../../../domain/model/types'
import { toLocalDate } from '../../../domain/rules/dates'
import { EMPTY_VALUE, formatDuration } from '../../../domain/rules/format'
import { useT } from '../../i18n/I18nProvider'
import type { TranslationKey } from '../../i18n/dictionaries'
import { useServices } from '../../providers/ServicesProvider'
import { useTheme } from '../../theme/ThemeProvider'
import { programColors, radii } from '../../theme/tokens'
import type { StatsColumn, StatsMode } from './periodData'
import { isSamePeriod, loadPeriod, shiftPeriod } from './periodData'

/**
 * Экран «09 · Статистика» из макета: сегмент-контрол периода, переключатель
 * месяцев, сетка метрик 2×2, график по неделям, распределение по программам
 * и карточка серии (FR-6.2, FR-6.4).
 */

const PLOT_HEIGHT = 104
const MAX_BAR_HEIGHT = 86
const MIN_BAR_HEIGHT = 12

const monthKey = (month: number): TranslationKey => `calendar.month.${month}` as TranslationKey
const monthShortKey = (month: number): TranslationKey => `calendar.monthShort.${month}` as TranslationKey

const dayOf = (date: LocalDate): number => Number(date.slice(8, 10))
const monthOf = (date: LocalDate): number => Number(date.slice(5, 7))

const formatRatio = (ratio: number | null): string =>
  ratio === null ? EMPTY_VALUE : `${Math.round(ratio * 100)} %`

const formatPerWeek = (value: number | null): string =>
  value === null ? EMPTY_VALUE : value.toFixed(1)

const formatWorkouts = (value: number | null): string => (value === null ? EMPTY_VALUE : String(value))

export function StatsScreen() {
  const services = useServices()
  const { colors } = useTheme()
  const { t, count, locale } = useT()

  const today = useMemo<LocalDate>(
    () => toLocalDate(services.ports.clock.now(), services.ports.timeZone),
    [services],
  )

  const [mode, setMode] = useState<StatsMode>('month')
  const [anchor, setAnchor] = useState<LocalDate>(today)

  const period = useQuery({
    queryKey: ['stats', mode, mode === 'month' ? anchor.slice(0, 7) : anchor.slice(0, 4)],
    queryFn: () => loadPeriod(services, { mode, anchor, today }),
    // при переключении периода карточки не схлопываются: старые цифры видны до новых
    placeholderData: keepPreviousData,
  })

  const atCurrentPeriod = isSamePeriod(anchor, today, mode)
  const data = period.data

  const columnLabel = (column: StatsColumn): string =>
    mode === 'month'
      ? t('stats.weekRange', {
          from: dayOf(column.start),
          to: dayOf(column.end),
          month: t(monthShortKey(monthOf(column.end))),
        })
      : t(monthShortKey(monthOf(column.start)))

  const periodTitle =
    mode === 'month'
      ? `${t(monthKey(monthOf(anchor)))} ${anchor.slice(0, 4)}`
      : anchor.slice(0, 4)

  const metrics = data
    ? [
        {
          testID: 'stat-workouts',
          label: t('stats.workouts'),
          value: formatWorkouts(data.stats.workouts),
          previous: data.previous ? formatWorkouts(data.previous.workouts) : null,
          better: data.previous ? data.stats.workouts > data.previous.workouts : false,
        },
        {
          testID: 'stat-per-week',
          label: t('stats.perWeek'),
          value: formatPerWeek(data.stats.perWeek),
          previous: data.previous ? formatPerWeek(data.previous.perWeek) : null,
          better: data.previous ? (data.stats.perWeek ?? 0) > (data.previous.perWeek ?? 0) : false,
        },
        {
          testID: 'stat-duration',
          label: t('stats.averageDuration'),
          value: formatDuration(data.stats.averageDurationMs, locale),
          previous: data.previous ? formatDuration(data.previous.averageDurationMs, locale) : null,
          better: false,
        },
        {
          testID: 'stat-completion',
          label: t('stats.completion'),
          value: formatRatio(data.stats.completionRate),
          previous: data.previous ? formatRatio(data.previous.completionRate) : null,
          better: data.previous
            ? (data.stats.completionRate ?? 0) > (data.previous.completionRate ?? 0)
            : false,
        },
      ]
    : []

  const maxCount = Math.max(1, ...(data?.columns ?? []).map((column) => column.count))
  const totalByProgram = (data?.stats.byProgram ?? []).reduce((sum, program) => sum + program.count, 0)

  return (
    <View testID="stats-screen" style={[styles.screen, { backgroundColor: colors.bg }]}>
      <View style={styles.header}>
        <Text testID="stats-title" style={[styles.title, { color: colors.textPrimary }]}>
          {t('stats.title')}
        </Text>

        <View style={[styles.segmented, { backgroundColor: colors.surface2 }]}>
          {(['month', 'year'] as const).map((option) => {
            const selected = mode === option
            return (
              <Pressable
                key={option}
                testID={`stats-mode-${option}`}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => setMode(option)}
                style={[styles.segment, selected && { backgroundColor: colors.surface }]}
              >
                <Text
                  style={[
                    styles.segmentLabel,
                    {
                      color: selected ? colors.textPrimary : colors.textSecondary,
                      fontWeight: selected ? '600' : '500',
                    },
                  ]}
                >
                  {t(option === 'month' ? 'calendar.month' : 'calendar.year')}
                </Text>
              </Pressable>
            )
          })}
        </View>
      </View>

      <View style={styles.switcher}>
        <Pressable
          testID="stats-prev"
          accessibilityRole="button"
          accessibilityLabel={t('stats.previousPeriod')}
          onPress={() => setAnchor(shiftPeriod(anchor, mode, -1))}
          style={styles.arrow}
        >
          <Text style={[styles.arrowGlyph, { color: colors.textSecondary }]}>‹</Text>
        </Pressable>

        <Text testID="stats-period" style={[styles.period, { color: colors.textPrimary }]}>
          {periodTitle}
        </Text>

        <Pressable
          testID="stats-next"
          accessibilityRole="button"
          accessibilityLabel={t('stats.nextPeriod')}
          disabled={atCurrentPeriod}
          onPress={() => setAnchor(shiftPeriod(anchor, mode, 1))}
          style={styles.arrow}
        >
          <Text
            style={[styles.arrowGlyph, { color: atCurrentPeriod ? colors.textMuted : colors.textSecondary }]}
          >
            ›
          </Text>
        </Pressable>
      </View>

      {data ? (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.metricsRow}>
            {metrics.slice(0, 2).map((metric) => (
              <MetricCard key={metric.testID} {...metric} />
            ))}
          </View>
          <View style={styles.metricsRow}>
            {metrics.slice(2).map((metric) => (
              <MetricCard key={metric.testID} {...metric} />
            ))}
          </View>

          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{t('stats.byWeeks')}</Text>

            <View testID="stats-chart" style={styles.plot}>
              {data.columns.map((column, index) => (
                <View key={column.key} style={styles.column}>
                  {column.absent ? (
                    <View
                      testID={`stat-column-absent-${index}`}
                      style={[styles.vacation, { backgroundColor: colors.surface2 }]}
                    />
                  ) : (
                    <View
                      testID={`stat-bar-${index}`}
                      accessibilityLabel={count('workouts', column.count)}
                      style={[
                        styles.bar,
                        {
                          backgroundColor: column.count === 0 ? colors.track : colors.accent,
                          height:
                            column.count === 0
                              ? 4
                              : Math.max(
                                  MIN_BAR_HEIGHT,
                                  Math.round((MAX_BAR_HEIGHT * column.count) / maxCount),
                                ),
                        },
                      ]}
                    />
                  )}
                  <Text style={[styles.columnLabel, { color: colors.textMuted }]}>
                    {column.absent ? t('stats.vacation') : columnLabel(column)}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{t('stats.byPrograms')}</Text>

            <View testID="stats-programs-bar" style={[styles.splitBar, { backgroundColor: colors.track }]}>
              {data.stats.byProgram.map((program) => (
                <View
                  key={program.programId}
                  testID={`stat-program-bar-${program.programId}`}
                  style={{
                    flexGrow: totalByProgram === 0 ? 0 : program.count,
                    backgroundColor:
                      programColors[program.color as keyof typeof programColors] ?? colors.accent,
                  }}
                />
              ))}
            </View>

            <View style={styles.legend}>
              {data.stats.byProgram.map((program) => (
                <View
                  key={program.programId}
                  testID={`stat-program-${program.programId}`}
                  style={styles.legendItem}
                >
                  <View
                    style={[
                      styles.legendDot,
                      {
                        backgroundColor:
                          programColors[program.color as keyof typeof programColors] ?? colors.accent,
                      },
                    ]}
                  />
                  <Text numberOfLines={1} style={[styles.legendLabel, { color: colors.textSecondary }]}>
                    {`${program.name} · ${program.count}`}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          <View testID="stats-streak" style={[styles.streakCard, { backgroundColor: colors.accentSoft }]}>
            <View style={styles.streakRow}>
              <View style={styles.streakTexts}>
                <Text style={[styles.streakLabel, { color: colors.textSecondary }]}>
                  {t('stats.streak')}
                </Text>
                <Text testID="stat-streak-current" style={[styles.streakValue, { color: colors.accent }]}>
                  {t('stats.streakValue', { value: count('weeks', data.stats.streak.current) })}
                </Text>
              </View>
              <Text style={[styles.streakGlyph, { color: colors.accent }]}>▲</Text>
            </View>

            <Text testID="stat-streak-record" style={[styles.streakNote, { color: colors.textSecondary }]}>
              {`${t('stats.streakRecord', { value: count('weeks', data.stats.streak.record) })} · ${t('stats.streakNote')}`}
            </Text>
          </View>
        </ScrollView>
      ) : null}
    </View>
  )
}

interface MetricCardProps {
  readonly testID: string
  readonly label: string
  readonly value: string
  readonly previous: string | null
  readonly better: boolean
}

/** Карточка метрики: подпись, крупное значение и сравнение с прошлым периодом. */
function MetricCard({ testID, label, value, previous, better }: MetricCardProps) {
  const { colors } = useTheme()
  const { t } = useT()

  return (
    <View
      testID={testID}
      style={[styles.metricCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <Text style={[styles.metricLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text testID={`${testID}-value`} style={[styles.metricValue, { color: colors.textPrimary }]}>
        {value}
      </Text>
      {previous === null ? null : (
        <Text style={[styles.metricCompare, { color: better ? colors.success : colors.textMuted }]}>
          {t('stats.compareToPrevious', { value: previous })}
        </Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    paddingBottom: 10,
    paddingHorizontal: 20,
  },
  title: { fontSize: 26, fontWeight: '700' },
  segmented: { flexDirection: 'row', gap: 2, padding: 3, borderRadius: radii.sm },
  segment: { paddingVertical: 5, paddingHorizontal: 11, borderRadius: 7 },
  segmentLabel: { fontSize: 12 },

  switcher: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  arrow: { width: 18, height: 18, alignItems: 'center', justifyContent: 'center' },
  arrowGlyph: { fontSize: 18, lineHeight: 18 },
  period: { flex: 1, textAlign: 'center', fontSize: 14, fontWeight: '600' },

  content: { paddingHorizontal: 16, paddingBottom: 16, gap: 10 },
  metricsRow: { flexDirection: 'row', gap: 10 },
  metricCard: { flex: 1, borderRadius: radii.lg, borderWidth: 1, padding: 16, gap: 4 },
  metricLabel: { fontSize: 11 },
  metricValue: { fontSize: 26, fontWeight: '700' },
  metricCompare: { fontSize: 11 },

  card: { borderRadius: radii.lg, borderWidth: 1, padding: 16, gap: 12 },
  cardTitle: { fontSize: 14, fontWeight: '600' },
  plot: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, height: PLOT_HEIGHT },
  column: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', gap: 6 },
  bar: { alignSelf: 'stretch', borderRadius: 6 },
  vacation: { alignSelf: 'stretch', height: 26, borderRadius: 6 },
  columnLabel: { fontSize: 9 },

  splitBar: { flexDirection: 'row', height: 12, borderRadius: radii.pill, overflow: 'hidden' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 7, columnGap: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6, width: '47%' },
  legendDot: { width: 8, height: 8, borderRadius: radii.pill },
  legendLabel: { flex: 1, fontSize: 12 },

  streakCard: { borderRadius: radii.lg, padding: 16, gap: 10 },
  streakRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  streakTexts: { gap: 2 },
  streakLabel: { fontSize: 12 },
  streakValue: { fontSize: 18, fontWeight: '700' },
  streakGlyph: { fontSize: 22 },
  streakNote: { fontSize: 11 },
})
