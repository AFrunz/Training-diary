import { useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import type { Id } from '../../../domain/model/types'
import { Chip } from '../../components/Chip'
import { useT } from '../../i18n/I18nProvider'
import { useTheme } from '../../theme/ThemeProvider'
import { programColors, radii } from '../../theme/tokens'
import type { SortMode } from './data'
import {
  formatRecord,
  formatShortDate,
  groupByMuscle,
  matchesQuery,
  muscleGroupLabel,
  sortSummaries,
  useExerciseSummaries,
  useProgramSummaries,
  useWeightUnit,
} from './data'

export type LibraryTab = 'exercises' | 'programs'

export interface LibraryScreenProps {
  readonly onCreateExercise?: () => void
  readonly onCreateProgram?: () => void
  readonly onOpenExercise?: (id: Id) => void
  readonly onOpenProgram?: (id: Id) => void
}

const SORT_MODES: readonly SortMode[] = ['alphabet', 'frequency', 'date']

const SORT_LABELS = {
  alphabet: 'library.sortAlphabet',
  frequency: 'library.sortFrequency',
  date: 'library.sortDate',
} as const

/** Экран «06 · Библиотека»: упражнения и программы под одним сегмент-контролом. */
export function LibraryScreen({
  onCreateExercise,
  onCreateProgram,
  onOpenExercise,
  onOpenProgram,
}: LibraryScreenProps) {
  const { colors } = useTheme()
  const { t, count, locale } = useT()
  const unit = useWeightUnit()

  const [tab, setTab] = useState<LibraryTab>('exercises')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortMode>('alphabet')

  const exercises = useExerciseSummaries()
  const programs = useProgramSummaries()

  const sections = useMemo(() => {
    const all = exercises.data ?? []
    const found = all.filter((summary) => matchesQuery(summary.exercise.name, query))
    return groupByMuscle(sortSummaries(found, sort))
  }, [exercises.data, query, sort])

  const foundPrograms = useMemo(
    () => (programs.data ?? []).filter((summary) => matchesQuery(summary.program.name, query)),
    [programs.data, query],
  )

  const isExercises = tab === 'exercises'
  const total = isExercises ? (exercises.data ?? []).length : (programs.data ?? []).length
  const shown = isExercises ? sections.length : foundPrograms.length

  const emptyTitle = query.trim().length > 0 && total > 0
    ? t('library.nothingFound')
    : isExercises
      ? t('library.emptyExercises')
      : t('library.emptyPrograms')

  const emptyHint = query.trim().length > 0 && total > 0
    ? t('library.nothingFoundHint')
    : isExercises
      ? t('library.emptyExercisesHint')
      : t('library.emptyProgramsHint')

  const segment = (value: LibraryTab, label: string, testID: string) => {
    const active = tab === value
    return (
      <Pressable
        testID={testID}
        accessibilityRole="tab"
        accessibilityState={{ selected: active }}
        onPress={() => setTab(value)}
        style={[styles.segment, active && { backgroundColor: colors.surface }]}
      >
        <Text
          style={[
            styles.segmentLabel,
            { color: active ? colors.textPrimary : colors.textSecondary, fontWeight: active ? '600' : '500' },
          ]}
        >
          {label}
        </Text>
      </Pressable>
    )
  }

  return (
    <View testID="library-screen" style={[styles.root, { backgroundColor: colors.bg }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{t('library.title')}</Text>
        <Pressable
          testID="add-button"
          accessibilityRole="button"
          accessibilityLabel={isExercises ? t('exercise.new') : t('program.new')}
          onPress={isExercises ? onCreateExercise : onCreateProgram}
          style={[styles.addButton, { backgroundColor: colors.accent }]}
        >
          <Text style={[styles.addIcon, { color: colors.onAccent }]}>＋</Text>
        </Pressable>
      </View>

      <View style={styles.segmentWrap}>
        <View style={[styles.segmented, { backgroundColor: colors.surface2 }]}>
          {segment('exercises', t('library.exercises'), 'library-segment-exercises')}
          {segment('programs', t('library.programs'), 'library-segment-programs')}
        </View>
      </View>

      <View style={styles.searchWrap}>
        <View style={[styles.searchField, { backgroundColor: colors.surface2 }]}>
          <Text style={[styles.searchIcon, { color: colors.textMuted }]}>⌕</Text>
          <TextInput
            testID="library-search"
            value={query}
            onChangeText={setQuery}
            placeholder={t('library.search')}
            placeholderTextColor={colors.textMuted}
            style={[styles.searchInput, { color: colors.textPrimary }]}
          />
        </View>
      </View>

      {isExercises ? (
        <View style={styles.sortChips}>
          {SORT_MODES.map((mode) => (
            <Chip
              key={mode}
              testID={`library-sort-${mode}`}
              label={t(SORT_LABELS[mode])}
              selected={sort === mode}
              onPress={() => setSort(mode)}
            />
          ))}
        </View>
      ) : null}

      <ScrollView contentContainerStyle={styles.list}>
        {shown === 0 ? (
          <View testID="library-empty" style={[styles.empty, { backgroundColor: colors.surface2 }]}>
            <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>{emptyTitle}</Text>
            <Text style={[styles.emptyHint, { color: colors.textMuted }]}>{emptyHint}</Text>
          </View>
        ) : null}

        {isExercises
          ? sections.map((section) => (
              <View key={section.group} style={styles.group}>
                <Text
                  testID={`library-group-${section.group}`}
                  style={[styles.groupTitle, { color: colors.textMuted }]}
                >
                  {muscleGroupLabel(section.group, t).toUpperCase()}
                </Text>

                <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  {section.items.map((summary, index) => (
                    <View key={summary.exercise.id}>
                      {index > 0 ? <View style={[styles.divider, { backgroundColor: colors.border }]} /> : null}
                      <Pressable
                        testID={`exercise-row-${summary.exercise.name}`}
                        accessibilityRole="button"
                        onPress={() => onOpenExercise?.(summary.exercise.id)}
                        style={styles.row}
                      >
                        <View style={styles.rowInfo}>
                          <Text style={[styles.rowName, { color: colors.textPrimary }]}>
                            {summary.exercise.name}
                          </Text>
                          {summary.lastDate ? (
                            <Text style={[styles.rowMeta, { color: colors.textMuted }]}>
                              {t('library.lastTime', { date: formatShortDate(summary.lastDate, t) })}
                            </Text>
                          ) : null}
                        </View>

                        <View style={styles.rowRecord}>
                          <Text style={[styles.rowValue, { color: colors.textPrimary }]}>
                            {formatRecord(summary, unit, locale)}
                          </Text>
                          <Text style={[styles.chevron, { color: colors.textMuted }]}>›</Text>
                        </View>
                      </Pressable>
                    </View>
                  ))}
                </View>
              </View>
            ))
          : null}

        {!isExercises && foundPrograms.length > 0 ? (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {foundPrograms.map((summary, index) => (
              <View key={summary.program.id}>
                {index > 0 ? <View style={[styles.divider, { backgroundColor: colors.border }]} /> : null}
                <Pressable
                  testID={`program-row-${summary.program.name}`}
                  accessibilityRole="button"
                  onPress={() => onOpenProgram?.(summary.program.id)}
                  style={styles.row}
                >
                  <View style={styles.programInfo}>
                    <View
                      testID={`program-dot-${summary.program.name}`}
                      style={[
                        styles.dot,
                        {
                          backgroundColor:
                            programColors[summary.program.color as keyof typeof programColors] ?? colors.accent,
                        },
                      ]}
                    />
                    <Text style={[styles.rowName, { color: colors.textPrimary }]}>{summary.program.name}</Text>
                  </View>

                  <View style={styles.rowRecord}>
                    <Text style={[styles.rowMeta, { color: colors.textMuted }]}>
                      {count('exercises', summary.exerciseCount)}
                    </Text>
                    <Text style={[styles.chevron, { color: colors.textMuted }]}>›</Text>
                  </View>
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  title: { fontSize: 26, fontWeight: '700' },
  addButton: { width: 36, height: 36, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center' },
  addIcon: { fontSize: 17, fontWeight: '600' },

  segmentWrap: { paddingHorizontal: 20, paddingBottom: 10 },
  segmented: { flexDirection: 'row', gap: 2, padding: 3, borderRadius: radii.sm },
  segment: { flex: 1, borderRadius: 7, paddingVertical: 7, alignItems: 'center', justifyContent: 'center' },
  segmentLabel: { fontSize: 13 },

  searchWrap: { paddingHorizontal: 20, paddingBottom: 10 },
  searchField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: radii.md,
    paddingVertical: 11,
    paddingHorizontal: 13,
  },
  searchIcon: { fontSize: 15 },
  searchInput: { flex: 1, fontSize: 14, fontWeight: '500', padding: 0 },

  sortChips: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingBottom: 12 },

  list: { paddingHorizontal: 20, paddingBottom: 24, gap: 12 },
  group: { gap: 6 },
  groupTitle: { fontSize: 12, fontWeight: '700', letterSpacing: 0.6 },
  card: { borderRadius: radii.lg, borderWidth: 1, overflow: 'hidden' },
  divider: { height: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    paddingHorizontal: 14,
  },
  rowInfo: { flex: 1, gap: 3 },
  programInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 10, height: 10, borderRadius: radii.pill },
  rowName: { fontSize: 15, fontWeight: '500' },
  rowMeta: { fontSize: 11, fontWeight: '500' },
  rowRecord: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowValue: { fontSize: 14, fontWeight: '600' },
  chevron: { fontSize: 17 },

  empty: { borderRadius: radii.lg, alignItems: 'center', gap: 8, paddingVertical: 26, paddingHorizontal: 20 },
  emptyTitle: { fontSize: 14, fontWeight: '600' },
  emptyHint: { fontSize: 11, fontWeight: '500', textAlign: 'center' },
})
