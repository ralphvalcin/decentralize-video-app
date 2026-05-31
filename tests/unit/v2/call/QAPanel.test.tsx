import { render, screen, fireEvent } from '@testing-library/react'
import { QAPanel } from '../../../../src/v2/call/QAPanel'
import { useSessionStore } from '../../../../src/v2/store/useSessionStore'
import type { Question } from '../../../../src/v2/types'

const makeQuestion = (overrides: Partial<Question> = {}): Question => ({
  id: 'q-1',
  text: 'How do I join?',
  author: 'Bob',
  authorId: 'socket-1',
  timestamp: 1000,
  votes: 0,
  votedBy: [],
  answer: null,
  answeredBy: null,
  answeredAt: null,
  isAnswered: false,
  ...overrides,
})

const defaultProps = {
  onSubmitQuestion: jest.fn(),
  onVoteQuestion: jest.fn(),
  onAnswerQuestion: jest.fn(),
}

beforeEach(() => {
  useSessionStore.setState({ questions: [] })
  jest.clearAllMocks()
})

test('renders QA panel with Q&A header', () => {
  render(<QAPanel {...defaultProps} />)
  expect(screen.getByTestId('qa-panel')).toBeInTheDocument()
  expect(screen.getByText('Q&A')).toBeInTheDocument()
})

test('renders empty state when no questions', () => {
  render(<QAPanel {...defaultProps} />)
  expect(screen.getByTestId('qa-empty')).toBeInTheDocument()
})

test('renders question text', () => {
  useSessionStore.setState({ questions: [makeQuestion()] })
  render(<QAPanel {...defaultProps} />)
  expect(screen.getByText('How do I join?')).toBeInTheDocument()
})

test('renders question author', () => {
  useSessionStore.setState({ questions: [makeQuestion()] })
  render(<QAPanel {...defaultProps} />)
  expect(screen.getByText('Bob')).toBeInTheDocument()
})

test('renders vote count', () => {
  useSessionStore.setState({ questions: [makeQuestion({ votes: 5 })] })
  render(<QAPanel {...defaultProps} />)
  expect(screen.getByText('5')).toBeInTheDocument()
})

test('upvote button calls onVoteQuestion with question id', () => {
  useSessionStore.setState({ questions: [makeQuestion({ id: 'q-1' })] })
  render(<QAPanel {...defaultProps} />)
  fireEvent.click(screen.getByTestId('btn-upvote-q-1'))
  expect(defaultProps.onVoteQuestion).toHaveBeenCalledWith('q-1')
})

test('upvote button is disabled after clicking', () => {
  useSessionStore.setState({ questions: [makeQuestion({ id: 'q-1' })] })
  render(<QAPanel {...defaultProps} />)
  const btn = screen.getByTestId('btn-upvote-q-1')
  fireEvent.click(btn)
  expect(btn).toBeDisabled()
})

test('shows answered question with answer box', () => {
  useSessionStore.setState({
    questions: [makeQuestion({ isAnswered: true, answer: 'Click Join.', answeredBy: 'Alice' })],
  })
  render(<QAPanel {...defaultProps} />)
  expect(screen.getByTestId('qa-answer')).toBeInTheDocument()
  expect(screen.getByText('Click Join.')).toBeInTheDocument()
  expect(screen.getByText(/Alice/)).toBeInTheDocument()
})

test('sorts questions by votes descending', () => {
  useSessionStore.setState({
    questions: [
      makeQuestion({ id: 'q-low', text: 'Low votes', votes: 1 }),
      makeQuestion({ id: 'q-high', text: 'High votes', votes: 10 }),
    ],
  })
  render(<QAPanel {...defaultProps} />)
  const items = screen.getAllByTestId(/^qa-question-/)
  expect(items[0]).toHaveTextContent('High votes')
  expect(items[1]).toHaveTextContent('Low votes')
})

test('clicking Answer expands inline answer input', () => {
  useSessionStore.setState({ questions: [makeQuestion({ id: 'q-1', isAnswered: false })] })
  render(<QAPanel {...defaultProps} />)
  fireEvent.click(screen.getByTestId('btn-expand-answer-q-1'))
  expect(screen.getByTestId('answer-input-q-1')).toBeInTheDocument()
})

test('submitting answer calls onAnswerQuestion and closes input', () => {
  useSessionStore.setState({ questions: [makeQuestion({ id: 'q-1', isAnswered: false })] })
  render(<QAPanel {...defaultProps} />)
  fireEvent.click(screen.getByTestId('btn-expand-answer-q-1'))
  fireEvent.change(screen.getByTestId('answer-input-q-1'), { target: { value: 'Because.' } })
  fireEvent.click(screen.getByTestId('btn-submit-answer-q-1'))
  expect(defaultProps.onAnswerQuestion).toHaveBeenCalledWith('q-1', 'Because.')
})

test('ask input submits new question via onSubmitQuestion and clears field', () => {
  render(<QAPanel {...defaultProps} />)
  const input = screen.getByTestId('qa-ask-input')
  fireEvent.change(input, { target: { value: 'When is it?' } })
  fireEvent.click(screen.getByTestId('btn-ask'))
  expect(defaultProps.onSubmitQuestion).toHaveBeenCalledWith('When is it?')
  expect((input as HTMLInputElement).value).toBe('')
})

test('ask button is disabled when input is empty', () => {
  render(<QAPanel {...defaultProps} />)
  expect(screen.getByTestId('btn-ask')).toBeDisabled()
})
