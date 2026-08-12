import type { ExportBundle, ImportMode, MergeSummary } from '../../domain/transfer/types'
import type { Ports } from '../ports'

/** Экспорт и импорт (FR-7.1, FR-7.2). Файловый ввод-вывод остаётся в infra. */

export const exportAll = (_p: Ports) => async (): Promise<ExportBundle> => {
  throw new Error('exportAll не реализован')
}

export const importAll =
  (_p: Ports) =>
  async (_input: { readonly raw: unknown; readonly mode: ImportMode }): Promise<MergeSummary> => {
    throw new Error('importAll не реализован')
  }
