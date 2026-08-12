import { fireEvent, screen, waitFor } from '@testing-library/react-native'
import { useState } from 'react'
import type { Services } from '../../../../app/container'
import type { LanguageMode, Settings, ThemeMode } from '../../../../domain/model/entities'
import { id as makeId, instant } from '../../../../domain/model/types'
import { I18nProvider } from '../../../i18n/I18nProvider'
import { createTestServices, renderWithProviders } from '../../../testing/render'
import { ThemeProvider } from '../../../theme/ThemeProvider'
import { palette } from '../../../theme/tokens'
import { SettingsScreen } from '../SettingsScreen'

/**
 * Тема и язык живут в провайдерах над экраном, поэтому тесты поднимают ту же
 * связку, что и точка сборки приложения: экран пишет настройку в порт и отдаёт
 * её наружу, провайдеры перерисовывают интерфейс.
 */
function Harness({ language = 'ru' as LanguageMode, theme = 'light' as ThemeMode }) {
  const [mode, setMode] = useState<LanguageMode>(language)
  const [themeMode, setThemeMode] = useState<ThemeMode>(theme)

  return (
    <ThemeProvider mode={themeMode}>
      <I18nProvider mode={mode} systemLanguage="ru-RU">
        <SettingsScreen
          onSettingsChange={(settings: Settings) => {
            setMode(settings.language)
            setThemeMode(settings.theme)
          }}
        />
      </I18nProvider>
    </ThemeProvider>
  )
}

const withRussianSettings = (): { services: Services; settings: Settings } => {
  const { services, ports } = createTestServices()
  ports.state.settings = { unit: 'kg', firstDayOfWeek: 1, theme: 'light', language: 'ru' }
  ports.state.exercises.push({
    id: makeId('exercise-1'),
    name: 'Жим лёжа',
    createdAt: instant(0),
    updatedAt: instant(0),
  })
  return { services, settings: ports.state.settings }
}

describe('экран настроек', () => {
  it('показывает все строки трёх секций', async () => {
    const { services } = createTestServices()

    renderWithProviders(<SettingsScreen />, { services })

    expect(await screen.findByTestId('settings-export')).toBeOnTheScreen()
    for (const testID of [
      'settings-import',
      'settings-backups',
      'settings-units',
      'settings-first-day',
      'settings-language',
      'settings-theme',
      'settings-wipe',
    ]) {
      expect(screen.getByTestId(testID)).toBeOnTheScreen()
    }

    expect(screen.getByText('Данные')).toBeOnTheScreen()
    expect(screen.getByText('Предпочтения')).toBeOnTheScreen()
    expect(screen.getByText('Опасная зона')).toBeOnTheScreen()
    expect(screen.getByText('работает без интернета')).toBeOnTheScreen()
    expect(screen.getByText('Дневник тренировок · версия 1.0')).toBeOnTheScreen()
  })

  it('переключение единиц веса меняет настройку в портах и подпись сегмента', async () => {
    const { services, ports } = createTestServices()

    renderWithProviders(<SettingsScreen />, { services })

    const lb = await screen.findByTestId('settings-unit-lb')
    expect(screen.getByTestId('settings-unit-kg')).toBeSelected()

    fireEvent.press(lb)

    await waitFor(() => expect(screen.getByTestId('settings-unit-lb')).toBeSelected())
    expect(ports.state.settings.unit).toBe('lb')
    expect(screen.getByTestId('settings-unit-kg')).not.toBeSelected()
  })

  it('первый день недели переключается между понедельником и воскресеньем', async () => {
    const { services, ports } = createTestServices()

    renderWithProviders(<SettingsScreen />, { services })

    expect(await screen.findByTestId('settings-first-day-value')).toHaveTextContent('Понедельник')

    fireEvent.press(screen.getByTestId('settings-first-day'))

    await waitFor(() =>
      expect(screen.getByTestId('settings-first-day-value')).toHaveTextContent('Воскресенье'),
    )
    expect(ports.state.settings.firstDayOfWeek).toBe(7)
  })

  it('смена языка переводит интерфейс и не трогает пользовательские данные', async () => {
    const { services } = withRussianSettings()
    const { ports } = { ports: services.ports }

    renderWithProviders(<Harness />, { services })

    expect(await screen.findByTestId('settings-title')).toHaveTextContent('Настройки')

    fireEvent.press(screen.getByTestId('settings-language'))

    expect(await screen.findByText('Settings')).toBeOnTheScreen()
    expect(screen.getByTestId('settings-language-value')).toHaveTextContent('English')
    expect(screen.getByText('works offline')).toBeOnTheScreen()

    const settings = await ports.settings.get()
    expect(settings.language).toBe('en')
    // пользовательские данные переводу не подлежат
    expect((await ports.exercises.list())[0]?.name).toBe('Жим лёжа')
  })

  it('смена темы перекрашивает экран', async () => {
    const { services } = withRussianSettings()

    renderWithProviders(<Harness />, { services })

    expect(await screen.findByTestId('settings-theme-value')).toHaveTextContent('Светлая')
    expect(screen.getByTestId('settings-screen')).toHaveStyle({ backgroundColor: palette.light.bg })

    fireEvent.press(screen.getByTestId('settings-theme'))

    expect(await screen.findByText('Тёмная')).toBeOnTheScreen()
    expect(screen.getByTestId('settings-screen')).toHaveStyle({ backgroundColor: palette.dark.bg })
    expect((await services.ports.settings.get()).theme).toBe('dark')
  })

  it('экспорт запускает сценарий и подтверждает готовность файла', async () => {
    const { services: base } = createTestServices()
    const exportAll = jest.fn(base.exportAll)
    const services: Services = { ...base, exportAll }

    renderWithProviders(<SettingsScreen />, { services })

    expect(await screen.findByTestId('settings-export-subtitle')).toHaveTextContent(
      'training-diary-2026-08-11.json',
    )

    fireEvent.press(screen.getByTestId('settings-export'))

    await waitFor(() =>
      expect(screen.getByTestId('settings-export-subtitle')).toHaveTextContent(
        'файл готов к сохранению',
      ),
    )
    expect(exportAll).toHaveBeenCalled()
  })

  it('удаление всех данных требует подтверждения', async () => {
    const { services } = createTestServices()
    const onWipeConfirmed = jest.fn()

    renderWithProviders(<SettingsScreen onWipeConfirmed={onWipeConfirmed} />, { services })

    fireEvent.press(await screen.findByTestId('settings-wipe'))

    expect(onWipeConfirmed).not.toHaveBeenCalled()
    expect(screen.getByTestId('settings-wipe-subtitle')).toHaveTextContent(
      'нажмите ещё раз, чтобы подтвердить',
    )

    fireEvent.press(screen.getByTestId('settings-wipe'))
    expect(onWipeConfirmed).toHaveBeenCalledTimes(1)
  })
})
