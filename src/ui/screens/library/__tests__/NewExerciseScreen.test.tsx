import { fireEvent, screen, waitFor, within } from '@testing-library/react-native'
import { createTestServices, renderWithProviders as render } from '../../../testing/render'
import { NewExerciseScreen } from '../NewExerciseScreen'

describe('Новое упражнение', () => {
  it('свободное название сразу помечается зелёной строкой', async () => {
    const { services } = createTestServices()

    render(<NewExerciseScreen />, { services })

    fireEvent.changeText(await screen.findByTestId('name-input'), 'Жим лёжа узким хватом')

    expect(within(await screen.findByTestId('name-free')).getByText('Такого упражнения ещё нет')).toBeTruthy()
    expect(screen.queryByTestId('name-error')).toBeNull()
  })

  it('дубликат подсвечивается прямо при вводе, без нажатия кнопки (FR-2.1.1)', async () => {
    const { services } = createTestServices()
    await services.createExercise({ name: 'Жим лёжа' })

    render(<NewExerciseScreen />, { services })

    fireEvent.changeText(await screen.findByTestId('name-input'), 'Жим лёжа')

    expect(within(await screen.findByTestId('name-error')).getByText('Такое упражнение уже есть')).toBeTruthy()
    expect(screen.getByTestId('create-button').props.accessibilityState).toMatchObject({
      disabled: true,
    })
  })

  it('регистр в проверке дубликата не важен', async () => {
    const { services } = createTestServices()
    await services.createExercise({ name: 'Жим лёжа' })

    render(<NewExerciseScreen />, { services })

    fireEvent.changeText(await screen.findByTestId('name-input'), '  жим ЛЁЖА  ')

    expect(await screen.findByTestId('name-error')).toBeTruthy()
  })

  it('создание пишет упражнение в порты вместе с группой и заметкой', async () => {
    const { services, ports } = createTestServices()
    const onCreated = jest.fn()

    render(<NewExerciseScreen onCreated={onCreated} />, { services })

    fireEvent.changeText(await screen.findByTestId('name-input'), 'Жим лёжа узким хватом')
    fireEvent.press(screen.getByTestId('muscle-group-chest'))
    fireEvent.changeText(screen.getByTestId('note-input'), 'Локти ближе к корпусу')
    fireEvent.press(screen.getByTestId('create-button'))

    await waitFor(() => expect(onCreated).toHaveBeenCalled())

    const exercises = await ports.exercises.list()
    expect(exercises).toHaveLength(1)
    expect(exercises[0]).toMatchObject({
      name: 'Жим лёжа узким хватом',
      muscleGroup: 'chest',
      note: 'Локти ближе к корпусу',
    })
  })

  it('пустое название не даёт создать упражнение', async () => {
    const { services, ports } = createTestServices()

    render(<NewExerciseScreen />, { services })

    const button = await screen.findByTestId('create-button')
    expect(button.props.accessibilityState).toMatchObject({ disabled: true })

    fireEvent.press(button)
    await waitFor(async () => expect(await ports.exercises.list()).toHaveLength(0))
  })

  it('чипы групп мышц выложены двумя рядами и переключаются', async () => {
    const { services } = createTestServices()

    render(<NewExerciseScreen />, { services })

    const chip = await screen.findByTestId('muscle-group-core')
    expect(chip.props.accessibilityState).toMatchObject({ selected: false })

    fireEvent.press(chip)
    expect(screen.getByTestId('muscle-group-core').props.accessibilityState).toMatchObject({
      selected: true,
    })

    fireEvent.press(screen.getByTestId('muscle-group-core'))
    expect(screen.getByTestId('muscle-group-core').props.accessibilityState).toMatchObject({
      selected: false,
    })
  })
})
