import { describe, it, expect, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useAsync } from '../../hooks/useAsync.js'

describe('useAsync hook', () => {
    it('starts with loading=true and data=null', () => {
        const fn = () => new Promise(() => {}) // never resolves
        const { result } = renderHook(() => useAsync(fn, []))
        expect(result.current.loading).toBe(true)
        expect(result.current.data).toBeNull()
        expect(result.current.error).toBeNull()
    })

    it('sets data and loading=false on success', async () => {
        const fn = vi.fn().mockResolvedValue([1, 2, 3])
        const { result } = renderHook(() => useAsync(fn, []))
        await waitFor(() => expect(result.current.loading).toBe(false))
        expect(result.current.data).toEqual([1, 2, 3])
        expect(result.current.error).toBeNull()
    })

    it('sets error and loading=false on failure', async () => {
        const err = new Error('API failed')
        const fn = vi.fn().mockRejectedValue(err)
        const { result } = renderHook(() => useAsync(fn, []))
        await waitFor(() => expect(result.current.loading).toBe(false))
        expect(result.current.error).toBe(err)
        expect(result.current.data).toBeNull()
    })

    it('refetch re-executes the function', async () => {
        const fn = vi.fn()
            .mockResolvedValueOnce('first')
            .mockResolvedValueOnce('second')
        const { result } = renderHook(() => useAsync(fn, []))
        await waitFor(() => expect(result.current.loading).toBe(false))
        expect(result.current.data).toBe('first')

        act(() => { result.current.refetch() })
        await waitFor(() => expect(result.current.loading).toBe(false))
        expect(result.current.data).toBe('second')
        expect(fn).toHaveBeenCalledTimes(2)
    })

    it('clears previous error on refetch', async () => {
        const err = new Error('oops')
        const fn = vi.fn()
            .mockRejectedValueOnce(err)
            .mockResolvedValueOnce('ok')
        const { result } = renderHook(() => useAsync(fn, []))
        await waitFor(() => expect(result.current.error).toBeTruthy())

        act(() => { result.current.refetch() })
        await waitFor(() => expect(result.current.loading).toBe(false))
        expect(result.current.error).toBeNull()
        expect(result.current.data).toBe('ok')
    })

    it('re-runs when dependency array changes', async () => {
        let dep = 0
        const fn = vi.fn().mockResolvedValue('value')
        const { result, rerender } = renderHook(({ d }) => useAsync(fn, [d]), {
            initialProps: { d: 0 },
        })
        await waitFor(() => expect(result.current.loading).toBe(false))
        expect(fn).toHaveBeenCalledTimes(1)

        rerender({ d: 1 })
        await waitFor(() => expect(result.current.loading).toBe(false))
        expect(fn).toHaveBeenCalledTimes(2)
    })

    it('handles async function returning null', async () => {
        const fn = vi.fn().mockResolvedValue(null)
        const { result } = renderHook(() => useAsync(fn, []))
        await waitFor(() => expect(result.current.loading).toBe(false))
        expect(result.current.data).toBeNull()
        expect(result.current.error).toBeNull()
    })

    it('handles async function returning empty array', async () => {
        const fn = vi.fn().mockResolvedValue([])
        const { result } = renderHook(() => useAsync(fn, []))
        await waitFor(() => expect(result.current.loading).toBe(false))
        expect(result.current.data).toEqual([])
    })

    it('handles async function returning large array (stress)', async () => {
        const bigData = Array.from({ length: 10000 }, (_, i) => ({ id: i }))
        const fn = vi.fn().mockResolvedValue(bigData)
        const { result } = renderHook(() => useAsync(fn, []))
        await waitFor(() => expect(result.current.loading).toBe(false))
        expect(result.current.data).toHaveLength(10000)
    })

    it('exposes refetch function', async () => {
        const fn = vi.fn().mockResolvedValue('x')
        const { result } = renderHook(() => useAsync(fn, []))
        await waitFor(() => expect(result.current.loading).toBe(false))
        expect(typeof result.current.refetch).toBe('function')
    })
})
