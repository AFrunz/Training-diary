import { fireEvent, screen } from '@testing-library/react-native'
import { renderWithProviders as render } from '../../testing/render'
import { ExerciseRow } from '../ExerciseRow'
import type { ExerciseRowProps } from '../ExerciseRow'

const sets = [
  { id: '1', weightKg: 80, reps: 8 },
  { id: '2', weightKg: 82.5, reps: 6 },
]

/** Обязательные пропсы по умолчанию: в тестах интересна только их часть. */
const row = (over: Partial<ExerciseRowProps> = {}) => (
  <ExerciseRow
    index={0}
    name="Жим лёжа"
    sets={[]}
    previousSets={[]}
    done={false}
    unit="kg"
    onToggleDone={jest.fn()}
    onAddSet={jest.fn()}
    onEditSet={jest.fn()}
    onOpenHistory={jest.fn()}
    {...over}
  />
)

describe('ExerciseRow', () => {
  it('показывает название и план из программы', () => {
    render(row({ targetSets: 4, targetReps: 8 }))

    expect(screen.getByText('Жим лёжа')).toBeTruthy()
    expect(screen.getByText('4 × 8')).toBeTruthy()
  })

  it('показывает подходы чипами в формате «80 × 8»', () => {
    render(row({ sets }))

    expect(screen.getByText('80 × 8')).toBeTruthy()
    expect(screen.getByText('82.5 × 6')).toBeTruthy()
  })

  it('подход без веса показывается как «× 12»', () => {
    render(row({ name: 'Подтягивания', sets: [{ id: '1', weightKg: null, reps: 12 }] }))

    expect(screen.getByText('× 12')).toBeTruthy()
  })

  it('в фунтах вес пересчитывается (FR-7.5)', () => {
    render(row({ sets: [{ id: '1', weightKg: 82.5, reps: 6 }], unit: 'lb' }))

    expect(screen.getByText('182 × 6')).toBeTruthy()
  })

  it('единица подхода подписывается, когда отличается от настроек (FR-4.11)', () => {
    render(
      row({
        sets: [
          { id: '1', weightKg: 82.5, unit: 'lb', reps: 6 },
          { id: '2', angleDeg: 45, unit: 'deg', reps: 15 },
        ],
      }),
    )

    expect(screen.getByText('182 lb × 6')).toBeTruthy()
    expect(screen.getByText('45° × 15')).toBeTruthy()
  })

  it('выполненное упражнение зачёркнуто (FR-4.5)', () => {
    render(row({ sets, done: true }))

    expect(screen.getByText('Жим лёжа')).toHaveStyle({ textDecorationLine: 'line-through' })
  })

  it('невыполненное упражнение не зачёркнуто', () => {
    render(row({ sets }))

    expect(screen.getByText('Жим лёжа')).not.toHaveStyle({ textDecorationLine: 'line-through' })
  })

  it('нажатие на чекбокс переключает отметку', () => {
    const onToggleDone = jest.fn()
    render(row({ index: 2, sets, onToggleDone }))

    fireEvent.press(screen.getByTestId('item-checkbox-2'))
    expect(onToggleDone).toHaveBeenCalledWith(true)
  })

  it('повторное нажатие снимает отметку', () => {
    const onToggleDone = jest.fn()
    render(row({ sets, done: true, onToggleDone }))

    fireEvent.press(screen.getByTestId('item-checkbox-0'))
    expect(onToggleDone).toHaveBeenCalledWith(false)
  })

  it('кнопка добавления подхода вызывает обработчик', () => {
    const onAddSet = jest.fn()
    render(row({ index: 1, onAddSet }))

    fireEvent.press(screen.getByTestId('add-set-1'))
    expect(onAddSet).toHaveBeenCalled()
  })

  it('кнопка добавления — только иконка, без подписи', () => {
    render(row())

    expect(screen.getByTestId('add-set-0')).not.toHaveTextContent('подход')
  })

  it('история открывается отдельной кнопкой, а не сразу (FR-5.1)', () => {
    const onOpenHistory = jest.fn()
    render(row({ sets, onOpenHistory }))

    fireEvent.press(screen.getByTestId('open-history-0'))
    expect(onOpenHistory).toHaveBeenCalled()
  })

  it('у упражнения без плана подпись не рисуется', () => {
    render(row())

    expect(screen.queryByTestId('item-target-0')).toBeNull()
  })
})

describe('ExerciseRow — пары с прошлой тренировкой (FR-4.10)', () => {
  it('подход прошлой тренировки стоит над сегодняшним под тем же номером', () => {
    render(
      row({
        sets: [{ id: 'n-1', weightKg: 85, reps: 8 }],
        previousSets: [
          { id: 'p-1', weightKg: 80, reps: 8 },
          { id: 'p-2', weightKg: 80, reps: 6 },
        ],
      }),
    )

    expect(screen.getByTestId('set-previous-0-0')).toHaveTextContent('80 × 8')
    expect(screen.getByTestId('set-chip-0-0')).toHaveTextContent('85 × 8')
    // второй подход в прошлый раз был, сегодня его ещё нет
    expect(screen.getByTestId('set-previous-0-1')).toHaveTextContent('80 × 6')
    expect(screen.getByTestId('set-missing-0-1')).toBeTruthy()
  })

  it('подход сверх прошлого раза остаётся без пары, но рисуется', () => {
    render(
      row({
        sets: [
          { id: 'n-1', weightKg: 85, reps: 8 },
          { id: 'n-2', weightKg: 85, reps: 6 },
        ],
        previousSets: [{ id: 'p-1', weightKg: 80, reps: 8 }],
      }),
    )

    expect(screen.getByTestId('set-chip-0-1')).toHaveTextContent('85 × 6')
    expect(screen.queryByTestId('set-previous-0-1')).toBeNull()
  })

  it('без истории верхнего ряда нет вовсе', () => {
    render(row({ sets }))

    expect(screen.queryByTestId('set-previous-0-0')).toBeNull()
    expect(screen.queryByTestId('set-missing-0-0')).toBeNull()
  })

  it('тап по сегодняшнему подходу открывает правку с его номером', () => {
    const onEditSet = jest.fn()
    render(row({ sets, onEditSet }))

    fireEvent.press(screen.getByTestId('set-chip-0-1'))
    expect(onEditSet).toHaveBeenCalledWith('2', 2)
  })

  it('подход прошлой тренировки не правится', () => {
    const onEditSet = jest.fn()
    render(row({ previousSets: [{ id: 'p-1', weightKg: 80, reps: 8 }], onEditSet }))

    fireEvent.press(screen.getByTestId('set-previous-0-0'))
    expect(onEditSet).not.toHaveBeenCalled()
  })
})

describe('ExerciseRow — тема', () => {
  it('явно выбранная тёмная тема применяется, даже если система светлая', () => {
    render(row({ sets }), { theme: 'dark' })
    const dark = screen.getByText('Жим лёжа').props.style

    render(row({ sets }), { theme: 'light' })
    const light = screen.getByText('Жим лёжа').props.style

    expect(JSON.stringify(dark)).not.toEqual(JSON.stringify(light))
  })
})
