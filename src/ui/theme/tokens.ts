/**
 * Токены из фрейма «00 · Дизайн-система» в design.pen. Значения продублированы
 * сюда вручную: при правке макета их нужно синхронизировать.
 */

export type ThemeName = 'light' | 'dark'

export const palette = {
  light: {
    bg: '#F5F5F8',
    surface: '#FFFFFF',
    surface2: '#EEEEF3',
    border: '#E4E4EB',
    textPrimary: '#141418',
    textSecondary: '#5F5F6C',
    textMuted: '#9797A5',
    accent: '#5A5AF0',
    accentSoft: '#E9E9FE',
    onAccent: '#FFFFFF',
    success: '#1E9E6A',
    warning: '#E08217',
    danger: '#DC3B41',
    track: '#E4E4EB',
  },
  dark: {
    bg: '#0D0D10',
    surface: '#17171D',
    surface2: '#212129',
    border: '#2B2B35',
    textPrimary: '#F3F3F6',
    textSecondary: '#A2A2B2',
    textMuted: '#67677A',
    accent: '#8080FF',
    accentSoft: '#23233A',
    onAccent: '#0D0D10',
    success: '#3ED98F',
    warning: '#F0A93B',
    danger: '#F0575D',
    track: '#2B2B35',
  },
} as const

/** Именно строки, а не литералы: иначе тёмная палитра не подойдёт под тип светлой. */
export type Colors = { readonly [Token in keyof (typeof palette)['light']]: string }

/** Палитра программ одинакова в обеих темах (§7.3). */
export const programColors = {
  'prog-red': '#E5484D',
  'prog-orange': '#F2762E',
  'prog-amber': '#D9A400',
  'prog-green': '#30A46C',
  'prog-teal': '#12A5A5',
  'prog-blue': '#3E7BFA',
  'prog-violet': '#8E5BF0',
  'prog-pink': '#E255A1',
} as const

export const radii = { lg: 22, md: 14, sm: 9, pill: 99 } as const

/**
 * Имена шрифтов совпадают с ключами загрузки в `app/_layout.tsx`.
 * Inter — весь интерфейс, Space Grotesk — числа и метрики (макет «00 · Дизайн-система»).
 */
export const fonts = {
  ui: 'Inter_400Regular',
  uiMedium: 'Inter_500Medium',
  uiSemibold: 'Inter_600SemiBold',
  uiBold: 'Inter_700Bold',
  num: 'SpaceGrotesk_600SemiBold',
  numBold: 'SpaceGrotesk_700Bold',
} as const

/** Гарнитура под нужную насыщенность: в RN начертания подключаются отдельными файлами. */
export const uiFont = (weight?: string): string =>
  weight === '700' ? fonts.uiBold : weight === '600' ? fonts.uiSemibold : weight === '500' ? fonts.uiMedium : fonts.ui

export const numFont = (weight?: string): string => (weight === '700' ? fonts.numBold : fonts.num)

/** Цвет бублика по тону завершённости из §5.2. */
export const toneColor = (colors: Colors, tone: 'success' | 'warning' | 'danger' | 'muted'): string =>
  tone === 'success'
    ? colors.success
    : tone === 'warning'
      ? colors.warning
      : tone === 'danger'
        ? colors.danger
        : colors.track
