import { render } from '@testing-library/react'
import { act } from 'react'
import { WhiteboardController } from '../../../../src/v2/call/WhiteboardController'
import { useWhiteboardStore } from '../../../../src/v2/store/useWhiteboardStore'
import type { Stroke } from '../../../../src/v2/types'

const stroke: Stroke = { id: 's1', tool: 'pen', color: '#222', width: 3, points: [{ x: 0.1, y: 0.2 }], drawerId: 'p1' }

beforeEach(() => {
  useWhiteboardStore.setState({ strokes: [stroke], grantedPeerIds: new Set(['peer-x']), currentTool: 'pen', currentColor: '#222222' })
})

test('renders nothing (null)', () => {
  const { container } = render(<WhiteboardController />)
  expect(container.firstChild).toBeNull()
})

test('clears strokes from store when unmounted', () => {
  const { unmount } = render(<WhiteboardController />)
  expect(useWhiteboardStore.getState().strokes).toHaveLength(1)
  act(() => { unmount() })
  expect(useWhiteboardStore.getState().strokes).toHaveLength(0)
})

test('clears grantedPeerIds from store when unmounted', () => {
  const { unmount } = render(<WhiteboardController />)
  act(() => { unmount() })
  expect(useWhiteboardStore.getState().grantedPeerIds.size).toBe(0)
})
