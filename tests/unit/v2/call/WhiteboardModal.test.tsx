import { render, screen, fireEvent } from '@testing-library/react'
import { WhiteboardModal } from '../../../../src/v2/call/WhiteboardModal'
import { useWhiteboardStore } from '../../../../src/v2/store/useWhiteboardStore'

jest.mock('../../../../src/v2/call/ThumbnailStrip', () => ({
  ThumbnailStrip: () => <div data-testid="thumbnail-strip" />,
}))

const defaultProps = {
  onStroke: jest.fn(),
  onClear: jest.fn(),
  onClose: jest.fn(),
  canDraw: true,
}

beforeEach(() => {
  jest.clearAllMocks()
  // Polyfill crypto.randomUUID for jsdom environments that lack it
  if (!crypto.randomUUID) {
    Object.defineProperty(crypto, 'randomUUID', {
      value: () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
      }),
      configurable: true,
    })
  }
  useWhiteboardStore.setState({ strokes: [], grantedPeerIds: new Set(), currentTool: 'pen', currentColor: '#222222' })
  HTMLCanvasElement.prototype.getContext = jest.fn(() => ({
    clearRect: jest.fn(),
    beginPath: jest.fn(),
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    stroke: jest.fn(),
    save: jest.fn(),
    restore: jest.fn(),
    globalCompositeOperation: 'source-over',
    strokeStyle: '',
    lineWidth: 0,
    lineCap: '',
    lineJoin: '',
  })) as unknown as typeof HTMLCanvasElement.prototype.getContext
})

test('renders the canvas element', () => {
  render(<WhiteboardModal {...defaultProps} />)
  expect(screen.getByTestId('whiteboard-canvas')).toBeInTheDocument()
})

test('renders toolbar when canDraw is true', () => {
  render(<WhiteboardModal {...defaultProps} canDraw={true} />)
  expect(screen.getByTestId('btn-tool-pen')).toBeInTheDocument()
})

test('hides toolbar when canDraw is false', () => {
  render(<WhiteboardModal {...defaultProps} canDraw={false} />)
  expect(screen.queryByTestId('btn-tool-pen')).not.toBeInTheDocument()
})

test('calls onClose when exit button is clicked', () => {
  render(<WhiteboardModal {...defaultProps} />)
  fireEvent.click(screen.getByTestId('btn-whiteboard-close'))
  expect(defaultProps.onClose).toHaveBeenCalled()
})

test('calls onClear from toolbar clear button', () => {
  render(<WhiteboardModal {...defaultProps} />)
  fireEvent.click(screen.getByTestId('btn-clear'))
  expect(defaultProps.onClear).toHaveBeenCalled()
})

test('renders ThumbnailStrip', () => {
  render(<WhiteboardModal {...defaultProps} />)
  expect(screen.getByTestId('thumbnail-strip')).toBeInTheDocument()
})

test('shows read-only label when canDraw is false', () => {
  render(<WhiteboardModal {...defaultProps} canDraw={false} />)
  expect(screen.getByText('View only')).toBeInTheDocument()
})

test('calls onStroke after mousedown → mousemove → mouseup sequence', () => {
  render(<WhiteboardModal {...defaultProps} canDraw={true} />)
  const canvas = screen.getByTestId('whiteboard-canvas')

  fireEvent.mouseDown(canvas, { clientX: 10, clientY: 10 })
  fireEvent.mouseMove(canvas, { clientX: 20, clientY: 20 })
  fireEvent.mouseUp(canvas)

  expect(defaultProps.onStroke).toHaveBeenCalledTimes(1)
  const stroke = defaultProps.onStroke.mock.calls[0][0]
  expect(stroke.id).toBeDefined()
  expect(stroke.points.length).toBeGreaterThanOrEqual(2)
  expect(stroke.tool).toBe('pen')
})

test('does not call onStroke when canDraw is false', () => {
  render(<WhiteboardModal {...defaultProps} canDraw={false} />)
  const canvas = screen.getByTestId('whiteboard-canvas')

  fireEvent.mouseDown(canvas, { clientX: 10, clientY: 10 })
  fireEvent.mouseMove(canvas, { clientX: 20, clientY: 20 })
  fireEvent.mouseUp(canvas)

  expect(defaultProps.onStroke).not.toHaveBeenCalled()
})
