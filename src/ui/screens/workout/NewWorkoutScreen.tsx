import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { WorkoutDateTaken } from '../../../domain/errors'
import type { Id, LocalDate } from '../../../domain/model/types'
import { useT } from '../../i18n/I18nProvider'
import { useServices } from '../../providers/ServicesProvider'
import { ScreenHeader } from '../../components/ScreenHeader'
import { useTheme } from '../../theme/ThemeProvider'
import { programColors, radii, uiFont } from '../../theme/tokens'

export interface NewWorkoutScreenProps {
  /** Дата тренировки; по умолчанию сегодня (FR-4.1). */
  readonly date: LocalDate
  readonly onBack?: () => void
  readonly onCreated?: (workoutId: Id) => void
  /** Дата занята: экран предлагает открыть существующую тренировку (FR-1.3). */
  readonly onOpenExisting?: (workoutId: Id) => void
}

/**
 * Выбор программы для новой тренировки. Отдельного фрейма в макете нет:
 * это шаг между кнопкой добавления и экраном тренировки.
 */
export function NewWorkoutScreen({ date, onBack, onCreated, onOpenExisting }: NewWorkoutScreenProps) {
  const { colors } = useTheme()
  const { t, count } = useT()
  const services = useServices()
  const [taken, setTaken] = useState<Id | null>(null)

  const { data: programs = [] } = useQuery({
    queryKey: ['programs'],
    queryFn: () => services.ports.programs.list(),
  })

  const create = useMutation({
    mutationFn: (programId: Id) => services.createWorkout({ date, programId }),
    onSuccess: (workoutId) => onCreated?.(workoutId),
    onError: (error) => {
      if (error instanceof WorkoutDateTaken) {
        setTaken(error.existingId)
        return
      }
      throw error
    },
  })

  return (
    <View testID="new-workout-screen" style={[styles.root, { backgroundColor: colors.bg }]}>
      <ScreenHeader title={t('workout.chooseProgram')} subtitle={date} onBack={onBack} />

      {taken ? (
        <View style={[styles.notice, { backgroundColor: colors.accentSoft }]}>
          <Text style={[styles.noticeText, { color: colors.textPrimary }]}>{t('workout.dateTaken')}</Text>
          <Pressable testID="open-existing" onPress={() => onOpenExisting?.(taken)}>
            <Text style={[styles.noticeAction, { color: colors.accent }]}>{t('workout.openExisting')}</Text>
          </Pressable>
        </View>
      ) : null}

      <ScrollView contentContainerStyle={styles.list}>
        {programs.map((program) => (
          <Pressable
            key={program.id}
            testID={`program-option-${program.name}`}
            onPress={() => create.mutate(program.id)}
            style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <View
              style={[
                styles.dot,
                { backgroundColor: programColors[program.color as keyof typeof programColors] ?? colors.accent },
              ]}
            />
            <Text style={[styles.name, { color: colors.textPrimary }]}>{program.name}</Text>
          </Pressable>
        ))}

        {programs.length === 0 ? (
          <Text testID="new-workout-empty" style={[styles.empty, { color: colors.textMuted }]}>
            {t('program.empty')}
          </Text>
        ) : null}
      </ScrollView>

      <Text style={[styles.hint, { color: colors.textMuted }]}>
        {count('exercises', programs.length)}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  list: { padding: 20, gap: 10 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: 16,
  },
  dot: { width: 10, height: 10, borderRadius: radii.pill },
  name: { fontFamily: uiFont('600'), fontSize: 16, fontWeight: '600' },
  empty: { fontFamily: uiFont('500'), fontSize: 13, fontWeight: '500', textAlign: 'center', paddingVertical: 24 },
  notice: { marginHorizontal: 20, borderRadius: radii.md, padding: 14, gap: 6 },
  noticeText: { fontFamily: uiFont('600'), fontSize: 13, fontWeight: '600' },
  noticeAction: { fontFamily: uiFont('700'), fontSize: 13, fontWeight: '700' },
  hint: { fontFamily: uiFont('500'), fontSize: 11, fontWeight: '500', textAlign: 'center', paddingBottom: 20 },
})
