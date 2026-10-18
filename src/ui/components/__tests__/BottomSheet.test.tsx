import { act, fireEvent, screen } from '@testing-library/react-native'
import { Text } from 'react-native'
import { renderWithProviders as render } from '../../testing/render'
import { BottomSheet, shouldDismiss } from '../BottomSheet'

const sheet = (onClose = jest.fn(), visible = true) => {
  render(
    <BottomSheet visible={visible} onClose={onClose}>
      <Text>Содержимое</Text>
    </BottomSheet>,
  )
  return onClose
}

describe('BottomSheet', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => {
    // анимация шторки планирует кадры: без уборки они утекают в следующий тест
    jest.clearAllTimers()
    jest.useRealTimers()
  })

  it('показывает содержимое и ручку', () => {
    sheet()

    expect(screen.getByText('Содержимое')).toBeTruthy()
    expect(screen.getByTestId('bottom-sheet-grabber')).toBeTruthy()
  })

  it('скрытая шторка не рисуется', () => {
    sheet(jest.fn(), false)

    expect(screen.queryByText('Содержимое')).toBeNull()
  })

  it('нажатие мимо шторки закрывает её — после того, как доиграет анимация', () => {
    const onClose = sheet()

    fireEvent.press(screen.getByTestId('bottom-sheet-scrim'))
    // сначала шторка уезжает вниз и только потом снимается: иначе она мигает
    expect(onClose).not.toHaveBeenCalled()

    act(() => {
      jest.advanceTimersByTime(400)
    })
    expect(onClose).toHaveBeenCalled()
  })

  it('ручка слушает жест: без обработчиков полоску не утянуть', () => {
    sheet()
    const grabber = screen.getByTestId('bottom-sheet-grabber')

    expect(typeof grabber.props.onMoveShouldSetResponder).toBe('function')
    expect(typeof grabber.props.onResponderMove).toBe('function')
    expect(typeof grabber.props.onResponderRelease).toBe('function')
  })

  it('экранный диктор закрывает шторку действием, а не жестом', () => {
    const onClose = sheet()
    const grabber = screen.getByTestId('bottom-sheet-grabber')

    expect(grabber.props.accessibilityActions).toEqual([{ name: 'decrement' }])
    grabber.props.onAccessibilityAction({ nativeEvent: { actionName: 'decrement' } })

    act(() => {
      jest.advanceTimersByTime(400)
    })
    expect(onClose).toHaveBeenCalled()
  })
})

/**
 * Сам путь пальца считает PanResponder из истории касаний — подделывать её в
 * тесте значит проверять арифметику React Native. Проверяется решение по
 * готовому жесту: это и есть своя логика.
 */
describe('shouldDismiss — какой жест закрывает шторку', () => {
  it('протяжка дальше порога закрывает', () => {
    expect(shouldDismiss({ dy: 140, vy: 0 })).toBe(true)
  })

  it('короткая протяжка возвращает на место', () => {
    expect(shouldDismiss({ dy: 20, vy: 0 })).toBe(false)
    expect(shouldDismiss({ dy: 90, vy: 0 })).toBe(false)
  })

  it('резкий рывок вниз закрывает и на коротком пути', () => {
    expect(shouldDismiss({ dy: 30, vy: 1.4 })).toBe(true)
  })

  it('движение вверх шторку не закрывает', () => {
    expect(shouldDismiss({ dy: -200, vy: -2 })).toBe(false)
  })
})
