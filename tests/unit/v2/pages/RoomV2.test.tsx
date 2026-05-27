import { render, screen, fireEvent, act } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { useCallStore } from '../../../../src/v2/store/useCallStore'
import { useUIStore } from '../../../../src/v2/store/useUIStore'
import { useSessionStore } from '../../../../src/v2/store/useSessionStore'
import { Suspense } from 'react'

const mockNavigate = jest.fn()
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}))

// Mock socket.io-client with named `io` export (PeerManager uses `import { io }`)
const mockSocket = {
  on: jest.fn(),
  once: jest.fn(),
  off: jest.fn(),
  emit: jest.fn(),
  disconnect: jest.fn(),
  id: 'mock-socket-id',
}
jest.mock('socket.io-client', () => ({ io: jest.fn(() => mockSocket) }))

// Silence getUserMedia in this test file
beforeEach(() => {
  mockNavigate.mockClear()
  mockSocket.on.mockClear()
  mockSocket.once.mockClear()
  mockSocket.off.mockClear()
  mockSocket.emit.mockClear()
  mockSocket.disconnect.mockClear()
  jest.spyOn(navigator.mediaDevices, 'getUserMedia').mockRejectedValue(new Error('no cam'))
  useCallStore.setState({ userName: 'Ralph', isMuted: false, isCamOff: false, localStream: null, screenSharePeerId: null })
  useUIStore.setState({ isChatOpen: false, isParticipantsOpen: false })
  useSessionStore.setState({ activePoll: null, pollResponses: {} })
})
afterEach(() => { jest.restoreAllMocks() })

async function renderRoom(roomId = 'test-room') {
  const RoomV2 = (await import('../../../../src/v2/pages/RoomV2')).default
  return render(
    <MemoryRouter initialEntries={[`/room/${roomId}`]}>
      <Suspense fallback={null}>
        <Routes>
          <Route path="/room/:roomId" element={<RoomV2 />} />
        </Routes>
      </Suspense>
    </MemoryRouter>
  )
}

test('renders room-v2 container', async () => {
  const { findByTestId } = await renderRoom()
  expect(await findByTestId('room-v2')).toBeInTheDocument()
})

test('displays room name in top bar', async () => {
  await renderRoom('my-room')
  expect(await screen.findByText('my-room')).toBeInTheDocument()
})

test('chat panel is hidden by default', async () => {
  await renderRoom()
  await screen.findByTestId('room-v2')
  expect(screen.queryByTestId('chat-panel')).not.toBeInTheDocument()
})

test('chat panel appears when isChatOpen is true', async () => {
  const { findByTestId } = await renderRoom()
  await findByTestId('room-v2')
  act(() => { useUIStore.getState().toggleChat() })
  expect(await screen.findByTestId('chat-panel')).toBeInTheDocument()
})

test('end call button navigates to /', async () => {
  const { findByTestId } = await renderRoom()
  await findByTestId('room-v2')
  fireEvent.click(screen.getByTestId('btn-end-call'))
  expect(mockNavigate).toHaveBeenCalledWith('/')
})

test('reaction from ControlBar flows through ref without throwing', async () => {
  const { findByTestId } = await renderRoom()
  await findByTestId('room-v2')
  fireEvent.click(screen.getByTestId('btn-reactions'))
  expect(() => fireEvent.click(screen.getByText('👍'))).not.toThrow()
})

test('sendMessage from ChatPanel flows through ref without throwing', async () => {
  const { findByTestId } = await renderRoom()
  await findByTestId('room-v2')
  act(() => { useUIStore.getState().toggleChat() })
  const input = await screen.findByTestId('chat-input')
  fireEvent.change(input, { target: { value: 'Hello' } })
  expect(() => fireEvent.click(screen.getByTestId('chat-send'))).not.toThrow()
})

test('participants panel is hidden by default', async () => {
  await renderRoom()
  await screen.findByTestId('room-v2')
  expect(screen.queryByTestId('participants-panel')).not.toBeInTheDocument()
})

test('participants panel appears when isParticipantsOpen is true', async () => {
  await renderRoom()
  await screen.findByTestId('room-v2')
  act(() => { useUIStore.getState().toggleParticipants() })
  expect(await screen.findByTestId('participants-panel')).toBeInTheDocument()
})

test('poll-banner is absent when activePoll is null', async () => {
  await renderRoom()
  await screen.findByTestId('room-v2')
  expect(screen.queryByTestId('poll-banner')).not.toBeInTheDocument()
})

test('poll-banner appears when activePoll is set', async () => {
  await renderRoom()
  await screen.findByTestId('room-v2')
  act(() => {
    useSessionStore.setState({
      activePoll: { id: 'p1', question: 'Ready?', options: ['Yes', 'No'], createdAt: 1 },
    })
  })
  expect(await screen.findByTestId('poll-banner')).toBeInTheDocument()
})

test('redirects to /?redirect=/room/:id when userName is empty', async () => {
  useCallStore.setState({ userName: '' })
  await renderRoom('abc123')
  await screen.findByTestId('room-v2')
  expect(mockNavigate).toHaveBeenCalledWith('/?redirect=/room/abc123')
})

test('does not redirect when userName is set', async () => {
  useCallStore.setState({ userName: 'Ralph' })
  await renderRoom('abc123')
  await screen.findByTestId('room-v2')
  expect(mockNavigate).not.toHaveBeenCalledWith(expect.stringContaining('redirect'))
})

test('passes roomId from URL params to PeerManager via socket emit', async () => {
  useCallStore.setState({ userName: 'Ralph' })
  await renderRoom('xyz789')
  await screen.findByTestId('room-v2')
  act(() => {
    const connectCb = mockSocket.on.mock.calls.find(([event]: [string]) => event === 'connect')?.[1]
    if (connectCb) connectCb()
  })
  expect(mockSocket.emit).toHaveBeenCalledWith('request-room-token',
    expect.objectContaining({ roomId: 'xyz789' })
  )
})

test('end call resets isMuted and isCamOff before navigating', async () => {
  useCallStore.setState({ userName: 'Ralph', isMuted: true, isCamOff: true })
  const { findByTestId } = await renderRoom()
  await findByTestId('room-v2')
  fireEvent.click(screen.getByTestId('btn-end-call'))
  expect(useCallStore.getState().isMuted).toBe(false)
  expect(useCallStore.getState().isCamOff).toBe(false)
  expect(mockNavigate).toHaveBeenCalledWith('/')
})
