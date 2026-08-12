import { render, screen } from '@testing-library/react-native'
import { Text, useColorScheme } from 'react-native'
import { ThemeProvider, resolveTheme, useTheme } from '../ThemeProvider'
import { palette, toneColor } from '../tokens'

jest.mock('react-native/Libraries/Utilities/useColorScheme')

const mockedScheme = useColorScheme as jest.MockedFunction<typeof useColorScheme>

const Probe = () => {
  const { name, colors } = useTheme()
  return (
    <>
      <Text testID="name">{name}</Text>
      <Text testID="bg">{colors.bg}</Text>
    </>
  )
}

describe('resolveTheme', () => {
  it('системный режим следует за устройством', () => {
    expect(resolveTheme('system', 'dark')).toBe('dark')
    expect(resolveTheme('system', 'light')).toBe('light')
  })

  it('когда устройство молчит, берётся светлая', () => {
    expect(resolveTheme('system', null)).toBe('light')
  })

  it('явный выбор перекрывает системный', () => {
    expect(resolveTheme('dark', 'light')).toBe('dark')
    expect(resolveTheme('light', 'dark')).toBe('light')
  })
})

describe('ThemeProvider', () => {
  it('в тёмном режиме отдаёт тёмные токены', () => {
    mockedScheme.mockReturnValue('dark')
    render(
      <ThemeProvider mode="system">
        <Probe />
      </ThemeProvider>,
    )

    expect(screen.getByTestId('name')).toHaveTextContent('dark')
    expect(screen.getByTestId('bg')).toHaveTextContent(palette.dark.bg)
  })

  it('явно выбранная светлая тема не зависит от устройства', () => {
    mockedScheme.mockReturnValue('dark')
    render(
      <ThemeProvider mode="light">
        <Probe />
      </ThemeProvider>,
    )

    expect(screen.getByTestId('bg')).toHaveTextContent(palette.light.bg)
  })

  it('без провайдера хук падает с понятным сообщением', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Probe />)).toThrow(/ThemeProvider/)
    spy.mockRestore()
  })
})

describe('токены', () => {
  it('цвет бублика соответствует тону из §5.2', () => {
    expect(toneColor(palette.light, 'success')).toBe(palette.light.success)
    expect(toneColor(palette.light, 'warning')).toBe(palette.light.warning)
    expect(toneColor(palette.light, 'danger')).toBe(palette.light.danger)
    expect(toneColor(palette.light, 'muted')).toBe(palette.light.track)
  })

  it('обе темы описывают один и тот же набор цветов', () => {
    expect(Object.keys(palette.light).sort()).toEqual(Object.keys(palette.dark).sort())
  })
})
