import { screen } from '@testing-library/react-native'
import { ICON_NAMES, Icon, resolveIconProps } from '../Icon'
import { renderWithProviders as render } from '../../testing/render'
import { palette } from '../../theme/tokens'

describe('resolveIconProps', () => {
  it('размер по умолчанию — 18, как у строк и шапок', () => {
    expect(resolveIconProps(palette.light)).toMatchObject({ size: 18, strokeWidth: 2 })
  })

  it('цвет по умолчанию берётся из темы', () => {
    expect(resolveIconProps(palette.dark).color).toBe(palette.dark.textSecondary)
    expect(resolveIconProps(palette.light).color).toBe(palette.light.textSecondary)
  })

  it('размер и цвет переопределяются', () => {
    expect(resolveIconProps(palette.light, { size: 22, color: palette.light.accent })).toMatchObject({
      size: 22,
      color: palette.light.accent,
    })
  })
})

describe('Icon', () => {
  it('рисует иконку по имени', () => {
    render(<Icon name="dumbbell" testID="glyph" />)
    expect(screen.getByTestId('glyph')).toBeTruthy()
  })

  it('занимает место по своему размеру', () => {
    render(<Icon name="calendar" size={22} testID="glyph" />)
    expect(screen.getByTestId('glyph')).toHaveStyle({ width: 22, height: 22 })
  })

  it('инвентарь совпадает с макетом: 28 иконок интерфейса', () => {
    // три иконки статус-бара в приложение не идут, они только для макетов
    expect(ICON_NAMES).toHaveLength(28)
  })

  it('каждая иконка из инвентаря рисуется', () => {
    for (const name of ICON_NAMES) {
      const { unmount } = render(<Icon name={name} testID={`glyph-${name}`} />)
      expect(screen.getByTestId(`glyph-${name}`)).toBeTruthy()
      unmount()
    }
  })
})
