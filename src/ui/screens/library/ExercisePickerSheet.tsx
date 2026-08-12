import { useEffect, useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import type { Id } from '../../../domain/model/types'
import { Icon } from '../../components/Icon'
import { useT } from '../../i18n/I18nProvider'
import { useTheme } from '../../theme/ThemeProvider'
import { numFont, radii, uiFont } from '../../theme/tokens'
import {
  formatRecord,
  groupByMuscle,
  matchesQuery,
  muscleGroupLabel,
  sortSummaries,
  useExerciseSummaries,
  useWeightUnit,
} from './data'

export interface ExercisePickerSheetProps {
  readonly visible?: boolean
  /** Уже выбранные упражнения: шит открывается с ними отмеченными. */
  readonly selectedIds?: readonly Id[]
  readonly onDone: (ids: readonly Id[]) => void
  readonly onClose?: () => void
  readonly onCreateExercise?: () => void
}

/**
 * Экран «13 · Выбор упражнений»: модальный шит поверх черновика программы.
 * Порядок выбора сохраняется — он же станет порядком упражнений в программе.
 */
export function ExercisePickerSheet({
  visible = true,
  selectedIds = [],
  onDone,
  onClose,
  onCreateExercise,
}: ExercisePickerSheetProps) {
  const { colors } = useTheme()
  const { t, locale } = useT()
  const unit = useWeightUnit()

  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<readonly Id[]>(selectedIds)

  // при каждом открытии шит показывает текущий состав программы, а не прошлый выбор
  useEffect(() => {
    if (visible) setSelected(selectedIds)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible])

  const exercises = useExerciseSummaries()

  const sections = useMemo(() => {
    const found = (exercises.data ?? []).filter((summary) => matchesQuery(summary.exercise.name, query))
    return groupByMuscle(sortSummaries(found, 'alphabet'))
  }, [exercises.data, query])

  if (!visible) return null

  const toggle = (id: Id) => {
    setSelected((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    )
  }

  return (
    <View testID="exercise-picker" style={styles.overlay}>
      <Pressable
        testID="exercise-picker-scrim"
        accessibilityRole="button"
        accessibilityLabel={t('common.cancel')}
        onPress={onClose}
        style={[styles.scrim, { backgroundColor: colors.textPrimary }]}
      />

      <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
        <View style={styles.handleRow}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
        </View>

        <View style={styles.titleRow}>
          <View style={styles.titleLeft}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>{t('library.addExercises')}</Text>
            <View
              testID="exercise-picker-counter"
              accessibilityLabel={t('library.selected', { count: selected.length })}
              style={[styles.counter, { backgroundColor: colors.accentSoft }]}
            >
              <Text style={[styles.counterLabel, { color: colors.accent }]}>{selected.length}</Text>
            </View>
          </View>

          <Pressable
            testID="exercise-picker-done"
            accessibilityRole="button"
            onPress={() => onDone(selected)}
          >
            <Text style={[styles.done, { color: colors.accent }]}>{t('common.done')}</Text>
          </Pressable>
        </View>

        <View style={[styles.searchField, { backgroundColor: colors.surface2 }]}>
          <Icon name="search" size={17} color={colors.textMuted} />
          <TextInput
            testID="exercise-picker-search"
            value={query}
            onChangeText={setQuery}
            placeholder={t('library.searchInLibrary')}
            placeholderTextColor={colors.textMuted}
            style={[styles.searchInput, { color: colors.textPrimary }]}
          />
        </View>

        <ScrollView contentContainerStyle={styles.list}>
          {sections.map((section) => (
            <View key={section.group} style={styles.group}>
              <Text
                testID={`picker-group-${section.group}`}
                style={[styles.caption, { color: colors.textMuted }]}
              >
                {muscleGroupLabel(section.group, t).toUpperCase()}
              </Text>

              <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                {section.items.map((summary, index) => {
                  const checked = selected.includes(summary.exercise.id)
                  return (
                    <View key={summary.exercise.id}>
                      {index > 0 ? <View style={[styles.divider, { backgroundColor: colors.border }]} /> : null}
                      <Pressable
                        testID={`exercise-row-${summary.exercise.name}`}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked }}
                        onPress={() => toggle(summary.exercise.id)}
                        style={styles.row}
                      >
                        <View
                          style={[
                            styles.checkbox,
                            checked
                              ? { backgroundColor: colors.accent, borderColor: colors.accent }
                              : { borderColor: colors.border },
                          ]}
                        >
                          {checked ? <Icon name="check" size={14} color={colors.onAccent} /> : null}
                        </View>

                        <Text style={[styles.name, { color: colors.textPrimary }]}>{summary.exercise.name}</Text>
                        <Text style={[styles.value, { color: colors.textMuted }]}>
                          {formatRecord(summary, unit, locale)}
                        </Text>
                      </Pressable>
                    </View>
                  )
                })}
              </View>
            </View>
          ))}

          <Pressable
            testID="exercise-picker-create"
            accessibilityRole="button"
            onPress={onCreateExercise}
            style={[styles.createNew, { backgroundColor: colors.accentSoft }]}
          >
            <Icon name="plus" size={16} color={colors.accent} />
            <Text style={[styles.createNewLabel, { color: colors.accent }]}>{t('library.notFound')}</Text>
          </Pressable>
        </ScrollView>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end' },
  // затемнение из макета — тот же тёмный тон, что и основной текст, с прозрачностью
  scrim: { ...StyleSheet.absoluteFillObject, opacity: 0.7 },
  sheet: {
    maxHeight: '80%',
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    gap: 14,
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  handleRow: { alignItems: 'center' },
  handle: { width: 40, height: 4, borderRadius: radii.pill },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  titleLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 18, fontFamily: uiFont('700'), fontWeight: '700' },
  counter: { borderRadius: radii.pill, paddingVertical: 3, paddingHorizontal: 8 },
  counterLabel: { fontSize: 11, fontFamily: numFont('700'), fontWeight: '700' },
  done: { fontSize: 14, fontFamily: uiFont('600'), fontWeight: '600' },

  searchField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: radii.md,
    paddingVertical: 11,
    paddingHorizontal: 13,
  },
  searchInput: { flex: 1, fontSize: 14, fontFamily: uiFont('500'), fontWeight: '500', padding: 0 },

  list: { gap: 14, paddingBottom: 4 },
  group: { gap: 8 },
  caption: { fontSize: 11, fontFamily: uiFont('700'), fontWeight: '700', letterSpacing: 0.6 },
  card: { borderRadius: radii.lg, borderWidth: 1, overflow: 'hidden' },
  divider: { height: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 11, paddingHorizontal: 13 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { flex: 1, fontSize: 14, fontFamily: uiFont('500'), fontWeight: '500' },
  // рекорд в строке — числовая гарнитура ($font-num в макете)
  value: { fontSize: 12, fontFamily: numFont('600'), fontWeight: '600' },

  createNew: {
    flexDirection: 'row',
    gap: 8,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  createNewLabel: { fontSize: 13, fontFamily: uiFont('600'), fontWeight: '600' },
})
