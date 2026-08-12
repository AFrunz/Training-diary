import { fireEvent, screen, waitFor } from '@testing-library/react-native'
import { id, localDate } from '../../../../domain/model/types'
import { createTestServices, renderWithProviders as render } from '../../../testing/render'
import { NewWorkoutScreen } from '../NewWorkoutScreen'

const TODAY = localDate('2026-08-11')

const world = async () => {
  const { services, ports } = createTestServices()
  const chest = await services.createExercise({ name: 'Жим лёжа' })
  const programA = await services.createProgram({ name: 'Грудь + трицепс', exerciseIds: [chest] })
  const programB = await services.createProgram({ name: 'Ноги + пресс' })
  return { services, ports, programA, programB }
}

describe('NewWorkoutScreen', () => {
  it('показывает все действующие программы', async () => {
    const { services } = await world()
    render(<NewWorkoutScreen date={TODAY} />, { services })

    expect(await screen.findByTestId('program-option-Грудь + трицепс')).toBeTruthy()
    expect(screen.getByTestId('program-option-Ноги + пресс')).toBeTruthy()
  })

  it('выбор программы создаёт тренировку и отдаёт её идентификатор', async () => {
    const { services, ports } = await world()
    const onCreated = jest.fn()
    render(<NewWorkoutScreen date={TODAY} onCreated={onCreated} />, { services })

    fireEvent.press(await screen.findByTestId('program-option-Грудь + трицепс'))

    await waitFor(() => expect(onCreated).toHaveBeenCalled())
    expect(ports.state.workouts).toHaveLength(1)
    expect(ports.state.workouts[0]!.date).toBe(TODAY)
  })

  it('состав программы копируется в тренировку', async () => {
    const { services, ports } = await world()
    render(<NewWorkoutScreen date={TODAY} onCreated={jest.fn()} />, { services })

    fireEvent.press(await screen.findByTestId('program-option-Грудь + трицепс'))

    await waitFor(() => expect(ports.state.workoutItems).toHaveLength(1))
    expect(ports.state.workoutItems[0]!.exerciseName).toBe('Жим лёжа')
  })

  it('на занятую дату предлагает открыть существующую тренировку (FR-1.3)', async () => {
    const { services, programA } = await world()
    const existing = await services.createWorkout({ date: TODAY, programId: programA })
    const onOpenExisting = jest.fn()
    render(<NewWorkoutScreen date={TODAY} onOpenExisting={onOpenExisting} />, { services })

    fireEvent.press(await screen.findByTestId('program-option-Ноги + пресс'))

    fireEvent.press(await screen.findByTestId('open-existing'))
    expect(onOpenExisting).toHaveBeenCalledWith(existing)
  })

  it('вторая тренировка на занятую дату не создаётся', async () => {
    const { services, ports, programA } = await world()
    await services.createWorkout({ date: TODAY, programId: programA })
    render(<NewWorkoutScreen date={TODAY} />, { services })

    fireEvent.press(await screen.findByTestId('program-option-Ноги + пресс'))

    await screen.findByTestId('open-existing')
    expect(ports.state.workouts).toHaveLength(1)
  })

  it('архивные программы в выборе не показываются', async () => {
    const { services, programB } = await world()
    await services.archiveProgram(programB)
    render(<NewWorkoutScreen date={TODAY} />, { services })

    await screen.findByTestId('program-option-Грудь + трицепс')
    expect(screen.queryByTestId('program-option-Ноги + пресс')).toBeNull()
  })

  it('без программ показывает пустое состояние, а не пустой экран', async () => {
    const { services } = createTestServices()
    render(<NewWorkoutScreen date={TODAY} />, { services })

    expect(await screen.findByTestId('new-workout-empty')).toBeTruthy()
  })
})
