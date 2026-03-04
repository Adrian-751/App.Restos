import { describe, it, expect } from 'vitest'
import { getYMDArgentina, moneyToCents, APP_TIMEZONE } from '../../utils/date.js'

describe('client/utils/date.js', () => {
    describe('APP_TIMEZONE', () => {
        it('is the Argentina timezone', () => {
            expect(APP_TIMEZONE).toBe('America/Argentina/Buenos_Aires')
        })
    })

    describe('getYMDArgentina()', () => {
        it('returns null for null input', () => {
            expect(getYMDArgentina(null)).toBeNull()
        })

        it('returns null for undefined input', () => {
            expect(getYMDArgentina(undefined)).toBeNull()
        })

        it('returns null for invalid date string', () => {
            expect(getYMDArgentina('not-a-date')).toBeNull()
        })

        it('returns YYYY-MM-DD for a valid ISO string', () => {
            const result = getYMDArgentina('2026-03-04T15:00:00.000Z')
            expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
        })

        it('formats 2026-01-15 12:00 UTC correctly (Argentina is UTC-3 = 09:00 AR)', () => {
            const d = new Date('2026-01-15T12:00:00.000Z')
            expect(getYMDArgentina(d)).toBe('2026-01-15')
        })

        it('handles Date object input', () => {
            const d = new Date()
            const result = getYMDArgentina(d)
            expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
        })

        it('handles numeric timestamp input', () => {
            const result = getYMDArgentina(new Date('2026-06-15T15:00:00Z').getTime())
            expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
        })
    })

    describe('moneyToCents()', () => {
        it('converts integer to cents', () => {
            expect(moneyToCents(10)).toBe(1000)
        })

        it('converts float to cents correctly (avoids floating point errors)', () => {
            expect(moneyToCents(0.1 + 0.2)).toBe(30) // 0.30 -> 30 cents
        })

        it('returns 0 for 0', () => {
            expect(moneyToCents(0)).toBe(0)
        })

        it('returns 0 for NaN', () => {
            expect(moneyToCents(NaN)).toBe(0)
        })

        it('returns 0 for Infinity', () => {
            expect(moneyToCents(Infinity)).toBe(0)
        })

        it('returns 0 for non-numeric string', () => {
            expect(moneyToCents('abc')).toBe(0)
        })

        it('converts numeric string correctly', () => {
            expect(moneyToCents('5.50')).toBe(550)
        })

        it('handles negative values', () => {
            expect(moneyToCents(-10)).toBe(-1000)
        })

        it('handles large amounts', () => {
            expect(moneyToCents(99999.99)).toBe(9999999)
        })
    })
})
