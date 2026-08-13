import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Fragment } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import type { ProgramWithItems } from '../../../app/ports'
import { PROGRAM_PALETTE } from '../../../app/usecases/library'
import type { Id } from '../../../domain/model/types'
import { localDate } from '../../../domain/model/types'
import { Icon } from '../../components/Icon'
import { ScreenHeader } from '../../components/ScreenHeader'
import { ExercisePickerSheet } from '../library/ExercisePickerSheet'
import { useT } from '../../i18n/I18nProvider'
import { useServices } from '../../providers/ServicesProvider'
import { useTheme } from '../../theme/ThemeProvider'
import { programColors, radii, uiFont } from '../../theme/tokens'

export interface ProgramScreenProps {
  readonly programId: Id
  readonly onBack?: () => void
  readonly onAddExercise?: () => void
  /** Дублирование уводит на копию, архивация — назад к списку: маршруты знает навигация. */
  readonly onDuplicated?: (programId: Id) => void
  readonly onArchived?: () => void
}

/** Программа целиком: тренировки заводятся редко, поэтому диапазон берётся с запасом. */
const ALL_TIME = { from: localDate('1900-01-01'), to: localDate('2999-12-31') }

interface ProgramView {
  readonly program: ProgramWithItems['program']
  readonly items: ProgramWithItems['items']
  readonly workoutCount: number
}

/**
 * Экран «07 · Программа»: цвет, состав и действия над программой.
 *
 * Состав меняется целиком через сценарий `setProgramItems` — уже проведённые
 * тренировки держат собственный снапшот (FR-3.5) и не затрагиваются.
 */
export function ProgramScreen({
  programId,
  onBack,
  onAddExercise,
  onDuplicated,
  onArchived,
}: ProgramScreenProps) {
  const services = useServices()
  const { ports } = services
  const { colors } = useTheme()
  const { t, count } = useT()
  const queryClient = useQueryClient()

  const queryKey = ['program', programId] as const

  const { data } = useQuery<ProgramView | null>({
    queryKey,
    queryFn: async () => {
      const program = await ports.programs.byIdWithItems(programId)
      if (!program) return null

      const workouts = await ports.workouts.listRange(ALL_TIME)
      return {
        program: program.program,
        items: program.items,
        workoutCount: workouts.filter((workout) => workout.programId === programId).length,
      }
    },
  })

  const [pickerOpen, setPickerOpen] = useState(false)

  /**
   * Сбрасывается весь кэш, а не только этот экран: программа видна ещё и в
   * библиотеке, в фильтрах списка тренировок и в выборе программы.
   */
  const invalidate = () => queryClient.invalidateQueries()

  const setColor = useMutation({
    mutationFn: async (color: string) => {
      const program = await ports.programs.byId(programId)
      if (!program) return
      await ports.programs.update({ ...program, color, updatedAt: ports.clock.now() })
    },
    onSuccess: invalidate,
  })

  const removeItem = useMutation({
    mutationFn: async (exerciseId: Id) => {
      const exerciseIds = (data?.items ?? [])
        .filter((item) => item.exerciseId !== exerciseId)
        .map((item) => item.exerciseId)
      await services.setProgramItems({ programId, exerciseIds })
    },
    onSuccess: invalidate,
  })

  const duplicate = useMutation({
    mutationFn: () => services.duplicateProgram(programId),
    onSuccess: async (copyId) => {
      await invalidate()
      onDuplicated?.(copyId)
    },
  })

  const setItems = useMutation({
    mutationFn: (exerciseIds: readonly Id[]) => services.setProgramItems({ programId, exerciseIds }),
    onSuccess: invalidate,
  })

  const archive = useMutation({
    mutationFn: () => services.archiveProgram(programId),
    onSuccess: () => {
      onArchived?.()
      return invalidate()
    },
  })

  if (!data) return <View testID="program-screen" style={[styles.root, { backgroundColor: colors.bg }]} />

  const { program, items, workoutCount } = data

  return (
    <View testID="program-screen" style={[styles.root, { backgroundColor: colors.bg }]}>
      <ScreenHeader
        title={program.name}
        subtitle={t('program.subtitle', {
          exercises: count('exercises', items.length),
          workouts: count('workouts', workoutCount),
        })}
        {...(onBack ? { onBack } : {})}
      />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.block}>
          <Text style={[styles.blockLabel, { color: colors.textMuted }]}>{t('program.color')}</Text>

          <View style={styles.swatches}>
            {PROGRAM_PALETTE.map((color) => (
              <Pressable
                key={color}
                testID={`program-color-${color}`}
                accessibilityRole="button"
                accessibilityState={{ selected: program.color === color }}
                onPress={() => setColor.mutate(color)}
                style={[
                  styles.swatchSlot,
                  program.color === color
                    ? { borderWidth: 2, borderColor: colors.accent }
                    : styles.swatchSlotPlain,
                ]}
              >
                <View style={[styles.swatchDot, { backgroundColor: programColors[color] }]} />
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.block}>
          <View style={styles.listHeader}>
            <Text style={[styles.blockLabel, { color: colors.textMuted }]}>
              {t('program.composition')}
            </Text>
            <Text style={[styles.listHint, { color: colors.textMuted }]}>
              {t('library.reorderHint')}
            </Text>
          </View>

          <View
            testID="program-items"
            style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            {items.length === 0 ? (
              <View style={styles.empty}>
                <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
                  {t('program.empty')}
                </Text>
                <Text style={[styles.emptyHint, { color: colors.textMuted }]}>
                  {t('program.emptyHint')}
                </Text>
              </View>
            ) : null}

            {items.map((item, index) => (
              <Fragment key={item.id}>
                {index > 0 ? <View style={[styles.divider, { backgroundColor: colors.border }]} /> : null}

                <View testID={`program-item-${index}`} style={styles.row}>
                  <View
                    testID={`program-item-handle-${index}`}
                    accessibilityLabel={t('program.dragHandle')}
                    style={styles.grip}
                  >
                    <Icon name="grip-vertical" size={18} color={colors.textMuted} />
                  </View>

                  <View style={styles.rowTexts}>
                    <Text style={[styles.rowName, { color: colors.textPrimary }]}>
                      {item.exerciseName}
                    </Text>
                    {item.targetSets && item.targetReps ? (
                      <Text testID={`program-item-plan-${index}`} style={[styles.rowPlan, { color: colors.textMuted }]}>
                        {t('program.plan', {
                          sets: count('sets', item.targetSets),
                          reps: count('reps', item.targetReps),
                        })}
                      </Text>
                    ) : null}
                  </View>

                  <Pressable
                    testID={`program-item-remove-${index}`}
                    accessibilityRole="button"
                    accessibilityLabel={t('library.removeFromProgram')}
                    onPress={() => removeItem.mutate(item.exerciseId)}
                    style={[styles.removeButton, { backgroundColor: colors.surface2 }]}
                  >
                    <Icon name="x" size={15} color={colors.textMuted} />
                  </Pressable>
                </View>
              </Fragment>
            ))}
          </View>
        </View>

        <Pressable
          testID="program-add-exercise"
          accessibilityRole="button"
          onPress={() => (onAddExercise ? onAddExercise() : setPickerOpen(true))}
          style={[styles.addButton, { backgroundColor: colors.accentSoft }]}
        >
          <Icon name="plus" size={16} color={colors.accent} />
          <Text style={[styles.addLabel, { color: colors.accent }]}>{t('workout.addExercise')}</Text>
        </Pressable>

        <View style={styles.actions}>
          <Pressable
            testID="program-duplicate"
            accessibilityRole="button"
            onPress={() => duplicate.mutate()}
            style={[styles.actionButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Icon name="copy" size={15} color={colors.textSecondary} />
            <Text style={[styles.actionLabel, { color: colors.textSecondary }]}>
              {t('program.duplicate')}
            </Text>
          </Pressable>

          <Pressable
            testID="program-archive"
            accessibilityRole="button"
            onPress={() => archive.mutate()}
            style={[styles.actionButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Icon name="archive" size={15} color={colors.danger} />
            <Text style={[styles.actionLabel, { color: colors.danger }]}>{t('program.archive')}</Text>
          </Pressable>
        </View>
      </ScrollView>

      <ExercisePickerSheet
        visible={pickerOpen}
        selectedIds={items.map((item) => item.exerciseId)}
        onDone={(exerciseIds) => {
          setPickerOpen(false)
          setItems.mutate(exerciseIds)
        }}
        onClose={() => setPickerOpen(false)}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingTop: 8, paddingHorizontal: 20, paddingBottom: 24, gap: 18 },

  block: { gap: 9 },
  blockLabel: { fontSize: 12, fontFamily: uiFont('600'), fontWeight: '600' },

  swatches: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  swatchSlot: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // без кольца слот сохраняет размер: иначе выбор цвета дёргает ряд
  swatchSlotPlain: { borderWidth: 2, borderColor: 'transparent' },
  swatchDot: { width: 30, height: 30, borderRadius: radii.pill },

  listHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  listHint: { fontSize: 11, fontFamily: uiFont('400'), fontWeight: '400' },

  card: { borderRadius: radii.lg, borderWidth: 1, overflow: 'hidden' },
  divider: { height: 1 },

  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, paddingHorizontal: 14 },
  grip: { width: 18, alignItems: 'center', justifyContent: 'center' },
  rowTexts: { flex: 1, gap: 3 },
  rowName: { fontSize: 15, fontFamily: uiFont('500'), fontWeight: '500' },
  rowPlan: { fontSize: 11, fontFamily: uiFont('400'), fontWeight: '400' },
  removeButton: {
    width: 28,
    height: 28,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: { padding: 14, gap: 3 },
  emptyTitle: { fontSize: 15, fontFamily: uiFont('600'), fontWeight: '600' },
  emptyHint: { fontSize: 11, fontFamily: uiFont('400'), fontWeight: '400' },

  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: radii.md,
    paddingVertical: 13,
  },
  addLabel: { fontSize: 14, fontFamily: uiFont('600'), fontWeight: '600' },

  actions: { flexDirection: 'row', gap: 12 },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderRadius: radii.md,
    borderWidth: 1,
    paddingVertical: 12,
  },
  actionLabel: { fontSize: 13, fontFamily: uiFont('600'), fontWeight: '600' },
})
