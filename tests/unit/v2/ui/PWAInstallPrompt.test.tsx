import { render } from '@testing-library/react'

jest.mock('../../../../src/v2/services/pwa', () => ({
  isInstalled: jest.fn().mockReturnValue(false),
  canInstall: jest.fn().mockReturnValue(false),
  promptInstall: jest.fn(),
  activateUpdate: jest.fn(),
}))

import PWAInstallPrompt from '../../../../src/v2/ui/PWAInstallPrompt'

test('renders nothing by default (no install prompt available in test env)', () => {
  const { container } = render(<PWAInstallPrompt />)
  expect(container.firstChild).toBeNull()
})

test('shows offline indicator when navigator.onLine is false', () => {
  Object.defineProperty(navigator, 'onLine', { value: false, configurable: true, writable: true })
  const { getByText } = render(<PWAInstallPrompt />)
  expect(getByText(/offline/i)).toBeInTheDocument()
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true, writable: true })
})
