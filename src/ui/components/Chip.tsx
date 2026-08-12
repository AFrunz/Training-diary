import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useTheme } from '../theme/ThemeProvider'
import { radii } from '../theme/tokens'

export interface ChipProps {
  readonly label: string
  /** Активный чип из макета: тёмная заливка и цвет фона в тексте. */
  readonly selected?: boolean
  /** Цветная точка слева — метка программы. */
  readonly dotColor?: string
  readonly onPress?: () => void
  readonly testID?: string
}

/** Чип фильтра или сортировки. */
export function Chip({ label, selected = false, dotColor, onPress, testID }: ChipProps) {
  const { colors } = useTheme()

  const content = (
    <>
      {dotColor ? <View style={[styles.dot, { backgroundColor: dotColor }]} /> : null}
      <Text
        style={[
          styles.label,
          { color: selected ? colors.bg : colors.textSecondary, fontWeight: selected ? '600' : '500' },
        ]}
      >
        {label}
      </Text>
    </>
  )

  const style = [
    styles.chip,
    { backgroundColor: selected ? colors.textPrimary : colors.surface2 },
  ]

  if (!onPress) return <View testID={testID} style={style}>{content}</View>

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={style}
    >
      {content}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radii.pill,
    paddingVertical: 6,
    paddingHorizontal: 11,
  },
  dot: { width: 7, height: 7, borderRadius: radii.pill },
  label: { fontSize: 12 },
})
