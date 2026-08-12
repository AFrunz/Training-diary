import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import type { Id, WeightUnit } from '../../../domain/model/types'
import { formatSet } from '../../../domain/rules/format'
import { fromInputWeight, roundForUnit, stepForUnit, toDisplayWeight } from '../../../domain/rules/units'
import { useT } from '../../i18n/I18nProvider'
import { useServices } from '../../providers/ServicesProvider'
import { useTheme } from '../../theme/ThemeProvider'
import { palette, radii } from '../../theme/tokens'

/**
 * Шит добавления подхода (фрейм «04 · Добавление подхода»). Начальные значения
 * приходят из сценария suggestNextSet, запись идёт сразу в базу — без черновиков
 * и кнопки «Сохранить» (ARCHITECTURE.md §4).
 */

export interface AddSetSheetProps {
  readonly workoutId: Id
  readonly itemId: Id
  readonly exerciseName: string
  /** Номер подхода: количество уже записанных плюс один. */
  readonly setNumber: number
  readonly unit: WeightUnit
  readonly onClose: () => void
}

interface Draft {
  readonly weight: string
  readonly reps: string
}

/** Пустая строка и мусор считаются отсутствующим значением: вес необязателен. */
const parseNumber = (value: string): number | null => {
  const normalized = value.trim().replace(',', '.')
  if (normalized.length === 0) return null
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

const showNumber = (value: number | null): string => (value === null ? '' : String(value))

export function AddSetSheet({
  workoutId,
  itemId,
  exerciseName,
  setNumber,
  unit,
  onClose,
}: AddSetSheetProps) {
  const services = useServices()
  const queryClient = useQueryClient()
  const { colors } = useTheme()
  const { t } = useT()

  const suggestion = useQuery({
    queryKey: ['set-suggestion', workoutId, itemId],
    queryFn: () => services.suggestNextSet({ workoutId, itemId }),
  })

  const [draft, setDraft] = useState<Draft | null>(null)

  useEffect(() => {
    const suggested = suggestion.data
    if (!suggested || draft !== null) return
    setDraft({
      weight: showNumber(toDisplayWeight(suggested.weightKg, unit)),
      reps: suggested.reps > 0 ? String(suggested.reps) : '',
    })
  }, [suggestion.data, draft, unit])

  const weightText = draft?.weight ?? ''
  const repsText = draft?.reps ?? ''
  const weightValue = parseNumber(weightText)
  const repsValue = parseNumber(repsText)
  const step = stepForUnit(unit)

  const patch = (next: Partial<Draft>) =>
    setDraft((current) => ({ weight: current?.weight ?? '', reps: current?.reps ?? '', ...next }))

  /** Шаг вниз до нуля очищает поле: подход без веса — штатный случай. */
  const bumpWeight = (delta: number) => {
    const next = roundForUnit((weightValue ?? 0) + delta, unit)
    patch({ weight: next > 0 ? String(next) : '' })
  }

  const bumpReps = (delta: number) => {
    const next = Math.max(0, Math.round((repsValue ?? 0) + delta))
    patch({ reps: next > 0 ? String(next) : '' })
  }

  const canSubmit =
    repsValue !== null && Number.isInteger(repsValue) && repsValue > 0 && (weightValue ?? 0) >= 0

  const submit = useMutation({
    mutationFn: async () => {
      if (repsValue === null) return
      await services.addSet({
        workoutId,
        itemId,
        weightKg: fromInputWeight(weightValue, unit),
        reps: repsValue,
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['workout', workoutId] })
      onClose()
    },
  })

  const previous = suggestion.data
  const hint =
    previous && previous.source !== 'empty' && previous.source !== 'program-target'
      ? t('set.previous', {
          value: formatSet({ weightKg: previous.weightKg, reps: previous.reps }, unit),
        })
      : null

  const roundButton = (label: string, testID: string, onPress: () => void) => (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.round, { backgroundColor: colors.surface2 }]}
    >
      <Text style={[styles.roundLabel, { color: colors.textPrimary }]}>{label}</Text>
    </Pressable>
  )

  const quickChip = (delta: number) => {
    const label = `${delta > 0 ? '+' : '−'}${Math.abs(delta)}`
    return (
      <Pressable
        key={label}
        testID={`set-quick-${delta}`}
        accessibilityRole="button"
        onPress={() => bumpWeight(delta)}
        style={[styles.quickChip, { backgroundColor: colors.surface2 }]}
      >
        <Text style={[styles.quickChipLabel, { color: colors.textSecondary }]}>{label}</Text>
      </Pressable>
    )
  }

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

        <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
          <View style={styles.grabberWrap}>
            <View style={[styles.grabber, { backgroundColor: colors.border }]} />
          </View>

          <View style={styles.titles}>
            <Text testID="add-set-title" style={[styles.title, { color: colors.textPrimary }]}>
              {exerciseName}
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              {t('set.number', { number: setNumber })}
            </Text>
          </View>

          <View style={styles.steppers}>
            <View style={styles.stepper}>
              <Text style={[styles.label, { color: colors.textMuted }]}>
                {t(unit === 'kg' ? 'set.weight' : 'set.weightLb')}
              </Text>
              <View style={styles.controls}>
                {roundButton('−', 'set-weight-minus', () => bumpWeight(-step))}
                <TextInput
                  testID="set-weight-input"
                  value={weightText}
                  onChangeText={(value) => patch({ weight: value })}
                  keyboardType="numeric"
                  style={[styles.value, { color: colors.textPrimary }]}
                />
                {roundButton('+', 'set-weight-plus', () => bumpWeight(step))}
              </View>
            </View>

            <View style={styles.stepper}>
              <Text style={[styles.label, { color: colors.textMuted }]}>{t('set.reps')}</Text>
              <View style={styles.controls}>
                {roundButton('−', 'set-reps-minus', () => bumpReps(-1))}
                <TextInput
                  testID="set-reps-input"
                  value={repsText}
                  onChangeText={(value) => patch({ reps: value })}
                  keyboardType="number-pad"
                  style={[styles.value, { color: colors.textPrimary }]}
                />
                {roundButton('+', 'set-reps-plus', () => bumpReps(1))}
              </View>
            </View>
          </View>

          <View style={styles.quickChips}>{[step, step * 2, -step].map(quickChip)}</View>

          {hint ? (
            <Text testID="set-hint" style={[styles.hint, { color: colors.textMuted }]}>
              {hint}
            </Text>
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
            <Text style={[styles.submitLabel, { color: colors.onAccent }]}>{t('set.submit')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  scrim: { opacity: 0.7 },
  sheet: {
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    gap: 22,
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: 34,
  },
  grabberWrap: { alignItems: 'center' },
  grabber: { width: 40, height: 4, borderRadius: radii.pill },
  titles: { gap: 2 },
  title: { fontSize: 18, fontWeight: '700' },
  subtitle: { fontSize: 12, fontWeight: '500' },
  steppers: { flexDirection: 'row', gap: 14 },
  stepper: { flex: 1, gap: 6 },
  label: { fontSize: 11, fontWeight: '500' },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  round: { width: 38, height: 38, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center' },
  roundLabel: { fontSize: 18, fontWeight: '600' },
  value: { flex: 1, fontSize: 26, fontWeight: '700', textAlign: 'center', padding: 0 },
  quickChips: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  quickChip: { borderRadius: radii.sm, paddingVertical: 6, paddingHorizontal: 10 },
  quickChipLabel: { fontSize: 12, fontWeight: '600' },
  hint: { fontSize: 12, fontWeight: '500' },
  submit: { borderRadius: radii.md, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  submitLabel: { fontSize: 15, fontWeight: '700' },
})
