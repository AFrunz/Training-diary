import { fireEvent, screen, waitFor } from '@testing-library/react-native'
import { localDate } from '../../../../domain/model/types'
import { createTestServices, renderWithProviders as render } from '../../../testing/render'
import { NewAbsenceScreen } from '../NewAbsenceScreen'

const DATE = localDate('2026-08-17')
const ALL_TIME = { from: localDate('0000-01-01'), to: localDate('9999-12-31') }

describe('NewAbsenceScreen (FR-1.6)', () => {
  it('по умолчанию предлагает неделю от выбранного дня', () => {
    const { services } = createTestServices()
    render(<NewAbsenceScreen date={DATE} />, { services })

    expect(screen.getByTestId('absence-start-date').props.value).toBe('2026-08-17')
    expect(screen.getByTestId('absence-end-date').props.value).toBe('2026-08-23')
  })

  it('по умолчанию выбран отпуск', () => {
    const { services } = createTestServices()
    render(<NewAbsenceScreen date={DATE} />, { services })

    expect(screen.getByTestId('absence-type-vacation').props.accessibilityState).toMatchObject({
      selected: true,
    })
  })

  it('сохраняет отсутствие с выбранным типом и заметкой', async () => {
    const { services, ports } = createTestServices()
    const onCreated = jest.fn()
    render(<NewAbsenceScreen date={DATE} onCreated={onCreated} />, { services })

    fireEvent.press(screen.getByTestId('absence-type-illness'))
    fireEvent.changeText(screen.getByTestId('absence-note'), 'Грипп')
    fireEvent.press(screen.getByTestId('absence-save'))

    await waitFor(() => expect(onCreated).toHaveBeenCalled())
    const [absence] = await ports.absences.listRange(ALL_TIME)
    expect(absence).toMatchObject({
      startDate: '2026-08-17',
      endDate: '2026-08-23',
      type: 'illness',
      note: 'Грипп',
    })
  })

  it('показывает длину периода в днях', () => {
    const { services } = createTestServices()
    render(<NewAbsenceScreen date={DATE} />, { services })

    expect(screen.getByTestId('absence-length')).toHaveTextContent(/^7 дней подряд$/)
  })

  it('конец раньше начала показывает ошибку и ничего не сохраняет', async () => {
    const { services, ports } = createTestServices()
    render(<NewAbsenceScreen date={DATE} />, { services })

    fireEvent.changeText(screen.getByTestId('absence-end-date'), '2026-08-10')
    fireEvent.press(screen.getByTestId('absence-save'))

    expect(await screen.findByTestId('absence-error')).toBeTruthy()
    expect(await ports.absences.listRange(ALL_TIME)).toHaveLength(0)
  })

  it('период длиннее года отклоняется', async () => {
    const { services } = createTestServices()
    render(<NewAbsenceScreen date={localDate('2026-01-01')} />, { services })

    fireEvent.changeText(screen.getByTestId('absence-end-date'), '2027-06-01')
    fireEvent.press(screen.getByTestId('absence-save'))

    expect(await screen.findByTestId('absence-error')).toBeTruthy()
  })

  it('незаполненная дата делает кнопку недоступной', () => {
    const { services } = createTestServices()
    render(<NewAbsenceScreen date={DATE} />, { services })

    fireEvent.changeText(screen.getByTestId('absence-end-date'), '17 августа')

    expect(screen.getByTestId('absence-save').props.accessibilityState).toMatchObject({ disabled: true })
  })

  it('отсутствие на один день допустимо', async () => {
    const { services, ports } = createTestServices()
    render(<NewAbsenceScreen date={DATE} onCreated={jest.fn()} />, { services })

    fireEvent.changeText(screen.getByTestId('absence-end-date'), '2026-08-17')
    fireEvent.press(screen.getByTestId('absence-save'))

    await waitFor(async () => expect(await ports.absences.listRange(ALL_TIME)).toHaveLength(1))
  })
})
