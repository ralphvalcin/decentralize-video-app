import { useWhiteboardStore } from '../../../../src/v2/store/useWhiteboardStore'
import type { Stroke } from '../../../../src/v2/types'

const makeStroke = (id: string, drawerId = 'peer-1'): Stroke => ({
  id,
  tool: 'pen',
  color: '#222222',
  width: 3,
  points: [{ x: 0.1, y: 0.2 }, { x: 0.3, y: 0.4 }],
  drawerId,
})

beforeEach(() => {
  useWhiteboardStore.setState({
    strokes: [],
    grantedPeerIds: new Set(),
    currentTool: 'pen',
    currentColor: '#222222',
  })
})

test('addStroke appends stroke to array', () => {
  useWhiteboardStore.getState().addStroke(makeStroke('s1'))
  expect(useWhiteboardStore.getState().strokes).toHaveLength(1)
  expect(useWhiteboardStore.getState().strokes[0].id).toBe('s1')
})

test('addStroke accumulates multiple strokes', () => {
  useWhiteboardStore.getState().addStroke(makeStroke('s1'))
  useWhiteboardStore.getState().addStroke(makeStroke('s2'))
  expect(useWhiteboardStore.getState().strokes).toHaveLength(2)
})

test('clearStrokes empties the array', () => {
  useWhiteboardStore.getState().addStroke(makeStroke('s1'))
  useWhiteboardStore.getState().clearStrokes()
  expect(useWhiteboardStore.getState().strokes).toHaveLength(0)
})

test('grantDrawing adds peerId to grantedPeerIds', () => {
  useWhiteboardStore.getState().grantDrawing('peer-x')
  expect(useWhiteboardStore.getState().grantedPeerIds.has('peer-x')).toBe(true)
})

test('grantDrawing preserves existing grants', () => {
  useWhiteboardStore.getState().grantDrawing('peer-x')
  useWhiteboardStore.getState().grantDrawing('peer-y')
  expect(useWhiteboardStore.getState().grantedPeerIds.has('peer-x')).toBe(true)
  expect(useWhiteboardStore.getState().grantedPeerIds.has('peer-y')).toBe(true)
})

test('grantDrawing is idempotent — duplicate grant does not grow the set', () => {
  useWhiteboardStore.getState().grantDrawing('peer-x')
  useWhiteboardStore.getState().grantDrawing('peer-x')
  expect(useWhiteboardStore.getState().grantedPeerIds.size).toBe(1)
})

test('revokeDrawing removes peerId from grantedPeerIds', () => {
  useWhiteboardStore.getState().grantDrawing('peer-x')
  useWhiteboardStore.getState().revokeDrawing('peer-x')
  expect(useWhiteboardStore.getState().grantedPeerIds.has('peer-x')).toBe(false)
})

test('revokeDrawing is a no-op for unknown peerId', () => {
  expect(() => useWhiteboardStore.getState().revokeDrawing('nobody')).not.toThrow()
})

test('setTool updates currentTool', () => {
  useWhiteboardStore.getState().setTool('eraser')
  expect(useWhiteboardStore.getState().currentTool).toBe('eraser')
})

test('setColor updates currentColor', () => {
  useWhiteboardStore.getState().setColor('#ff4444')
  expect(useWhiteboardStore.getState().currentColor).toBe('#ff4444')
})
