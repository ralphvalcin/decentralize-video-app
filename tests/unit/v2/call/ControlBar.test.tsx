import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import { ControlBar } from '../../../../src/v2/call/ControlBar'
import { useCallStore } from '../../../../src/v2/store/useCallStore'
import { useUIStore } from '../../../../src/v2/store/useUIStore'
import { useTranscriptionStore } from '../../../../src/v2/store/useTranscriptionStore'

// framer-motion's AnimatePresence calls setState in an rAF callback after exit
// animations complete — React flags this as outside act(). Strip animations so
// component-controlled visibility (the `visible &&` guard) drives DOM presence.
jest.mock('framer-motion', () => {
  const React = require('react')
  return {
    motion: {
      div: React.forwardRef(
        ({ children, initial, animate, exit, transition, ...rest }: any, ref: any) =>
          React.createElement('div', { ref, ...rest }, children)
      ),
    },
    AnimatePresence: ({ children }: any) => React.createElement(React.Fragment, null, children),
  }
})

beforeEach(() => {
  useCallStore.setState({ isMuted: false, isCamOff: false, isNoiseSuppressed: true })
  useUIStore.setState({ isChatOpen: false, isParticipantsOpen: false, isQAOpen: false, isAIOpen: false, isCaptionsOpen: false, isWhiteboardOpen: false })
  useTranscriptionStore.setState({ isLoading: false, isEnabled: false, segments: [] })
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

test('renders control bar', () => {
  render(<ControlBar onEndCall={jest.fn()} />)
  expect(screen.getByTestId('control-bar')).toBeInTheDocument()
})

test('mute button toggles isMuted in store', () => {
  render(<ControlBar onEndCall={jest.fn()} />)
  fireEvent.click(screen.getByTestId('btn-mute'))
  expect(useCallStore.getState().isMuted).toBe(true)
  fireEvent.click(screen.getByTestId('btn-mute'))
  expect(useCallStore.getState().isMuted).toBe(false)
})

test('cam button toggles isCamOff in store', () => {
  render(<ControlBar onEndCall={jest.fn()} />)
  fireEvent.click(screen.getByTestId('btn-cam'))
  expect(useCallStore.getState().isCamOff).toBe(true)
})

test('end call button calls onEndCall', () => {
  const onEndCall = jest.fn()
  render(<ControlBar onEndCall={onEndCall} />)
  fireEvent.click(screen.getByTestId('btn-end-call'))
  expect(onEndCall).toHaveBeenCalled()
})

test('reactions button opens reaction picker', () => {
  render(<ControlBar onEndCall={jest.fn()} />)
  fireEvent.click(screen.getByTestId('btn-reactions'))
  expect(screen.getByTestId('reaction-picker')).toBeInTheDocument()
})

test('clicking a reaction calls onSendReaction and closes picker', () => {
  const onSendReaction = jest.fn()
  render(<ControlBar onEndCall={jest.fn()} onSendReaction={onSendReaction} />)
  fireEvent.click(screen.getByTestId('btn-reactions'))
  fireEvent.click(screen.getByText('👍'))
  expect(onSendReaction).toHaveBeenCalledWith('👍')
  expect(screen.queryByTestId('reaction-picker')).not.toBeInTheDocument()
})

const waitForHide = () => act(async () => new Promise(r => setTimeout(r, 3100)))

test('control bar hides after 3 seconds of inactivity', async () => {
  jest.useRealTimers()
  render(<ControlBar onEndCall={jest.fn()} />)
  expect(screen.getByTestId('control-bar')).toBeInTheDocument()
  await waitForHide()
  expect(screen.queryByTestId('control-bar')).not.toBeInTheDocument()
})

test('control bar reappears on mousemove', async () => {
  jest.useRealTimers()
  render(<ControlBar onEndCall={jest.fn()} />)
  await waitForHide()
  expect(screen.queryByTestId('control-bar')).not.toBeInTheDocument()
  fireEvent.mouseMove(window)
  expect(screen.getByTestId('control-bar')).toBeInTheDocument()
})

test('cleanup clears pending timer on unmount', () => {
  let capturedId: ReturnType<typeof setTimeout> | undefined
  const origSet = global.setTimeout
  jest.spyOn(global, 'setTimeout').mockImplementation((fn: TimerHandler, delay?: number) => {
    capturedId = origSet(fn as () => void, delay)
    return capturedId
  })
  const clearSpy = jest.spyOn(global, 'clearTimeout')
  const { unmount } = render(<ControlBar onEndCall={jest.fn()} />)
  unmount()
  expect(clearSpy).toHaveBeenCalledWith(capturedId)
  jest.restoreAllMocks()
})

test('chat button toggles isChatOpen in store', () => {
  render(<ControlBar onEndCall={jest.fn()} />)
  fireEvent.click(screen.getByTestId('btn-chat'))
  expect(useUIStore.getState().isChatOpen).toBe(true)
  fireEvent.click(screen.getByTestId('btn-chat'))
  expect(useUIStore.getState().isChatOpen).toBe(false)
})

test('participants button toggles isParticipantsOpen in store', () => {
  render(<ControlBar onEndCall={jest.fn()} />)
  fireEvent.click(screen.getByTestId('btn-participants'))
  expect(useUIStore.getState().isParticipantsOpen).toBe(true)
  fireEvent.click(screen.getByTestId('btn-participants'))
  expect(useUIStore.getState().isParticipantsOpen).toBe(false)
})

test('chat button renders with primary variant when isChatOpen', () => {
  useUIStore.setState({ isChatOpen: true })
  render(<ControlBar onEndCall={jest.fn()} />)
  const btn = screen.getByTestId('btn-chat')
  expect(btn.className).toMatch(/bg-\[var\(--text-primary\)\]/)
})

test('participants button renders with primary variant when isParticipantsOpen', () => {
  useUIStore.setState({ isParticipantsOpen: true })
  render(<ControlBar onEndCall={jest.fn()} />)
  const btn = screen.getByTestId('btn-participants')
  expect(btn.className).toMatch(/bg-\[var\(--text-primary\)\]/)
})

test('opening chat closes participants (mutual exclusion)', () => {
  useUIStore.setState({ isParticipantsOpen: true })
  render(<ControlBar onEndCall={jest.fn()} />)
  fireEvent.click(screen.getByTestId('btn-chat'))
  expect(useUIStore.getState().isChatOpen).toBe(true)
  expect(useUIStore.getState().isParticipantsOpen).toBe(false)
})

test('cleanup does not throw when unmounted before auto-hide timer fires', () => {
  jest.useRealTimers()
  const { unmount } = render(<ControlBar onEndCall={jest.fn()} />)
  expect(() => unmount()).not.toThrow()
})

test('opening participants closes chat (mutual exclusion)', () => {
  useUIStore.setState({ isChatOpen: true })
  render(<ControlBar onEndCall={jest.fn()} />)
  fireEvent.click(screen.getByTestId('btn-participants'))
  expect(useUIStore.getState().isParticipantsOpen).toBe(true)
  expect(useUIStore.getState().isChatOpen).toBe(false)
})

test('Q&A button exists in control bar', () => {
  render(<ControlBar onEndCall={jest.fn()} />)
  expect(screen.getByTestId('btn-qa')).toBeInTheDocument()
})

test('Q&A button toggles isQAOpen in store', () => {
  render(<ControlBar onEndCall={jest.fn()} />)
  fireEvent.click(screen.getByTestId('btn-qa'))
  expect(useUIStore.getState().isQAOpen).toBe(true)
  fireEvent.click(screen.getByTestId('btn-qa'))
  expect(useUIStore.getState().isQAOpen).toBe(false)
})

test('Q&A button renders with primary variant when isQAOpen', () => {
  useUIStore.setState({ isQAOpen: true })
  render(<ControlBar onEndCall={jest.fn()} />)
  expect(screen.getByTestId('btn-qa').className).toMatch(/bg-\[var\(--text-primary\)\]/)
})

test('opening Q&A closes chat (mutual exclusion via store)', () => {
  useUIStore.setState({ isChatOpen: true })
  render(<ControlBar onEndCall={jest.fn()} />)
  fireEvent.click(screen.getByTestId('btn-qa'))
  expect(useUIStore.getState().isQAOpen).toBe(true)
  expect(useUIStore.getState().isChatOpen).toBe(false)
})

test('AI button exists in control bar', () => {
  render(<ControlBar onEndCall={jest.fn()} />)
  expect(screen.getByTestId('btn-ai')).toBeInTheDocument()
})

test('AI button toggles isAIOpen in store', () => {
  render(<ControlBar onEndCall={jest.fn()} />)
  fireEvent.click(screen.getByTestId('btn-ai'))
  expect(useUIStore.getState().isAIOpen).toBe(true)
  fireEvent.click(screen.getByTestId('btn-ai'))
  expect(useUIStore.getState().isAIOpen).toBe(false)
})

test('AI button renders with primary variant when isAIOpen', () => {
  useUIStore.setState({ isAIOpen: true })
  render(<ControlBar onEndCall={jest.fn()} />)
  expect(screen.getByTestId('btn-ai').className).toMatch(/bg-\[var\(--text-primary\)\]/)
})

test('opening AI closes chat (mutual exclusion)', () => {
  useUIStore.setState({ isChatOpen: true })
  render(<ControlBar onEndCall={jest.fn()} />)
  fireEvent.click(screen.getByTestId('btn-ai'))
  expect(useUIStore.getState().isAIOpen).toBe(true)
  expect(useUIStore.getState().isChatOpen).toBe(false)
})

test('noise button renders in the control bar', () => {
  render(<ControlBar onEndCall={jest.fn()} />)
  expect(screen.getByTestId('btn-noise')).toBeInTheDocument()
})

test('noise button shows primary variant when noise suppression is on', () => {
  useCallStore.setState({ isNoiseSuppressed: true })
  render(<ControlBar onEndCall={jest.fn()} />)
  expect(screen.getByTestId('btn-noise')).toHaveTextContent('🎛 Noise: On')
})

test('noise button shows ghost variant label when noise suppression is off', () => {
  useCallStore.setState({ isNoiseSuppressed: false })
  render(<ControlBar onEndCall={jest.fn()} />)
  expect(screen.getByTestId('btn-noise')).toHaveTextContent('🎛 Noise: Off')
})

test('clicking noise button toggles isNoiseSuppressed in store', () => {
  render(<ControlBar onEndCall={jest.fn()} />)
  expect(useCallStore.getState().isNoiseSuppressed).toBe(true)
  fireEvent.click(screen.getByTestId('btn-noise'))
  expect(useCallStore.getState().isNoiseSuppressed).toBe(false)
  fireEvent.click(screen.getByTestId('btn-noise'))
  expect(useCallStore.getState().isNoiseSuppressed).toBe(true)
})

test('CC button renders in control bar', () => {
  render(<ControlBar onEndCall={jest.fn()} />)
  expect(screen.getByTestId('btn-cc')).toBeInTheDocument()
})

test('CC button shows "CC" when captions are off', () => {
  render(<ControlBar onEndCall={jest.fn()} />)
  expect(screen.getByTestId('btn-cc')).toHaveTextContent('CC')
})

test('CC button shows "CC ✓" when captions are on', () => {
  useUIStore.setState({ isCaptionsOpen: true })
  render(<ControlBar onEndCall={jest.fn()} />)
  expect(screen.getByTestId('btn-cc')).toHaveTextContent('CC ✓')
})

test('CC button shows "CC …" and is disabled when model is loading', () => {
  useTranscriptionStore.setState({ isLoading: true })
  render(<ControlBar onEndCall={jest.fn()} />)
  expect(screen.getByTestId('btn-cc')).toHaveTextContent('CC …')
  expect(screen.getByTestId('btn-cc')).toBeDisabled()
})

test('clicking CC button calls toggleCaptions', () => {
  render(<ControlBar onEndCall={jest.fn()} />)
  fireEvent.click(screen.getByTestId('btn-cc'))
  expect(useUIStore.getState().isCaptionsOpen).toBe(true)
})

test('CC button renders with primary variant when captions are open', () => {
  useUIStore.setState({ isCaptionsOpen: true })
  render(<ControlBar onEndCall={jest.fn()} />)
  expect(screen.getByTestId('btn-cc').className).toMatch(/bg-\[var\(--text-primary\)\]/)
})

import { useSessionStore } from '../../../../src/v2/store/useSessionStore'

describe('Recording buttons', () => {
  beforeEach(() => {
    useCallStore.setState({ isHost: false })
    useSessionStore.setState({ recordingState: 'idle' })
  })

  test('Record button is hidden when isHost is false', () => {
    render(<ControlBar onEndCall={jest.fn()} />)
    expect(screen.queryByTestId('btn-record')).not.toBeInTheDocument()
  })

  test('Record button is visible when isHost is true', () => {
    useCallStore.setState({ isHost: true })
    render(<ControlBar onEndCall={jest.fn()} />)
    expect(screen.getByTestId('btn-record')).toBeInTheDocument()
  })

  test('clicking Record calls onStartRecording', () => {
    const onStartRecording = jest.fn()
    useCallStore.setState({ isHost: true })
    render(<ControlBar onEndCall={jest.fn()} onStartRecording={onStartRecording} />)
    fireEvent.click(screen.getByTestId('btn-record'))
    expect(onStartRecording).toHaveBeenCalled()
  })

  test('Stop button visible when recordingState is recording (host)', () => {
    useCallStore.setState({ isHost: true })
    useSessionStore.setState({ recordingState: 'recording' })
    render(<ControlBar onEndCall={jest.fn()} />)
    expect(screen.getByTestId('btn-stop-record')).toBeInTheDocument()
    expect(screen.queryByTestId('btn-record')).not.toBeInTheDocument()
  })

  test('clicking Stop calls onStopRecording', () => {
    const onStopRecording = jest.fn()
    useCallStore.setState({ isHost: true })
    useSessionStore.setState({ recordingState: 'recording' })
    render(<ControlBar onEndCall={jest.fn()} onStopRecording={onStopRecording} />)
    fireEvent.click(screen.getByTestId('btn-stop-record'))
    expect(onStopRecording).toHaveBeenCalled()
  })
})

test('renders whiteboard toggle button', () => {
  render(
    <ControlBar
      onEndCall={jest.fn()}
      onSendReaction={jest.fn()}
      onStartRecording={jest.fn()}
      onStopRecording={jest.fn()}
    />
  )
  expect(screen.getByTestId('btn-whiteboard')).toBeInTheDocument()
})

test('whiteboard button toggles isWhiteboardOpen in store', () => {
  render(
    <ControlBar
      onEndCall={jest.fn()}
      onSendReaction={jest.fn()}
      onStartRecording={jest.fn()}
      onStopRecording={jest.fn()}
    />
  )
  fireEvent.click(screen.getByTestId('btn-whiteboard'))
  expect(useUIStore.getState().isWhiteboardOpen).toBe(true)
  fireEvent.click(screen.getByTestId('btn-whiteboard'))
  expect(useUIStore.getState().isWhiteboardOpen).toBe(false)
})

test('whiteboard button renders with primary variant when isWhiteboardOpen is true', () => {
  useUIStore.setState({ isWhiteboardOpen: true })
  render(
    <ControlBar
      onEndCall={jest.fn()}
      onSendReaction={jest.fn()}
      onStartRecording={jest.fn()}
      onStopRecording={jest.fn()}
    />
  )
  const btn = screen.getByTestId('btn-whiteboard')
  // Primary variant applies when isWhiteboardOpen — check it differs from ghost
  expect(btn.className).toMatch(/bg-\[var\(--text-primary\)\]/)
  // The btn-whiteboard should have aria-label="Whiteboard"
  expect(btn).toHaveAttribute('aria-label', 'Whiteboard')
})
