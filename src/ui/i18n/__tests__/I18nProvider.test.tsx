import { render, screen } from '@testing-library/react-native'
import { Text } from 'react-native'
import type { LanguageMode } from '../../../domain/model/entities'
import { I18nProvider, resolveLocale, useT } from '../I18nProvider'

const Probe = () => {
  const { t, count, locale } = useT()
  return (
    <>
      <Text testID="tab">{t('tab.workouts')}</Text>
      <Text testID="params">{t('workout.startedAt', { time: '18:32' })}</Text>
      <Text testID="count">{count('workouts', 12)}</Text>
      <Text testID="locale">{locale}</Text>
    </>
  )
}

const renderWith = (mode: LanguageMode, systemLanguage = 'ru-RU') =>
  render(
    <I18nProvider mode={mode} systemLanguage={systemLanguage}>
      <Probe />
    </I18nProvider>,
  )

describe('resolveLocale', () => {
  it('системный язык сводится к поддерживаемому', () => {
    expect(resolveLocale('system', 'ru-RU')).toBe('ru')
    expect(resolveLocale('system', 'en-GB')).toBe('en')
  })

  it('неподдерживаемый системный язык даёт английский (FR-7.6)', () => {
    expect(resolveLocale('system', 'de-DE')).toBe('en')
    expect(resolveLocale('system', '')).toBe('en')
  })

  it('явный выбор сильнее системного', () => {
    expect(resolveLocale('ru', 'en-US')).toBe('ru')
    expect(resolveLocale('en', 'ru-RU')).toBe('en')
  })
})

describe('I18nProvider', () => {
  it('отдаёт строки выбранного языка', () => {
    renderWith('ru')
    expect(screen.getByTestId('tab')).toHaveTextContent('Тренировки')
  })

  it('подставляет параметры', () => {
    renderWith('ru')
    expect(screen.getByTestId('params')).toHaveTextContent('начата в 18:32')
  })

  it('склоняет числительные', () => {
    renderWith('ru')
    expect(screen.getByTestId('count')).toHaveTextContent('12 тренировок')
  })

  it('переключение языка меняет интерфейс без перезапуска', () => {
    const { rerender } = renderWith('ru')
    expect(screen.getByTestId('tab')).toHaveTextContent('Тренировки')

    rerender(
      <I18nProvider mode="en" systemLanguage="ru-RU">
        <Probe />
      </I18nProvider>,
    )

    expect(screen.getByTestId('tab')).toHaveTextContent('Workouts')
    expect(screen.getByTestId('count')).toHaveTextContent('12 workouts')
  })

  it('без провайдера хук падает с понятным сообщением, а не отдаёт undefined', () => {
    // консольную ошибку React в этом тесте глушим: она ожидаема
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Probe />)).toThrow(/I18nProvider/)
    spy.mockRestore()
  })
})
