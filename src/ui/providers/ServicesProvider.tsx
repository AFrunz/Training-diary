import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'
import type { Services } from '../../app/container'

/**
 * Доступ к сценариям из компонентов. Экраны получают функции, а не репозитории,
 * поэтому в тестах достаточно подсунуть контейнер над фейковыми портами.
 */
const ServicesContext = createContext<Services | null>(null)

export function ServicesProvider({ children, services }: { children: ReactNode; services: Services }) {
  return <ServicesContext.Provider value={services}>{children}</ServicesContext.Provider>
}

export function useServices(): Services {
  const context = useContext(ServicesContext)
  if (!context) throw new Error('useServices вызван вне ServicesProvider')
  return context
}
