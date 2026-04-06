import { render, screen } from '@testing-library/react'
import { PollBanner } from '../../../../src/v2/call/PollBanner'
import { useSessionStore } from '../../../../src/v2/store/useSessionStore'
import type { Poll } from '../../../../src/v2/types'

const poll: Poll = {
  id: 'poll-1',
  question: 'Best time to meet?',
  options: ['9am', '2pm', '5pm'],
  createdAt: Date.now(),
}

beforeEach(() => {
  useSessionStore.setState({ activePoll: null, pollResponses: {} })
})

test('renders nothing when no active poll', () => {
  const { container } = render(<PollBanner />)
  expect(container.firstChild).toBeNull()
})

test('renders poll question when poll is active', () => {
  useSessionStore.setState({ activePoll: poll })
  render(<PollBanner />)
  expect(screen.getByTestId('poll-banner')).toBeInTheDocument()
  expect(screen.getByText('Best time to meet?')).toBeInTheDocument()
})

test('renders all poll options', () => {
  useSessionStore.setState({ activePoll: poll })
  render(<PollBanner />)
  expect(screen.getByText('9am')).toBeInTheDocument()
  expect(screen.getByText('2pm')).toBeInTheDocument()
  expect(screen.getByText('5pm')).toBeInTheDocument()
})

test('each option has its own testid', () => {
  useSessionStore.setState({ activePoll: poll })
  render(<PollBanner />)
  expect(screen.getByTestId('poll-option-9am')).toBeInTheDocument()
  expect(screen.getByTestId('poll-option-2pm')).toBeInTheDocument()
  expect(screen.getByTestId('poll-option-5pm')).toBeInTheDocument()
})

test('each option button is disabled', () => {
  useSessionStore.setState({ activePoll: poll })
  render(<PollBanner />)
  expect(screen.getByTestId('poll-option-9am')).toBeDisabled()
  expect(screen.getByTestId('poll-option-2pm')).toBeDisabled()
  expect(screen.getByTestId('poll-option-5pm')).toBeDisabled()
})
