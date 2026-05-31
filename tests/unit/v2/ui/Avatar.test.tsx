import { render, screen } from '@testing-library/react'
import { Avatar } from '../../../../src/v2/ui/Avatar'

test('shows initials from name', () => {
  render(<Avatar name="Ralph Valcin" />)
  expect(screen.getByText('RV')).toBeInTheDocument()
})

test('shows single initial for single-word name', () => {
  render(<Avatar name="Ralph" />)
  expect(screen.getByText('R')).toBeInTheDocument()
})

test('applies size class', () => {
  render(<Avatar name="Alice" size="lg" />)
  const el = screen.getByText('A').parentElement
  expect(el?.className).toMatch(/w-12/)
  expect(el?.className).toMatch(/h-12/)
  expect(el?.className).toMatch(/text-base/)
})
