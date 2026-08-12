import * as DocumentPicker from 'expo-document-picker'
import * as FileSystem from 'expo-file-system/legacy'
import * as Sharing from 'expo-sharing'
import type { FileGateway } from '../../app/ports'

/**
 * Файловый шлюз приложения (FR-7.1–FR-7.3).
 *
 * Выгрузки складываются в кэш и сразу уходят в системное «Поделиться»: своей
 * папки в общем хранилище приложение не заводит, разрешений не просит.
 * Автобэкапы лежат в приватной директории и наружу не показываются.
 */

const BACKUPS_DIR = `${FileSystem.documentDirectory}backups/`

const ensureBackupsDir = async (): Promise<void> => {
  const info = await FileSystem.getInfoAsync(BACKUPS_DIR)
  if (!info.exists) await FileSystem.makeDirectoryAsync(BACKUPS_DIR, { intermediates: true })
}

const readJson = async (uri: string): Promise<unknown> => {
  const raw = await FileSystem.readAsStringAsync(uri)
  return JSON.parse(raw)
}

export const createExpoFileGateway = (): FileGateway => ({
  async saveExport(fileName, content) {
    const path = `${FileSystem.cacheDirectory}${fileName}`
    await FileSystem.writeAsStringAsync(path, JSON.stringify(content, null, 2))
    return path
  },

  async pickJson() {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/json',
      copyToCacheDirectory: true,
    })
    if (result.canceled) return null

    const asset = result.assets[0]
    if (!asset) return null
    return readJson(asset.uri)
  },

  async share(path) {
    if (!(await Sharing.isAvailableAsync())) return
    await Sharing.shareAsync(path, { mimeType: 'application/json' })
  },

  async listBackups() {
    await ensureBackupsDir()
    const names = await FileSystem.readDirectoryAsync(BACKUPS_DIR)
    // свежие первыми: в имени лежит момент снятия
    return names.sort().reverse()
  },

  async saveBackup(fileName, content) {
    await ensureBackupsDir()
    await FileSystem.writeAsStringAsync(`${BACKUPS_DIR}${fileName}`, JSON.stringify(content))
  },

  async readBackup(fileName) {
    const info = await FileSystem.getInfoAsync(`${BACKUPS_DIR}${fileName}`)
    if (!info.exists) return null
    return readJson(`${BACKUPS_DIR}${fileName}`)
  },

  async removeBackup(fileName) {
    await FileSystem.deleteAsync(`${BACKUPS_DIR}${fileName}`, { idempotent: true })
  },
})
