import { render, screen } from '@testing-library/react'
import { Badge } from '../../../../src/v2/ui/Badge'

test('renders label', () => {
  render(<Badge variant="live">Live</Badge>)
  expect(screen.getByText('Live')).toBeInTheDocument()
})

test('live variant has green dot', () => {
  render(<Badge variant="live">On</Badge>)
  const dot = screen.getByTestId('badge-dot')
  expect(dot.className).toMatch(/accent-live/)
})

test('warn variant has amber dot', () => {
  render(<Badge variant="warn">Fair</Badge>)
  const dot = screen.getByTestId('badge-dot')
  expect(dot.className).toMatch(/accent-warn/)
})
