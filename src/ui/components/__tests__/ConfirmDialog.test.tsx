import { fireEvent, screen } from '@testing-library/react-native'
import { renderWithProviders as render } from '../../testing/render'
import { ConfirmDialog } from '../ConfirmDialog'
import type { ConfirmDialogProps } from '../ConfirmDialog'

const dialog = (over: Partial<ConfirmDialogProps> = {}) => (
  <ConfirmDialog
    visible
    title="Удалить тренировку?"
    message="Отменить это нельзя."
    confirmLabel="Удалить"
    onConfirm={jest.fn()}
    onCancel={jest.fn()}
    {...over}
  />
)

describe('ConfirmDialog', () => {
  it('показывает вопрос и последствия', () => {
    render(dialog())

    expect(screen.getByTestId('confirm-dialog-title')).toHaveTextContent('Удалить тренировку?')
    expect(screen.getByText('Отменить это нельзя.')).toBeTruthy()
    expect(screen.getByTestId('confirm-dialog-confirm')).toHaveTextContent('Удалить')
  })

  it('скрытый диалог не рисуется', () => {
    render(dialog({ visible: false }))

    expect(screen.queryByTestId('confirm-dialog')).toBeNull()
  })

  it('подтверждение и отмена уходят в разные обработчики', () => {
    const onConfirm = jest.fn()
    const onCancel = jest.fn()
    render(dialog({ onConfirm, onCancel }))

    fireEvent.press(screen.getByTestId('confirm-dialog-confirm'))
    expect(onConfirm).toHaveBeenCalled()
    expect(onCancel).not.toHaveBeenCalled()

    fireEvent.press(screen.getByTestId('confirm-dialog-cancel'))
    expect(onCancel).toHaveBeenCalled()
  })

  it('нажатие мимо диалога равносильно отмене', () => {
    const onCancel = jest.fn()
    render(dialog({ onCancel }))

    fireEvent.press(screen.getByTestId('confirm-dialog-scrim'))
    expect(onCancel).toHaveBeenCalled()
  })

  it('опасное действие красится в danger, обычное — акцентом', () => {
    render(dialog({ destructive: true }))
    const danger = screen.getByTestId('confirm-dialog-confirm').props.style

    render(dialog())
    const accent = screen.getByTestId('confirm-dialog-confirm').props.style

    expect(JSON.stringify(danger)).not.toEqual(JSON.stringify(accent))
  })

  it('идентификаторы строятся от testID: на экране их может быть несколько', () => {
    render(dialog({ testID: 'delete-workout' }))

    expect(screen.getByTestId('delete-workout-confirm')).toBeTruthy()
    expect(screen.getByTestId('delete-workout-cancel')).toBeTruthy()
  })
})
