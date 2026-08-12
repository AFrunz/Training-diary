import {
  Activity,
  Archive,
  ArrowRight,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Dumbbell,
  Ellipsis,
  Flame,
  GripVertical,
  History,
  Info,
  Languages,
  List,
  Minus,
  Moon,
  Plus,
  Scale,
  Search,
  Settings,
  Trash2,
  Upload,
  X,
} from 'lucide-react-native'
import { View } from 'react-native'
import { useTheme } from '../theme/ThemeProvider'
import type { Colors } from '../theme/tokens'

/**
 * Иконки из макета (фрейм «16 · Иконки интерфейса»). Набор lucide, обводка 2 px.
 * Размеры: 22 — таббар, 18–19 — шапки и строки, 16 — кнопки, 14–15 — подписи.
 *
 * Список закрытый: незнакомое имя не соберётся, поэтому в интерфейс не попадёт
 * иконка мимо инвентаря.
 */
const ICONS = {
  activity: Activity,
  archive: Archive,
  'arrow-right': ArrowRight,
  calendar: Calendar,
  check: Check,
  'circle-check': CheckCircle2,
  'chevron-down': ChevronDown,
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,
  copy: Copy,
  download: Download,
  dumbbell: Dumbbell,
  ellipsis: Ellipsis,
  flame: Flame,
  'grip-vertical': GripVertical,
  history: History,
  info: Info,
  languages: Languages,
  list: List,
  minus: Minus,
  moon: Moon,
  plus: Plus,
  scale: Scale,
  search: Search,
  settings: Settings,
  'trash-2': Trash2,
  upload: Upload,
  x: X,
} as const

export type IconName = keyof typeof ICONS

export interface IconProps {
  readonly name: IconName
  readonly size?: number
  /** По умолчанию — вторичный текстовый цвет темы. */
  readonly color?: string
  readonly testID?: string
}

/** Размер и цвет по умолчанию. Вынесены отдельно: сам SVG наружу пропсы не отдаёт. */
export const resolveIconProps = (
  colors: Colors,
  options: { size?: number; color?: string } = {},
): { size: number; color: string; strokeWidth: number } => ({
  size: options.size ?? 18,
  color: options.color ?? colors.textSecondary,
  // обводка 2 px — как в макете
  strokeWidth: 2,
})

export function Icon({ name, size, color, testID }: IconProps) {
  const { colors } = useTheme()
  const Glyph = ICONS[name]
  const resolved = resolveIconProps(colors, { size, color })

  return (
    <View testID={testID} style={{ width: resolved.size, height: resolved.size }}>
      <Glyph size={resolved.size} color={resolved.color} strokeWidth={resolved.strokeWidth} />
    </View>
  )
}

export const ICON_NAMES = Object.keys(ICONS) as readonly IconName[]
