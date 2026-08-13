import { backupTakenAt, sortBackups } from '../backups'

describe('имена автобэкапов', () => {
  it('время снятия читается из имени файла', () => {
    expect(backupTakenAt('backup-1754926320000.json')).toBe(1754926320000)
  })

  it('чужое имя временем не считается', () => {
    expect(backupTakenAt('training-diary-2026-08-11.json')).toBeNull()
    expect(backupTakenAt('backup-.json')).toBeNull()
    expect(backupTakenAt('backup-2026-08-11.json')).toBeNull()
  })

  it('свежие копии идут первыми независимо от порядка в порту', () => {
    const sorted = sortBackups([
      'backup-1000.json',
      'backup-3000.json',
      'backup-2000.json',
    ])

    expect(sorted.map((backup) => backup.fileName)).toEqual([
      'backup-3000.json',
      'backup-2000.json',
      'backup-1000.json',
    ])
  })

  it('файл с непонятным именем уезжает в конец, но из списка не пропадает', () => {
    const sorted = sortBackups(['backup-old.json', 'backup-5.json'])

    expect(sorted.map((backup) => backup.fileName)).toEqual(['backup-5.json', 'backup-old.json'])
    expect(sorted[1]?.takenAt).toBeNull()
  })
})
