import { render, screen, fireEvent } from '@testing-library/react'
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

test('reload button is clickable when error occurs', () => {
  render(<ErrorBoundary><Bomb /></ErrorBoundary>)
  const reloadButton = screen.getByRole('button', { name: /reload/i })
  expect(reloadButton).toBeInTheDocument()
  expect(reloadButton).toBeEnabled()
})
