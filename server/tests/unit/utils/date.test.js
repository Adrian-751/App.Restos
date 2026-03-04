import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
    getTodayYMD,
    formatDateYMD,
    getTimeHMS,
    getArgentinaOffset,
} from '../../../utils/date.js'

describe('server/utils/date.js', () => {
    describe('getArgentinaOffset()', () => {
        it('returns -03:00', () => {
            expect(getArgentinaOffset()).toBe('-03:00')
        })
    })

    describe('getTodayYMD()', () => {
        it('returns a YYYY-MM-DD string', () => {
            const result = getTodayYMD()
            expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
        })

        it('returns same length as ISO date prefix', () => {
            expect(getTodayYMD()).toHaveLength(10)
        })

        it('accepts a custom timezone without throwing', () => {
            expect(() => getTodayYMD('UTC')).not.toThrow()
        })

        it('falls back to UTC on invalid timezone', () => {
            const result = getTodayYMD('Invalid/Zone')
            expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
        })
    })

    describe('formatDateYMD()', () => {
        it('returns null for null input', () => {
            expect(formatDateYMD(null)).toBeNull()
        })

        it('returns null for undefined input', () => {
            expect(formatDateYMD(undefined)).toBeNull()
        })

        it('returns null for invalid date string', () => {
            expect(formatDateYMD('not-a-date')).toBeNull()
        })

        it('formats a Date object to YYYY-MM-DD', () => {
            // Use a fixed UTC timestamp to avoid timezone flakiness:
            // 2026-01-15 12:00:00 UTC => 2026-01-15 09:00 Argentina => "2026-01-15"
            const d = new Date('2026-01-15T12:00:00.000Z')
            expect(formatDateYMD(d)).toBe('2026-01-15')
        })

        it('formats a date string to YYYY-MM-DD', () => {
            const result = formatDateYMD('2026-03-04T15:00:00.000Z')
            expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
        })

        it('returns YYYY-MM-DD pattern for any valid Date', () => {
            const result = formatDateYMD(new Date())
            expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
        })
    })

    describe('getTimeHMS()', () => {
        it('returns HH:mm:ss format', () => {
            const result = getTimeHMS()
            expect(result).toMatch(/^\d{2}:\d{2}:\d{2}$/)
        })

        it('accepts a Date argument', () => {
            const d = new Date('2026-01-15T10:30:45.000Z')
            const result = getTimeHMS(d)
            expect(result).toMatch(/^\d{2}:\d{2}:\d{2}$/)
        })

        it('returns 00:00:00 for invalid date', () => {
            expect(getTimeHMS(new Date('invalid'))).toBe('00:00:00')
        })

        it('accepts UTC timezone', () => {
            const d = new Date('2026-01-15T10:30:00.000Z')
            const result = getTimeHMS(d, 'UTC')
            expect(result).toBe('10:30:00')
        })

        it('falls back gracefully for invalid timezone', () => {
            const result = getTimeHMS(new Date(), 'Fake/Zone')
            expect(result).toMatch(/^\d{2}:\d{2}:\d{2}$/)
        })
    })
})
