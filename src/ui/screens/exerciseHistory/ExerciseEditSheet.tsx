import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import type { Exercise } from '../../../domain/model/entities'
import { BottomSheet } from '../../components/BottomSheet'
import { Icon } from '../../components/Icon'
import { useT } from '../../i18n/I18nProvider'
import { useServices } from '../../providers/ServicesProvider'
import { useTheme } from '../../theme/ThemeProvider'
import { radii, uiFont } from '../../theme/tokens'
import { MUSCLE_GROUPS, muscleGroupLabel } from '../library/data'
import type { MuscleGroupKey } from '../library/data'

/**
 * Правка упражнения (FR-2.5): название и группа мышц.
 *
 * Удаление отсюда только запрашивается — подтверждение показывает экран:
 * диалог поверх шторки на Android выглядит как окно в окне.
 */

export interface ExerciseEditSheetProps {
  readonly exercise: Exercise
  readonly onRequestDelete: () => void
  readonly onClose: () => void
}

const CHIP_ROWS: readonly (readonly MuscleGroupKey[])[] = [
  MUSCLE_GROUPS.slice(0, 4),
  MUSCLE_GROUPS.slice(4),
]

export function ExerciseEditSheet({ exercise, onRequestDelete, onClose }: ExerciseEditSheetProps) {
  const services = useServices()
  const { colors } = useTheme()
  const { t } = useT()

  const [name, setName] = useState(exercise.name)
  const [group, setGroup] = useState<string | null>(exercise.muscleGroup ?? null)

  const save = useMutation({
    mutationFn: () => services.editExercise({ exerciseId: exercise.id, name, muscleGroup: group }),
    onSuccess: onClose,
  })

  const canSave = name.trim().length > 0

  return (
    <BottomSheet visible onClose={onClose} testID="exercise-edit-sheet">
      <Text style={[styles.title, { color: colors.textPrimary }]}>{t('exercise.edit')}</Text>

      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.textMuted }]}>{t('exercise.name')}</Text>
        <TextInput
          testID="exercise-name-input"
          value={name}
          onChangeText={setName}
          placeholder={t('exercise.namePlaceholder')}
          placeholderTextColor={colors.textMuted}
          style={[
            styles.input,
            { backgroundColor: colors.surface2, borderColor: colors.border, color: colors.textPrimary },
          ]}
        />
      </View>

      <View style={styles.field}>
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

      <View style={styles.actions}>
        <Pressable
          testID="exercise-delete"
          accessibilityRole="button"
          onPress={onRequestDelete}
          style={[styles.deleteButton, { borderColor: colors.danger }]}
        >
          <Icon name="trash-2" size={15} color={colors.danger} />
          <Text style={[styles.deleteLabel, { color: colors.danger }]}>{t('common.delete')}</Text>
        </Pressable>

        <Pressable
          testID="exercise-save"
          accessibilityRole="button"
          accessibilityState={{ disabled: !canSave }}
          disabled={!canSave || save.isPending}
          onPress={() => save.mutate()}
          style={[styles.submit, { backgroundColor: colors.accent, opacity: canSave ? 1 : 0.5 }]}
        >
          <Text style={[styles.submitLabel, { color: colors.onAccent }]}>{t('common.save')}</Text>
        </Pressable>
      </View>
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  title: { fontFamily: uiFont('700'), fontSize: 18, fontWeight: '700' },
  field: { gap: 8 },
  label: { fontFamily: uiFont('500'), fontSize: 11, fontWeight: '500' },
  input: {
    borderRadius: radii.md,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 15,
    fontFamily: uiFont('600'),
    fontWeight: '600',
  },
  chipRow: { flexDirection: 'row', gap: 8 },
  chip: { flex: 1, borderRadius: radii.pill, paddingVertical: 8, alignItems: 'center' },
  chipLabel: { fontSize: 12 },
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
