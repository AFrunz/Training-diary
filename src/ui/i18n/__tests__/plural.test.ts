import { formatCount, pluralize } from '../plural'
import type { PluralForms } from '../plural'

const workouts: PluralForms = {
  one: 'тренировка',
  few: 'тренировки',
  many: 'тренировок',
  other: 'тренировки',
}

const enWorkouts: PluralForms = { one: 'workout', other: 'workouts' }

describe('pluralize — русский', () => {
  it.each([
    [1, 'тренировка'],
    [2, 'тренировки'],
    [3, 'тренировки'],
    [4, 'тренировки'],
    [5, 'тренировок'],
    [10, 'тренировок'],
    [20, 'тренировок'],
  ])('%i → %s', (count, expected) => {
    expect(pluralize('ru', count, workouts)).toBe(expected)
  })

  it('одиннадцать–четырнадцать — исключение, а не «один-надцать»', () => {
    for (const n of [11, 12, 13, 14]) {
      expect(pluralize('ru', n, workouts)).toBe('тренировок')
    }
  })

  it('составные числа смотрят на последнюю цифру', () => {
    expect(pluralize('ru', 21, workouts)).toBe('тренировка')
    expect(pluralize('ru', 22, workouts)).toBe('тренировки')
    expect(pluralize('ru', 25, workouts)).toBe('тренировок')
    expect(pluralize('ru', 101, workouts)).toBe('тренировка')
    expect(pluralize('ru', 111, workouts)).toBe('тренировок')
    expect(pluralize('ru', 121, workouts)).toBe('тренировка')
  })

  it('ноль — «тренировок»', () => {
    expect(pluralize('ru', 0, workouts)).toBe('тренировок')
  })

  it('дробные значения берут отдельную форму: «3.1 тренировки» на экране статистики', () => {
    expect(pluralize('ru', 3.1, workouts)).toBe('тренировки')
    expect(pluralize('ru', 1.5, workouts)).toBe('тренировки')
  })
})

describe('pluralize — английский', () => {
  it.each([
    [0, 'workouts'],
    [1, 'workout'],
    [2, 'workouts'],
    [11, 'workouts'],
    [21, 'workouts'],
  ])('%i → %s', (count, expected) => {
    expect(pluralize('en', count, enWorkouts)).toBe(expected)
  })

  it('дробные значения тоже во множественном числе', () => {
    expect(pluralize('en', 3.1, enWorkouts)).toBe('workouts')
  })
})

describe('formatCount — число вместе со словом', () => {
  it('русский', () => {
    expect(formatCount('ru', 1, workouts)).toBe('1 тренировка')
    expect(formatCount('ru', 3, workouts)).toBe('3 тренировки')
    expect(formatCount('ru', 12, workouts)).toBe('12 тренировок')
  })

  it('английский', () => {
    expect(formatCount('en', 1, enWorkouts)).toBe('1 workout')
    expect(formatCount('en', 12, enWorkouts)).toBe('12 workouts')
  })
})

describe('pluralize — отсутствующие формы', () => {
  it('если для языка не хватает формы, это ошибка разработки, а не тихий undefined', () => {
    // сообщение должно называть недостающую форму, иначе отладка превращается в гадание
    expect(() => pluralize('ru', 5, { one: 'тренировка' })).toThrow(/many/)
  })

  it('английскому достаточно one и other', () => {
    expect(() => pluralize('en', 5, enWorkouts)).not.toThrow()
  })
})
