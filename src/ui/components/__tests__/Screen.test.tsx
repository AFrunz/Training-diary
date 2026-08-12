import { screen } from '@testing-library/react-native'
import { Text } from 'react-native'
import { Screen } from '../Screen'
import { renderWithProviders as render } from '../../testing/render'

/** Значения вырезов приходят из провайдера безопасных зон; в тестах он даёт нули. */
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
}))

describe('Screen', () => {
  it('разводит содержимое со статус-баром и жестовой полосой', () => {
    render(
      <Screen testID="screen">
        <Text>Содержимое</Text>
      </Screen>,
    )

    expect(screen.getByTestId('screen')).toHaveStyle({ paddingTop: 44, paddingBottom: 34 })
  })

  it('внутри таббара нижний отступ не нужен: его держит сам таббар', () => {
    render(
      <Screen testID="screen" withBottomInset={false}>
        <Text>Содержимое</Text>
      </Screen>,
    )

    expect(screen.getByTestId('screen')).toHaveStyle({ paddingTop: 44, paddingBottom: 0 })
  })

  it('красит фон цветом темы', () => {
    render(
      <Screen testID="screen">
        <Text>Содержимое</Text>
      </Screen>,
      { theme: 'dark' },
    )

    expect(screen.getByTestId('screen')).toHaveStyle({ backgroundColor: '#0D0D10' })
  })

  it('содержимое остаётся на месте', () => {
    render(
      <Screen>
        <Text>Содержимое</Text>
      </Screen>,
    )

    expect(screen.getByText('Содержимое')).toBeTruthy()
  })
})
