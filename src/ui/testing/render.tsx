import { render } from '@testing-library/react-native'
import type { RenderOptions } from '@testing-library/react-native'
import type { ReactElement, ReactNode } from 'react'
import type { LanguageMode } from '../../domain/model/entities'
import { I18nProvider } from '../i18n/I18nProvider'

/**
 * Обёртка для компонентных тестов: поднимает провайдеры, которые нужны любому
 * куску интерфейса. Тесты не должны знать, сколько их и в каком порядке.
 */
export interface ProviderOptions {
  readonly language?: LanguageMode
  readonly systemLanguage?: string
}

export const withProviders = (
  children: ReactNode,
  { language = 'ru', systemLanguage = 'ru-RU' }: ProviderOptions = {},
) => (
  <I18nProvider mode={language} systemLanguage={systemLanguage}>
    {children}
  </I18nProvider>
)

export const renderWithProviders = (
  ui: ReactElement,
  options: ProviderOptions & Omit<RenderOptions, 'wrapper'> = {},
) => {
  const { language, systemLanguage, ...renderOptions } = options
  return render(withProviders(ui, { language, systemLanguage }), renderOptions)
}
