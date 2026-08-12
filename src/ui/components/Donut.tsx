import { StyleSheet, Text, View } from 'react-native'
import Svg, { Circle } from 'react-native-svg'
import type { CompletionTone } from '../../domain/rules/completion'
import { formatCompletion } from '../../domain/rules/format'
import { useTheme } from '../theme/ThemeProvider'
import { toneColor } from '../theme/tokens'

export interface DonutProps {
  readonly done: number
  readonly total: number
  readonly tone: CompletionTone
  readonly size?: number
  readonly testID?: string
}

/**
 * Кольцо завершённости тренировки (§5.2). Цвет задаётся тоном, подпись — «3/5».
 * Размеры повторяют компонент Donut из макета: 46 px, толщина кольца 6.
 */
export function Donut({ done, total, tone, size = 46, testID = 'workout-donut' }: DonutProps) {
  const { colors } = useTheme()
  const stroke = 6
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const ratio = total === 0 ? 0 : Math.min(1, done / total)

  return (
    <View testID={testID} accessibilityLabel={formatCompletion(done, total)} style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.track}
          strokeWidth={stroke}
          fill="none"
        />
        <Circle
          testID={`${testID}-arc`}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={toneColor(colors, tone)}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${circumference * ratio} ${circumference}`}
          // дуга начинается сверху, как в макете
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          fill="none"
        />
      </Svg>
      <View style={styles.label} pointerEvents="none">
        <Text style={[styles.text, { color: colors.textPrimary, fontSize: size * 0.26 }]}>
          {formatCompletion(done, total)}
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  label: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  text: { fontWeight: '700' },
})
