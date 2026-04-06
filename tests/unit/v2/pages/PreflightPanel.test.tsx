import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { PreflightPanel } from '../../../../src/v2/pages/home/PreflightPanel'

const mockNavigate = jest.fn()
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}))

// Reject getUserMedia so no async state updates (setMicReady/setCamReady) leak
// outside act() during these layout-focused tests.
beforeEach(() => {
  jest.spyOn(navigator.mediaDevices, 'getUserMedia').mockRejectedValue(new Error('no camera'))
})

afterEach(() => {
  jest.restoreAllMocks()
})

function wrap(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

test('renders camera preview section', () => {
  wrap(<PreflightPanel />)
  expect(screen.getByTestId('camera-preview')).toBeInTheDocument()
})

test('shows mic and cam status indicators', async () => {
  wrap(<PreflightPanel />)
  await waitFor(() => {
    expect(screen.getByTestId('mic-status')).toBeInTheDocument()
    expect(screen.getByTestId('cam-status')).toBeInTheDocument()
  })
})

test('renders recent rooms section', () => {
  wrap(<PreflightPanel />)
  expect(screen.getByTestId('recent-rooms')).toBeInTheDocument()
})

test('shows stored-locally footer', () => {
  wrap(<PreflightPanel />)
  expect(screen.getByText(/stored locally/i)).toBeInTheDocument()
})

// ---------------------------------------------------------------------------
// Group A — acquired stream path
// ---------------------------------------------------------------------------
describe('with getUserMedia resolved', () => {
  const mockAudioTrack = { enabled: true, stop: jest.fn() }
  const mockVideoTrack = { enabled: true, stop: jest.fn() }
  const mockStream = {
    getTracks: () => [mockAudioTrack, mockVideoTrack],
    getAudioTracks: () => [mockAudioTrack],
    getVideoTracks: () => [mockVideoTrack],
  } as unknown as MediaStream

  beforeEach(() => {
    jest.spyOn(navigator.mediaDevices, 'getUserMedia').mockResolvedValue(mockStream)
    mockAudioTrack.enabled = true
    mockVideoTrack.enabled = true
  })

  test('mic status shows ready after getUserMedia resolves', async () => {
    wrap(<PreflightPanel />)
    await waitFor(() => expect(screen.getByText('Mic ready')).toBeInTheDocument())
  })

  test('cam status shows ready after getUserMedia resolves', async () => {
    wrap(<PreflightPanel />)
    await waitFor(() => expect(screen.getByText('Cam ready')).toBeInTheDocument())
  })

  test('toggleMic disables audio track', async () => {
    wrap(<PreflightPanel />)
    await waitFor(() => screen.getByText('Mic ready'))
    fireEvent.click(screen.getByText('🎙'))
    expect(mockAudioTrack.enabled).toBe(false)
  })

  test('toggleCam disables video track', async () => {
    wrap(<PreflightPanel />)
    await waitFor(() => screen.getByText('Cam ready'))
    fireEvent.click(screen.getByText('🎥'))
    expect(mockVideoTrack.enabled).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Group B — localStorage recent rooms
// ---------------------------------------------------------------------------
describe('recent rooms from localStorage', () => {
  afterEach(() => localStorage.clear())

  test('renders recent room items when localStorage is seeded', () => {
    const rooms = [{ id: 'room-abc', name: 'Daily Standup', lastVisited: Date.now() - 60000 }]
    localStorage.setItem('velo_recent_rooms', JSON.stringify(rooms))
    wrap(<PreflightPanel />)
    expect(screen.getByText('Daily Standup')).toBeInTheDocument()
  })

  test('getRecentRooms returns empty array on malformed JSON', () => {
    localStorage.setItem('velo_recent_rooms', 'not-json{{{')
    wrap(<PreflightPanel />)
    expect(screen.getByText('No recent rooms.')).toBeInTheDocument()
  })

  test('clicking recent room navigates to its route', () => {
    const rooms = [{ id: 'room-xyz', name: 'Team Call', lastVisited: Date.now() - 60000 }]
    localStorage.setItem('velo_recent_rooms', JSON.stringify(rooms))
    wrap(<PreflightPanel />)
    fireEvent.click(screen.getByText('Team Call'))
    expect(mockNavigate).toHaveBeenCalledWith('/v2/room/room-xyz')
  })
})

// ---------------------------------------------------------------------------
// Group C — formatRelative branches (exercised through the component so the
//            source lines are instrumented, not a duplicate copy in the test)
// ---------------------------------------------------------------------------
describe('formatRelative time display', () => {
  const NOW = 1000000000000
  beforeEach(() => jest.spyOn(Date, 'now').mockReturnValue(NOW))
  afterEach(() => { jest.restoreAllMocks(); localStorage.clear() })

  function renderWithRoom(lastVisited: number) {
    localStorage.setItem('velo_recent_rooms', JSON.stringify([{ id: 'r1', name: 'Room', lastVisited }]))
    wrap(<PreflightPanel />)
  }

  test('shows Xm ago for times within the last hour', () => {
    renderWithRoom(NOW - 1800000)
    expect(screen.getByText(/30m ago/)).toBeInTheDocument()
  })

  test('shows Xh ago for times within the last day', () => {
    renderWithRoom(NOW - 7200000)
    expect(screen.getByText(/2h ago/)).toBeInTheDocument()
  })

  test('shows yesterday for times within the last week', () => {
    renderWithRoom(NOW - 172800000)
    expect(screen.getByText('yesterday')).toBeInTheDocument()
  })

  test('shows Xd ago for times over a week old', () => {
    renderWithRoom(NOW - 864000000)
    expect(screen.getByText(/10d ago/)).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Group D — active room branches
// ---------------------------------------------------------------------------
describe('active room display', () => {
  afterEach(() => localStorage.clear())

  test('shows participant count when room is active with participantCount', () => {
    const rooms = [{ id: 'r1', name: 'Standup', lastVisited: Date.now(), isActive: true, participantCount: 5 }]
    localStorage.setItem('velo_recent_rooms', JSON.stringify(rooms))
    wrap(<PreflightPanel />)
    expect(screen.getByText('5 active')).toBeInTheDocument()
  })

  test('does not show participant count when isActive but participantCount absent', () => {
    const rooms = [{ id: 'r1', name: 'Standup', lastVisited: Date.now(), isActive: true }]
    localStorage.setItem('velo_recent_rooms', JSON.stringify(rooms))
    wrap(<PreflightPanel />)
    expect(screen.queryByText(/active/)).not.toBeInTheDocument()
  })

  test('falls back to room.id when name is empty string', () => {
    const rooms = [{ id: 'room-xyz', name: '', lastVisited: Date.now() }]
    localStorage.setItem('velo_recent_rooms', JSON.stringify(rooms))
    wrap(<PreflightPanel />)
    expect(screen.getByText('room-xyz')).toBeInTheDocument()
  })
})
