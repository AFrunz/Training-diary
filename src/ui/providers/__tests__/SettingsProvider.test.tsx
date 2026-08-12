import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react-native'
import { Pressable, Text } from 'react-native'
import { createServices } from '../../../app/container'
import { createFakePorts } from '../../../app/testing/fakes'
import { I18nProvider } from '../../i18n/I18nProvider'
import { ThemeProvider } from '../../theme/ThemeProvider'
import { ServicesProvider } from '../ServicesProvider'
import { SettingsProvider, useSettings } from '../SettingsProvider'

const Probe = () => {
  const { settings, update } = useSettings()
  return (
    <>
      <Text testID="unit">{settings.unit}</Text>
      <Text testID="language">{settings.language}</Text>
      <Pressable testID="to-lb" onPress={() => update({ unit: 'lb' })}>
        <Text>lb</Text>
      </Pressable>
    </>
  )
}

const setup = () => {
  const ports = createFakePorts()
  const services = createServices(ports)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })

  render(
    <QueryClientProvider client={client}>
      <ServicesProvider services={services}>
        <SettingsProvider fallback={<Text testID="loading">…</Text>}>
          {(settings) => (
            <ThemeProvider mode={settings.theme}>
              <I18nProvider mode={settings.language} systemLanguage="ru-RU">
                <Probe />
              </I18nProvider>
            </ThemeProvider>
          )}
        </SettingsProvider>
      </ServicesProvider>
    </QueryClientProvider>,
  )

  return { ports }
}

describe('SettingsProvider', () => {
  it('читает настройки из базы', async () => {
    setup()
    expect(await screen.findByTestId('unit')).toHaveTextContent('kg')
  })

  it('пока настройки не прочитаны, показывает заглушку', () => {
    setup()
    expect(screen.getByTestId('loading')).toBeTruthy()
  })

  it('изменение сохраняется в базу и возвращается в интерфейс', async () => {
    const { ports } = setup()
    await screen.findByTestId('unit')

    fireEvent.press(screen.getByTestId('to-lb'))

    expect(await screen.findByText('lb')).toBeTruthy()
    await screen.findByTestId('unit')
    expect(ports.state.settings.unit).toBe('lb')
  })

  it('язык по умолчанию системный: провайдер отдаёт его как есть', async () => {
    setup()
    expect(await screen.findByTestId('language')).toHaveTextContent('system')
  })

  it('без провайдера хук падает с понятным сообщением', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Probe />)).toThrow(/SettingsProvider/)
    spy.mockRestore()
  })
})
