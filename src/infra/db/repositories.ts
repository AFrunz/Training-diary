import type { Ports } from '../../app/ports'
import type { SqlDriver } from './driver'

/**
 * Реализация портов поверх SQLite. Единственное место в приложении, где живёт SQL.
 */
export type DataPorts = Pick<
  Ports,
  'workouts' | 'programs' | 'exercises' | 'absences' | 'settings' | 'uow'
>

export function createSqliteRepositories(_driver: SqlDriver): DataPorts {
  throw new Error('createSqliteRepositories не реализована')
}
