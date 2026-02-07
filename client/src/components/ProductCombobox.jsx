import { useEffect, useMemo, useRef, useState } from 'react'

/**
 * Combobox simple para productos:
 * - Se ve como input (mismas clases `input-field`)
 * - Al escribir filtra y muestra lista
 * - Enter selecciona el primer resultado (y NO deja que el modal lo tome como "Guardar")
 */
export default function ProductCombobox({
  products = [],
  value = '',
  onChange,
  placeholder = 'Seleccionar producto',
  className = 'input-field w-full sm:flex-1',
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const blurTimer = useRef(null)

  const normalizedProducts = useMemo(() => {
    if (!Array.isArray(products)) return []
    return products
      .filter(Boolean)
      .map((p) => ({
        id: p._id,
        name: String(p.nombre || ''),
        price: p.precio,
        search: String(p.nombre || '').toLowerCase(),
      }))
  }, [products])

  const selected = useMemo(() => {
    if (!value) return null
    return normalizedProducts.find((p) => String(p.id) === String(value)) || null
  }, [normalizedProducts, value])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return normalizedProducts
    return normalizedProducts.filter((p) => p.search.includes(q))
  }, [normalizedProducts, query])

  const displayValue = open ? query : (selected?.name || '')

  useEffect(() => {
    // cuando cambia el seleccionado desde afuera, limpiar query
    if (!open) setQuery('')
  }, [value, open])

  const pick = (id) => {
    onChange?.(id)
    setOpen(false)
    setQuery('')
  }

  return (
    <div className="relative w-full sm:flex-1">
      <input
        type="text"
        className={className}
        value={displayValue}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setOpen(true)
          setQuery(e.target.value)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault()
            e.stopPropagation()
            setOpen(false)
            setQuery('')
            return
          }
          if (e.key === 'Enter') {
            // Seleccionar el primero filtrado sin disparar "Guardar" del modal
            e.preventDefault()
            e.stopPropagation()
            const first = filtered?.[0]
            if (first?.id) pick(first.id)
          }
        }}
        onBlur={() => {
          if (blurTimer.current) clearTimeout(blurTimer.current)
          blurTimer.current = setTimeout(() => setOpen(false), 120)
        }}
      />

      {open && filtered.length > 0 && (
        <div className="absolute left-0 right-0 mt-1 z-[80] max-h-64 overflow-auto rounded-lg border border-slate-700 bg-slate-900 shadow-xl">
          {filtered.slice(0, 60).map((p) => (
            <button
              key={p.id}
              type="button"
              className="w-full text-left px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
              onMouseDown={(e) => {
                // evitar blur antes de click
                e.preventDefault()
              }}
              onClick={() => pick(p.id)}
            >
              <span className="font-semibold">{p.name}</span>
              {typeof p.price === 'number' && (
                <span className="text-slate-400"> — ${p.price.toLocaleString()}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

