import { fireEvent, screen, waitFor } from '@testing-library/react-native'

/** Системный календарь: открываем поле и отдаём выбранную дату, как это делает пикер. */
const pickDate = (testID: string, iso: string) => {
  fireEvent.press(screen.getByTestId(testID))
  const [year, month, day] = iso.split('-').map(Number)
  const picked = new Date(year!, month! - 1, day!)
  fireEvent(
    screen.getByTestId(`${testID}-picker`),
    'onChange',
    { type: 'set', nativeEvent: { timestamp: picked.getTime() } },
    picked,
  )
}

/** Машиночитаемое значение поля: человекочитаемая подпись остаётся для глаз. */
const dateValue = (testID: string): string => screen.getByTestId(testID).props.accessibilityValue.text
import { localDate } from '../../../../domain/model/types'
import { createTestServices, renderWithProviders as render } from '../../../testing/render'
import { NewAbsenceScreen } from '../NewAbsenceScreen'

const DATE = localDate('2026-08-17')
const ALL_TIME = { from: localDate('0000-01-01'), to: localDate('9999-12-31') }

describe('NewAbsenceScreen (FR-1.6)', () => {
  it('по умолчанию предлагает неделю от выбранного дня', () => {
    const { services } = createTestServices()
    render(<NewAbsenceScreen date={DATE} />, { services })

    expect(dateValue('absence-start-date')).toBe('2026-08-17')
    expect(dateValue('absence-end-date')).toBe('2026-08-23')
    // на экране дата человекочитаемая, а не «2026-08-17»
    expect(screen.getByText('17 августа')).toBeTruthy()
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

    pickDate('absence-end-date', '2026-08-10')
    fireEvent.press(screen.getByTestId('absence-save'))

    expect(await screen.findByTestId('absence-error')).toBeTruthy()
    expect(await ports.absences.listRange(ALL_TIME)).toHaveLength(0)
  })

  it('период длиннее года отклоняется', async () => {
    const { services } = createTestServices()
    render(<NewAbsenceScreen date={localDate('2026-01-01')} />, { services })

    pickDate('absence-end-date', '2027-06-01')
    fireEvent.press(screen.getByTestId('absence-save'))

    expect(await screen.findByTestId('absence-error')).toBeTruthy()
  })

  it('дату нельзя испортить руками: она приходит из системного календаря', () => {
    const { services } = createTestServices()
    render(<NewAbsenceScreen date={DATE} />, { services })

    expect(screen.getByTestId('absence-save').props.accessibilityState).toMatchObject({ disabled: false })
    expect(screen.queryByTestId('absence-end-date-picker')).toBeNull()
  })

  it('отсутствие на один день допустимо', async () => {
    const { services, ports } = createTestServices()
    render(<NewAbsenceScreen date={DATE} onCreated={jest.fn()} />, { services })

    pickDate('absence-end-date', '2026-08-17')
    fireEvent.press(screen.getByTestId('absence-save'))

    await waitFor(async () => expect(await ports.absences.listRange(ALL_TIME)).toHaveLength(1))
  })
})
