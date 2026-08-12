import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { WeightKg, WeightUnit } from '../../domain/model/types'
import { formatSet } from '../../domain/rules/format'
import { useT } from '../i18n/I18nProvider'
import { useTheme } from '../theme/ThemeProvider'
import { numFont, radii, uiFont } from '../theme/tokens'
import { Icon } from './Icon'

export interface ExerciseRowSet {
  readonly id: string
  readonly weightKg?: WeightKg | null
  readonly reps: number
}

export interface ExerciseRowProps {
  /** Порядковый номер в тренировке: из него строятся testID для сквозных сценариев. */
  readonly index: number
  readonly name: string
  readonly targetSets?: number | null
  readonly targetReps?: number | null
  readonly sets: readonly ExerciseRowSet[]
  readonly done: boolean
  readonly unit: WeightUnit
  readonly onToggleDone: (next: boolean) => void
  readonly onAddSet: () => void
  readonly onOpenHistory: () => void
}

/** Упражнение в экране тренировки: чекбокс, план, подходы чипами, кнопка истории. */
export function ExerciseRow({
  index,
  name,
  targetSets,
  targetReps,
  sets,
  done,
  unit,
  onToggleDone,
  onAddSet,
  onOpenHistory,
}: ExerciseRowProps) {
  // тема берётся из провайдера, а не из системной схемы: иначе явный выбор темы не применится
  const { colors } = useTheme()
  const { t } = useT()
  const target = targetSets && targetReps ? `${targetSets} × ${targetReps}` : null

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.header}>
        <Pressable
          testID={`item-checkbox-${index}`}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: done }}
          onPress={() => onToggleDone(!done)}
          style={[
            styles.checkbox,
            done
              ? { backgroundColor: colors.accent, borderColor: colors.accent }
              : { borderColor: colors.border },
          ]}
        >
          {done ? <Icon name="check" size={15} color={colors.onAccent} /> : null}
        </Pressable>

        <View style={styles.titles}>
          <Text
            style={[
              styles.name,
              { color: done ? colors.textMuted : colors.textPrimary },
              done && styles.nameDone,
            ]}
          >
            {name}
          </Text>
          {target ? (
            <Text testID={`item-target-${index}`} style={[styles.target, { color: colors.textMuted }]}>
              {target}
            </Text>
          ) : null}
        </View>

        <Pressable
          testID={`open-history-${index}`}
          accessibilityRole="button"
          accessibilityLabel={t('workout.history')}
          onPress={onOpenHistory}
          style={[styles.historyButton, { backgroundColor: colors.surface2 }]}
        >
          <Icon name="history" size={18} color={colors.textMuted} />
        </Pressable>
      </View>

      <View style={styles.sets}>
        {sets.map((set) => (
          <View key={set.id} style={[styles.chip, { backgroundColor: colors.surface2 }]}>
            <Text style={[styles.chipText, { color: colors.textPrimary }]}>
              {formatSet({ weightKg: set.weightKg ?? null, reps: set.reps }, unit)}
            </Text>
          </View>
        ))}

        <Pressable
          testID={`add-set-${index}`}
          accessibilityRole="button"
          onPress={onAddSet}
          style={[styles.chip, styles.addSet, { backgroundColor: colors.accentSoft }]}
        >
          <Icon name="plus" size={13} color={colors.accent} />
          <Text style={[styles.addSetLabel, { color: colors.accent }]}>{t('workout.addSet')}</Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  // размеры из макета: карточка padding 12, gap 10
  card: { borderRadius: radii.lg, borderWidth: 1, padding: 12, gap: 10 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titles: { flex: 1, gap: 2 },
  name: { fontFamily: uiFont('600'), fontSize: 15, fontWeight: '600' },
  nameDone: { textDecorationLine: 'line-through' },
  target: { fontFamily: uiFont('500'), fontSize: 11, fontWeight: '500' },
  historyButton: { width: 30, height: 30, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center' },
  sets: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderRadius: radii.sm, paddingVertical: 5, paddingHorizontal: 9 },
  // вес и повторы — числа, поэтому Space Grotesk
  chipText: { fontFamily: numFont('600'), fontSize: 12, fontWeight: '600' },
  addSet: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addSetLabel: { fontFamily: uiFont('600'), fontSize: 12, fontWeight: '600' },
})
