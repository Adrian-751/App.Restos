import '@testing-library/jest-dom'
import { vi, afterEach } from 'vitest'

// Mock localStorage
const localStorageMock = (() => {
    let store = {}
    return {
        getItem: vi.fn((key) => store[key] ?? null),
        setItem: vi.fn((key, value) => { store[key] = String(value) }),
        removeItem: vi.fn((key) => { delete store[key] }),
        clear: vi.fn(() => { store = {} }),
    }
})()

Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
    writable: true,
})

// Reset mocks between tests
afterEach(() => {
    localStorageMock.clear()
    vi.clearAllMocks()
})
