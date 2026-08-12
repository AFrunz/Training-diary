import { instant, localDate } from '../../model/types'
import { OUTLIER_THRESHOLD_MS, computeDuration, deriveFinishedAt } from '../duration'
import type { DurationInput } from '../duration'

const MSK = 'Europe/Moscow'
const NY = 'America/New_York'
const utc = (iso: string) => instant(Date.parse(iso))
const minutes = (n: number) => n * 60 * 1000

/** Тренировка 11 августа 2026: создана в 18:32 по Москве. */
const base: DurationInput = {
  date: localDate('2026-08-11'),
  startedAt: utc('2026-08-11T15:32:00Z'),
  finishedAt: utc('2026-08-11T16:44:00Z'),
  timeZone: MSK,
}

describe('deriveFinishedAt — окончанием считается последняя отметка', () => {
  it('берёт самую позднюю отметку, а не последнюю в списке', () => {
    const items = [
      { completedAt: utc('2026-08-11T16:44:00Z') },
      { completedAt: utc('2026-08-11T15:50:00Z') },
      { completedAt: utc('2026-08-11T16:10:00Z') },
    ]
    expect(deriveFinishedAt(items)).toBe(utc('2026-08-11T16:44:00Z'))
  })

  it('пропускает неотмеченные упражнения', () => {
    const items = [
      { completedAt: null },
      { completedAt: utc('2026-08-11T16:10:00Z') },
      { completedAt: null },
    ]
    expect(deriveFinishedAt(items)).toBe(utc('2026-08-11T16:10:00Z'))
  })

  it('ни одной отметки — null', () => {
    expect(deriveFinishedAt([{ completedAt: null }, { completedAt: null }])).toBeNull()
  })

  it('пустой список — null', () => {
    expect(deriveFinishedAt([])).toBeNull()
  })
})

describe('computeDuration — основной расчёт', () => {
  it('разница между созданием и последней отметкой', () => {
    const result = computeDuration(base)
    expect(result.ms).toBe(minutes(72))
    expect(result.reason).toBe('ok')
    expect(result.isManual).toBe(false)
    expect(result.isOutlier).toBe(false)
  })

  it('нулевая длительность допустима: отметка в тот же момент', () => {
    const result = computeDuration({ ...base, finishedAt: base.startedAt })
    expect(result.ms).toBe(0)
    expect(result.reason).toBe('ok')
  })
})

describe('computeDuration — случаи, когда длительность недостоверна', () => {
  it('не отмечено ни одного упражнения → null, а не ноль (§5.1)', () => {
    const result = computeDuration({ ...base, finishedAt: null })
    expect(result.ms).toBeNull()
    expect(result.reason).toBe('no-completion')
  })

  it('тренировка заведена задним числом → null, даже если отметки есть', () => {
    const result = computeDuration({ ...base, date: localDate('2026-08-09') })
    expect(result.ms).toBeNull()
    expect(result.reason).toBe('backdated')
  })

  it('«задним числом» определяется по локальной дате создания, а не по UTC', () => {
    // 20:30 UTC = 23:30 по Москве того же дня: это НЕ задним числом
    const result = computeDuration({
      ...base,
      startedAt: utc('2026-08-11T20:30:00Z'),
      finishedAt: utc('2026-08-11T20:50:00Z'),
    })
    expect(result.reason).toBe('ok')
    expect(result.ms).toBe(minutes(20))
  })

  it('нет времени начала вовсе → invalid-range', () => {
    const result = computeDuration({ ...base, startedAt: null })
    expect(result.ms).toBeNull()
    expect(result.reason).toBe('invalid-range')
  })

  it('конец раньше начала → invalid-range, а не отрицательная длительность', () => {
    const result = computeDuration({
      ...base,
      finishedAt: utc('2026-08-11T15:00:00Z'),
    })
    expect(result.ms).toBeNull()
    expect(result.reason).toBe('invalid-range')
  })
})

describe('computeDuration — порог выброса', () => {
  it('ровно шесть часов выбросом не считается', () => {
    const result = computeDuration({
      ...base,
      finishedAt: instant(base.startedAt! + OUTLIER_THRESHOLD_MS),
    })
    expect(result.reason).toBe('ok')
    expect(result.isOutlier).toBe(false)
    expect(result.ms).toBe(OUTLIER_THRESHOLD_MS)
  })

  it('шесть часов и одна миллисекунда — уже выброс', () => {
    const result = computeDuration({
      ...base,
      finishedAt: instant(base.startedAt! + OUTLIER_THRESHOLD_MS + 1),
    })
    expect(result.reason).toBe('outlier')
    expect(result.isOutlier).toBe(true)
  })

  it('выброс сохраняет значение: на экране показывается, из средних исключается', () => {
    const result = computeDuration({
      ...base,
      finishedAt: instant(base.startedAt! + OUTLIER_THRESHOLD_MS + minutes(30)),
    })
    expect(result.ms).toBe(OUTLIER_THRESHOLD_MS + minutes(30))
    expect(result.isOutlier).toBe(true)
  })
})

describe('computeDuration — ручные значения приоритетнее вычисленных', () => {
  it('заданы оба конца — берутся они', () => {
    const result = computeDuration({
      ...base,
      manualStartedAt: utc('2026-08-11T15:00:00Z'),
      manualFinishedAt: utc('2026-08-11T16:00:00Z'),
    })
    expect(result.ms).toBe(minutes(60))
    expect(result.isManual).toBe(true)
  })

  it('задано только начало — конец берётся из отметок', () => {
    const result = computeDuration({ ...base, manualStartedAt: utc('2026-08-11T15:44:00Z') })
    expect(result.ms).toBe(minutes(60))
    expect(result.isManual).toBe(true)
  })

  it('задан только конец — начало берётся из создания', () => {
    const result = computeDuration({ ...base, manualFinishedAt: utc('2026-08-11T16:32:00Z') })
    expect(result.ms).toBe(minutes(60))
    expect(result.isManual).toBe(true)
  })

  it('ручное время спасает тренировку, заведённую задним числом (FR-4.7)', () => {
    const result = computeDuration({
      ...base,
      date: localDate('2026-08-09'),
      manualStartedAt: utc('2026-08-09T15:00:00Z'),
      manualFinishedAt: utc('2026-08-09T16:15:00Z'),
    })
    expect(result.ms).toBe(minutes(75))
    expect(result.reason).toBe('ok')
    expect(result.isManual).toBe(true)
  })

  it('ручное время позволяет посчитать длительность без единой отметки', () => {
    const result = computeDuration({
      ...base,
      finishedAt: null,
      manualStartedAt: utc('2026-08-11T15:00:00Z'),
      manualFinishedAt: utc('2026-08-11T16:05:00Z'),
    })
    expect(result.ms).toBe(minutes(65))
    expect(result.reason).toBe('ok')
  })

  it('ручной конец раньше ручного начала → invalid-range', () => {
    const result = computeDuration({
      ...base,
      manualStartedAt: utc('2026-08-11T17:00:00Z'),
      manualFinishedAt: utc('2026-08-11T16:00:00Z'),
    })
    expect(result.ms).toBeNull()
    expect(result.reason).toBe('invalid-range')
  })

  it('ручные значения тоже проверяются на выброс', () => {
    const result = computeDuration({
      ...base,
      manualStartedAt: utc('2026-08-11T08:00:00Z'),
      manualFinishedAt: utc('2026-08-11T18:00:00Z'),
    })
    expect(result.isOutlier).toBe(true)
    expect(result.reason).toBe('outlier')
  })
})

describe('computeDuration — переход на летнее время', () => {
  it('меряет реальное время, а не разницу по настенным часам', () => {
    // 8 марта 2026 в Нью-Йорке: 01:45 EST → 03:30 EDT. По часам «1 ч 45 мин», на деле 45 минут
    const result = computeDuration({
      date: localDate('2026-03-08'),
      startedAt: utc('2026-03-08T06:45:00Z'),
      finishedAt: utc('2026-03-08T07:30:00Z'),
      timeZone: NY,
    })
    expect(result.ms).toBe(minutes(45))
    expect(result.reason).toBe('ok')
  })
})
