import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createContext, useContext, useMemo } from 'react'
import type { ReactNode } from 'react'
import type { Settings } from '../../domain/model/entities'
import { useServices } from './ServicesProvider'

/**
 * Настройки приложения: единицы веса, первый день недели, язык и тема.
 * Живут в базе, поэтому читаются запросом и инвалидируются после изменения.
 */

export const SETTINGS_QUERY_KEY = ['settings'] as const

export interface SettingsContextValue {
  readonly settings: Settings
  readonly update: (patch: Partial<Settings>) => Promise<void>
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

export const DEFAULT_SETTINGS: Settings = {
  unit: 'kg',
  firstDayOfWeek: 1,
  theme: 'system',
  language: 'system',
}

export function SettingsProvider({
  children,
  fallback = null,
}: {
  children: (settings: Settings) => ReactNode
  /** Что показывать, пока настройки читаются из базы. */
  fallback?: ReactNode
}) {
  const services = useServices()
  const queryClient = useQueryClient()

  const { data } = useQuery({
    queryKey: SETTINGS_QUERY_KEY,
    queryFn: () => services.ports.settings.get(),
  })

  const mutation = useMutation({
    mutationFn: async (next: Settings) => services.ports.settings.set(next),
  })

  const value = useMemo<SettingsContextValue | null>(() => {
    if (!data) return null
    return {
      settings: data,
      update: async (patch) => {
        await mutation.mutateAsync({ ...data, ...patch })
      },
    }
  }, [data, mutation])

  if (!value) return <>{fallback}</>

  return <SettingsContext.Provider value={value}>{children(value.settings)}</SettingsContext.Provider>
}

export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext)
  if (!context) throw new Error('useSettings вызван вне SettingsProvider')
  return context
}
