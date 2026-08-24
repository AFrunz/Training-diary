import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import type { Id, Instant, LocalDate } from '../../../domain/model/types'
import { computeCompletion } from '../../../domain/rules/completion'
import { weekdayOf } from '../../../domain/rules/dates'
import { computeDuration } from '../../../domain/rules/duration'
import { formatDuration, formatElapsed } from '../../../domain/rules/format'
import { Donut } from '../../components/Donut'
import { ExerciseRow } from '../../components/ExerciseRow'
import { Icon } from '../../components/Icon'
import { ScreenHeader } from '../../components/ScreenHeader'
import type { TranslationKey } from '../../i18n/dictionaries'
import { useT } from '../../i18n/I18nProvider'
import { useServices } from '../../providers/ServicesProvider'
import { useTheme } from '../../theme/ThemeProvider'
import { numFont, radii, uiFont } from '../../theme/tokens'
import { AddSetSheet } from './AddSetSheet'

/**
 * Экран активной тренировки (фрейм «03 · Тренировка»). Источник истины — база:
 * данные читаются сценарным слоем через порты, мутации инвалидируют ключ запроса
 * и перерисовывают карточки и бублик (ARCHITECTURE.md §4).
 */

export interface WorkoutScreenProps {
  readonly workoutId: Id
  readonly onBack?: () => void
  readonly onAddExercise?: () => void
  readonly onOpenHistory?: (exerciseId: Id) => void
}

const MINUTE_MS = 60_000

const timeFormatters = new Map<string, Intl.DateTimeFormat>()

/** Время начала в зоне устройства, круглосуточный формат из макета: 18:32. */
const formatClockTime = (at: Instant, timeZone: string): string => {
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

type Translate = (key: TranslationKey, params?: Record<string, string | number>) => string

/** Подзаголовок шапки: «11 августа, вторник». Названия месяцев и дней — из словаря. */
const formatWorkoutDate = (date: LocalDate, t: Translate): string => {
  const [, month, day] = date.split('-')
  return t('date.dayMonthWeekday', {
    day: Number(day),
    month: t(`date.monthGenitive.${Number(month)}` as TranslationKey),
    weekday: t(`date.weekday.${weekdayOf(date)}` as TranslationKey),
  })
}

export function WorkoutScreen({ workoutId, onBack, onAddExercise, onOpenHistory }: WorkoutScreenProps) {
  const services = useServices()
  const queryClient = useQueryClient()
  const { colors } = useTheme()
  const { t, locale } = useT()

  /** Открытый шит: добавление подхода к упражнению либо правка записанного. */
  const [sheet, setSheet] = useState<{ itemId: Id; setId?: Id } | null>(null)
  const [now, setNow] = useState(() => Date.now())

  // счётчик обновляется раз в минуту: в формате «1 ч 12 мин» чаще незачем
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), MINUTE_MS)
    return () => clearInterval(timer)
  }, [])

  const workout = useQuery({
    queryKey: ['workout', workoutId],
    queryFn: async () => {
      const aggregate = await services.ports.workouts.byId(workoutId)
      if (!aggregate) return null
      const program = await services.ports.programs.byIdWithItems(aggregate.workout.programId)
      const settings = await services.ports.settings.get()
      // подходы прошлой тренировки: они стоят над сегодняшними (FR-4.10)
      const previous = await services.previousSets(workoutId)
      return { aggregate, program, settings, previous }
    },
  })

  const invalidate = () => queryClient.invalidateQueries()

  const toggleDone = useMutation({
    mutationFn: (input: { itemId: Id; done: boolean }) =>
      services.toggleItemDone({ workoutId, itemId: input.itemId, done: input.done }),
    onSuccess: invalidate,
  })

  const data = workout.data
  if (!data) return null

  const { workout: entity, items } = data.aggregate
  const unit = data.settings.unit
  const completion = computeCompletion(
    items.map((item) => ({ completedAt: item.completedAt ?? null, setCount: item.sets.length })),
  )

  const duration = computeDuration({
    date: entity.date,
    startedAt: entity.startedAt,
    finishedAt: entity.finishedAt ?? null,
    manualStartedAt: entity.manualStartedAt ?? null,
    manualFinishedAt: entity.manualFinishedAt ?? null,
    timeZone: services.ports.timeZone,
  })

  // finishedAt проставляется с первой же отметки, поэтому «завершена» — это когда
  // отмечены все упражнения: только тогда счётчик замирает на итоговой длительности
  const isFinished =
    Boolean(entity.manualFinishedAt) || (completion.total > 0 && completion.done === completion.total)
  const elapsed = isFinished
    ? formatDuration(duration.ms, locale)
    : formatElapsed(entity.startedAt, now, locale)

  const targetOf = (exerciseId: Id) =>
    data.program?.items.find((item) => item.exerciseId === exerciseId) ?? null

  const openItem = sheet ? items.find((item) => item.id === sheet.itemId) ?? null : null
  const editingSet = openItem?.sets.find((set) => set.id === sheet?.setId) ?? null
  const openPrevious = openItem ? data.previous[openItem.id] ?? [] : []
  // номер подхода: правится существующий или добавляется следующий
  const openSetNumber = editingSet ? editingSet.order + 1 : (openItem?.sets.length ?? 0) + 1

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <ScreenHeader
        title={entity.programName}
        subtitle={formatWorkoutDate(entity.date, t)}
        onBack={onBack}
      />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.timerSection}>
          <View style={[styles.timerBlock, { backgroundColor: colors.accentSoft }]}>
            <View style={styles.timerLeft}>
              <View style={styles.timerValueRow}>
                <View style={[styles.liveDot, { backgroundColor: colors.accent }]} />
                <Text testID="workout-timer" style={[styles.elapsed, { color: colors.accent }]}>
                  {elapsed}
                </Text>
              </View>
              <Text testID="workout-started-at" style={[styles.startedAt, { color: colors.textSecondary }]}>
                {t('workout.startedAt', {
                  time: formatClockTime(entity.manualStartedAt ?? entity.startedAt, services.ports.timeZone),
                })}
              </Text>
            </View>

            <Donut done={completion.done} total={completion.total} tone={completion.tone} />
          </View>
        </View>

        <View style={styles.list}>
          {items.length > 0 ? (
            <Text testID="workout-sets-hint" style={[styles.setsHint, { color: colors.textMuted }]}>
              {t('workout.setsHint')}
            </Text>
          ) : null}

          {items.map((item, index) => {
            const target = targetOf(item.exerciseId)
            return (
              <ExerciseRow
                key={item.id}
                index={index}
                name={item.exerciseName}
                targetSets={target?.targetSets ?? null}
                targetReps={target?.targetReps ?? null}
                sets={item.sets}
                previousSets={data.previous[item.id] ?? []}
                done={item.completedAt !== null && item.completedAt !== undefined}
                unit={unit}
                onToggleDone={(next) => toggleDone.mutate({ itemId: item.id, done: next })}
                onAddSet={() => setSheet({ itemId: item.id })}
                onEditSet={(setId) => setSheet({ itemId: item.id, setId: setId as Id })}
                onOpenHistory={() => onOpenHistory?.(item.exerciseId)}
              />
            )
          })}
        </View>

        <View style={styles.addExerciseSection}>
          <Pressable
            testID="add-exercise"
            accessibilityRole="button"
            onPress={onAddExercise}
            style={[styles.addExerciseButton, { borderColor: colors.border }]}
          >
            <Icon name="plus" size={15} color={colors.textSecondary} />
            <Text style={[styles.addExerciseLabel, { color: colors.textSecondary }]}>
              {t('workout.addExercise')}
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      {openItem ? (
        <AddSetSheet
          workoutId={workoutId}
          itemId={openItem.id}
          exerciseName={openItem.exerciseName}
          setNumber={openSetNumber}
          editing={editingSet}
          previousSet={openPrevious[openSetNumber - 1] ?? null}
          unit={unit}
          onClose={() => setSheet(null)}
        />
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingBottom: 24 },
  timerSection: { paddingHorizontal: 16, paddingTop: 10 },
  timerBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: radii.lg,
    padding: 16,
  },
  timerLeft: { gap: 2 },
  timerValueRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  liveDot: { width: 7, height: 7, borderRadius: radii.pill },
  // длительность — метрика, в макете она набрана Space Grotesk
  elapsed: { fontFamily: numFont('700'), fontSize: 30, fontWeight: '700' },
  startedAt: { fontFamily: uiFont('500'), fontSize: 12, fontWeight: '500' },
  list: { gap: 8, paddingHorizontal: 16, paddingTop: 14 },
  // пояснение к парам подходов: без него верхний ряд читается как «сегодняшний»
  setsHint: { fontFamily: uiFont('500'), fontSize: 11, fontWeight: '500' },
  addExerciseSection: { paddingHorizontal: 16, paddingTop: 12 },
  addExerciseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: radii.md,
    borderWidth: 1,
    paddingVertical: 12,
  },
  addExerciseLabel: { fontFamily: uiFont('600'), fontSize: 14, fontWeight: '600' },
})
