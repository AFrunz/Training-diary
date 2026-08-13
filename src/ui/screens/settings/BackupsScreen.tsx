import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import type { Instant } from '../../../domain/model/types'
import { toLocalDate } from '../../../domain/rules/dates'
import { EMPTY_VALUE } from '../../../domain/rules/format'
import { Icon } from '../../components/Icon'
import { ScreenHeader } from '../../components/ScreenHeader'
import type { TranslationKey } from '../../i18n/dictionaries'
import { useT } from '../../i18n/I18nProvider'
import { useServices } from '../../providers/ServicesProvider'
import { useTheme } from '../../theme/ThemeProvider'
import { radii, uiFont } from '../../theme/tokens'
import { sortBackups } from './backups'

/**
 * Список автобэкапов (FR-7.3): что снято, когда и чем восстановиться.
 * Копии снимает сценарий `runBackup` при каждом запуске приложения и перед
 * импортом, здесь же копию можно снять руками.
 *
 * Восстановление заменяет текущие данные целиком, поэтому просит подтверждения
 * вторым нажатием — как удаление в опасной зоне настроек.
 */

export interface BackupsScreenProps {
  readonly onBack?: () => void
}

const BACKUPS_KEY = ['backups'] as const

const timeFormatters = new Map<string, Intl.DateTimeFormat>()

/** Время снятия в зоне устройства, круглосуточный формат из макета: 18:32. */
const formatClockTime = (at: Instant, timeZone: string): string => {
  let formatter = timeFormatters.get(timeZone)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
    timeFormatters.set(timeZone, formatter)
  }
  return formatter.format(new Date(at))
}

export function BackupsScreen({ onBack }: BackupsScreenProps) {
  const services = useServices()
  const queryClient = useQueryClient()
  const { colors } = useTheme()
  const { t } = useT()

  /** Имя копии, у которой уже нажали «восстановить»: ждём подтверждения. */
  const [armed, setArmed] = useState<string | null>(null)

  const backupsQuery = useQuery({
    queryKey: BACKUPS_KEY,
    queryFn: () => services.ports.files.listBackups(),
  })

  const backups = useMemo(() => sortBackups(backupsQuery.data ?? []), [backupsQuery.data])

  const create = useMutation({
    mutationFn: () => services.runBackup(),
    onSuccess: () => queryClient.invalidateQueries(),
  })

  const restore = useMutation({
    mutationFn: (fileName: string) => services.restoreBackup(fileName),
    onSuccess: async () => {
      setArmed(null)
      await queryClient.invalidateQueries()
    },
  })

  const askRestore = (fileName: string) => {
    if (armed !== fileName) {
      setArmed(fileName)
      return
    }
    restore.mutate(fileName)
  }

  const formatTaken = (at: Instant | null): { date: string; time: string } => {
    if (at === null) return { date: EMPTY_VALUE, time: EMPTY_VALUE }

    const localDate = toLocalDate(at, services.ports.timeZone)
    const month = Number(localDate.slice(5, 7))
    return {
      date: t('date.dayMonth', {
        day: Number(localDate.slice(8, 10)),
        month: t(`date.monthGenitive.${month}` as TranslationKey),
      }),
      time: formatClockTime(at, services.ports.timeZone),
    }
  }

  return (
    <View testID="backups-screen" style={[styles.root, { backgroundColor: colors.bg }]}>
      <ScreenHeader
        title={t('settings.backups')}
        subtitle={t('settings.backupsCount', { value: backups.length })}
        onBack={onBack}
      />

      <ScrollView contentContainerStyle={styles.body}>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {backups.map((backup, index) => {
            const taken = formatTaken(backup.takenAt)
            const waiting = armed === backup.fileName

            return (
              <View key={backup.fileName}>
                {index > 0 ? <View style={[styles.divider, { backgroundColor: colors.border }]} /> : null}

                <View testID={`backups-row-${index}`} style={styles.row}>
                  <View style={[styles.iconPlate, { backgroundColor: colors.surface2 }]}>
                    <Icon name="history" size={16} color={colors.textSecondary} />
                  </View>

                  <View style={styles.rowTexts}>
                    <Text testID={`backups-row-${index}-date`} style={[styles.rowTitle, { color: colors.textPrimary }]}>
                      {taken.date}
                    </Text>
                    <Text
                      testID={`backups-row-${index}-subtitle`}
                      style={[styles.rowSubtitle, { color: waiting ? colors.danger : colors.textMuted }]}
                    >
                      {waiting ? t('settings.wipeConfirm') : taken.time}
                    </Text>
                  </View>

                  <Pressable
                    testID={`backups-restore-${index}`}
                    accessibilityRole="button"
                    onPress={() => askRestore(backup.fileName)}
                    style={[styles.action, { backgroundColor: colors.surface2 }]}
                  >
                    <Text
                      style={[styles.actionLabel, { color: waiting ? colors.danger : colors.textSecondary }]}
                    >
                      {t('settings.restore')}
                    </Text>
                  </Pressable>
                </View>
              </View>
            )
          })}

          {!backupsQuery.isPending && backups.length === 0 ? (
            <View testID="backups-empty" style={styles.empty}>
              <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>{t('settings.backupsEmpty')}</Text>
              <Text style={[styles.emptyHint, { color: colors.textMuted }]}>{t('settings.backupsEmptyHint')}</Text>
            </View>
          ) : null}
        </View>

        <Pressable
          testID="backups-create"
          accessibilityRole="button"
          accessibilityState={{ disabled: create.isPending }}
          disabled={create.isPending}
          onPress={() => create.mutate()}
          style={[styles.button, { backgroundColor: colors.accent }]}
        >
          <Text style={[styles.buttonLabel, { color: colors.onAccent }]}>{t('settings.backupNow')}</Text>
        </Pressable>

        <Text style={[styles.footer, { color: colors.textMuted }]}>{t('settings.backupsHint')}</Text>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { paddingHorizontal: 16, paddingBottom: 24, gap: 14 },

  card: { borderRadius: radii.lg, borderWidth: 1, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 14 },
  iconPlate: { width: 30, height: 30, borderRadius: radii.sm, alignItems: 'center', justifyContent: 'center' },
  rowTexts: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 15, fontWeight: '500', fontFamily: uiFont('500') },
  rowSubtitle: { fontSize: 11, fontFamily: uiFont() },
  divider: { height: 1 },

  action: { borderRadius: radii.sm, paddingVertical: 7, paddingHorizontal: 11 },
  actionLabel: { fontSize: 12, fontWeight: '600', fontFamily: uiFont('600') },

  empty: { paddingVertical: 28, paddingHorizontal: 20, gap: 6, alignItems: 'center' },
  emptyTitle: { fontSize: 15, fontWeight: '600', fontFamily: uiFont('600') },
  emptyHint: { fontSize: 11, fontWeight: '500', fontFamily: uiFont('500'), textAlign: 'center' },

  button: { borderRadius: radii.md, paddingVertical: 14, alignItems: 'center' },
  buttonLabel: { fontSize: 15, fontWeight: '700', fontFamily: uiFont('700') },
  footer: { fontSize: 11, fontFamily: uiFont(), textAlign: 'center' },
})
