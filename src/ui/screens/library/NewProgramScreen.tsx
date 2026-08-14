import { useMutation, useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { PROGRAM_PALETTE } from '../../../app/usecases/library'
import type { Id } from '../../../domain/model/types'
import { Icon } from '../../components/Icon'
import { ScreenHeader } from '../../components/ScreenHeader'
import { useT } from '../../i18n/I18nProvider'
import { useServices } from '../../providers/ServicesProvider'
import { useTheme } from '../../theme/ThemeProvider'
import { numFont, programColors, radii, uiFont } from '../../theme/tokens'
import { useExerciseSummaries } from './data'
import { ExercisePickerSheet } from './ExercisePickerSheet'

export interface NewProgramScreenProps {
  readonly onBack?: () => void
  readonly onCreated?: (id: Id) => void
  readonly onCreateExercise?: () => void
  /**
   * Дублирование программы (FR-3.6): экран открывается с подставленным именем и
   * составом оригинала. Копия появляется только по кнопке «Создать», поэтому
   * пользователь успевает поправить и название, и состав.
   */
  readonly sourceProgramId?: Id
}

/**
 * Экран «11 · Новая программа» (FR-3.1.1): пустое название, предложенный цвет,
 * пустой состав. Кнопка «Создать» неактивна, пока название пустое.
 */
export function NewProgramScreen({
  onBack,
  onCreated,
  onCreateExercise,
  sourceProgramId,
}: NewProgramScreenProps) {
  const { colors } = useTheme()
  const { t } = useT()
  const services = useServices()

  const [name, setName] = useState('')
  const [color, setColor] = useState<string | null>(null)
  const [exerciseIds, setExerciseIds] = useState<readonly Id[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)
  /** Подстановка из оригинала одноразовая: дальше поля принадлежат пользователю. */
  const [prefilled, setPrefilled] = useState(false)

  const suggested = useQuery({
    queryKey: ['library', 'suggested-color'],
    queryFn: () => services.suggestProgramColor(),
  })

  // отдельный ключ от экрана программы: там лежит другое представление тех же данных
  const source = useQuery({
    queryKey: ['library', 'program-source', sourceProgramId ?? null],
    queryFn: () =>
      sourceProgramId === undefined ? null : services.ports.programs.byIdWithItems(sourceProgramId),
    enabled: sourceProgramId !== undefined,
  })

  useEffect(() => {
    if (color === null && suggested.data) setColor(suggested.data)
  }, [color, suggested.data])

  useEffect(() => {
    const loaded = source.data
    if (prefilled || !loaded) return
    setName(`${loaded.program.name} (${t('program.copySuffix')})`)
    setExerciseIds(loaded.items.map((item) => item.exerciseId))
    setPrefilled(true)
  }, [prefilled, source.data, t])

  const exercises = useExerciseSummaries()
  const chosen = exerciseIds
    .map((id) => (exercises.data ?? []).find((summary) => summary.exercise.id === id))
    .filter((summary): summary is NonNullable<typeof summary> => summary !== undefined)


  /**
   * Запись идёт мутацией: общий обработчик кэша сбрасывает его целиком, иначе
   * программа появится в библиотеке, но не в выборе при создании тренировки —
   * у них разные ключи запросов.
   */
  const createProgram = useMutation({
    mutationFn: () => services.createProgram({ name, color: color ?? undefined, exerciseIds }),
    onSuccess: (id) => onCreated?.(id),
  })

  const canCreate = name.trim().length > 0 && !createProgram.isPending

  const create = () => {
    if (!canCreate) return
    createProgram.mutate()
  }

  return (
    <View testID="new-program-screen" style={[styles.root, { backgroundColor: colors.bg }]}>
      <ScreenHeader title={t('program.new')} onBack={onBack} />

      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.textMuted }]}>{t('program.name')}</Text>
          <View style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.accent }]}>
            <TextInput
              testID="name-input"
              value={name}
              onChangeText={setName}
              autoFocus
              placeholder={t('program.namePlaceholder')}
              placeholderTextColor={colors.textMuted}
              style={[styles.inputText, { color: colors.textPrimary }]}
            />
          </View>
          <Text style={[styles.hint, { color: colors.textMuted }]}>{t('program.nameHint')}</Text>
        </View>

        <View style={styles.colorBlock}>
          <Text style={[styles.label, { color: colors.textMuted }]}>{t('program.color')}</Text>
          <View style={styles.swatches}>
            {PROGRAM_PALETTE.map((key) => (
              <Pressable
                key={key}
                testID={`program-color-${key}`}
                accessibilityRole="radio"
                accessibilityState={{ selected: color === key }}
                onPress={() => setColor(key)}
                style={[styles.swatchSlot, color === key && { borderColor: colors.accent, borderWidth: 2 }]}
              >
                <View style={[styles.swatchDot, { backgroundColor: programColors[key] }]} />
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.textMuted }]}>{t('program.composition')}</Text>

          {chosen.length === 0 ? (
            <View testID="program-empty" style={[styles.empty, { backgroundColor: colors.surface2 }]}>
              <Icon name="dumbbell" size={24} color={colors.textMuted} />
              <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>{t('program.empty')}</Text>
              <Text style={[styles.emptyHint, { color: colors.textMuted }]}>{t('program.emptyHint')}</Text>
              <Pressable
                testID="exercise-picker-open"
                accessibilityRole="button"
                onPress={() => setPickerOpen(true)}
                style={[styles.addButton, { backgroundColor: colors.accentSoft }]}
              >
                <Icon name="plus" size={16} color={colors.accent} />
                <Text style={[styles.addLabel, { color: colors.accent }]}>{t('workout.addExercise')}</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.composition}>
              <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                {chosen.map((summary, index) => (
                  <View key={summary.exercise.id}>
                    {index > 0 ? <View style={[styles.divider, { backgroundColor: colors.border }]} /> : null}
                    <View testID={`program-item-${index}`} style={styles.row}>
                      <Text style={[styles.rowOrder, { color: colors.textMuted }]}>{index + 1}</Text>
                      <Text style={[styles.rowName, { color: colors.textPrimary }]}>{summary.exercise.name}</Text>
                    </View>
                  </View>
                ))}
              </View>

              <Pressable
                testID="exercise-picker-open"
                accessibilityRole="button"
                onPress={() => setPickerOpen(true)}
                style={[styles.addButton, { backgroundColor: colors.accentSoft }]}
              >
                <Icon name="plus" size={16} color={colors.accent} />
                <Text style={[styles.addLabel, { color: colors.accent }]}>{t('workout.addExercise')}</Text>
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>

      <View style={[styles.bottomBar, { borderTopColor: colors.border }]}>
        <Pressable
          testID="create-button"
          accessibilityRole="button"
          accessibilityState={{ disabled: !canCreate }}
          disabled={!canCreate}
          onPress={create}
          style={[
            styles.createButton,
            { backgroundColor: canCreate ? colors.accent : colors.surface2 },
          ]}
        >
          <Text style={[styles.createLabel, { color: canCreate ? colors.onAccent : colors.textMuted }]}>
            {t('program.create')}
          </Text>
        </Pressable>

        {canCreate ? null : (
          <Text style={[styles.note, { color: colors.textMuted }]}>{t('program.createDisabledHint')}</Text>
        )}
      </View>

      <ExercisePickerSheet
        visible={pickerOpen}
        selectedIds={exerciseIds}
        onClose={() => setPickerOpen(false)}
        onCreateExercise={onCreateExercise}
        onDone={(ids) => {
          setExerciseIds(ids)
          setPickerOpen(false)
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { gap: 22, paddingTop: 6, paddingHorizontal: 20, paddingBottom: 24 },
  field: { gap: 7 },
  label: { fontSize: 12, fontFamily: uiFont('600'), fontWeight: '600' },
  input: { borderRadius: radii.md, borderWidth: 1.5, paddingVertical: 13, paddingHorizontal: 14 },
  inputText: { fontSize: 15, fontFamily: uiFont('500'), fontWeight: '500', padding: 0 },
  hint: { fontSize: 11, fontFamily: uiFont('500'), fontWeight: '500', lineHeight: 15 },

  colorBlock: { gap: 9 },
  swatches: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  swatchSlot: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    borderWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchDot: { width: 30, height: 30, borderRadius: radii.pill },

  empty: { borderRadius: radii.lg, alignItems: 'center', gap: 8, paddingVertical: 26, paddingHorizontal: 20 },
  emptyTitle: { fontSize: 14, fontFamily: uiFont('600'), fontWeight: '600' },
  emptyHint: { fontSize: 11, fontFamily: uiFont('500'), fontWeight: '500', textAlign: 'center', lineHeight: 15 },
  addButton: {
    flexDirection: 'row',
    gap: 8,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    paddingHorizontal: 16,
  },
  addLabel: { fontSize: 13, fontFamily: uiFont('600'), fontWeight: '600' },

  composition: { gap: 9 },
  card: { borderRadius: radii.lg, borderWidth: 1, overflow: 'hidden' },
  divider: { height: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 13, paddingHorizontal: 14 },
  // порядковый номер — числовая гарнитура
  rowOrder: { fontSize: 12, fontFamily: numFont('600'), fontWeight: '600' },
  rowName: { flex: 1, fontSize: 15, fontFamily: uiFont('500'), fontWeight: '500' },

  bottomBar: { borderTopWidth: 1, gap: 8, paddingTop: 14, paddingHorizontal: 20, paddingBottom: 20 },
  createButton: { borderRadius: radii.md, alignItems: 'center', justifyContent: 'center', paddingVertical: 14 },
  createLabel: { fontSize: 15, fontFamily: uiFont('700'), fontWeight: '700' },
  note: { fontSize: 11, fontFamily: uiFont('500'), fontWeight: '500', textAlign: 'center' },
})
