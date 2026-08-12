import { fireEvent, screen, waitFor, within } from '@testing-library/react-native'
import { createTestServices, renderWithProviders as render } from '../../../testing/render'
import { NewProgramScreen } from '../NewProgramScreen'

describe('Новая программа', () => {
  it('кнопка «Создать» неактивна, пока название пустое (FR-3.1.1)', async () => {
    const { services } = createTestServices()

    render(<NewProgramScreen />, { services })

    const button = await screen.findByTestId('create-button')
    expect(button.props.accessibilityState).toMatchObject({ disabled: true })
    expect(screen.getByText('Кнопка станет активной, когда появится название')).toBeTruthy()

    fireEvent.changeText(screen.getByTestId('name-input'), 'Грудь + трицепс')

    await waitFor(() =>
      expect(screen.getByTestId('create-button').props.accessibilityState).toMatchObject({
        disabled: false,
      }),
    )
  })

  it('пустое название не создаёт программу даже при нажатии', async () => {
    const { services, ports } = createTestServices()

    render(<NewProgramScreen />, { services })
    fireEvent.press(await screen.findByTestId('create-button'))

    await waitFor(async () => expect(await ports.programs.list()).toHaveLength(0))
  })

  it('предлагается первый свободный цвет палитры', async () => {
    const { services } = createTestServices()
    await services.createProgram({ name: 'Спина + бицепс', color: 'prog-red' })

    render(<NewProgramScreen />, { services })

    await waitFor(() =>
      expect(screen.getByTestId('program-color-prog-orange').props.accessibilityState).toMatchObject({
        selected: true,
      }),
    )
    expect(screen.getByTestId('program-color-prog-red').props.accessibilityState).toMatchObject({
      selected: false,
    })
  })

  it('созданная программа появляется в портах с выбранным цветом', async () => {
    const { services, ports } = createTestServices()
    const onCreated = jest.fn()

    render(<NewProgramScreen onCreated={onCreated} />, { services })

    fireEvent.changeText(await screen.findByTestId('name-input'), 'Грудь + трицепс')
    fireEvent.press(screen.getByTestId('program-color-prog-teal'))
    fireEvent.press(screen.getByTestId('create-button'))

    await waitFor(() => expect(onCreated).toHaveBeenCalled())

    const programs = await ports.programs.list()
    expect(programs).toHaveLength(1)
    expect(programs[0]).toMatchObject({ name: 'Грудь + трицепс', color: 'prog-teal' })
  })

  it('состав сохраняется в том порядке, в котором его выбрали', async () => {
    const { services, ports } = createTestServices()
    await services.createExercise({ name: 'Жим лёжа', muscleGroup: 'chest' })
    await services.createExercise({ name: 'Разводка гантелей', muscleGroup: 'chest' })

    render(<NewProgramScreen />, { services })

    fireEvent.changeText(await screen.findByTestId('name-input'), 'Грудь + трицепс')
    fireEvent.press(screen.getByTestId('exercise-picker-open'))

    fireEvent.press(await screen.findByTestId('exercise-row-Разводка гантелей'))
    fireEvent.press(screen.getByTestId('exercise-row-Жим лёжа'))
    fireEvent.press(screen.getByTestId('exercise-picker-done'))

    expect(within(await screen.findByTestId('program-item-0')).getByText('Разводка гантелей')).toBeTruthy()
    expect(within(screen.getByTestId('program-item-1')).getByText('Жим лёжа')).toBeTruthy()

    fireEvent.press(screen.getByTestId('create-button'))

    await waitFor(async () => expect(await ports.programs.list()).toHaveLength(1))
    const [program] = await ports.programs.list()
    const stored = await ports.programs.byIdWithItems(program!.id)
    expect(stored!.items.map((item) => item.exerciseName)).toEqual(['Разводка гантелей', 'Жим лёжа'])
  })
})
