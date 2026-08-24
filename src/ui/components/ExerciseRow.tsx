import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { SetUnit, WeightKg, WeightUnit } from '../../domain/model/types'
import { formatSet } from '../../domain/rules/format'
import { useT } from '../i18n/I18nProvider'
import { useTheme } from '../theme/ThemeProvider'
import { numFont, radii, uiFont } from '../theme/tokens'
import { Icon } from './Icon'

export interface ExerciseRowSet {
  readonly id: string
  readonly weightKg?: WeightKg | null
  readonly angleDeg?: number | null
  readonly unit?: SetUnit
  readonly reps: number
}

export interface ExerciseRowProps {
  /** Порядковый номер в тренировке: из него строятся testID для сквозных сценариев. */
  readonly index: number
  readonly name: string
  readonly targetSets?: number | null
  readonly targetReps?: number | null
  readonly sets: readonly ExerciseRowSet[]
  /** Подходы того же упражнения в прошлой тренировке (FR-4.10). */
  readonly previousSets: readonly ExerciseRowSet[]
  readonly done: boolean
  /** Единица из настроек: в ней показываются подходы, записанные без своей. */
  readonly unit: WeightUnit
  readonly onToggleDone: (next: boolean) => void
  readonly onAddSet: () => void
  readonly onEditSet: (setId: string, setNumber: number) => void
  readonly onOpenHistory: () => void
}

/**
 * Упражнение в экране тренировки: чекбокс, план, подходы и кнопка истории.
 *
 * Подходы стоят парами по вертикали — сверху прошлая тренировка, снизу
 * сегодняшняя (FR-4.10). Пустая рамка снизу означает, что в прошлый раз подход
 * был, а сегодня его ещё нет; пустое место сверху — что сегодня подходов больше.
 */
export function ExerciseRow({
  index,
  name,
  targetSets,
  targetReps,
  sets,
  previousSets,
  done,
  unit,
  onToggleDone,
  onAddSet,
  onEditSet,
  onOpenHistory,
}: ExerciseRowProps) {
  // тема берётся из провайдера, а не из системной схемы: иначе явный выбор темы не применится
  const { colors } = useTheme()
  const { t, locale } = useT()
  const target = targetSets && targetReps ? `${targetSets} × ${targetReps}` : null

  const columns = Array.from({ length: Math.max(sets.length, previousSets.length) }, (_, column) => ({
    previous: previousSets[column] ?? null,
    today: sets[column] ?? null,
  }))

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
        {columns.map(({ previous, today }, column) => (
          <View key={today?.id ?? previous?.id ?? column} style={styles.column}>
            {previous ? (
              <Text
                testID={`set-previous-${index}-${column}`}
                style={[styles.previousChip, { backgroundColor: colors.surface2, color: colors.textMuted }]}
              >
                {formatSet(previous, unit, locale)}
              </Text>
            ) : (
              // место прошлой тренировки остаётся пустым, чтобы пары не разъезжались
              <View style={styles.previousGap} />
            )}

            {today ? (
              <Pressable
                testID={`set-chip-${index}-${column}`}
                accessibilityRole="button"
                accessibilityLabel={t('workout.editSet')}
                onPress={() => onEditSet(today.id, column + 1)}
                style={[styles.todayChip, { backgroundColor: colors.surface2, borderColor: colors.border }]}
              >
                <Text style={[styles.todayText, { color: colors.textPrimary }]}>
                  {formatSet(today, unit, locale)}
                </Text>
              </Pressable>
            ) : (
              <View
                testID={`set-missing-${index}-${column}`}
                style={[styles.todayChip, styles.missingChip, { borderColor: colors.border }]}
              />
            )}
          </View>
        ))}

        <Pressable
          testID={`add-set-${index}`}
          accessibilityRole="button"
          accessibilityLabel={t('set.submit')}
          onPress={onAddSet}
          style={[styles.addSet, { backgroundColor: colors.accentSoft }]}
        >
          <Icon name="plus" size={14} color={colors.accent} />
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

  // колонки прижаты к низу: у подхода без пары сверху остаётся пустое место
  sets: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', gap: 6 },
  column: { gap: 4, minWidth: 58 },
  // вес и повторы — числа, поэтому Space Grotesk
  previousChip: {
    fontFamily: numFont('600'),
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    borderRadius: radii.sm,
    paddingVertical: 3,
    paddingHorizontal: 8,
    overflow: 'hidden',
  },
  previousGap: { height: 20 },
  todayChip: {
    borderRadius: radii.sm,
    borderWidth: 1,
    paddingVertical: 5,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayText: { fontFamily: numFont('600'), fontSize: 12, fontWeight: '600' },
  // высота пустой рамки повторяет чип с текстом, иначе ряд просядет
  missingChip: { height: 26, opacity: 0.5 },
  addSet: {
    width: 30,
    height: 26,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
