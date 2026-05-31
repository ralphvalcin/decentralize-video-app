import { render, screen, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import HomeV2 from '../../../../src/v2/pages/HomeV2'

// PreflightPanel calls getUserMedia in a useEffect. Mocking here ensures the
// rejection's setState fires inside act() and doesn't leak after each test.
beforeEach(() => {
  jest.spyOn(navigator.mediaDevices, 'getUserMedia').mockRejectedValue(new Error('no cam'))
})
afterEach(() => { jest.restoreAllMocks() })

async function wrap(ui: React.ReactElement) {
  await act(async () => render(<MemoryRouter>{ui}</MemoryRouter>))
}

test('renders without crashing', async () => {
  await wrap(<HomeV2 />)
})

test('renders both panels', async () => {
  await wrap(<HomeV2 />)
  expect(screen.getByTestId('join-form')).toBeInTheDocument()
  expect(screen.getByTestId('preflight-panel')).toBeInTheDocument()
})
