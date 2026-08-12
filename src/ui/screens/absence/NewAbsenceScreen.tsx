import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { ValidationFailed } from '../../../domain/errors'
import type { AbsenceType } from '../../../domain/model/entities'
import type { Id, LocalDate } from '../../../domain/model/types'
import { localDate } from '../../../domain/model/types'
import { addDays, daysBetween } from '../../../domain/rules/dates'
import { Chip } from '../../components/Chip'
import { ScreenHeader } from '../../components/ScreenHeader'
import { useT } from '../../i18n/I18nProvider'
import { useServices } from '../../providers/ServicesProvider'
import { useTheme } from '../../theme/ThemeProvider'
import { radii } from '../../theme/tokens'

export interface NewAbsenceScreenProps {
  /** День, с которого начали заводить отсутствие: календарь передаёт выбранный. */
  readonly date: LocalDate
  readonly onBack?: () => void
  readonly onCreated?: (absenceId: Id) => void
}

const TYPES: readonly AbsenceType[] = ['vacation', 'illness', 'injury', 'other']

/** Заведение отпуска или другого запланированного отсутствия (FR-1.6). */
export function NewAbsenceScreen({ date, onBack, onCreated }: NewAbsenceScreenProps) {
  const { colors } = useTheme()
  const { t, count } = useT()
  const services = useServices()
  const queryClient = useQueryClient()

  const [type, setType] = useState<AbsenceType>('vacation')
  const [from, setFrom] = useState<string>(date)
  const [to, setTo] = useState<string>(addDays(date, 6))
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  const length = isDate(from) && isDate(to) ? daysBetween(localDate(from), localDate(to)) + 1 : null

  const save = useMutation({
    mutationFn: async () => {
      setError(null)
      return services.createAbsence({
        startDate: localDate(from),
        endDate: localDate(to),
        type,
        note: note.trim() || null,
      })
    },
    onSuccess: async (absenceId) => {
      await queryClient.invalidateQueries()
      onCreated?.(absenceId)
    },
    onError: (failure) => {
      if (failure instanceof ValidationFailed) {
        setError(failure.code === 'range-inverted' ? t('absence.errorInverted') : t('absence.errorTooLong'))
        return
      }
      throw failure
    },
  })

  const canSave = isDate(from) && isDate(to)

  return (
    <View testID="new-absence-screen" style={[styles.root, { backgroundColor: colors.bg }]}>
      <ScreenHeader title={t('absence.new')} onBack={onBack} />

      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.textMuted }]}>{t('absence.type')}</Text>
          <View style={styles.chips}>
            {TYPES.map((candidate) => (
              <Chip
                key={candidate}
                testID={`absence-type-${candidate}`}
                label={t(`calendar.absenceType.${candidate}`)}
                selected={candidate === type}
                onPress={() => setType(candidate)}
              />
            ))}
          </View>
        </View>

        <View style={styles.row}>
          <DateField
            testID="absence-start-date"
            label={t('absence.from')}
            value={from}
            onChange={setFrom}
          />
          <DateField testID="absence-end-date" label={t('absence.to')} value={to} onChange={setTo} />
        </View>

        {length !== null && length > 0 ? (
          <Text testID="absence-length" style={[styles.hint, { color: colors.textSecondary }]}>
            {count('days', length)} {t('absence.days')}
          </Text>
        ) : null}

        {error ? (
          <Text testID="absence-error" style={[styles.hint, { color: colors.danger }]}>
            {error}
          </Text>
        ) : null}

        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.textMuted }]}>{t('absence.note')}</Text>
          <TextInput
            testID="absence-note"
            value={note}
            onChangeText={setNote}
            placeholder={t('absence.notePlaceholder')}
            placeholderTextColor={colors.textMuted}
            style={[
              styles.input,
              { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary },
            ]}
          />
        </View>

        <Text style={[styles.hint, { color: colors.textMuted }]}>{t('absence.hint')}</Text>
      </ScrollView>

      <View style={[styles.bottom, { borderTopColor: colors.border }]}>
        <Pressable
          testID="absence-save"
          accessibilityRole="button"
          accessibilityState={{ disabled: !canSave }}
          disabled={!canSave}
          onPress={() => save.mutate()}
          style={[
            styles.button,
            { backgroundColor: canSave ? colors.accent : colors.surface2 },
          ]}
        >
          <Text style={[styles.buttonLabel, { color: canSave ? colors.onAccent : colors.textMuted }]}>
            {t('absence.create')}
          </Text>
        </Pressable>
      </View>
    </View>
  )
}

/** Дата вводится строкой `YYYY-MM-DD`: системного пикера в проекте пока нет. */
function DateField({
  testID,
  label,
  value,
  onChange,
}: {
  testID: string
  label: string
  value: string
  onChange: (next: string) => void
}) {
  const { colors } = useTheme()
  return (
    <View style={[styles.field, styles.grow]}>
      <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChange}
        autoCapitalize="none"
        keyboardType="numbers-and-punctuation"
        style={[
          styles.input,
          { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary },
        ]}
      />
    </View>
  )
}

const isDate = (value: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(value)

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { padding: 20, gap: 22 },
  field: { gap: 7 },
  grow: { flex: 1 },
  row: { flexDirection: 'row', gap: 12 },
  label: { fontSize: 12, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  input: { borderRadius: radii.md, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15 },
  hint: { fontSize: 11, fontWeight: '500', lineHeight: 15 },
  bottom: { padding: 20, borderTopWidth: 1 },
  button: { borderRadius: radii.md, paddingVertical: 14, alignItems: 'center' },
  buttonLabel: { fontSize: 15, fontWeight: '700' },
})
