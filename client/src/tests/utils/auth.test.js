import { describe, it, expect, beforeEach, vi } from 'vitest'
import { saveToken, getToken, removeToken, saveUser, getUser, clearAuth } from '../../utils/auth.js'

describe('auth.js utilities', () => {
    describe('saveToken()', () => {
        it('stores token in localStorage', () => {
            saveToken('my-token')
            expect(localStorage.setItem).toHaveBeenCalledWith('token', 'my-token')
        })

        it('does not call setItem when token is falsy', () => {
            saveToken(null)
            expect(localStorage.setItem).not.toHaveBeenCalled()
            saveToken(undefined)
            expect(localStorage.setItem).not.toHaveBeenCalled()
            saveToken('')
            expect(localStorage.setItem).not.toHaveBeenCalled()
        })
    })

    describe('getToken()', () => {
        it('returns token from localStorage', () => {
            localStorage.getItem.mockReturnValueOnce('abc123')
            expect(getToken()).toBe('abc123')
        })

        it('returns null when no token', () => {
            localStorage.getItem.mockReturnValueOnce(null)
            expect(getToken()).toBeNull()
        })
    })

    describe('removeToken()', () => {
        it('calls localStorage.removeItem for token key', () => {
            removeToken()
            expect(localStorage.removeItem).toHaveBeenCalledWith('token')
        })
    })

    describe('saveUser()', () => {
        it('stores JSON-serialized user', () => {
            const user = { id: 1, nombre: 'Test' }
            saveUser(user)
            expect(localStorage.setItem).toHaveBeenCalledWith('user', JSON.stringify(user))
        })

        it('does nothing when user is null', () => {
            saveUser(null)
            expect(localStorage.setItem).not.toHaveBeenCalled()
        })

        it('does nothing when user is undefined', () => {
            saveUser(undefined)
            expect(localStorage.setItem).not.toHaveBeenCalled()
        })
    })

    describe('getUser()', () => {
        it('returns parsed user object', () => {
            const user = { id: 1, nombre: 'Ana', role: 'admin' }
            localStorage.getItem.mockReturnValueOnce(JSON.stringify(user))
            expect(getUser()).toEqual(user)
        })

        it('returns null when no user in storage', () => {
            localStorage.getItem.mockReturnValueOnce(null)
            expect(getUser()).toBeNull()
        })

        it('returns null for corrupted JSON', () => {
            localStorage.getItem.mockReturnValueOnce('{broken json}')
            expect(getUser()).toBeNull()
        })

        it('returns null for empty string in storage', () => {
            localStorage.getItem.mockReturnValueOnce('')
            expect(getUser()).toBeNull()
        })
    })

    describe('clearAuth()', () => {
        it('removes both token and user from localStorage', () => {
            clearAuth()
            expect(localStorage.removeItem).toHaveBeenCalledWith('token')
            expect(localStorage.removeItem).toHaveBeenCalledWith('user')
        })
    })
})
