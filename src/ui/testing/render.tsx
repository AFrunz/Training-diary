import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react-native'
import type { RenderOptions } from '@testing-library/react-native'
import type { ReactElement, ReactNode } from 'react'
import { createServices } from '../../app/container'
import type { Services } from '../../app/container'
import { createFakePorts } from '../../app/testing/fakes'
import type { FakePorts } from '../../app/testing/fakes'
import type { LanguageMode, ThemeMode } from '../../domain/model/entities'
import { I18nProvider } from '../i18n/I18nProvider'
import { ServicesProvider } from '../providers/ServicesProvider'
import { ThemeProvider } from '../theme/ThemeProvider'

/**
 * Обёртка для компонентных тестов: поднимает провайдеры, которые нужны любому
 * куску интерфейса. Тесты не должны знать, сколько их и в каком порядке.
 */
export interface ProviderOptions {
  readonly language?: LanguageMode
  readonly systemLanguage?: string
  readonly theme?: ThemeMode
  readonly services?: Services
}

/** Кэш без повторов и без задержек: в тестах ретраи только маскируют ошибки. */
const createTestQueryClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })

export const withProviders = (
  children: ReactNode,
  {
    language = 'ru',
    systemLanguage = 'ru-RU',
    theme = 'light',
    services = createServices(createFakePorts()),
  }: ProviderOptions = {},
) => (
  <QueryClientProvider client={createTestQueryClient()}>
    <ServicesProvider services={services}>
      <ThemeProvider mode={theme}>
        <I18nProvider mode={language} systemLanguage={systemLanguage}>
          {children}
        </I18nProvider>
      </ThemeProvider>
    </ServicesProvider>
  </QueryClientProvider>
)

export const renderWithProviders = (
  ui: ReactElement,
  options: ProviderOptions & Omit<RenderOptions, 'wrapper'> = {},
) => {
  const { language, systemLanguage, theme, services, ...renderOptions } = options
  return render(withProviders(ui, { language, systemLanguage, theme, services }), renderOptions)
}

/** Готовый контейнер над фейковыми портами: экранные тесты работают с ним как с настоящим. */
export const createTestServices = (): { services: Services; ports: FakePorts } => {
  const ports = createFakePorts()
  return { services: createServices(ports), ports }
}
