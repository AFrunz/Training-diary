import { fireEvent, screen, waitFor, within } from '@testing-library/react-native'
import type { Services } from '../../../../app/container'
import { createTestServices, renderWithProviders as render } from '../../../testing/render'
import { ExercisePickerSheet } from '../ExercisePickerSheet'

const seed = async (services: Services) => {
  await services.createExercise({ name: 'Жим лёжа', muscleGroup: 'chest' })
  await services.createExercise({ name: 'Разводка гантелей', muscleGroup: 'chest' })
  await services.createExercise({ name: 'Подтягивания', muscleGroup: 'back' })
}

describe('Выбор упражнений', () => {
  it('множественный выбор отражается в счётчике', async () => {
    const { services } = createTestServices()
    await seed(services)

    render(<ExercisePickerSheet onDone={jest.fn()} />, { services })

    await screen.findByTestId('exercise-row-Жим лёжа')
    expect(within(screen.getByTestId('exercise-picker-counter')).getByText('0')).toBeTruthy()

    fireEvent.press(screen.getByTestId('exercise-row-Жим лёжа'))
    fireEvent.press(screen.getByTestId('exercise-row-Подтягивания'))

    expect(within(screen.getByTestId('exercise-picker-counter')).getByText('2')).toBeTruthy()
    expect(screen.getByTestId('exercise-row-Жим лёжа').props.accessibilityState).toMatchObject({
      checked: true,
    })

    fireEvent.press(screen.getByTestId('exercise-row-Жим лёжа'))
    expect(within(screen.getByTestId('exercise-picker-counter')).getByText('1')).toBeTruthy()
  })

  it('«Готово» отдаёт выбранные id в порядке выбора', async () => {
    const { services, ports } = createTestServices()
    await seed(services)
    const exercises = await ports.exercises.list()
    const byName = (name: string) => exercises.find((exercise) => exercise.name === name)!.id
    const onDone = jest.fn()

    render(<ExercisePickerSheet onDone={onDone} />, { services })

    fireEvent.press(await screen.findByTestId('exercise-row-Подтягивания'))
    fireEvent.press(screen.getByTestId('exercise-row-Жим лёжа'))
    fireEvent.press(screen.getByTestId('exercise-picker-done'))

    expect(onDone).toHaveBeenCalledWith([byName('Подтягивания'), byName('Жим лёжа')])
  })

  it('упражнения сгруппированы по мышцам, поиск фильтрует список', async () => {
    const { services } = createTestServices()
    await seed(services)

    render(<ExercisePickerSheet onDone={jest.fn()} />, { services })

    expect(await screen.findByTestId('picker-group-chest')).toHaveTextContent('ГРУДЬ')
    expect(screen.getByTestId('picker-group-back')).toHaveTextContent('СПИНА')

    fireEvent.changeText(screen.getByTestId('exercise-picker-search'), 'развод')

    await waitFor(() => expect(screen.queryByTestId('exercise-row-Подтягивания')).toBeNull())
    expect(screen.getByTestId('exercise-row-Разводка гантелей')).toBeTruthy()
  })

  it('открывается с уже выбранным составом и предлагает создать упражнение', async () => {
    const { services, ports } = createTestServices()
    await seed(services)
    const exercises = await ports.exercises.list()
    const onCreateExercise = jest.fn()

    render(
      <ExercisePickerSheet
        selectedIds={[exercises[0]!.id]}
        onDone={jest.fn()}
        onCreateExercise={onCreateExercise}
      />,
      { services },
    )

    await waitFor(() =>
      expect(screen.getByTestId('exercise-row-Жим лёжа').props.accessibilityState).toMatchObject({
        checked: true,
      }),
    )
    expect(within(screen.getByTestId('exercise-picker-counter')).getByText('1')).toBeTruthy()

    fireEvent.press(screen.getByTestId('exercise-picker-create'))
    expect(onCreateExercise).toHaveBeenCalled()
  })

  it('скрытый шит ничего не рисует', async () => {
    const { services } = createTestServices()
    await seed(services)

    render(<ExercisePickerSheet visible={false} onDone={jest.fn()} />, { services })

    expect(screen.queryByTestId('exercise-picker')).toBeNull()
  })
})
