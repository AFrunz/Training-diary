import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Fragment } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
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
  /**
   * Дублирование уводит на экран создания с подставленным составом, архивация —
   * назад к списку: маршруты знает навигация. Копия появляется только по кнопке
   * «Создать», поэтому здесь никакой записи не происходит.
   */
  readonly onDuplicate?: () => void
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
  onDuplicate,
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
  /** Черновик названия: пока поле правится, запрос его не перетирает. */
  const [draftName, setDraftName] = useState<string | null>(null)

  useEffect(() => {
    setDraftName(null)
  }, [programId])

  /**
   * Сбрасывается весь кэш, а не только этот экран: программа видна ещё и в
   * библиотеке, в фильтрах списка тренировок и в выборе программы.
   */
  const invalidate = () => queryClient.invalidateQueries()

  const rename = useMutation({
    mutationFn: (name: string) => services.renameProgram({ programId, name }),
    onSuccess: invalidate,
  })

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

  const setItems = useMutation({
    mutationFn: (exerciseIds: readonly Id[]) => services.setProgramItems({ programId, exerciseIds }),
    onSuccess: invalidate,
  })

  /**
   * Перестановка соседей: порядок массива и есть порядок в программе, поэтому
   * достаточно обменять две позиции и сохранить состав целиком.
   */
  const moveItem = useMutation({
    mutationFn: async ({ from, to }: { readonly from: number; readonly to: number }) => {
      const exerciseIds = (data?.items ?? []).map((item) => item.exerciseId)
      const moved = exerciseIds[from]
      const target = exerciseIds[to]
      if (moved === undefined || target === undefined) return

      const next = [...exerciseIds]
      next[from] = target
      next[to] = moved
      await services.setProgramItems({ programId, exerciseIds: next })
    },
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
  const nameValue = draftName ?? program.name

  /**
   * Пустое название не сохраняется: поле возвращается к прежнему. Так правка
   * названия ведёт себя как на экране создания, только без кнопки.
   */
  const commitName = () => {
    const next = nameValue.trim()
    setDraftName(null)
    if (next.length === 0 || next === program.name) return
    rename.mutate(next)
  }

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
          <Text style={[styles.blockLabel, { color: colors.textMuted }]}>{t('program.name')}</Text>

          <TextInput
            testID="program-name-input"
            value={nameValue}
            onChangeText={setDraftName}
            onBlur={commitName}
            onSubmitEditing={commitName}
            returnKeyType="done"
            placeholder={t('program.namePlaceholder')}
            placeholderTextColor={colors.textMuted}
            style={[
              styles.nameInput,
              { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary },
            ]}
          />
        </View>

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
                  {/*
                   * Осознанное отступление от макета: там ручка перетаскивания, но
                   * жестовой библиотеки в проекте нет и ставить её ради одного
                   * списка избыточно. Порядок меняется двумя стрелками — крайние
                   * позиции получают недоступную кнопку вместо исчезающей, иначе
                   * ряд бы прыгал по ширине.
                   */}
                  <View style={styles.reorder}>
                    <Pressable
                      testID={`program-item-up-${index}`}
                accessibilityLabel={t('program.moveUp')}
                      accessibilityRole="button"
                      accessibilityState={{ disabled: index === 0 }}
                      disabled={index === 0}
                      onPress={() => moveItem.mutate({ from: index, to: index - 1 })}
                      style={styles.reorderButton}
                    >
                      <Icon
                        name="chevron-up"
                        size={15}
                        color={index === 0 ? colors.border : colors.textMuted}
                      />
                    </Pressable>

                    <Pressable
                      testID={`program-item-down-${index}`}
                accessibilityLabel={t('program.moveDown')}
                      accessibilityRole="button"
                      accessibilityState={{ disabled: index === items.length - 1 }}
                      disabled={index === items.length - 1}
                      onPress={() => moveItem.mutate({ from: index, to: index + 1 })}
                      style={styles.reorderButton}
                    >
                      <Icon
                        name="chevron-down"
                        size={15}
                        color={index === items.length - 1 ? colors.border : colors.textMuted}
                      />
                    </Pressable>
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
            onPress={() => onDuplicate?.()}
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
  nameInput: {
    borderRadius: radii.md,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 15,
    fontFamily: uiFont('600'),
    fontWeight: '600',
  },

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

  card: { borderRadius: radii.lg, borderWidth: 1, overflow: 'hidden' },
  divider: { height: 1 },

  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, paddingHorizontal: 14 },
  reorder: { width: 22, alignItems: 'center', justifyContent: 'center' },
  // компактно: две стрелки занимают ту же ширину, что раньше ручка перетаскивания
  reorderButton: { width: 22, height: 20, alignItems: 'center', justifyContent: 'center' },
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
