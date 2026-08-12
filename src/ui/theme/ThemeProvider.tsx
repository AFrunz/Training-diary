import { createContext, useContext, useMemo } from 'react'
import type { ReactNode } from 'react'
import { useColorScheme } from 'react-native'
import type { ThemeMode } from '../../domain/model/entities'
import { palette } from './tokens'
import type { Colors, ThemeName } from './tokens'

/**
 * Тема интерфейса (FR-7.4). Системный режим следует за настройкой устройства,
 * явный выбор её перекрывает.
 */

export interface Theme {
  readonly name: ThemeName
  readonly colors: Colors
}

const ThemeContext = createContext<Theme | null>(null)

export const resolveTheme = (mode: ThemeMode, system: ThemeName | null): ThemeName =>
  mode === 'system' ? (system ?? 'light') : mode

export function ThemeProvider({ children, mode }: { children: ReactNode; mode: ThemeMode }) {
  const system = useColorScheme()
  const name = resolveTheme(mode, system === 'dark' ? 'dark' : system === 'light' ? 'light' : null)
  const value = useMemo<Theme>(() => ({ name, colors: palette[name] }), [name])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): Theme {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme вызван вне ThemeProvider')
  return context
}
