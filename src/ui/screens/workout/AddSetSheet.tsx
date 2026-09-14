import { useMutation, useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { WorkoutSet } from '../../../domain/model/entities'
import type { Id, SetUnit, WeightUnit } from '../../../domain/model/types'
import { SET_UNITS } from '../../../domain/model/types'
import { formatSet } from '../../../domain/rules/format'
import {
  MAX_ANGLE_DEG,
  MIN_ANGLE_DEG,
  fromInputWeight,
  measureFromInput,
  measureToDisplay,
  roundForSetUnit,
  stepForSetUnit,
} from '../../../domain/rules/units'
import { validateSet } from '../../../domain/validation/rules'
import { Icon } from '../../components/Icon'
import { KeyboardAvoider } from '../../components/KeyboardAvoider'
import type { TranslationKey } from '../../i18n/dictionaries'
import { useT } from '../../i18n/I18nProvider'
import { useServices } from '../../providers/ServicesProvider'
import { useTheme } from '../../theme/ThemeProvider'
import { numFont, palette, radii, uiFont } from '../../theme/tokens'

/**
 * Шит подхода (фреймы «04 · Добавление подхода» и «04b · Правка подхода»).
 *
 * Добавление берёт начальные значения из сценария suggestNextSet, правка —
 * из самого подхода. Запись идёт сразу в базу, без черновиков (ARCHITECTURE.md §4).
 */

export interface AddSetSheetProps {
  readonly workoutId: Id
  readonly itemId: Id
  readonly exerciseName: string
  /** Номер подхода: при добавлении — следующий, при правке — номер правимого. */
  readonly setNumber: number
  /** Правимый подход; без него шит добавляет новый (FR-4.4.1). */
  readonly editing?: WorkoutSet | null
  /** Подход прошлой тренировки под тем же номером — подсказка под полями (FR-4.10). */
  readonly previousSet?: WorkoutSet | null
  /** Единица из настроек: с неё начинается новый подход (FR-7.5). */
  readonly unit: WeightUnit
  readonly onClose: () => void
}

interface Draft {
  readonly value: string
  readonly reps: string
  readonly unit: SetUnit
}

/** Пустая строка и мусор считаются отсутствующим значением: вес необязателен. */
const parseNumber = (value: string): number | null => {
  const normalized = value.trim().replace(',', '.')
  if (normalized.length === 0) return null
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

const showNumber = (value: number | null): string => (value === null ? '' : String(value))

const UNIT_LABEL: Record<SetUnit, TranslationKey> = {
  kg: 'set.unitKg',
  lb: 'set.unitLb',
  deg: 'set.unitDeg',
}

export function AddSetSheet({
  workoutId,
  itemId,
  exerciseName,
  setNumber,
  editing = null,
  previousSet = null,
  unit,
  onClose,
}: AddSetSheetProps) {
  const services = useServices()
  const insets = useSafeAreaInsets()
  const { colors } = useTheme()
  const { t, locale } = useT()

  const isEditing = editing !== null

  const suggestion = useQuery({
    queryKey: ['set-suggestion', workoutId, itemId],
    queryFn: () => services.suggestNextSet({ workoutId, itemId }),
    // при правке подсказка не нужна: значения приходят из самого подхода
    enabled: !isEditing,
  })

  const [draft, setDraft] = useState<Draft | null>(
    editing
      ? {
          value: showNumber(measureToDisplay(editing, editing.unit)),
          reps: String(editing.reps),
          unit: editing.unit,
        }
      : null,
  )

  useEffect(() => {
    const suggested = suggestion.data
    if (!suggested || draft !== null) return
    setDraft({
      value: showNumber(suggested.value),
      reps: suggested.reps > 0 ? String(suggested.reps) : '',
      unit: suggested.unit,
    })
  }, [suggestion.data, draft])

  const valueText = draft?.value ?? ''
  const repsText = draft?.reps ?? ''
  const setUnit = draft?.unit ?? unit
  const value = parseNumber(valueText)
  const repsValue = parseNumber(repsText)
  const step = stepForSetUnit(setUnit)

  const patch = (next: Partial<Draft>) =>
    setDraft((current) => ({
      value: current?.value ?? '',
      reps: current?.reps ?? '',
      unit: current?.unit ?? unit,
      ...next,
    }))

  /**
   * У веса шаг вниз до нуля очищает поле: подход без веса — штатный случай.
   * У угла ноль — настоящее значение (горизонтальная скамья), а минус — декалайн,
   * поэтому там значение просто упирается в границы диапазона.
   */
  const bump = (delta: number) => {
    const next = roundForSetUnit((value ?? 0) + delta, setUnit)
    if (setUnit === 'deg') {
      patch({ value: String(Math.min(MAX_ANGLE_DEG, Math.max(MIN_ANGLE_DEG, next))) })
      return
    }
    patch({ value: next > 0 ? String(next) : '' })
  }

  const bumpReps = (delta: number) => {
    const next = Math.max(0, Math.round((repsValue ?? 0) + delta))
    patch({ reps: next > 0 ? String(next) : '' })
  }

  /**
   * Килограммы и фунты — одна и та же величина, поэтому число пересчитывается.
   * Градусы — другая: при переключении на них и с них поле очищается.
   */
  const switchUnit = (next: SetUnit) => {
    if (next === setUnit) return
    if (next === 'deg' || setUnit === 'deg') {
      patch({ unit: next, value: '' })
      return
    }
    const converted =
      value === null ? null : measureToDisplay({ weightKg: fromInputWeight(value, setUnit) }, next)
    patch({ unit: next, value: showNumber(converted) })
  }

  // те же правила, что и в сценарии: отрицательный вес и угол «больше вертикали»
  // не должны доезжать до записи, поэтому кнопка гаснет
  const canSubmit = validateSet({ ...measureFromInput(value, setUnit), reps: repsValue ?? 0 }).ok

  const submit = useMutation({
    mutationFn: async () => {
      if (repsValue === null) return
      const input = { workoutId, itemId, value, unit: setUnit, reps: repsValue }
      if (editing) await services.editSet({ ...input, setId: editing.id })
      else await services.addSet(input)
    },
    // кэш целиком сбрасывает общий обработчик мутаций: подсказка следующего
    // подхода зависит от только что записанного (FR-4.4)
    onSuccess: onClose,
  })

  const remove = useMutation({
    mutationFn: async () => {
      if (!editing) return
      await services.deleteSet({ workoutId, itemId, setId: editing.id })
    },
    onSuccess: onClose,
  })

  const hint = previousSet
    ? t('set.previous', { value: formatSet(previousSet, unit, locale) })
    : suggestion.data?.previous
      ? t('set.previous', { value: formatSet(suggestion.data.previous, unit, locale) })
      : null

  /**
   * Знак остаётся подписью для вспомогательных технологий: он не переводится,
   * поэтому в словаре ему места нет.
   */
  const roundButton = (direction: 'minus' | 'plus', testID: string, onPress: () => void) => (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={direction === 'plus' ? '+' : '−'}
      onPress={onPress}
      style={[styles.round, { backgroundColor: colors.surface2 }]}
    >
      <Icon name={direction} size={18} color={colors.textPrimary} />
    </Pressable>
  )

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose} testID="add-set-sheet">
      <View style={styles.root}>
        <Pressable
          testID="add-set-scrim"
          accessibilityRole="button"
          accessibilityLabel={t('common.cancel')}
          onPress={onClose}
          style={[StyleSheet.absoluteFill, styles.scrim, { backgroundColor: palette.dark.bg }]}
        />

        {/* без этого клавиатура закрывает и поля, и кнопку записи */}
        <KeyboardAvoider style={styles.avoider}>
          <View
            style={[
              styles.sheet,
              // жестовая полоса устройства: без этого кнопка уезжает под системное меню
              { backgroundColor: colors.surface, paddingBottom: 20 + insets.bottom },
            ]}
          >
            <View style={styles.grabberWrap}>
              <View style={[styles.grabber, { backgroundColor: colors.border }]} />
            </View>

            <View style={styles.titles}>
              <Text testID="add-set-title" style={[styles.title, { color: colors.textPrimary }]}>
                {isEditing ? t('set.editTitle') : exerciseName}
              </Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                {isEditing
                  ? t('set.editSubtitle', { exercise: exerciseName, number: setNumber })
                  : t('set.number', { number: setNumber })}
              </Text>
            </View>

            <View style={styles.steppers}>
              <View style={styles.stepper}>
                <View style={styles.labelRow}>
                  <Text style={[styles.label, { color: colors.textMuted }]}>
                    {t(setUnit === 'deg' ? 'set.angle' : 'set.weight')}
                  </Text>

                  <View style={[styles.segment, { backgroundColor: colors.surface2 }]}>
                    {SET_UNITS.map((option) => (
                      <Pressable
                        key={option}
                        testID={`set-unit-${option}`}
                        accessibilityRole="button"
                        accessibilityState={{ selected: option === setUnit }}
                        onPress={() => switchUnit(option)}
                        style={[
                          styles.segmentChip,
                          option === setUnit
                            ? { backgroundColor: colors.surface, borderColor: colors.border }
                            : styles.segmentChipPlain,
                        ]}
                      >
                        <Text
                          style={[
                            styles.segmentLabel,
                            { color: option === setUnit ? colors.textPrimary : colors.textMuted },
                          ]}
                        >
                          {t(UNIT_LABEL[option])}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                <View style={styles.controls}>
                  {roundButton('minus', 'set-weight-minus', () => bump(-step))}
                  <TextInput
                    testID="set-weight-input"
                    value={valueText}
                    onChangeText={(next) => patch({ value: next })}
                    keyboardType="numeric"
                    style={[styles.value, { color: colors.textPrimary }]}
                  />
                  {roundButton('plus', 'set-weight-plus', () => bump(step))}
                </View>
              </View>

              <View style={styles.stepper}>
                <View style={styles.labelRow}>
                  <Text style={[styles.label, { color: colors.textMuted }]}>{t('set.reps')}</Text>
                </View>

                <View style={styles.controls}>
                  {roundButton('minus', 'set-reps-minus', () => bumpReps(-1))}
                  <TextInput
                    testID="set-reps-input"
                    value={repsText}
                    onChangeText={(next) => patch({ reps: next })}
                    keyboardType="number-pad"
                    style={[styles.value, { color: colors.textPrimary }]}
                  />
                  {roundButton('plus', 'set-reps-plus', () => bumpReps(1))}
                </View>
              </View>
            </View>

            {hint ? (
              <Text testID="set-hint" style={[styles.hint, { color: colors.textMuted }]}>
                {hint}
              </Text>
            ) : null}

            <View style={styles.actions}>
              {isEditing ? (
                <Pressable
                  testID="set-delete"
                  accessibilityRole="button"
                  onPress={() => remove.mutate()}
                  disabled={remove.isPending}
                  style={[styles.deleteButton, { borderColor: colors.danger }]}
                >
                  <Icon name="trash-2" size={15} color={colors.danger} />
                  <Text style={[styles.deleteLabel, { color: colors.danger }]}>{t('common.delete')}</Text>
                </Pressable>
              ) : null}

              <Pressable
                testID="set-submit"
                accessibilityRole="button"
                accessibilityState={{ disabled: !canSubmit }}
                disabled={!canSubmit || submit.isPending}
                onPress={() => submit.mutate()}
                style={[
                  styles.submit,
                  { backgroundColor: colors.accent, opacity: canSubmit ? 1 : 0.5 },
                ]}
              >
                <Text style={[styles.submitLabel, { color: colors.onAccent }]}>
                  {isEditing ? t('common.save') : t('set.submit')}
                </Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoider>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  avoider: { justifyContent: 'flex-end' },
  scrim: { opacity: 0.7 },
  sheet: {
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    gap: 18,
    paddingTop: 12,
    paddingHorizontal: 20,
  },
  grabberWrap: { alignItems: 'center' },
  grabber: { width: 40, height: 4, borderRadius: radii.pill },
  titles: { gap: 2 },
  title: { fontFamily: uiFont('700'), fontSize: 18, fontWeight: '700' },
  subtitle: { fontFamily: uiFont('500'), fontSize: 12, fontWeight: '500' },
  steppers: { flexDirection: 'row', gap: 14 },
  stepper: { flex: 1, gap: 6 },
  // одинаковая высота строк подписи держит оба степпера на одной линии
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 26 },
  label: { fontFamily: uiFont('500'), fontSize: 11, fontWeight: '500' },
  segment: { flexDirection: 'row', alignItems: 'center', borderRadius: radii.pill, padding: 2 },
  segmentChip: {
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingVertical: 2,
    paddingHorizontal: 7,
  },
  // прозрачная рамка держит ширину: без неё выбор единицы дёргает ряд
  segmentChipPlain: { borderWidth: 1, borderColor: 'transparent' },
  segmentLabel: { fontFamily: uiFont('600'), fontSize: 10, fontWeight: '600' },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  round: { width: 38, height: 38, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center' },
  // вес и повторы — числа: Space Grotesk и в поле ввода, и в быстрых чипах
  value: { fontFamily: numFont('700'), flex: 1, fontSize: 26, fontWeight: '700', textAlign: 'center', padding: 0 },
  hint: { fontFamily: uiFont('500'), fontSize: 12, fontWeight: '500' },
  actions: { flexDirection: 'row', gap: 12 },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderRadius: radii.md,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  deleteLabel: { fontFamily: uiFont('600'), fontSize: 14, fontWeight: '600' },
  submit: { flex: 1, borderRadius: radii.md, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  submitLabel: { fontFamily: uiFont('700'), fontSize: 15, fontWeight: '700' },
})
