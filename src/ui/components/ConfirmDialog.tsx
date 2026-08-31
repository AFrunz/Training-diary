import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { useT } from '../i18n/I18nProvider'
import { useTheme } from '../theme/ThemeProvider'
import { palette, radii, uiFont } from '../theme/tokens'

/**
 * Подтверждение необратимого действия: удаления тренировки (FR-4.7) и подобного.
 *
 * Диалог, а не шит снизу: вопрос короткий, а решение требует внимания — по центру
 * экрана его труднее нажать случайно. Ползунок, как в «удалить все данные»,
 * здесь избыточен: тренировка восстанавливается повтором записи, а не бэкапом.
 */

export interface ConfirmDialogProps {
  readonly visible: boolean
  readonly title: string
  readonly message: string
  readonly confirmLabel: string
  /** Опасное действие красится в `danger`; обычное — акцентом. */
  readonly destructive?: boolean
  readonly onConfirm: () => void
  readonly onCancel: () => void
  readonly testID?: string
}

export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  destructive = false,
  onConfirm,
  onCancel,
  testID = 'confirm-dialog',
}: ConfirmDialogProps) {
  const { colors } = useTheme()
  const { t } = useT()

  if (!visible) return null

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCancel} testID={testID}>
      <View style={styles.root}>
        <Pressable
          testID={`${testID}-scrim`}
          accessibilityRole="button"
          accessibilityLabel={t('common.cancel')}
          onPress={onCancel}
          style={[StyleSheet.absoluteFill, styles.scrim, { backgroundColor: palette.dark.bg }]}
        />

        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <View style={styles.texts}>
            <Text testID={`${testID}-title`} style={[styles.title, { color: colors.textPrimary }]}>
              {title}
            </Text>
            <Text style={[styles.message, { color: colors.textSecondary }]}>{message}</Text>
          </View>

          <View style={styles.actions}>
            <Pressable
              testID={`${testID}-cancel`}
              accessibilityRole="button"
              onPress={onCancel}
              style={[styles.button, { backgroundColor: colors.surface2 }]}
            >
              <Text style={[styles.buttonLabel, { color: colors.textPrimary }]}>
                {t('common.cancel')}
              </Text>
            </Pressable>

            <Pressable
              testID={`${testID}-confirm`}
              accessibilityRole="button"
              onPress={onConfirm}
              style={[
                styles.button,
                { backgroundColor: destructive ? colors.danger : colors.accent },
              ]}
            >
              <Text style={[styles.buttonLabel, { color: colors.onAccent }]}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  scrim: { opacity: 0.7 },
  card: { width: '100%', borderRadius: radii.lg, padding: 20, gap: 18 },
  texts: { gap: 6 },
  title: { fontFamily: uiFont('700'), fontSize: 17, fontWeight: '700' },
  message: { fontFamily: uiFont('500'), fontSize: 13, fontWeight: '500', lineHeight: 18 },
  actions: { flexDirection: 'row', gap: 10 },
  button: {
    flex: 1,
    borderRadius: radii.md,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonLabel: { fontFamily: uiFont('600'), fontSize: 14, fontWeight: '600' },
})
