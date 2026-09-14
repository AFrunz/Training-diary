import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native'
import type { ReactNode } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'

/**
 * Поднимает содержимое над клавиатурой.
 *
 * В режиме edge-to-edge (он включён по умолчанию с Expo SDK 53) окно под
 * клавиатуру больше не сжимается, поэтому `adjustResize` ничего не даёт: поле
 * ввода и кнопки остаются под ней. `KeyboardAvoidingView` считает перекрытие
 * по событиям клавиатуры и работает в обоих режимах — на нём держится весь
 * ввод в приложении, и это проверяет отдельный тест.
 */

export interface KeyboardAvoiderProps {
  readonly children: ReactNode
  readonly style?: StyleProp<ViewStyle>
  readonly testID?: string
}

export function KeyboardAvoider({ children, style, testID }: KeyboardAvoiderProps) {
  return (
    <KeyboardAvoidingView
      testID={testID}
      // на iOS отступ снизу, на Android сжатие: так ведут себя нативные экраны
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.root, style]}
    >
      {children}
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
})
