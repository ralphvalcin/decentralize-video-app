import { render, screen, fireEvent } from '@testing-library/react'
import { WhiteboardToolbar } from '../../../../src/v2/call/WhiteboardToolbar'

const defaultProps = {
  currentTool: 'pen' as const,
  currentColor: '#222222',
  onToolChange: jest.fn(),
  onColorChange: jest.fn(),
  onClear: jest.fn(),
}

beforeEach(() => jest.clearAllMocks())

test('renders pen button as active when currentTool is pen', () => {
  render(<WhiteboardToolbar {...defaultProps} />)
  expect(screen.getByTestId('btn-tool-pen')).toHaveAttribute('aria-pressed', 'true')
})

test('renders eraser button as inactive when currentTool is pen', () => {
  render(<WhiteboardToolbar {...defaultProps} />)
  expect(screen.getByTestId('btn-tool-eraser')).toHaveAttribute('aria-pressed', 'false')
})

test('calls onToolChange with eraser when eraser button clicked', () => {
  render(<WhiteboardToolbar {...defaultProps} />)
  fireEvent.click(screen.getByTestId('btn-tool-eraser'))
  expect(defaultProps.onToolChange).toHaveBeenCalledWith('eraser')
})

test('calls onToolChange with pen when pen button clicked', () => {
  render(<WhiteboardToolbar {...defaultProps} currentTool="eraser" />)
  fireEvent.click(screen.getByTestId('btn-tool-pen'))
  expect(defaultProps.onToolChange).toHaveBeenCalledWith('pen')
})

test('renders all 4 color swatches', () => {
  render(<WhiteboardToolbar {...defaultProps} />)
  expect(screen.getAllByTestId(/^btn-color-/)).toHaveLength(4)
})

test('calls onColorChange when a color swatch is clicked', () => {
  render(<WhiteboardToolbar {...defaultProps} />)
  fireEvent.click(screen.getByTestId('btn-color-#ff4444'))
  expect(defaultProps.onColorChange).toHaveBeenCalledWith('#ff4444')
})

test('renders clear button and calls onClear when clicked', () => {
  render(<WhiteboardToolbar {...defaultProps} />)
  fireEvent.click(screen.getByTestId('btn-clear'))
  expect(defaultProps.onClear).toHaveBeenCalled()
})
