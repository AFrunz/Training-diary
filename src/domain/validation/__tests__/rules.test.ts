import { id } from '../../model/types'
import {
  MAX_ABSENCE_DAYS,
  MAX_NAME_LENGTH,
  validateAbsenceRange,
  validateExerciseName,
  validateProgramItems,
  validateProgramName,
  validateSet,
} from '../rules'
import { localDate } from '../../model/types'

const ok = { ok: true }
const fail = (code: string) => ({ ok: false, code })
const d = (s: string) => localDate(s)

describe('validateExerciseName', () => {
  const existing = ['Жим лёжа', 'Приседания со штангой']

  it('обычное новое название проходит', () => {
    expect(validateExerciseName('Тяга верхнего блока', existing)).toEqual(ok)
  })

  it('пустое название и одни пробелы отклоняются', () => {
    expect(validateExerciseName('', existing)).toEqual(fail('name-empty'))
    expect(validateExerciseName('   ', existing)).toEqual(fail('name-empty'))
  })

  it('совпадение без учёта регистра — дубликат (FR-2.1)', () => {
    expect(validateExerciseName('жим лёжа', existing)).toEqual(fail('name-duplicate'))
    expect(validateExerciseName('ЖИМ ЛЁЖА', existing)).toEqual(fail('name-duplicate'))
  })

  it('краевые пробелы не делают название новым', () => {
    expect(validateExerciseName('  Жим лёжа  ', existing)).toEqual(fail('name-duplicate'))
  })

  it('внутренние пробелы значимы: «Жим  лёжа» с двойным пробелом — другое название', () => {
    expect(validateExerciseName('Жим  лёжа', existing)).toEqual(ok)
  })

  it('«е» вместо «ё» считается другим названием: угадывать за пользователя не будем', () => {
    expect(validateExerciseName('Жим лежа', existing)).toEqual(ok)
  })

  it('слишком длинное название отклоняется', () => {
    expect(validateExerciseName('я'.repeat(MAX_NAME_LENGTH + 1), existing)).toEqual(fail('name-too-long'))
  })

  it('название ровно предельной длины проходит', () => {
    expect(validateExerciseName('я'.repeat(MAX_NAME_LENGTH), existing)).toEqual(ok)
  })

  it('длина считается после обрезки пробелов', () => {
    expect(validateExerciseName(`  ${'я'.repeat(MAX_NAME_LENGTH)}  `, existing)).toEqual(ok)
  })

  it('пустой список существующих названий не мешает', () => {
    expect(validateExerciseName('Жим лёжа', [])).toEqual(ok)
  })
})

describe('validateProgramName', () => {
  it('произвольное название проходит', () => {
    expect(validateProgramName('Грудь + трицепс')).toEqual(ok)
  })

  it('пустое отклоняется — кнопка создания неактивна (FR-3.1.1)', () => {
    expect(validateProgramName('   ')).toEqual(fail('name-empty'))
  })

  it('одинаковые названия программ разрешены: это дело пользователя', () => {
    expect(validateProgramName('Ноги')).toEqual(ok)
  })

  it('слишком длинное отклоняется', () => {
    expect(validateProgramName('я'.repeat(MAX_NAME_LENGTH + 1))).toEqual(fail('name-too-long'))
  })
})

describe('validateSet', () => {
  it('вес и повторы', () => {
    expect(validateSet({ weightKg: 82.5, reps: 6 })).toEqual(ok)
  })

  it('подход без веса — штатная ситуация для турника', () => {
    expect(validateSet({ weightKg: null, reps: 12 })).toEqual(ok)
    expect(validateSet({ reps: 12 })).toEqual(ok)
  })

  it('нулевой вес допустим: пустой гриф тоже вес', () => {
    expect(validateSet({ weightKg: 0, reps: 10 })).toEqual(ok)
  })

  it('ноль повторов бессмыслен', () => {
    expect(validateSet({ weightKg: 80, reps: 0 })).toEqual(fail('reps-not-positive-integer'))
  })

  it('отрицательные и дробные повторы отклоняются', () => {
    expect(validateSet({ reps: -5 })).toEqual(fail('reps-not-positive-integer'))
    expect(validateSet({ reps: 8.5 })).toEqual(fail('reps-not-positive-integer'))
  })

  it('отрицательный вес отклоняется', () => {
    expect(validateSet({ weightKg: -20, reps: 8 })).toEqual(fail('weight-negative'))
  })

  it('NaN и бесконечность не должны попасть в базу', () => {
    expect(validateSet({ weightKg: Number.NaN, reps: 8 })).toEqual(fail('weight-not-finite'))
    expect(validateSet({ weightKg: Number.POSITIVE_INFINITY, reps: 8 })).toEqual(fail('weight-not-finite'))
  })

  it('неправдоподобно большие значения — опечатка при вводе', () => {
    expect(validateSet({ weightKg: 1001, reps: 8 })).toEqual(fail('weight-too-large'))
    expect(validateSet({ reps: 1000 })).toEqual(fail('reps-too-large'))
  })

  it('граничные допустимые значения проходят', () => {
    expect(validateSet({ weightKg: 1000, reps: 999 })).toEqual(ok)
    expect(validateSet({ reps: 1 })).toEqual(ok)
  })

  it('скамья наклоняется в обе стороны: угол от −90 до 90 (FR-4.11)', () => {
    expect(validateSet({ angleDeg: 45, reps: 15 })).toEqual(ok)
    // ноль — это горизонтальная скамья, а не «пусто»
    expect(validateSet({ angleDeg: 0, reps: 15 })).toEqual(ok)
    // минус — декалайн
    expect(validateSet({ angleDeg: -15, reps: 15 })).toEqual(ok)
    expect(validateSet({ angleDeg: 90, reps: 15 })).toEqual(ok)
    expect(validateSet({ angleDeg: -90, reps: 15 })).toEqual(ok)
  })

  it('запредельный угол отклоняется', () => {
    expect(validateSet({ angleDeg: 91, reps: 15 })).toEqual(fail('angle-out-of-range'))
    expect(validateSet({ angleDeg: -91, reps: 15 })).toEqual(fail('angle-out-of-range'))
    expect(validateSet({ angleDeg: Number.NaN, reps: 15 })).toEqual(fail('angle-out-of-range'))
  })
})

describe('validateAbsenceRange', () => {
  it('обычный отпуск', () => {
    expect(validateAbsenceRange(d('2026-08-17'), d('2026-08-23'))).toEqual(ok)
  })

  it('один день — допустимо', () => {
    expect(validateAbsenceRange(d('2026-08-17'), d('2026-08-17'))).toEqual(ok)
  })

  it('конец раньше начала отклоняется', () => {
    expect(validateAbsenceRange(d('2026-08-23'), d('2026-08-17'))).toEqual(fail('range-inverted'))
  })

  it('отсутствие длиннее года — опечатка при выборе дат', () => {
    expect(validateAbsenceRange(d('2026-01-01'), d('2027-06-01'))).toEqual(fail('range-too-long'))
  })

  it('ровно предельная длина проходит', () => {
    expect(validateAbsenceRange(d('2026-01-01'), d('2026-12-31'))).toEqual(ok)
    expect(MAX_ABSENCE_DAYS).toBe(365)
  })
})

describe('validateProgramItems', () => {
  const a = id('ex-1')
  const b = id('ex-2')

  it('разные упражнения проходят', () => {
    expect(validateProgramItems([a, b])).toEqual(ok)
  })

  it('пустая программа допустима (FR-3.2)', () => {
    expect(validateProgramItems([])).toEqual(ok)
  })

  it('одно упражнение дважды в одной программе отклоняется (FR-3.3)', () => {
    expect(validateProgramItems([a, b, a])).toEqual(fail('exercise-duplicate-in-program'))
  })
})
