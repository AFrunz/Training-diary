import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import type { Id } from '../../../domain/model/types'
import { validateExerciseName } from '../../../domain/validation/rules'
import type { ValidationCode } from '../../../domain/validation/rules'
import { Icon } from '../../components/Icon'
import { ScreenHeader } from '../../components/ScreenHeader'
import type { TranslationKey } from '../../i18n/dictionaries'
import { useT } from '../../i18n/I18nProvider'
import { useServices } from '../../providers/ServicesProvider'
import { useTheme } from '../../theme/ThemeProvider'
import { radii, uiFont } from '../../theme/tokens'
import type { MuscleGroupKey } from './data'
import { MUSCLE_GROUPS, muscleGroupLabel } from './data'

export interface NewExerciseScreenProps {
  readonly onBack?: () => void
  readonly onCreated?: (id: Id) => void
}

/** Чипы групп мышц идут двумя рядами, как в макете. */
const CHIP_ROWS: readonly (readonly MuscleGroupKey[])[] = [
  MUSCLE_GROUPS.slice(0, 4),
  MUSCLE_GROUPS.slice(4),
]

const ERROR_KEYS: Partial<Record<ValidationCode, TranslationKey>> = {
  'name-duplicate': 'validation.nameDuplicate',
  'name-too-long': 'validation.nameTooLong',
}

/**
 * Экран «12 · Новое упражнение» (FR-2.1.1): дубликат подсвечивается прямо при
 * вводе, до попытки сохранить.
 */
export function NewExerciseScreen({ onBack, onCreated }: NewExerciseScreenProps) {
  const { colors } = useTheme()
  const { t } = useT()
  const services = useServices()

  const [name, setName] = useState('')
  const [group, setGroup] = useState<MuscleGroupKey | null>(null)
  const [note, setNote] = useState('')

  // архивные упражнения тоже занимают имя, поэтому список берётся вместе с ними
  const existing = useQuery({
    queryKey: ['library', 'exercise-names'],
    queryFn: async () => {
      const list = await services.ports.exercises.list({ includeArchived: true })
      return list.map((exercise) => exercise.name)
    },
  })

  const typed = name.trim().length > 0
  const check = validateExerciseName(name, existing.data ?? [])
  const errorKey = check.ok ? null : ERROR_KEYS[check.code] ?? null

  /** Запись мутацией: общий обработчик кэша сбрасывает его целиком (см. mutations.test.ts). */
  const createExercise = useMutation({
    mutationFn: () =>
      services.createExercise({
        name,
        muscleGroup: group,
        note: note.trim().length > 0 ? note.trim() : null,
      }),
    onSuccess: (id) => onCreated?.(id),
  })

  const canCreate = check.ok && !createExercise.isPending

  const create = () => {
    if (!canCreate) return
    createExercise.mutate()
  }

  return (
    <View testID="new-exercise-screen" style={[styles.root, { backgroundColor: colors.bg }]}>
      <ScreenHeader title={t('exercise.new')} onBack={onBack} />

      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.textMuted }]}>{t('exercise.name')}</Text>
          <View style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.accent }]}>
            <TextInput
              testID="name-input"
              value={name}
              onChangeText={setName}
              autoFocus
              placeholder={t('exercise.namePlaceholder')}
              placeholderTextColor={colors.textMuted}
              style={[styles.inputText, { color: colors.textPrimary }]}
            />
          </View>

          {typed && check.ok ? (
            <View testID="name-free" style={styles.validation}>
              <Icon name="circle-check" size={14} color={colors.success} />
              <Text style={[styles.validationText, { color: colors.success }]}>{t('exercise.nameFree')}</Text>
            </View>
          ) : null}

          {typed && errorKey ? (
            <View testID="name-error" style={styles.validation}>
              {/* зеркало «имя свободно»: тот же размер, но крестик и красный тон */}
              <Icon name="x" size={14} color={colors.danger} />
              <Text style={[styles.validationText, { color: colors.danger }]}>{t(errorKey)}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.groupField}>
          <Text style={[styles.label, { color: colors.textMuted }]}>{t('exercise.muscleGroup')}</Text>
          {CHIP_ROWS.map((row, index) => (
            <View key={index} style={styles.chipRow}>
              {row.map((key) => {
                const selected = group === key
                return (
                  <Pressable
                    key={key}
                    testID={`muscle-group-${key}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => setGroup(selected ? null : key)}
                    style={[
                      styles.chip,
                      { backgroundColor: selected ? colors.textPrimary : colors.surface2 },
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipLabel,
                        {
                          color: selected ? colors.bg : colors.textSecondary,
                          fontFamily: uiFont(selected ? '600' : '500'),
                          fontWeight: selected ? '600' : '500',
                        },
                      ]}
                    >
                      {muscleGroupLabel(key, t)}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
          ))}
        </View>

        <View style={styles.field}>
          <View style={styles.labelRow}>
            <Text style={[styles.label, { color: colors.textMuted }]}>{t('exercise.note')}</Text>
            <Text style={[styles.optional, { color: colors.textMuted }]}>{t('exercise.noteOptional')}</Text>
          </View>
          <View style={[styles.textarea, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <TextInput
              testID="note-input"
              value={note}
              onChangeText={setNote}
              multiline
              placeholder={t('exercise.notePlaceholder')}
              placeholderTextColor={colors.textMuted}
              style={[styles.textareaText, { color: colors.textPrimary }]}
            />
          </View>
        </View>

        <View style={[styles.noteRow, { backgroundColor: colors.surface2 }]}>
          <Icon name="info" size={15} color={colors.textMuted} />
          <Text style={[styles.noteText, { color: colors.textSecondary }]}>{t('exercise.weightHint')}</Text>
        </View>
      </ScrollView>

      <View style={[styles.bottomBar, { borderTopColor: colors.border }]}>
        <Pressable
          testID="create-button"
          accessibilityRole="button"
          accessibilityState={{ disabled: !canCreate }}
          disabled={!canCreate}
          onPress={create}
          style={[styles.createButton, { backgroundColor: canCreate ? colors.accent : colors.surface2 }]}
        >
          <Text style={[styles.createLabel, { color: canCreate ? colors.onAccent : colors.textMuted }]}>
            {t('exercise.create')}
          </Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { gap: 22, paddingTop: 6, paddingHorizontal: 20, paddingBottom: 24 },
  field: { gap: 7 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: { fontSize: 12, fontFamily: uiFont('600'), fontWeight: '600' },
  optional: { fontSize: 11, fontFamily: uiFont('500'), fontWeight: '500' },
  input: { borderRadius: radii.md, borderWidth: 1.5, paddingVertical: 13, paddingHorizontal: 14 },
  inputText: { fontSize: 15, fontFamily: uiFont('500'), fontWeight: '500', padding: 0 },
  validation: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  validationText: { fontSize: 11, fontFamily: uiFont('500'), fontWeight: '500' },

  groupField: { gap: 9 },
  chipRow: { flexDirection: 'row', gap: 7 },
  chip: { borderRadius: radii.pill, paddingVertical: 7, paddingHorizontal: 12 },
  chipLabel: { fontSize: 13 },

  textarea: { height: 84, borderRadius: radii.md, borderWidth: 1, padding: 13 },
  textareaText: {
    flex: 1,
    fontSize: 13,
    fontFamily: uiFont('500'),
    fontWeight: '500',
    padding: 0,
    textAlignVertical: 'top',
  },

  noteRow: { flexDirection: 'row', gap: 8, borderRadius: radii.md, padding: 12 },
  noteText: { flex: 1, fontSize: 11, fontFamily: uiFont('500'), fontWeight: '500', lineHeight: 15 },

  bottomBar: { borderTopWidth: 1, paddingTop: 14, paddingHorizontal: 20, paddingBottom: 20 },
  createButton: { borderRadius: radii.md, alignItems: 'center', justifyContent: 'center', paddingVertical: 14 },
  createLabel: { fontSize: 15, fontFamily: uiFont('700'), fontWeight: '700' },
})
