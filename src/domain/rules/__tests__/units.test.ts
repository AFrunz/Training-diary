import fc from 'fast-check'
import { fromInputWeight, kgToLb, lbToKg, roundForUnit, stepForUnit, toDisplayWeight } from '../units'

describe('kgToLb и lbToKg', () => {
  it('переводит килограммы в фунты', () => {
    expect(kgToLb(100)).toBeCloseTo(220.462, 3)
    expect(kgToLb(82.5)).toBeCloseTo(181.881, 3)
  })

  it('переводит фунты в килограммы', () => {
    expect(lbToKg(220.462)).toBeCloseTo(100, 3)
  })

  it('ноль переводится в ноль', () => {
    expect(kgToLb(0)).toBe(0)
    expect(lbToKg(0)).toBe(0)
  })

  it('отрицательный вес — ошибка, а не молчаливое преобразование', () => {
    expect(() => kgToLb(-1)).toThrow(RangeError)
    expect(() => lbToKg(-1)).toThrow(RangeError)
  })

  it('туда и обратно возвращает исходное значение', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 500, noNaN: true }), (kg) => {
        expect(lbToKg(kgToLb(kg))).toBeCloseTo(kg, 9)
      }),
    )
  })
})

describe('roundForUnit — шаг отображения', () => {
  it('килограммы округляются до половины', () => {
    expect(roundForUnit(82.26, 'kg')).toBe(82.5)
    expect(roundForUnit(82.24, 'kg')).toBe(82)
    expect(roundForUnit(82.5, 'kg')).toBe(82.5)
  })

  it('ровно середина шага округляется вверх', () => {
    expect(roundForUnit(82.25, 'kg')).toBe(82.5)
  })

  it('фунты округляются до целого', () => {
    expect(roundForUnit(181.4, 'lb')).toBe(181)
    expect(roundForUnit(181.6, 'lb')).toBe(182)
  })

  it('не порождает значений вида 82.50000000000001', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 500, noNaN: true }), (value) => {
        const rounded = roundForUnit(value, 'kg')
        expect(Number.isInteger(rounded * 2)).toBe(true)
      }),
    )
  })
})

describe('toDisplayWeight', () => {
  it('в килограммах показывает хранимое значение', () => {
    expect(toDisplayWeight(82.5, 'kg')).toBe(82.5)
  })

  it('в фунтах переводит и округляет до целого', () => {
    expect(toDisplayWeight(82.5, 'lb')).toBe(182)
  })

  it('упражнение без веса остаётся без веса', () => {
    expect(toDisplayWeight(null, 'kg')).toBeNull()
    expect(toDisplayWeight(null, 'lb')).toBeNull()
  })

  it('ноль — это вес, а не отсутствие веса', () => {
    expect(toDisplayWeight(0, 'kg')).toBe(0)
  })
})

describe('fromInputWeight — что уходит в базу', () => {
  it('килограммы сохраняются как есть', () => {
    expect(fromInputWeight(82.5, 'kg')).toBe(82.5)
  })

  it('фунты переводятся в килограммы без округления до 0.5', () => {
    const stored = fromInputWeight(182, 'lb')!
    expect(stored).toBeCloseTo(82.554, 3)
    expect(stored).not.toBe(82.5)
  })

  it('пустое поле веса остаётся пустым', () => {
    expect(fromInputWeight(null, 'kg')).toBeNull()
  })

  it('история не искажается при переключении единиц: кг → фунты → кг (FR-7.5)', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 500, noNaN: true }), (kg) => {
        const shownInLb = kgToLb(kg)
        expect(fromInputWeight(shownInLb, 'lb')).toBeCloseTo(kg, 9)
      }),
    )
  })
})

describe('stepForUnit — шаг кнопок «−» и «+» (§7.2)', () => {
  it('2.5 килограмма и 5 фунтов', () => {
    expect(stepForUnit('kg')).toBe(2.5)
    expect(stepForUnit('lb')).toBe(5)
  })
})
