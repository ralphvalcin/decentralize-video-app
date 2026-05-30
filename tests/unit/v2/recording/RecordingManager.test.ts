import { calcGrid } from '../../../../src/v2/recording/RecordingManager'

describe('calcGrid', () => {
  test('1 stream: single full-size cell', () => {
    const g = calcGrid(1, 1280, 720)
    expect(g.cols).toBe(1)
    expect(g.rows).toBe(1)
    expect(g.cellW).toBe(1280)
    expect(g.cellH).toBe(720)
  })

  test('2 streams: 2 columns, 1 row', () => {
    const g = calcGrid(2, 1280, 720)
    expect(g.cols).toBe(2)
    expect(g.rows).toBe(1)
    expect(g.cellW).toBe(640)
    expect(g.cellH).toBe(720)
  })

  test('4 streams: 2x2 grid', () => {
    const g = calcGrid(4, 1280, 720)
    expect(g.cols).toBe(2)
    expect(g.rows).toBe(2)
    expect(g.cellW).toBe(640)
    expect(g.cellH).toBe(360)
  })

  test('6 streams: 3 columns, 2 rows', () => {
    const g = calcGrid(6, 1280, 720)
    expect(g.cols).toBe(3)
    expect(g.rows).toBe(2)
    expect(g.cellW).toBe(426)
    expect(g.cellH).toBe(360)
  })

  test('3 streams: 2 columns, 2 rows (odd n)', () => {
    const g = calcGrid(3, 1280, 720)
    expect(g.cols).toBe(2)
    expect(g.rows).toBe(2)
    expect(g.cellW).toBe(640)
    expect(g.cellH).toBe(360)
  })
})
