import { render, screen, fireEvent } from '@testing-library/react'
import { PollBanner } from '../../../../src/v2/call/PollBanner'
import { useSessionStore } from '../../../../src/v2/store/useSessionStore'
import type { Poll } from '../../../../src/v2/types'

const poll: Poll = {
  id: 'poll-1',
  question: 'Best time to meet?',
  options: ['9am', '2pm', '5pm'],
  createdAt: Date.now(),
  createdBy: 'Alice',
  isActive: true,
  votes: {},
}

const pollWithVotes: Poll = {
  ...poll,
  votes: { 'socket-a': 0, 'socket-b': 0, 'socket-c': 1 },
}

beforeEach(() => {
  useSessionStore.setState({ activePoll: null, pollResponses: {} })
})

test('renders nothing when no active poll', () => {
  const { container } = render(<PollBanner onVotePoll={jest.fn()} />)
  expect(container.firstChild).toBeNull()
})

test('renders poll question when poll is active', () => {
  useSessionStore.setState({ activePoll: poll })
  render(<PollBanner onVotePoll={jest.fn()} />)
  expect(screen.getByTestId('poll-banner')).toBeInTheDocument()
  expect(screen.getByText('Best time to meet?')).toBeInTheDocument()
})

test('renders all poll options', () => {
  useSessionStore.setState({ activePoll: poll })
  render(<PollBanner onVotePoll={jest.fn()} />)
  expect(screen.getByText('9am')).toBeInTheDocument()
  expect(screen.getByText('2pm')).toBeInTheDocument()
  expect(screen.getByText('5pm')).toBeInTheDocument()
})

test('each option has its own testid', () => {
  useSessionStore.setState({ activePoll: poll })
  render(<PollBanner onVotePoll={jest.fn()} />)
  expect(screen.getByTestId('poll-option-9am')).toBeInTheDocument()
  expect(screen.getByTestId('poll-option-2pm')).toBeInTheDocument()
  expect(screen.getByTestId('poll-option-5pm')).toBeInTheDocument()
})

test('options are enabled before voting', () => {
  useSessionStore.setState({ activePoll: poll })
  render(<PollBanner onVotePoll={jest.fn()} />)
  expect(screen.getByTestId('poll-option-9am')).not.toBeDisabled()
})

test('clicking option calls onVotePoll with correct pollId and optionIndex', () => {
  useSessionStore.setState({ activePoll: poll })
  const onVotePoll = jest.fn()
  render(<PollBanner onVotePoll={onVotePoll} />)
  fireEvent.click(screen.getByTestId('poll-option-9am'))
  expect(onVotePoll).toHaveBeenCalledWith('poll-1', 0)
})

test('after voting all options become disabled', () => {
  useSessionStore.setState({ activePoll: poll })
  render(<PollBanner onVotePoll={jest.fn()} />)
  fireEvent.click(screen.getByTestId('poll-option-9am'))
  expect(screen.getByTestId('poll-option-9am')).toBeDisabled()
  expect(screen.getByTestId('poll-option-2pm')).toBeDisabled()
  expect(screen.getByTestId('poll-option-5pm')).toBeDisabled()
})

test('shows vote counts and percentages', () => {
  useSessionStore.setState({ activePoll: pollWithVotes })
  render(<PollBanner onVotePoll={jest.fn()} />)
  // 2 votes for index 0 (9am) = 67%, 1 vote for index 1 (2pm) = 33%, 0 for 5pm
  expect(screen.getByText('2 (67%)')).toBeInTheDocument()
  expect(screen.getByText('1 (33%)')).toBeInTheDocument()
  expect(screen.getByText('0')).toBeInTheDocument()
})

test('votedIndex resets when poll id changes', () => {
  useSessionStore.setState({ activePoll: poll })
  const { rerender } = render(<PollBanner onVotePoll={jest.fn()} />)
  fireEvent.click(screen.getByTestId('poll-option-9am'))
  expect(screen.getByTestId('poll-option-9am')).toBeDisabled()

  const poll2: Poll = { ...poll, id: 'poll-2' }
  useSessionStore.setState({ activePoll: poll2 })
  rerender(<PollBanner onVotePoll={jest.fn()} />)
  expect(screen.getByTestId('poll-option-9am')).not.toBeDisabled()
})
