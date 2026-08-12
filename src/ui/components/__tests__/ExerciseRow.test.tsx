import { fireEvent, screen } from '@testing-library/react-native'
import { renderWithProviders as render } from '../../testing/render'
import { ExerciseRow } from '../ExerciseRow'

const sets = [
  { id: '1', weightKg: 80, reps: 8 },
  { id: '2', weightKg: 82.5, reps: 6 },
]

describe('ExerciseRow', () => {
  it('показывает название и план из программы', () => {
    render(
      <ExerciseRow
        index={0}
        name="Жим лёжа"
        targetSets={4}
        targetReps={8}
        sets={[]}
        done={false}
        unit="kg"
        onToggleDone={jest.fn()}
        onAddSet={jest.fn()}
        onOpenHistory={jest.fn()}
      />,
    )

    expect(screen.getByText('Жим лёжа')).toBeTruthy()
    expect(screen.getByText('4 × 8')).toBeTruthy()
  })

  it('показывает подходы чипами в формате «80 × 8»', () => {
    render(
      <ExerciseRow
        index={0}
        name="Жим лёжа"
        sets={sets}
        done={false}
        unit="kg"
        onToggleDone={jest.fn()}
        onAddSet={jest.fn()}
        onOpenHistory={jest.fn()}
      />,
    )

    expect(screen.getByText('80 × 8')).toBeTruthy()
    expect(screen.getByText('82.5 × 6')).toBeTruthy()
  })

  it('подход без веса показывается как «× 12»', () => {
    render(
      <ExerciseRow
        index={0}
        name="Подтягивания"
        sets={[{ id: '1', weightKg: null, reps: 12 }]}
        done={false}
        unit="kg"
        onToggleDone={jest.fn()}
        onAddSet={jest.fn()}
        onOpenHistory={jest.fn()}
      />,
    )

    expect(screen.getByText('× 12')).toBeTruthy()
  })

  it('в фунтах вес пересчитывается (FR-7.5)', () => {
    render(
      <ExerciseRow
        index={0}
        name="Жим лёжа"
        sets={[{ id: '1', weightKg: 82.5, reps: 6 }]}
        done={false}
        unit="lb"
        onToggleDone={jest.fn()}
        onAddSet={jest.fn()}
        onOpenHistory={jest.fn()}
      />,
    )

    expect(screen.getByText('182 × 6')).toBeTruthy()
  })

  it('выполненное упражнение зачёркнуто (FR-4.5)', () => {
    render(
      <ExerciseRow
        index={0}
        name="Жим лёжа"
        sets={sets}
        done
        unit="kg"
        onToggleDone={jest.fn()}
        onAddSet={jest.fn()}
        onOpenHistory={jest.fn()}
      />,
    )

    expect(screen.getByText('Жим лёжа')).toHaveStyle({ textDecorationLine: 'line-through' })
  })

  it('невыполненное упражнение не зачёркнуто', () => {
    render(
      <ExerciseRow
        index={0}
        name="Жим лёжа"
        sets={sets}
        done={false}
        unit="kg"
        onToggleDone={jest.fn()}
        onAddSet={jest.fn()}
        onOpenHistory={jest.fn()}
      />,
    )

    expect(screen.getByText('Жим лёжа')).not.toHaveStyle({ textDecorationLine: 'line-through' })
  })

  it('нажатие на чекбокс переключает отметку', () => {
    const onToggleDone = jest.fn()
    render(
      <ExerciseRow
        index={2}
        name="Жим лёжа"
        sets={sets}
        done={false}
        unit="kg"
        onToggleDone={onToggleDone}
        onAddSet={jest.fn()}
        onOpenHistory={jest.fn()}
      />,
    )

    fireEvent.press(screen.getByTestId('item-checkbox-2'))
    expect(onToggleDone).toHaveBeenCalledWith(true)
  })

  it('повторное нажатие снимает отметку', () => {
    const onToggleDone = jest.fn()
    render(
      <ExerciseRow
        index={0}
        name="Жим лёжа"
        sets={sets}
        done
        unit="kg"
        onToggleDone={onToggleDone}
        onAddSet={jest.fn()}
        onOpenHistory={jest.fn()}
      />,
    )

    fireEvent.press(screen.getByTestId('item-checkbox-0'))
    expect(onToggleDone).toHaveBeenCalledWith(false)
  })

  it('кнопка «＋ подход» вызывает обработчик', () => {
    const onAddSet = jest.fn()
    render(
      <ExerciseRow
        index={1}
        name="Жим лёжа"
        sets={[]}
        done={false}
        unit="kg"
        onToggleDone={jest.fn()}
        onAddSet={onAddSet}
        onOpenHistory={jest.fn()}
      />,
    )

    fireEvent.press(screen.getByTestId('add-set-1'))
    expect(onAddSet).toHaveBeenCalled()
  })

  it('история открывается отдельной кнопкой, а не сразу (FR-5.1)', () => {
    const onOpenHistory = jest.fn()
    render(
      <ExerciseRow
        index={0}
        name="Жим лёжа"
        sets={sets}
        done={false}
        unit="kg"
        onToggleDone={jest.fn()}
        onAddSet={jest.fn()}
        onOpenHistory={onOpenHistory}
      />,
    )

    fireEvent.press(screen.getByTestId('open-history-0'))
    expect(onOpenHistory).toHaveBeenCalled()
  })

  it('у упражнения без плана подпись не рисуется', () => {
    render(
      <ExerciseRow
        index={0}
        name="Жим лёжа"
        sets={[]}
        done={false}
        unit="kg"
        onToggleDone={jest.fn()}
        onAddSet={jest.fn()}
        onOpenHistory={jest.fn()}
      />,
    )

    expect(screen.queryByTestId('item-target-0')).toBeNull()
  })
})
