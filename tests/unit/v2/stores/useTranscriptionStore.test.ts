import { useTranscriptionStore } from '../../../../src/v2/store/useTranscriptionStore'

beforeEach(() => {
  useTranscriptionStore.setState({ isEnabled: false, isLoading: false, segments: [] })
})

test('default state: isEnabled=false, isLoading=false, segments=[]', () => {
  const s = useTranscriptionStore.getState()
  expect(s.isEnabled).toBe(false)
  expect(s.isLoading).toBe(false)
  expect(s.segments).toEqual([])
})

test('enable sets isEnabled to true', () => {
  useTranscriptionStore.getState().enable()
  expect(useTranscriptionStore.getState().isEnabled).toBe(true)
})

test('disable sets isEnabled to false', () => {
  useTranscriptionStore.setState({ isEnabled: true })
  useTranscriptionStore.getState().disable()
  expect(useTranscriptionStore.getState().isEnabled).toBe(false)
})

test('setLoading(true) sets isLoading to true', () => {
  useTranscriptionStore.getState().setLoading(true)
  expect(useTranscriptionStore.getState().isLoading).toBe(true)
})

test('setLoading(false) sets isLoading to false', () => {
  useTranscriptionStore.setState({ isLoading: true })
  useTranscriptionStore.getState().setLoading(false)
  expect(useTranscriptionStore.getState().isLoading).toBe(false)
})

test('addSegment appends a segment', () => {
  const seg = { speakerId: 's1', userName: 'Alice', text: 'hello', timestamp: 1000 }
  useTranscriptionStore.getState().addSegment(seg)
  expect(useTranscriptionStore.getState().segments).toEqual([seg])
})

test('addSegment appends multiple segments in order', () => {
  const s1 = { speakerId: 's1', userName: 'Alice', text: 'hi', timestamp: 1 }
  const s2 = { speakerId: 's2', userName: 'Bob', text: 'hey', timestamp: 2 }
  useTranscriptionStore.getState().addSegment(s1)
  useTranscriptionStore.getState().addSegment(s2)
  expect(useTranscriptionStore.getState().segments).toEqual([s1, s2])
})

test('clear empties segments', () => {
  useTranscriptionStore.setState({
    segments: [{ speakerId: 's1', userName: 'Alice', text: 'hi', timestamp: 1 }],
  })
  useTranscriptionStore.getState().clear()
  expect(useTranscriptionStore.getState().segments).toEqual([])
})
