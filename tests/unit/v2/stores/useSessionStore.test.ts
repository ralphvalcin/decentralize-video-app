import { useSessionStore } from '../../../../src/v2/store/useSessionStore'
import type { ChatMessage, Poll, Question } from '../../../../src/v2/types'

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

const makeMessage = (overrides: Partial<ChatMessage> = {}): ChatMessage => ({
  id: 'msg-1',
  peerId: 'peer-1',
  peerName: 'Alice',
  text: 'Hello',
  sentAt: Date.now(),
  ...overrides,
})

beforeEach(() => {
  useSessionStore.setState({
    messages: [],
    pinnedMessage: null,
    activePoll: null,
    pollResponses: {},
    recordingState: 'idle',
    recordingConsentPeers: [],
    questions: [],
  })
})

test('addMessage appends to messages', () => {
  useSessionStore.getState().addMessage(makeMessage())
  expect(useSessionStore.getState().messages).toHaveLength(1)
})

test('pinMessage sets pinnedMessage', () => {
  const msg = makeMessage()
  useSessionStore.getState().addMessage(msg)
  useSessionStore.getState().pinMessage(msg)
  expect(useSessionStore.getState().pinnedMessage?.id).toBe('msg-1')
})

test('unpinMessage clears pinnedMessage', () => {
  useSessionStore.setState({ pinnedMessage: makeMessage() })
  useSessionStore.getState().unpinMessage()
  expect(useSessionStore.getState().pinnedMessage).toBeNull()
})

test('recordPollResponse stores peerId → choiceId', () => {
  useSessionStore.getState().recordPollResponse('peer-1', 'Yes')
  expect(useSessionStore.getState().pollResponses['peer-1']).toBe('Yes')
})

test('setRecordingState transitions state', () => {
  useSessionStore.getState().setRecordingState('recording')
  expect(useSessionStore.getState().recordingState).toBe('recording')
})

test('addRecordingConsent adds peerId once', () => {
  useSessionStore.getState().addRecordingConsent('peer-1')
  useSessionStore.getState().addRecordingConsent('peer-1')
  expect(useSessionStore.getState().recordingConsentPeers).toHaveLength(1)
})

test('setActivePoll sets poll and resets pollResponses', () => {
  useSessionStore.getState().recordPollResponse('peer-1', 'Yes')
  const poll: Poll = {
    id: 'poll-1',
    question: 'Q?',
    options: ['Yes', 'No'],
    createdAt: 0,
    createdBy: 'Alice',
    isActive: true,
    votes: {},
  }
  useSessionStore.getState().setActivePoll(poll)
  expect(useSessionStore.getState().activePoll?.id).toBe('poll-1')
  expect(useSessionStore.getState().pollResponses).toEqual({})
})

test('setActivePoll(null) clears poll and resets pollResponses', () => {
  const poll: Poll = {
    id: 'poll-1',
    question: 'Q?',
    options: ['Yes', 'No'],
    createdAt: 0,
    createdBy: 'Alice',
    isActive: true,
    votes: {},
  }
  useSessionStore.getState().setActivePoll(poll)
  useSessionStore.getState().recordPollResponse('peer-1', 'Yes')
  useSessionStore.getState().setActivePoll(null)
  expect(useSessionStore.getState().activePoll).toBeNull()
  expect(useSessionStore.getState().pollResponses).toEqual({})
})

test('addQuestion appends to questions', () => {
  useSessionStore.getState().addQuestion(makeQuestion())
  expect(useSessionStore.getState().questions).toHaveLength(1)
})

test('updateQuestion replaces question by id', () => {
  const q = makeQuestion({ id: 'q-1', votes: 0 })
  useSessionStore.setState({ questions: [q] })
  useSessionStore.getState().updateQuestion({ ...q, votes: 3 })
  expect(useSessionStore.getState().questions[0].votes).toBe(3)
})

test('updateQuestion appends if id not found', () => {
  useSessionStore.setState({ questions: [] })
  useSessionStore.getState().updateQuestion(makeQuestion({ id: 'q-new' }))
  expect(useSessionStore.getState().questions).toHaveLength(1)
})

test('setQuestionsHistory replaces all questions', () => {
  useSessionStore.setState({ questions: [makeQuestion()] })
  const qs = [makeQuestion({ id: 'q-a' }), makeQuestion({ id: 'q-b' })]
  useSessionStore.getState().setQuestionsHistory(qs)
  expect(useSessionStore.getState().questions).toHaveLength(2)
  expect(useSessionStore.getState().questions[0].id).toBe('q-a')
})
