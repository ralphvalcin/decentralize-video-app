import { render, act } from '@testing-library/react'
import { MediaController } from '../../../../src/v2/call/MediaController'
import { useCallStore } from '../../../../src/v2/store/useCallStore'

describe('MediaController', () => {
  const mockAudioTrack = { enabled: true, stop: jest.fn(), kind: 'audio', onended: null as (() => void) | null }
  const mockVideoTrack = { enabled: true, stop: jest.fn(), kind: 'video', onended: null as (() => void) | null }
  const mockStream = {
    getTracks: () => [mockAudioTrack, mockVideoTrack],
    getAudioTracks: () => [mockAudioTrack],
    getVideoTracks: () => [mockVideoTrack],
  }

  beforeEach(() => {
    mockAudioTrack.enabled = true
    mockVideoTrack.enabled = true
    mockAudioTrack.onended = null
    mockVideoTrack.onended = null
    mockAudioTrack.stop.mockClear()
    mockVideoTrack.stop.mockClear()
    jest.spyOn(navigator.mediaDevices, 'getUserMedia').mockResolvedValue(mockStream as any)
    useCallStore.setState({ localStream: null, isMuted: false, isCamOff: false })
  })

  afterEach(() => { jest.restoreAllMocks() })

  test('acquires stream on mount and writes to store', async () => {
    await act(async () => { render(<MediaController />) })
    expect(useCallStore.getState().localStream).toBe(mockStream)
  })

  test('stops all tracks and clears store on unmount', async () => {
    let unmount!: () => void
    await act(async () => { unmount = render(<MediaController />).unmount })
    act(() => { unmount() })
    expect(mockAudioTrack.stop).toHaveBeenCalled()
    expect(mockVideoTrack.stop).toHaveBeenCalled()
    expect(useCallStore.getState().localStream).toBeNull()
  })

  test('disables audio track when isMuted becomes true', async () => {
    await act(async () => { render(<MediaController />) })
    act(() => { useCallStore.getState().setMuted(true) })
    expect(mockAudioTrack.enabled).toBe(false)
  })

  test('re-enables audio track when isMuted becomes false', async () => {
    useCallStore.setState({ isMuted: true })
    await act(async () => { render(<MediaController />) })
    act(() => { useCallStore.getState().setMuted(false) })
    expect(mockAudioTrack.enabled).toBe(true)
  })

  test('disables video track when isCamOff becomes true', async () => {
    await act(async () => { render(<MediaController />) })
    act(() => { useCallStore.getState().setCamOff(true) })
    expect(mockVideoTrack.enabled).toBe(false)
  })

  test('re-enables video track when isCamOff becomes false', async () => {
    useCallStore.setState({ isCamOff: true })
    await act(async () => { render(<MediaController />) })
    act(() => { useCallStore.getState().setCamOff(false) })
    expect(mockVideoTrack.enabled).toBe(true)
  })

  test('applies initial muted state to tracks when stream resolves', async () => {
    useCallStore.setState({ isMuted: true, isCamOff: true })
    await act(async () => { render(<MediaController />) })
    expect(mockAudioTrack.enabled).toBe(false)
    expect(mockVideoTrack.enabled).toBe(false)
  })

  test('stops acquired stream immediately if unmounted before getUserMedia resolves', async () => {
    let resolveStream!: (s: MediaStream) => void
    jest.spyOn(navigator.mediaDevices, 'getUserMedia').mockReturnValue(
      new Promise<MediaStream>((res) => { resolveStream = res })
    )
    const { unmount } = render(<MediaController />)
    act(() => { unmount() })
    await act(async () => { resolveStream(mockStream as any) })
    expect(mockAudioTrack.stop).toHaveBeenCalled()
    expect(mockVideoTrack.stop).toHaveBeenCalled()
    expect(useCallStore.getState().localStream).toBeNull()
  })

  test('sets isMuted true when audio track ends unexpectedly', async () => {
    await act(async () => { render(<MediaController />) })
    act(() => { mockAudioTrack.onended?.() })
    expect(useCallStore.getState().isMuted).toBe(true)
  })

  test('sets isCamOff true when video track ends unexpectedly', async () => {
    await act(async () => { render(<MediaController />) })
    act(() => { mockVideoTrack.onended?.() })
    expect(useCallStore.getState().isCamOff).toBe(true)
  })

  test('permission denied: store stays empty and error is logged', async () => {
    jest.spyOn(navigator.mediaDevices, 'getUserMedia').mockRejectedValue(
      new DOMException('Permission denied', 'NotAllowedError')
    )
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    await act(async () => { render(<MediaController />) })
    expect(useCallStore.getState().localStream).toBeNull()
    expect(consoleSpy).toHaveBeenCalledWith(
      '[MediaController] getUserMedia failed:',
      expect.any(DOMException)
    )
  })

  test('unmount clears onended handlers before stopping tracks', async () => {
    let unmount!: () => void
    await act(async () => { unmount = render(<MediaController />).unmount })
    // Verify onended was registered after stream acquisition
    expect(mockAudioTrack.onended).not.toBeNull()
    expect(mockVideoTrack.onended).not.toBeNull()
    act(() => { unmount() })
    // Cleanup must null handlers before stop() so browser-fired 'ended' on stop()
    // doesn't incorrectly write isMuted/isCamOff true into the store
    expect(mockAudioTrack.onended).toBeNull()
    expect(mockVideoTrack.onended).toBeNull()
    expect(useCallStore.getState().isMuted).toBe(false)
    expect(useCallStore.getState().isCamOff).toBe(false)
  })
})
