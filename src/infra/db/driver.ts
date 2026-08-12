/**
 * Тонкий драйвер SQLite. Приложение подключает expo-sqlite, тесты — встроенный
 * в Node `node:sqlite`. Репозитории работают только с этим интерфейсом, поэтому
 * слой данных тестируется без эмулятора и без нативных модулей.
 */
export interface SqlDriver {
  /** Выполняет несколько операторов подряд: DDL, PRAGMA. */
  exec(sql: string): Promise<void>
  /** Запрос со строками результата в виде массивов значений. */
  all(sql: string, params: readonly unknown[]): Promise<unknown[][]>
  /** Операция без результата. */
  run(sql: string, params: readonly unknown[]): Promise<void>
  close(): Promise<void>
}
