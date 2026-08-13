import { fireEvent, screen, waitFor } from '@testing-library/react-native'
import type { FakePorts } from '../../../../app/testing/fakes'
import { id as makeId, instant } from '../../../../domain/model/types'
import { createTestServices, renderWithProviders } from '../../../testing/render'
import { BackupsScreen } from '../BackupsScreen'

/**
 * Экран автобэкапов (FR-7.3): список снятых копий, снятие руками и
 * восстановление с подтверждением. Копии снимает сценарий `runBackup`,
 * поэтому тесты готовят данные им же, а не подкладывают файлы в порт.
 */

const HOUR_MS = 60 * 60 * 1000

const seedExercise = (ports: FakePorts) => {
  ports.state.exercises.push({
    id: makeId('exercise-1'),
    name: 'Жим лёжа',
    createdAt: instant(0),
    updatedAt: instant(0),
  })
}

describe('экран автобэкапов', () => {
  it('показывает снятые копии свежими сверху', async () => {
    const { services, ports } = createTestServices()
    // часы двойника стоят на 2026-08-11T15:32:00Z, зона Europe/Moscow → 18:32
    await services.runBackup()
    ports.clock.advance(2 * HOUR_MS)
    await services.runBackup()

    renderWithProviders(<BackupsScreen />, { services })

    expect(await screen.findByTestId('backups-row-0-subtitle')).toHaveTextContent('20:32')
    expect(screen.getByTestId('backups-row-1-subtitle')).toHaveTextContent('18:32')
    expect(screen.getByTestId('backups-row-0-date')).toHaveTextContent('11 августа')
    expect(screen.queryByTestId('backups-row-2')).toBeNull()
    expect(screen.queryByTestId('backups-empty')).toBeNull()
  })

  it('«снять копию сейчас» добавляет копию в порты и в список', async () => {
    const { services, ports } = createTestServices()
    seedExercise(ports)

    renderWithProviders(<BackupsScreen />, { services })

    fireEvent.press(await screen.findByTestId('backups-create'))

    await waitFor(() => expect(Object.keys(ports.state.files.backups)).toHaveLength(1))
    expect(await screen.findByTestId('backups-row-0')).toBeOnTheScreen()
    expect(Object.keys(ports.state.files.backups)[0]).toMatch(/^backup-\d+\.json$/)
  })

  it('восстановление возвращает стёртые данные, но просит подтверждения', async () => {
    const { services, ports } = createTestServices()
    seedExercise(ports)
    await services.runBackup()
    await services.wipeAllData()
    expect(ports.state.exercises).toHaveLength(0)

    renderWithProviders(<BackupsScreen />, { services })

    fireEvent.press(await screen.findByTestId('backups-restore-0'))

    // первое нажатие только предупреждает: данные ещё не тронуты
    expect(ports.state.exercises).toHaveLength(0)
    expect(screen.getByTestId('backups-row-0-subtitle')).toHaveTextContent(
      'нажмите ещё раз, чтобы подтвердить',
    )

    fireEvent.press(screen.getByTestId('backups-restore-0'))

    await waitFor(() => expect(ports.state.exercises).toHaveLength(1))
    expect(ports.state.exercises[0]?.name).toBe('Жим лёжа')
  })

  it('без копий показывает пустое состояние', async () => {
    const { services } = createTestServices()

    renderWithProviders(<BackupsScreen />, { services })

    expect(await screen.findByTestId('backups-empty')).toBeOnTheScreen()
    expect(screen.queryByTestId('backups-row-0')).toBeNull()
    expect(screen.getByText('Копий пока нет')).toBeOnTheScreen()
  })

  it('шапка возвращает назад', async () => {
    const { services } = createTestServices()
    const onBack = jest.fn()

    renderWithProviders(<BackupsScreen onBack={onBack} />, { services })

    fireEvent.press(await screen.findByTestId('header-back'))

    expect(onBack).toHaveBeenCalledTimes(1)
  })
})
