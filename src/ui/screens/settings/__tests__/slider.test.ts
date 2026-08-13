import { isSlideComplete, sliderProgress } from '../slider'

/**
 * Жест в jest не разыграть, поэтому арифметика ползунка живёт отдельной
 * чистой функцией — и проверяется на границах хода.
 */
describe('ползунок удаления', () => {
  it('в начале хода прогресса нет', () => {
    expect(sliderProgress(0, 200)).toBe(0)
  })

  it('половина хода — половина прогресса', () => {
    expect(sliderProgress(100, 200)).toBe(0.5)
  })

  it('полный ход — единица', () => {
    expect(sliderProgress(200, 200)).toBe(1)
  })

  it('перетяг за край не даёт больше единицы', () => {
    expect(sliderProgress(560, 200)).toBe(1)
  })

  it('движение назад прогресс не отматывает в минус', () => {
    expect(sliderProgress(-80, 200)).toBe(0)
  })

  it('до замера дорожки ширины нет: прогресс остаётся нулевым', () => {
    expect(sliderProgress(120, 0)).toBe(0)
  })

  it('подтверждать можно только протянутый до конца ползунок', () => {
    expect(isSlideComplete(0)).toBe(false)
    expect(isSlideComplete(0.5)).toBe(false)
    expect(isSlideComplete(0.99)).toBe(false)
    expect(isSlideComplete(1)).toBe(true)
  })
})
