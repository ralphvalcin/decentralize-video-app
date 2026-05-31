import { render, screen, fireEvent } from '@testing-library/react'
import { ChatPanel } from '../../../../src/v2/call/ChatPanel'
import { useSessionStore } from '../../../../src/v2/store/useSessionStore'
import { usePeerStore } from '../../../../src/v2/store/usePeerStore'
import type { PeerRecord } from '../../../../src/v2/types'

function makePeer(overrides: Partial<PeerRecord> = {}): PeerRecord {
  return {
    id: 'peer-1', name: 'Alice', role: 'guest',
    stream: null, isMuted: false, isCamOff: false, videoEnabled: false, isScreenSharing: false,
    connectionState: 'connected', networkQuality: 'good',
    isSpeaking: false, isPinned: false, hasRaisedHand: false, handRaisedAt: null,
    reaction: null, isAway: false, isTyping: false,
    ...overrides,
  }
}

beforeEach(() => {
  useSessionStore.setState({ messages: [], pinnedMessage: null })
  usePeerStore.setState({ peers: new Map() })
})

test('renders chat panel', () => {
  render(<ChatPanel onSendMessage={jest.fn()} />)
  expect(screen.getByTestId('chat-panel')).toBeInTheDocument()
})

test('displays messages', () => {
  useSessionStore.getState().addMessage({ id: 'msg-1', peerId: 'p1', peerName: 'Alice', text: 'Hello!', sentAt: Date.now() })
  render(<ChatPanel onSendMessage={jest.fn()} />)
  expect(screen.getByText('Hello!')).toBeInTheDocument()
  expect(screen.getByText('Alice')).toBeInTheDocument()
})

test('shows pinned message banner when pinnedMessage is set', () => {
  useSessionStore.getState().pinMessage({ id: 'msg-1', peerId: 'p1', peerName: 'Alice', text: 'Important!', sentAt: 1000 })
  render(<ChatPanel onSendMessage={jest.fn()} />)
  expect(screen.getByTestId('pinned-message')).toHaveTextContent('Important!')
})

test('send button calls onSendMessage with input text', () => {
  const onSendMessage = jest.fn()
  render(<ChatPanel onSendMessage={onSendMessage} />)
  fireEvent.change(screen.getByTestId('chat-input'), { target: { value: 'Hey!' } })
  fireEvent.click(screen.getByTestId('chat-send'))
  expect(onSendMessage).toHaveBeenCalledWith('Hey!')
})

test('Enter key sends message', () => {
  const onSendMessage = jest.fn()
  render(<ChatPanel onSendMessage={onSendMessage} />)
  fireEvent.change(screen.getByTestId('chat-input'), { target: { value: 'Test' } })
  fireEvent.keyDown(screen.getByTestId('chat-input'), { key: 'Enter' })
  expect(onSendMessage).toHaveBeenCalledWith('Test')
})

test('clears input after send', () => {
  render(<ChatPanel onSendMessage={jest.fn()} />)
  fireEvent.change(screen.getByTestId('chat-input'), { target: { value: 'Hi' } })
  fireEvent.click(screen.getByTestId('chat-send'))
  expect(screen.getByTestId('chat-input')).toHaveValue('')
})

test('send button disabled when input is empty', () => {
  render(<ChatPanel onSendMessage={jest.fn()} />)
  expect(screen.getByTestId('chat-send')).toBeDisabled()
})

test('shows typing indicator for peers with isTyping true', () => {
  usePeerStore.getState().setPeer('peer-1', makePeer({ name: 'Alice', isTyping: true }))
  render(<ChatPanel onSendMessage={jest.fn()} />)
  expect(screen.getByTestId('typing-indicator')).toHaveTextContent('Alice typing...')
})

test('Enter on empty input does not call onSendMessage', () => {
  const onSendMessage = jest.fn()
  render(<ChatPanel onSendMessage={onSendMessage} />)
  fireEvent.keyDown(screen.getByTestId('chat-input'), { key: 'Enter' })
  expect(onSendMessage).not.toHaveBeenCalled()
})

test('Shift+Enter does not send message', () => {
  const onSendMessage = jest.fn()
  render(<ChatPanel onSendMessage={onSendMessage} />)
  fireEvent.change(screen.getByTestId('chat-input'), { target: { value: 'Draft' } })
  fireEvent.keyDown(screen.getByTestId('chat-input'), { key: 'Enter', shiftKey: true })
  expect(onSendMessage).not.toHaveBeenCalled()
})
