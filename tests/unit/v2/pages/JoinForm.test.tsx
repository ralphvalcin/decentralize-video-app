import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { JoinForm } from '../../../../src/v2/pages/home/JoinForm'
import { useCallStore } from '../../../../src/v2/store/useCallStore'

const mockNavigate = jest.fn()
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}))

beforeEach(() => {
  mockNavigate.mockClear()
  useCallStore.setState({ userName: '', roomId: '' })
})

function wrap(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

test('renders name and room ID fields', () => {
  wrap(<JoinForm />)
  expect(screen.getByPlaceholderText(/your name/i)).toBeInTheDocument()
  expect(screen.getByPlaceholderText(/room id/i)).toBeInTheDocument()
})

test('Create Room navigates to a new room id when room field is empty', () => {
  wrap(<JoinForm />)
  fireEvent.change(screen.getByPlaceholderText(/your name/i), { target: { value: 'Ralph' } })
  fireEvent.click(screen.getByText(/create room/i))
  expect(mockNavigate).toHaveBeenCalledWith(expect.stringMatching(/^\/v2\/room\/.+/))
})

test('Join navigates to the entered room id', () => {
  wrap(<JoinForm />)
  fireEvent.change(screen.getByPlaceholderText(/your name/i), { target: { value: 'Ralph' } })
  fireEvent.change(screen.getByPlaceholderText(/room id/i), { target: { value: 'design-sync' } })
  fireEvent.click(screen.getByText(/join/i))
  expect(mockNavigate).toHaveBeenCalledWith('/v2/room/design-sync')
})

test('Create Room is disabled when name is empty', () => {
  wrap(<JoinForm />)
  expect(screen.getByText(/create room/i).closest('button')).toBeDisabled()
})

test('Create Room persists name and roomId to store', () => {
  wrap(<JoinForm />)
  fireEvent.change(screen.getByPlaceholderText(/your name/i), { target: { value: 'Ralph' } })
  fireEvent.click(screen.getByText(/create room/i))
  const { userName, roomId } = useCallStore.getState()
  expect(userName).toBe('Ralph')
  expect(roomId).toMatch(/^[a-z0-9]{6}$/)
})

test('Join persists name and roomId to store', () => {
  wrap(<JoinForm />)
  fireEvent.change(screen.getByPlaceholderText(/your name/i), { target: { value: 'Alice' } })
  fireEvent.change(screen.getByPlaceholderText(/room id/i), { target: { value: 'design-sync' } })
  fireEvent.click(screen.getByText(/join/i))
  const { userName, roomId } = useCallStore.getState()
  expect(userName).toBe('Alice')
  expect(roomId).toBe('design-sync')
})
