import { StyleSheet, Text, View } from 'react-native'
import type { TranslationKey } from '../../i18n/dictionaries'
import { useT } from '../../i18n/I18nProvider'
import { useTheme } from '../../theme/ThemeProvider'
import { programColors, radii, uiFont } from '../../theme/tokens'
import type { YearMonthCell } from './yearData'

/**
 * Годовая сетка из макета «02 · Календарь — год»: 12 мини-месяцев по три в ряд.
 * День с тренировкой закрашен цветом программы, день отсутствия — приглушённым
 * серым, обычный день — цветом track, дни соседних месяцев занимают место пустыми.
 */

/** Цвета программ лежат в токенах по ключу, снапшот тренировки хранит именно ключ. */
const PROGRAM_FILL: Record<string, string> = programColors

const ROW_SIZE = 3

const monthKey = (month: number): TranslationKey => `calendar.month.${month}` as TranslationKey

export interface YearGridProps {
  readonly months: readonly YearMonthCell[]
  /** Номер текущего месяца, если на экране текущий год; иначе null. */
  readonly currentMonth: number | null
}

export function YearGrid({ months, currentMonth }: YearGridProps) {
  const { t } = useT()
  const { colors } = useTheme()

  const rows = Array.from({ length: Math.ceil(months.length / ROW_SIZE) }, (_, index) =>
    months.slice(index * ROW_SIZE, index * ROW_SIZE + ROW_SIZE),
  )

  return (
    <View testID="calendar-year-grid" style={styles.grid}>
      {rows.map((row) => (
        <View key={row[0]?.month ?? 0} style={styles.row}>
          {row.map((month) => {
            const isCurrent = month.month === currentMonth

            return (
              <View
                key={month.month}
                testID={`calendar-year-month-${month.month}`}
                style={[
                  styles.month,
                  { borderColor: isCurrent ? colors.accent : 'transparent' },
                ]}
              >
                <Text
                  testID={`calendar-year-month-${month.month}-label`}
                  numberOfLines={1}
                  style={[
                    styles.monthLabel,
                    {
                      color: isCurrent ? colors.accent : colors.textSecondary,
                      fontWeight: isCurrent ? '600' : '500',
                      fontFamily: uiFont(isCurrent ? '600' : '500'),
                    },
                  ]}
                >
                  {t(monthKey(month.month))}
                </Text>

                <View style={styles.days}>
                  {month.weeks.map((week, weekIndex) => (
                    <View key={week[0]?.date ?? weekIndex} style={styles.week}>
                      {week.map((day, dayIndex) =>
                        day.date === null ? (
                          <View key={dayIndex} style={styles.dayEmpty} />
                        ) : (
                          <View
                            key={day.date}
                            testID={`calendar-year-day-${day.date}`}
                            style={[
                              styles.day,
                              day.absent && day.programColor === null ? styles.dayAbsent : null,
                              {
                                backgroundColor:
                                  day.programColor === null
                                    ? day.absent
                                      ? colors.textMuted
                                      : colors.track
                                    : (PROGRAM_FILL[day.programColor] ?? colors.track),
                              },
                            ]}
                          />
                        ),
                      )}
                    </View>
                  ))}
                </View>
              </View>
            )
          })}
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  grid: { gap: 14, paddingTop: 2, paddingHorizontal: 16 },
  row: { flexDirection: 'row', gap: 6 },
  month: {
    flex: 1,
    gap: 6,
    borderRadius: radii.md,
    borderWidth: 1,
    padding: 6,
  },
  monthLabel: { fontSize: 11, textAlign: 'center' },
  days: { gap: 2 },
  week: { flexDirection: 'row', gap: 2 },
  day: { flex: 1, aspectRatio: 1, borderRadius: 2 },
  dayAbsent: { opacity: 0.55 },
  dayEmpty: { flex: 1, aspectRatio: 1 },
})
