import { render, screen, fireEvent } from '@testing-library/react'
import 'jest-location-mock'
import ErrorBoundary from '../../../../src/v2/ui/ErrorBoundary'

function Bomb(): never {
  throw new Error('test error')
}

beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  jest.restoreAllMocks()
})

test('renders children when no error occurs', () => {
  render(<ErrorBoundary><span>hello</span></ErrorBoundary>)
  expect(screen.getByText('hello')).toBeInTheDocument()
})

test('renders fallback UI when a child throws', () => {
  render(<ErrorBoundary><Bomb /></ErrorBoundary>)
  expect(screen.getByText('Something went wrong.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /reload/i })).toBeInTheDocument()
})

test('reload button calls window.location.reload', () => {
  // jest-location-mock sets up a spy on reload in beforeAll
  // Get the spy from jest's internal mock storage
  const reload = jest.fn()
  jest.spyOn(window.location, 'reload').mockImplementation(reload)

  render(<ErrorBoundary><Bomb /></ErrorBoundary>)
  fireEvent.click(screen.getByRole('button', { name: /reload/i }))
  expect(reload).toHaveBeenCalledTimes(1)
})
