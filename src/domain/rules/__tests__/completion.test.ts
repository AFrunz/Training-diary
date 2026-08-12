import { instant } from '../../model/types'
import { computeCompletion } from '../completion'
import type { CompletionItem } from '../completion'

const at = instant(Date.parse('2026-08-11T16:00:00Z'))

const done = (setCount = 3): CompletionItem => ({ completedAt: at, setCount })
const notDone = (setCount = 0): CompletionItem => ({ completedAt: null, setCount })

describe('computeCompletion — доля и цвет из §5.2', () => {
  it('всё выполнено → 100 %, зелёный', () => {
    const r = computeCompletion([done(), done(), done(), done(), done()])
    expect(r).toEqual({ done: 5, total: 5, ratio: 1, tone: 'success' })
  })

  it('три из пяти → оранжевый', () => {
    const r = computeCompletion([done(), done(), done(), notDone(2), notDone()])
    expect(r.done).toBe(3)
    expect(r.total).toBe(5)
    expect(r.ratio).toBeCloseTo(0.6)
    expect(r.tone).toBe('warning')
  })

  it('меньше половины → красный', () => {
    const r = computeCompletion([done(), done(), notDone(1), notDone(), notDone()])
    expect(r.ratio).toBeCloseTo(0.4)
    expect(r.tone).toBe('danger')
  })
})

describe('computeCompletion — границы диапазонов', () => {
  it('ровно половина попадает в оранжевый, а не в красный', () => {
    const r = computeCompletion([done(), done(), notDone(), notDone()])
    expect(r.ratio).toBe(0.5)
    expect(r.tone).toBe('warning')
  })

  it('чуть меньше половины — красный', () => {
    const r = computeCompletion([done(), done(), done(), notDone(), notDone(), notDone(), notDone()])
    expect(r.ratio).toBeLessThan(0.5)
    expect(r.tone).toBe('danger')
  })

  it('одно упражнение из двух — оранжевый', () => {
    expect(computeCompletion([done(), notDone()]).tone).toBe('warning')
  })

  it('единственное выполненное упражнение — зелёный', () => {
    expect(computeCompletion([done()]).tone).toBe('success')
  })

  it('99 % ещё не зелёный', () => {
    const items = [...Array.from({ length: 99 }, () => done()), notDone()]
    const r = computeCompletion(items)
    expect(r.tone).toBe('warning')
  })
})

describe('computeCompletion — «не начата» отличается от «начата и брошена»', () => {
  it('ничего не отмечено и ни одного подхода → серый', () => {
    const r = computeCompletion([notDone(), notDone(), notDone()])
    expect(r).toEqual({ done: 0, total: 3, ratio: 0, tone: 'muted' })
  })

  it('ничего не отмечено, но подходы записаны → красный', () => {
    const r = computeCompletion([notDone(2), notDone(), notDone()])
    expect(r.done).toBe(0)
    expect(r.tone).toBe('danger')
  })

  it('достаточно одного подхода в одном упражнении, чтобы тренировка считалась начатой', () => {
    expect(computeCompletion([notDone(1), notDone(), notDone()]).tone).toBe('danger')
  })
})

describe('computeCompletion — вырожденные случаи', () => {
  it('пустая тренировка не даёт деления на ноль', () => {
    const r = computeCompletion([])
    expect(r).toEqual({ done: 0, total: 0, ratio: 0, tone: 'muted' })
    expect(Number.isNaN(r.ratio)).toBe(false)
  })

  it('разово добавленные упражнения входят в знаменатель (FR-4.6)', () => {
    // пять по программе + одно добавленное сверх неё, выполнены только программные
    const items = [done(), done(), done(), done(), done(), notDone(1)]
    const r = computeCompletion(items)
    expect(r.total).toBe(6)
    expect(r.tone).toBe('warning')
  })
})
