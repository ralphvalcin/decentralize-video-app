import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import { ControlBar } from '../../../../src/v2/call/ControlBar'
import { useCallStore } from '../../../../src/v2/store/useCallStore'
import { useUIStore } from '../../../../src/v2/store/useUIStore'

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
  useCallStore.setState({ isMuted: false, isCamOff: false })
  useUIStore.setState({ isChatOpen: false, isParticipantsOpen: false })
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
