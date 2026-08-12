import * as Crypto from 'expo-crypto'
import type { Ports } from '../app/ports'
import { id as makeId, instant } from '../domain/model/types'
import { createExpoSqlDriver } from './db/expoSqlite'
import { applyMigrations } from './db/migrations'
import { createSqliteRepositories } from './db/repositories'

/**
 * Сборка портов приложения: настоящая база, системные часы, генератор UUID
 * и зона устройства. Единственное место, где приложение узнаёт про expo-*.
 */
export const createAppPorts = async (databaseName?: string): Promise<Ports> => {
  const driver = await createExpoSqlDriver(databaseName)
  await applyMigrations(driver)
  const repositories = createSqliteRepositories(driver)

  return {
    ...repositories,
    clock: { now: () => instant(Date.now()) },
    ids: { uuid: () => makeId(Crypto.randomUUID()) },
    // зона устройства нужна, чтобы отличить «сегодня» от «задним числом» (§5.1)
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  }
}
