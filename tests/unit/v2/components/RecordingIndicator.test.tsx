import { render, screen, act } from '@testing-library/react'
import { useSessionStore } from '../../../../src/v2/store/useSessionStore'

let RecordingIndicator: typeof import('../../../../src/v2/components/RecordingIndicator').RecordingIndicator

beforeAll(async () => {
  RecordingIndicator = (await import('../../../../src/v2/components/RecordingIndicator')).RecordingIndicator
})

beforeEach(() => {
  useSessionStore.setState({ recordingState: 'idle' })
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

test('renders nothing when recordingState is idle', () => {
  const { container } = render(<RecordingIndicator />)
  expect(container).toBeEmptyDOMElement()
})

test('renders REC indicator when recordingState is recording', async () => {
  render(<RecordingIndicator />)
  await act(async () => {
    useSessionStore.setState({ recordingState: 'recording' })
  })
  expect(screen.getByTestId('recording-indicator')).toBeInTheDocument()
  expect(screen.getByText(/REC/)).toBeInTheDocument()
})

test('shows elapsed time ticking up', async () => {
  render(<RecordingIndicator />)
  await act(async () => {
    useSessionStore.setState({ recordingState: 'recording' })
  })
  act(() => { jest.advanceTimersByTime(61000) })
  expect(screen.getByText(/01:01/)).toBeInTheDocument()
})

test('disappears when recordingState returns to idle', async () => {
  render(<RecordingIndicator />)
  await act(async () => {
    useSessionStore.setState({ recordingState: 'recording' })
  })
  await act(async () => {
    useSessionStore.setState({ recordingState: 'idle' })
  })
  expect(screen.queryByTestId('recording-indicator')).not.toBeInTheDocument()
})
