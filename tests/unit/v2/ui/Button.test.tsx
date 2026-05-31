import { render, screen, fireEvent } from '@testing-library/react'
import { Button } from '../../../../src/v2/ui/Button'

test('renders children', () => {
  render(<Button>Click me</Button>)
  expect(screen.getByText('Click me')).toBeInTheDocument()
})

test('calls onClick when clicked', () => {
  const onClick = jest.fn()
  render(<Button onClick={onClick}>Go</Button>)
  fireEvent.click(screen.getByText('Go'))
  expect(onClick).toHaveBeenCalledTimes(1)
})

test('danger variant applies danger styling', () => {
  render(<Button variant="danger">End</Button>)
  const btn = screen.getByText('End')
  expect(btn.className).toMatch(/danger/)
})

test('disabled button does not call onClick', () => {
  const onClick = jest.fn()
  render(<Button disabled onClick={onClick}>Nope</Button>)
  fireEvent.click(screen.getByText('Nope'))
  expect(onClick).not.toHaveBeenCalled()
})
