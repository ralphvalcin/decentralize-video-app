import { render, screen } from '@testing-library/react'
import { CaptionOverlay } from '../../../../../src/v2/components/ai/CaptionOverlay'
import { useUIStore } from '../../../../../src/v2/store/useUIStore'
import { useTranscriptionStore } from '../../../../../src/v2/store/useTranscriptionStore'
import type { TranscriptSegment } from '../../../../../src/v2/types'

beforeEach(() => {
  useUIStore.setState({ isCaptionsOpen: false })
  useTranscriptionStore.setState({ isEnabled: false, isLoading: false, segments: [] })
})

test('returns null when isCaptionsOpen is false', () => {
  render(<CaptionOverlay />)
  expect(screen.queryByTestId('caption-overlay')).not.toBeInTheDocument()
})

test('shows loading text when isCaptionsOpen=true and isLoading=true', () => {
  useUIStore.setState({ isCaptionsOpen: true })
  useTranscriptionStore.setState({ isLoading: true })
  render(<CaptionOverlay />)
  expect(screen.getByTestId('caption-overlay')).toHaveTextContent('Loading captions model…')
})

test('does not show loading text when isLoading=false', () => {
  useUIStore.setState({ isCaptionsOpen: true })
  useTranscriptionStore.setState({ isLoading: false, segments: [] })
  render(<CaptionOverlay />)
  expect(screen.queryByText(/Loading captions model/)).not.toBeInTheDocument()
})

test('renders [userName]: text format for each segment', () => {
  useUIStore.setState({ isCaptionsOpen: true })
  useTranscriptionStore.setState({
    segments: [{ speakerId: 's1', userName: 'Alice', text: 'Hello world', timestamp: 1 }],
  })
  render(<CaptionOverlay />)
  expect(screen.getByText('[Alice]: Hello world')).toBeInTheDocument()
})

test('renders only the last 3 segments when more than 3 exist', () => {
  const segments: TranscriptSegment[] = [
    { speakerId: 's1', userName: 'Alice', text: 'First', timestamp: 1 },
    { speakerId: 's2', userName: 'Bob', text: 'Second', timestamp: 2 },
    { speakerId: 's1', userName: 'Alice', text: 'Third', timestamp: 3 },
    { speakerId: 's2', userName: 'Bob', text: 'Fourth', timestamp: 4 },
  ]
  useUIStore.setState({ isCaptionsOpen: true })
  useTranscriptionStore.setState({ segments })
  render(<CaptionOverlay />)
  expect(screen.queryByText('[Alice]: First')).not.toBeInTheDocument()
  expect(screen.getByText('[Bob]: Second')).toBeInTheDocument()
  expect(screen.getByText('[Alice]: Third')).toBeInTheDocument()
  expect(screen.getByText('[Bob]: Fourth')).toBeInTheDocument()
})

test('renders all segments when 3 or fewer exist', () => {
  const segments: TranscriptSegment[] = [
    { speakerId: 's1', userName: 'Alice', text: 'Only one', timestamp: 1 },
  ]
  useUIStore.setState({ isCaptionsOpen: true })
  useTranscriptionStore.setState({ segments })
  render(<CaptionOverlay />)
  expect(screen.getByText('[Alice]: Only one')).toBeInTheDocument()
})

test('has role="region" and aria-live="polite" when open', () => {
  useUIStore.setState({ isCaptionsOpen: true })
  useTranscriptionStore.setState({
    segments: [{ speakerId: 's1', userName: 'Alice', text: 'Hello', timestamp: 1 }],
  })
  render(<CaptionOverlay />)
  const overlay = screen.getByTestId('caption-overlay')
  expect(overlay).toHaveAttribute('role', 'region')
  expect(overlay).toHaveAttribute('aria-live', 'polite')
})
