import '@testing-library/jest-dom'
import 'vitest-axe/extend-expect'
import { expect } from 'vitest'
import { toHaveNoViolations } from 'vitest-axe/dist/matchers'
expect.extend({ toHaveNoViolations })

// Headless UI Listbox uses ResizeObserver internally — not available in jsdom
globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// matchMedia not available in jsdom — provide a no-op implementation
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
})
