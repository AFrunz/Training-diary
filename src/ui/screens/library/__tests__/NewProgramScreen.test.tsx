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

describe('Дублирование программы (FR-3.6)', () => {
  const seed = async () => {
    const { services, ports } = createTestServices()

    const bench = await services.createExercise({ name: 'Жим лёжа', muscleGroup: 'chest' })
    const fly = await services.createExercise({ name: 'Разводка гантелей', muscleGroup: 'chest' })
    const sourceId = await services.createProgram({
      name: 'Грудь + трицепс',
      color: 'prog-red',
      exerciseIds: [bench, fly],
    })

    return { services, ports, sourceId, bench, fly }
  }

  it('поля заполнены именем с пометкой копии и составом оригинала', async () => {
    const { services, sourceId } = await seed()

    render(<NewProgramScreen sourceProgramId={sourceId} />, { services })

    const input = await screen.findByTestId('name-input')
    await waitFor(() => expect(input.props.value).toBe('Грудь + трицепс (копия)'))

    expect(within(screen.getByTestId('program-item-0')).getByText('Жим лёжа')).toBeTruthy()
    expect(within(screen.getByTestId('program-item-1')).getByText('Разводка гантелей')).toBeTruthy()
  })

  it('копия создаётся только по кнопке «Создать»', async () => {
    const { services, ports, sourceId, bench, fly } = await seed()
    const onCreated = jest.fn()

    render(<NewProgramScreen sourceProgramId={sourceId} onCreated={onCreated} />, { services })

    // экран открыт, но в портах по-прежнему одна программа
    await waitFor(() =>
      expect(screen.getByTestId('name-input').props.value).toContain('Грудь + трицепс'),
    )
    expect(await ports.programs.list()).toHaveLength(1)

    fireEvent.press(screen.getByTestId('create-button'))
    await waitFor(() => expect(onCreated).toHaveBeenCalled())

    const programs = await ports.programs.list()
    expect(programs).toHaveLength(2)

    const copy = programs.find((program) => program.id !== sourceId)!
    expect(copy.id).not.toBe(sourceId)

    const stored = await ports.programs.byIdWithItems(copy.id)
    expect(stored!.items.map((item) => item.exerciseId)).toEqual([bench, fly])
    // у копии свои строки состава, а не общие с оригиналом
    const original = await ports.programs.byIdWithItems(sourceId)
    expect(original!.program.name).toBe('Грудь + трицепс')
    expect(original!.items.map((item) => item.exerciseId)).toEqual([bench, fly])
    expect(stored!.items.map((item) => item.id)).not.toEqual(original!.items.map((item) => item.id))
  })

  it('правка названия перед созданием сохраняется', async () => {
    const { services, ports, sourceId } = await seed()

    render(<NewProgramScreen sourceProgramId={sourceId} />, { services })

    await waitFor(() =>
      expect(screen.getByTestId('name-input').props.value).toBe('Грудь + трицепс (копия)'),
    )
    fireEvent.changeText(screen.getByTestId('name-input'), 'Грудь + трицепс, вариант Б')
    fireEvent.press(screen.getByTestId('create-button'))

    await waitFor(async () => expect(await ports.programs.list()).toHaveLength(2))
    const programs = await ports.programs.list()
    expect(programs.map((program) => program.name).sort()).toEqual([
      'Грудь + трицепс',
      'Грудь + трицепс, вариант Б',
    ])
  })

  it('без sourceProgramId форма остаётся пустой', async () => {
    const { services } = await seed()

    render(<NewProgramScreen />, { services })

    expect((await screen.findByTestId('name-input')).props.value).toBe('')
    expect(screen.getByTestId('program-empty')).toBeTruthy()
  })
})
