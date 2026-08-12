import { fireEvent, screen } from '@testing-library/react-native'
import { Chip } from '../Chip'
import { Donut } from '../Donut'
import { ScreenHeader } from '../ScreenHeader'
import { renderWithProviders as render } from '../../testing/render'

describe('Donut', () => {
  it('показывает долю выполненных упражнений', () => {
    render(<Donut done={3} total={5} tone="warning" />)
    expect(screen.getByText('3/5')).toBeTruthy()
  })

  it('разные тона дают разный цвет дуги', () => {
    // react-native-svg переводит цвет в числовое представление, поэтому
    // сравниваем тона между собой; точное соответствие проверяет тест toneColor
    const { rerender } = render(<Donut done={5} total={5} tone="success" />)
    const success = screen.getByTestId('workout-donut-arc').props.stroke

    rerender(<Donut done={1} total={5} tone="danger" />)
    expect(screen.getByTestId('workout-donut-arc').props.stroke).not.toEqual(success)
  })

  it('пустая тренировка не даёт деления на ноль', () => {
    render(<Donut done={0} total={0} tone="muted" />)
    expect(screen.getByText('0/0')).toBeTruthy()
    // длина закрашенной дуги нулевая: кольцо пустое
    expect(screen.getByTestId('workout-donut-arc').props.strokeDasharray[0]).toBe('0')
  })

  it('доля читается вспомогательными технологиями', () => {
    render(<Donut done={2} total={5} tone="danger" />)
    expect(screen.getByTestId('workout-donut').props.accessibilityLabel).toBe('2/5')
  })
})

describe('ScreenHeader', () => {
  it('показывает заголовок и подпись', () => {
    render(<ScreenHeader title="Грудь + трицепс" subtitle="11 августа, вторник" />)
    expect(screen.getByTestId('header-title')).toHaveTextContent('Грудь + трицепс')
    expect(screen.getByTestId('header-subtitle')).toHaveTextContent('11 августа, вторник')
  })

  it('без подписи её нет в разметке', () => {
    render(<ScreenHeader title="Новая программа" />)
    expect(screen.queryByTestId('header-subtitle')).toBeNull()
  })

  it('кнопка «назад» появляется только с обработчиком', () => {
    const onBack = jest.fn()
    const { rerender } = render(<ScreenHeader title="Экран" />)
    expect(screen.queryByTestId('header-back')).toBeNull()

    rerender(<ScreenHeader title="Экран" onBack={onBack} />)
    fireEvent.press(screen.getByTestId('header-back'))
    expect(onBack).toHaveBeenCalled()
  })
})

describe('Chip', () => {
  it('нажатие вызывает обработчик', () => {
    const onPress = jest.fn()
    render(<Chip label="Все" onPress={onPress} testID="chip-all" />)
    fireEvent.press(screen.getByTestId('chip-all'))
    expect(onPress).toHaveBeenCalled()
  })

  it('выбранное состояние сообщается вспомогательным технологиям', () => {
    render(<Chip label="Все" selected onPress={jest.fn()} testID="chip-all" />)
    expect(screen.getByTestId('chip-all').props.accessibilityState).toMatchObject({ selected: true })
  })

  it('без обработчика остаётся некликабельной подписью', () => {
    render(<Chip label="Грудь" dotColor="#E5484D" testID="chip-legend" />)
    expect(screen.getByTestId('chip-legend').props.accessibilityRole).toBeUndefined()
  })
})
