import { render, screen, act } from '@testing-library/react'
import { AIInsightsDashboard } from '../../../../../src/v2/components/ai/AIInsightsDashboard'

const SAMPLE_METRICS = {
  connections: { total: 5, peak: 8, connectionRate: 3, byRoom: {} },
  messages: { totalSent: 42, totalReceived: 40, avgResponseTime: 12, errorCount: 0 },
  rooms: { active: 2, totalCreated: 10, averageParticipants: 2.5 },
}

beforeEach(() => {
  jest.useFakeTimers()
  global.fetch = jest.fn()
})

afterEach(() => {
  jest.useRealTimers()
  jest.restoreAllMocks()
})

test('displays stat tiles when fetch succeeds', async () => {
  ;(global.fetch as jest.Mock).mockResolvedValue({
    ok: true,
    json: async () => SAMPLE_METRICS,
  })
  await act(async () => { render(<AIInsightsDashboard />) })
  expect(screen.getByTestId('ai-insights-dashboard')).toBeInTheDocument()
  expect(screen.getByText('3')).toBeInTheDocument()   // connectionRate
  expect(screen.getByText('42')).toBeInTheDocument()  // totalSent
  expect(screen.getByText('12 ms')).toBeInTheDocument() // avgResponseTime
})

test('shows Metrics unavailable when fetch rejects', async () => {
  ;(global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'))
  await act(async () => { render(<AIInsightsDashboard />) })
  expect(screen.getByTestId('metrics-unavailable')).toBeInTheDocument()
})

test('shows Metrics unavailable when response is not ok', async () => {
  ;(global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 503 })
  await act(async () => { render(<AIInsightsDashboard />) })
  expect(screen.getByTestId('metrics-unavailable')).toBeInTheDocument()
})

test('re-fetches after 30s', async () => {
  ;(global.fetch as jest.Mock).mockResolvedValue({
    ok: true,
    json: async () => SAMPLE_METRICS,
  })
  await act(async () => { render(<AIInsightsDashboard />) })
  expect(global.fetch).toHaveBeenCalledTimes(1)
  await act(async () => { jest.advanceTimersByTime(30_000) })
  expect(global.fetch).toHaveBeenCalledTimes(2)
})
