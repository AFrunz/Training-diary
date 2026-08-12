import { createNodeSqlDriver } from '../testing/nodeSqlite'

/**
 * Проверка самого тестового стенда, а не приложения: если эти тесты красные,
 * все остальные тесты слоя данных бессмысленны.
 */

describe('стенд node:sqlite', () => {
  it('выполняет DDL и запросы', async () => {
    const driver = createNodeSqlDriver()
    await driver.exec('CREATE TABLE t (id TEXT PRIMARY KEY, n INTEGER)')
    await driver.run('INSERT INTO t (id, n) VALUES (?, ?)', ['a', 1])

    await expect(driver.all('SELECT id, n FROM t', [])).resolves.toEqual([['a', 1]])
    await driver.close()
  })

  it('соблюдает уникальность первичного ключа', async () => {
    const driver = createNodeSqlDriver()
    await driver.exec('CREATE TABLE t (id TEXT PRIMARY KEY)')
    await driver.run('INSERT INTO t (id) VALUES (?)', ['a'])

    await expect(driver.run('INSERT INTO t (id) VALUES (?)', ['a'])).rejects.toThrow()
    await driver.close()
  })

  it('внешние ключи включены: каскадное удаление работает', async () => {
    const driver = createNodeSqlDriver()
    await driver.exec(`
      CREATE TABLE parent (id TEXT PRIMARY KEY);
      CREATE TABLE child (id TEXT PRIMARY KEY, parent_id TEXT NOT NULL REFERENCES parent(id) ON DELETE CASCADE);
    `)
    await driver.run('INSERT INTO parent (id) VALUES (?)', ['p'])
    await driver.run('INSERT INTO child (id, parent_id) VALUES (?, ?)', ['c', 'p'])
    await driver.run('DELETE FROM parent WHERE id = ?', ['p'])

    await expect(driver.all('SELECT id FROM child', [])).resolves.toEqual([])
    await driver.close()
  })

  it('откатывает транзакцию при ошибке', async () => {
    const driver = createNodeSqlDriver()
    await driver.exec('CREATE TABLE t (id TEXT PRIMARY KEY)')
    await driver.exec('BEGIN')
    await driver.run('INSERT INTO t (id) VALUES (?)', ['a'])
    await driver.exec('ROLLBACK')

    await expect(driver.all('SELECT id FROM t', [])).resolves.toEqual([])
    await driver.close()
  })

  it('каждая база независима: тесты не влияют друг на друга', async () => {
    const first = createNodeSqlDriver()
    const second = createNodeSqlDriver()
    await first.exec('CREATE TABLE t (id TEXT PRIMARY KEY)')
    await first.run('INSERT INTO t (id) VALUES (?)', ['a'])

    await expect(second.all("SELECT name FROM sqlite_master WHERE type='table'", [])).resolves.toEqual([])
    await first.close()
    await second.close()
  })
})
