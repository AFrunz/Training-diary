import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import type { LanguageMode, Settings, ThemeMode } from '../../../domain/model/entities'
import type { FirstDayOfWeek, WeightUnit } from '../../../domain/model/types'
import { toLocalDate } from '../../../domain/rules/dates'
import { Icon } from '../../components/Icon'
import type { IconName } from '../../components/Icon'
import { useT } from '../../i18n/I18nProvider'
import type { TranslationKey } from '../../i18n/dictionaries'
import { useServices } from '../../providers/ServicesProvider'
import { useTheme } from '../../theme/ThemeProvider'
import { radii, uiFont } from '../../theme/tokens'
import { WipeSlider } from './WipeSlider'

/**
 * Экран «10 · Настройки» из макета: секции «Данные», «Предпочтения»
 * и «Опасная зона» карточками со строками (FR-7.1 — FR-7.6).
 *
 * Настройки пишутся в порт сразу по нажатию. Тема и язык живут в провайдерах
 * над экраном, поэтому наружу отдаётся `onSettingsChange`: точка сборки передаёт
 * новое значение в ThemeProvider и I18nProvider.
 */

export interface SettingsScreenProps {
  /** Вызывается после записи настроек: корень приложения обновляет провайдеры. */
  readonly onSettingsChange?: (settings: Settings) => void
  /** Выбор файла живёт в infra, поэтому импорт запускается снаружи. */
  readonly onImportRequested?: () => void
  /** Переход к списку автобэкапов: навигация живёт в маршруте. */
  readonly onBackupsRequested?: () => void
  /** Удаление всех данных: вызывается только после протянутого ползунка. */
  readonly onWipeConfirmed?: () => void
  readonly version?: string
}

const SETTINGS_KEY = ['settings'] as const

const nextLanguage: Record<LanguageMode, LanguageMode> = { system: 'ru', ru: 'en', en: 'system' }
const nextTheme: Record<ThemeMode, ThemeMode> = { system: 'light', light: 'dark', dark: 'system' }

const languageKey: Record<LanguageMode, TranslationKey> = {
  system: 'settings.system',
  ru: 'settings.languageRu',
  en: 'settings.languageEn',
}

const themeKey: Record<ThemeMode, TranslationKey> = {
  system: 'settings.system',
  light: 'settings.light',
  dark: 'settings.dark',
}

export function SettingsScreen({
  onSettingsChange,
  onImportRequested,
  onBackupsRequested,
  onWipeConfirmed,
  version = '1.0',
}: SettingsScreenProps) {
  const services = useServices()
  const queryClient = useQueryClient()
  const { colors } = useTheme()
  const { t } = useT()

  const [exported, setExported] = useState(false)

  const today = useMemo(
    () => toLocalDate(services.ports.clock.now(), services.ports.timeZone),
    [services],
  )

  const { data: settings } = useQuery({
    queryKey: SETTINGS_KEY,
    queryFn: () => services.ports.settings.get(),
  })

  const save = async (patch: Partial<Settings>) => {
    if (!settings) return
    const next: Settings = { ...settings, ...patch }
    await services.ports.settings.set(next)
    queryClient.setQueryData(SETTINGS_KEY, next)
    onSettingsChange?.(next)
  }

  const exportAll = async () => {
    // exportToFile сохраняет файл и открывает системное «Поделиться» (FR-7.1)
    await services.exportToFile()
    setExported(true)
  }

  if (!settings) {
    return <View testID="settings-screen" style={[styles.screen, { backgroundColor: colors.bg }]} />
  }

  return (
    <View testID="settings-screen" style={[styles.screen, { backgroundColor: colors.bg }]}>
      <View style={styles.header}>
        <Text testID="settings-title" style={[styles.title, { color: colors.textPrimary }]}>
          {t('settings.title')}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.sections}>
        <Section title={t('settings.data')}>
          <Row
            testID="settings-export"
            icon="upload"
            title={t('settings.export')}
            subtitle={
              exported ? t('settings.exportDone') : t('settings.exportHint', { date: today })
            }
            onPress={exportAll}
            right={<Chevron />}
          />
          <Divider />
          <Row
            testID="settings-import"
            icon="download"
            title={t('settings.import')}
            subtitle={t('settings.importHint')}
            onPress={onImportRequested}
            right={<Chevron />}
          />
          <Divider />
          <Row
            testID="settings-backups"
            icon="history"
            title={t('settings.backups')}
            subtitle={t('settings.backupsHint')}
            onPress={onBackupsRequested}
            right={<Chevron />}
          />
        </Section>

        <Section title={t('settings.preferences')}>
          <Row
            testID="settings-units"
            icon="scale"
            title={t('settings.units')}
            right={
              <Segmented
                value={settings.unit}
                options={[
                  { value: 'kg', label: t('settings.unitKg'), testID: 'settings-unit-kg' },
                  { value: 'lb', label: t('settings.unitLb'), testID: 'settings-unit-lb' },
                ]}
                onChange={(unit: WeightUnit) => void save({ unit })}
              />
            }
          />
          <Divider />
          <Row
            testID="settings-first-day"
            icon="calendar"
            title={t('settings.firstDay')}
            onPress={() =>
              void save({ firstDayOfWeek: (settings.firstDayOfWeek === 1 ? 7 : 1) as FirstDayOfWeek })
            }
            right={
              <Value
                testID="settings-first-day-value"
                text={t(settings.firstDayOfWeek === 1 ? 'settings.monday' : 'settings.sunday')}
              />
            }
          />
          <Divider />
          <Row
            testID="settings-language"
            icon="languages"
            title={t('settings.language')}
            onPress={() => void save({ language: nextLanguage[settings.language] })}
            right={
              <Value testID="settings-language-value" text={t(languageKey[settings.language])} />
            }
          />
          <Divider />
          <Row
            testID="settings-theme"
            icon="moon"
            title={t('settings.theme')}
            onPress={() => void save({ theme: nextTheme[settings.theme] })}
            right={<Value testID="settings-theme-value" text={t(themeKey[settings.theme])} />}
          />
        </Section>

        <Section title={t('settings.dangerZone')}>
          {/* нажатием такое не запускается: строка только объясняет, а решает ползунок */}
          <Row
            testID="settings-wipe"
            icon="trash-2"
            danger
            title={t('settings.wipe')}
            subtitle={t('settings.wipeHint')}
          />
          <View style={styles.sliderWrap}>
            <WipeSlider onConfirmed={onWipeConfirmed} />
          </View>
        </Section>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.textMuted }]}>
            {t('settings.version', { value: version })}
          </Text>
          <Text style={[styles.footerText, { color: colors.textMuted }]}>{t('settings.offline')}</Text>
        </View>
      </ScrollView>
    </View>
  )
}

/** Заголовок секции и карточка со строками под ним. */
function Section({ title, children }: { readonly title: string; readonly children: ReactNode }) {
  const { colors } = useTheme()

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{title}</Text>
      </View>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {children}
      </View>
    </View>
  )
}

interface RowProps {
  readonly testID: string
  /** Иконка строки из инвентаря макета: в плашке слева, 16 px. */
  readonly icon: IconName
  readonly title: string
  readonly subtitle?: string
  readonly right?: ReactNode
  readonly onPress?: () => void
  readonly danger?: boolean
}

function Row({ testID, icon, title, subtitle, right, onPress, danger = false }: RowProps) {
  const { colors } = useTheme()

  const content = (
    <>
      <View style={[styles.iconPlate, { backgroundColor: colors.surface2 }]}>
        <Icon
          testID={`${testID}-icon`}
          name={icon}
          size={16}
          color={danger ? colors.danger : colors.textSecondary}
        />
      </View>

      <View style={styles.rowTexts}>
        <Text style={[styles.rowTitle, { color: danger ? colors.danger : colors.textPrimary }]}>
          {title}
        </Text>
        {subtitle ? (
          <Text testID={`${testID}-subtitle`} style={[styles.rowSubtitle, { color: colors.textMuted }]}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {right}
    </>
  )

  if (!onPress) {
    return (
      <View testID={testID} style={styles.row}>
        {content}
      </View>
    )
  }

  return (
    <Pressable testID={testID} accessibilityRole="button" onPress={onPress} style={styles.row}>
      {content}
    </Pressable>
  )
}

function Divider() {
  const { colors } = useTheme()
  return <View style={[styles.divider, { backgroundColor: colors.border }]} />
}

function Chevron() {
  const { colors } = useTheme()
  return <Icon name="chevron-right" size={18} color={colors.textMuted} />
}

function Value({ text, testID }: { readonly text: string; readonly testID: string }) {
  const { colors } = useTheme()
  return (
    <View style={styles.value}>
      <Text testID={testID} style={[styles.valueText, { color: colors.textSecondary }]}>
        {text}
      </Text>
      <Chevron />
    </View>
  )
}

interface SegmentedProps<T extends string> {
  readonly value: T
  readonly options: readonly { readonly value: T; readonly label: string; readonly testID: string }[]
  readonly onChange: (value: T) => void
}

/** Сегмент-контрол из макета: активный сегмент белой плашкой. */
function Segmented<T extends string>({ value, options, onChange }: SegmentedProps<T>) {
  const { colors } = useTheme()

  return (
    <View style={[styles.segmented, { backgroundColor: colors.surface2 }]}>
      {options.map((option) => {
        const selected = option.value === value
        return (
          <Pressable
            key={option.value}
            testID={option.testID}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={[styles.segment, selected && { backgroundColor: colors.surface }]}
          >
            <Text
              style={[
                styles.segmentLabel,
                {
                  color: selected ? colors.textPrimary : colors.textSecondary,
                  fontWeight: selected ? '600' : '500',
                  fontFamily: uiFont(selected ? '600' : '500'),
                },
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { paddingTop: 8, paddingBottom: 14, paddingHorizontal: 20 },
  title: { fontSize: 26, fontWeight: '700', fontFamily: uiFont('700') },

  sections: { paddingHorizontal: 16, paddingBottom: 16, gap: 18 },
  section: { gap: 8 },
  sectionHeader: { paddingHorizontal: 6 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: uiFont('700'),
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  card: { borderRadius: radii.lg, borderWidth: 1, overflow: 'hidden' },

  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, paddingHorizontal: 14 },
  iconPlate: { width: 30, height: 30, borderRadius: radii.sm, alignItems: 'center', justifyContent: 'center' },
  rowTexts: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 15, fontWeight: '500', fontFamily: uiFont('500') },
  rowSubtitle: { fontSize: 11, fontFamily: uiFont() },
  divider: { height: 1 },
  sliderWrap: { paddingHorizontal: 14, paddingBottom: 14 },
  value: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  valueText: { fontSize: 13, fontFamily: uiFont() },

  segmented: { flexDirection: 'row', gap: 2, padding: 3, borderRadius: radii.sm },
  segment: { paddingVertical: 4, paddingHorizontal: 9, borderRadius: 7 },
  segmentLabel: { fontSize: 11 },

  footer: { alignItems: 'center', gap: 3, paddingTop: 4 },
  footerText: { fontSize: 11, fontFamily: uiFont() },
})
