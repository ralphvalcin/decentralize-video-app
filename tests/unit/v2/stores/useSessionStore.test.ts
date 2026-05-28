import { useSessionStore } from '../../../../src/v2/store/useSessionStore'
import type { ChatMessage, Poll } from '../../../../src/v2/types'

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
