import { render, act } from '@testing-library/react'
import { ConnectionQualityPredictions } from '../../../../../src/v2/components/ai/ConnectionQualityPredictions'
import type { QualitySnapshot } from '../../../../../src/v2/components/ai/ConnectionQualityPredictions'

function makeStatsReport(packetsLost: number, packetsReceived: number, jitter = 0.01, rtt = 0.05) {
  return new Map([
    ['entry-1', { type: 'remote-inbound-rtp', packetsLost, packetsReceived, jitter, currentRoundTripTime: rtt }],
  ])
}

function makeConn(packetsLost: number, packetsReceived: number, jitter = 0.01) {
  return {
    getStats: jest.fn().mockResolvedValue(makeStatsReport(packetsLost, packetsReceived, jitter)),
    iceConnectionState: 'connected' as RTCIceConnectionState,
  } as unknown as RTCPeerConnection
}

beforeEach(() => { jest.useFakeTimers() })
afterEach(() => { jest.useRealTimers() })

test('classifies Excellent when packet loss < 1%', async () => {
  const onQualityChange = jest.fn()
  const conn = makeConn(1, 199)  // 0.5% loss
  render(
    <ConnectionQualityPredictions
      getPeerConnections={() => new Map([['p1', conn]])}
      onQualityChange={onQualityChange}
    />
  )
  await act(async () => {})
  expect(onQualityChange).toHaveBeenCalledWith(expect.objectContaining({ worst: 'Excellent' }))
})

test('classifies Good when packet loss is 2%', async () => {
  const onQualityChange = jest.fn()
  const conn = makeConn(2, 98)  // 2% loss
  render(
    <ConnectionQualityPredictions
      getPeerConnections={() => new Map([['p1', conn]])}
      onQualityChange={onQualityChange}
    />
  )
  await act(async () => {})
  expect(onQualityChange).toHaveBeenCalledWith(expect.objectContaining({ worst: 'Good' }))
})

test('classifies Fair when packet loss is 5%', async () => {
  const onQualityChange = jest.fn()
  const conn = makeConn(5, 95)  // 5% loss
  render(
    <ConnectionQualityPredictions
      getPeerConnections={() => new Map([['p1', conn]])}
      onQualityChange={onQualityChange}
    />
  )
  await act(async () => {})
  expect(onQualityChange).toHaveBeenCalledWith(expect.objectContaining({ worst: 'Fair' }))
})

test('classifies Poor when packet loss > 8%', async () => {
  const onQualityChange = jest.fn()
  const conn = makeConn(10, 90)  // 10% loss
  render(
    <ConnectionQualityPredictions
      getPeerConnections={() => new Map([['p1', conn]])}
      onQualityChange={onQualityChange}
    />
  )
  await act(async () => {})
  expect(onQualityChange).toHaveBeenCalledWith(expect.objectContaining({ worst: 'Poor' }))
})

test('reports worst quality when multiple peers have different quality', async () => {
  const onQualityChange = jest.fn()
  const excellentConn = makeConn(0, 200)   // 0% → Excellent
  const poorConn = makeConn(10, 90)        // 10% → Poor
  render(
    <ConnectionQualityPredictions
      getPeerConnections={() => new Map([['p1', excellentConn], ['p2', poorConn]])}
      onQualityChange={onQualityChange}
    />
  )
  await act(async () => {})
  const snapshot: QualitySnapshot = onQualityChange.mock.calls[0][0]
  expect(snapshot.worst).toBe('Poor')
})

test('snapshot includes worstPacketLoss and worstJitter', async () => {
  const onQualityChange = jest.fn()
  const conn = makeConn(10, 90, 0.15)  // 10% loss, 0.15s = 150ms jitter
  render(
    <ConnectionQualityPredictions
      getPeerConnections={() => new Map([['p1', conn]])}
      onQualityChange={onQualityChange}
    />
  )
  await act(async () => {})
  const snapshot: QualitySnapshot = onQualityChange.mock.calls[0][0]
  expect(snapshot.worstPacketLoss).toBeCloseTo(10)
  expect(snapshot.worstJitter).toBeCloseTo(150)
})

test('clears interval on unmount', async () => {
  const clearIntervalSpy = jest.spyOn(global, 'clearInterval')
  const { unmount } = render(
    <ConnectionQualityPredictions
      getPeerConnections={() => new Map()}
      onQualityChange={jest.fn()}
    />
  )
  await act(async () => {})
  unmount()
  expect(clearIntervalSpy).toHaveBeenCalled()
  clearIntervalSpy.mockRestore()
})

test('calls onQualityChange with null worst when no connections', async () => {
  const onQualityChange = jest.fn()
  render(
    <ConnectionQualityPredictions
      getPeerConnections={() => new Map()}
      onQualityChange={onQualityChange}
    />
  )
  await act(async () => {})
  expect(onQualityChange).toHaveBeenCalledWith(expect.objectContaining({ worst: null }))
})
