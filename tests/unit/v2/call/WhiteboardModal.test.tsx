import { render, screen, fireEvent } from '@testing-library/react'
import { WhiteboardModal } from '../../../../src/v2/call/WhiteboardModal'
import { useWhiteboardStore } from '../../../../src/v2/store/useWhiteboardStore'

jest.mock('../../../../src/v2/call/ThumbnailStrip', () => ({
  ThumbnailStrip: () => <div data-testid="thumbnail-strip" />,
}))

const defaultProps = {
  onStroke: jest.fn(),
  onClear: jest.fn(),
  onGrant: jest.fn(),
  onRevoke: jest.fn(),
  onClose: jest.fn(),
  canDraw: true,
}

beforeEach(() => {
  jest.clearAllMocks()
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
