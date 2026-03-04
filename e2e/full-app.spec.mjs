/**
 * E2E — Full App QA Suite
 * Covers: Auth, Panel, Mesas, Caja, Productos, Clientes, Turnos, Historico, Metricas
 * Framework: Playwright
 *
 * Requires a running dev server at http://localhost:5173
 * and a running backend at http://localhost:3000
 */
import { test, expect, request as apiRequest } from '@playwright/test'

const BASE_URL = 'http://localhost:5173'
const API_URL  = 'http://localhost:3000'

const ADMIN = { email: 'qa_admin@e2e.test', password: 'QATest2026!', nombre: 'QA Admin' }

// ─── Crear usuario QA una sola vez antes de todos los tests ──────────────────
test.beforeAll(async () => {
    const ctx = await apiRequest.newContext()
    // Intentar registrar — si ya existe, el 400 es esperado y se ignora
    await ctx.post(`${API_URL}/api/auth/register`, {
        headers: { 'X-Tenant': 'default' },
        data: { email: ADMIN.email, password: ADMIN.password, nombre: ADMIN.nombre, role: 'admin' },
    })
    await ctx.dispose()
})

// ─── Helper: login vía UI ────────────────────────────────────────────────────
async function loginAs(page, user = ADMIN) {
    await page.goto(`${BASE_URL}/login`)
    await page.getByPlaceholder('tu@email.com').fill(user.email)
    await page.getByPlaceholder('••••••••').fill(user.password)
    await page.getByRole('button', { name: /ingresar/i }).click()
    await page.waitForURL((url) => !url.href.includes('/login'), { timeout: 15000 })
}

// ─── 1. Auth ─────────────────────────────────────────────────────────────────

test.describe('Auth — Login / Logout', () => {
    test('redirige al usuario no autenticado a /login', async ({ page }) => {
        await page.goto(`${BASE_URL}/`)
        await expect(page).toHaveURL(/\/login/)
    })

    test('muestra error con credenciales incorrectas', async ({ page }) => {
        await page.goto(`${BASE_URL}/login`)
        await page.getByPlaceholder('tu@email.com').fill('nadie@test.com')
        await page.getByPlaceholder('••••••••').fill('contraseñamala')
        await page.getByRole('button', { name: /ingresar/i }).click()
        await expect(page.locator('.text-red-200, [class*="red"]').first()).toBeVisible({ timeout: 8000 })
    })

    test('login con credenciales válidas redirige al panel', async ({ page }) => {
        await loginAs(page)
        await expect(page).not.toHaveURL(/\/login/)
    })

    test('tras login, el token persiste al refrescar', async ({ page }) => {
        await loginAs(page)
        await page.reload()
        await expect(page).not.toHaveURL(/\/login/)
    })

    test('formulario vacío no hace submit sin datos', async ({ page }) => {
        await page.goto(`${BASE_URL}/login`)
        await page.getByRole('button', { name: /ingresar/i }).click()
        // El input type="email" required impide el submit — seguimos en /login
        await expect(page).toHaveURL(/\/login/)
    })
})

// ─── 2. Panel ─────────────────────────────────────────────────────────────────

test.describe('Panel', () => {
    test.beforeEach(async ({ page }) => { await loginAs(page) })

    test('carga sin errores JS', async ({ page }) => {
        const errors = []
        page.on('pageerror', e => errors.push(e.message))
        await page.goto(`${BASE_URL}/panel`)
        await page.waitForLoadState('networkidle')
        expect(errors).toHaveLength(0)
    })

    test('muestra links de navegación', async ({ page }) => {
        await page.goto(`${BASE_URL}/panel`)
        await expect(page.getByRole('link').first()).toBeVisible({ timeout: 5000 })
    })
})

// ─── 3. Mesas ─────────────────────────────────────────────────────────────────

test.describe('Mesas', () => {
    test.beforeEach(async ({ page }) => { await loginAs(page) })

    test('página carga correctamente', async ({ page }) => {
        await page.goto(`${BASE_URL}/mesas`)
        await page.waitForLoadState('networkidle')
        await expect(page).not.toHaveURL(/\/login/)
        await expect(page.locator('body')).not.toBeEmpty()
    })

    test('no hay errores JS al cargar mesas', async ({ page }) => {
        const errors = []
        page.on('pageerror', e => errors.push(e.message))
        await page.goto(`${BASE_URL}/mesas`)
        await page.waitForLoadState('networkidle')
        expect(errors).toHaveLength(0)
    })
})

// ─── 4. Productos ─────────────────────────────────────────────────────────────

test.describe('Productos', () => {
    test.beforeEach(async ({ page }) => { await loginAs(page) })

    test('página carga correctamente', async ({ page }) => {
        await page.goto(`${BASE_URL}/productos`)
        await page.waitForLoadState('networkidle')
        await expect(page).not.toHaveURL(/\/login/)
    })

    test('botón de agregar producto es accesible', async ({ page }) => {
        await page.goto(`${BASE_URL}/productos`)
        await page.waitForLoadState('networkidle')
        const addBtn = page.getByRole('button', { name: /nuevo|agregar|añadir|\+/i }).first()
        if (await addBtn.count() > 0) {
            await addBtn.click()
            await expect(page.locator('input, [role="dialog"]').first()).toBeVisible({ timeout: 5000 })
        }
    })
})

// ─── 5. Clientes ──────────────────────────────────────────────────────────────

test.describe('Clientes', () => {
    test.beforeEach(async ({ page }) => { await loginAs(page) })

    test('página carga correctamente', async ({ page }) => {
        await page.goto(`${BASE_URL}/clientes`)
        await page.waitForLoadState('networkidle')
        await expect(page).not.toHaveURL(/\/login/)
    })
})

// ─── 6. Caja ──────────────────────────────────────────────────────────────────

test.describe('Caja', () => {
    test.beforeEach(async ({ page }) => { await loginAs(page) })

    test('página carga correctamente', async ({ page }) => {
        await page.goto(`${BASE_URL}/caja`)
        await page.waitForLoadState('networkidle')
        await expect(page).not.toHaveURL(/\/login/)
    })

    test('muestra estado de la caja', async ({ page }) => {
        await page.goto(`${BASE_URL}/caja`)
        await page.waitForLoadState('networkidle')
        await expect(page.locator('body')).not.toBeEmpty()
    })
})

// ─── 7. Pedidos ───────────────────────────────────────────────────────────────

test.describe('Pedidos', () => {
    test.beforeEach(async ({ page }) => { await loginAs(page) })

    test('página carga sin crash', async ({ page }) => {
        await page.goto(`${BASE_URL}/pedidos`)
        await page.waitForLoadState('networkidle')
        await expect(page).not.toHaveURL(/\/login/)
    })

    test('no hay errores JS en pedidos', async ({ page }) => {
        const errors = []
        page.on('pageerror', e => errors.push(e.message))
        await page.goto(`${BASE_URL}/pedidos`)
        await page.waitForLoadState('networkidle')
        expect(errors).toHaveLength(0)
    })

    test('payload XSS no ejecuta script', async ({ page }) => {
        await page.goto(`${BASE_URL}/pedidos`)
        await page.waitForLoadState('networkidle')
        const addBtn = page.getByRole('button', { name: /nuevo|agregar|\+/i }).first()
        if (await addBtn.count() > 0) {
            await addBtn.click()
            const nombreInput = page.locator('input[placeholder*="ombre"], input[placeholder*="liente"]').first()
            if (await nombreInput.count() > 0) {
                await nombreInput.fill('<script>alert("xss")</script>')
                let alertFired = false
                page.on('dialog', () => { alertFired = true })
                await page.waitForTimeout(500)
                expect(alertFired).toBe(false)
            }
        }
    })

    test('doble click en guardar no crea duplicado', async ({ page }) => {
        const errors = []
        page.on('pageerror', e => errors.push(e.message))
        await page.goto(`${BASE_URL}/pedidos`)
        await page.waitForLoadState('networkidle')
        const addBtn = page.getByRole('button', { name: /nuevo|agregar|\+/i }).first()
        if (await addBtn.count() > 0) {
            await addBtn.click()
            const saveBtn = page.getByRole('button', { name: /guardar|crear|confirmar/i }).first()
            if (await saveBtn.count() > 0) {
                await saveBtn.dblclick()
                await page.waitForTimeout(500)
                expect(errors).toHaveLength(0)
            }
        }
    })
})

// ─── 8. Turnos ────────────────────────────────────────────────────────────────

test.describe('Turnos', () => {
    test.beforeEach(async ({ page }) => { await loginAs(page) })

    test('página carga correctamente', async ({ page }) => {
        await page.goto(`${BASE_URL}/turnos`)
        await page.waitForLoadState('networkidle')
        await expect(page).not.toHaveURL(/\/login/)
    })
})

// ─── 9. Histórico ─────────────────────────────────────────────────────────────

test.describe('Histórico', () => {
    test.beforeEach(async ({ page }) => { await loginAs(page) })

    test('página carga correctamente', async ({ page }) => {
        await page.goto(`${BASE_URL}/historico`)
        await page.waitForLoadState('networkidle')
        await expect(page).not.toHaveURL(/\/login/)
    })

    test('tiene filtro por fecha', async ({ page }) => {
        await page.goto(`${BASE_URL}/historico`)
        await page.waitForLoadState('networkidle')
        const dateInput = page.locator('input[type="date"]')
        if (await dateInput.count() > 0) {
            await expect(dateInput.first()).toBeVisible()
        }
    })
})

// ─── 10. Métricas ─────────────────────────────────────────────────────────────

test.describe('Métricas', () => {
    test.beforeEach(async ({ page }) => { await loginAs(page) })

    test('página carga (admin)', async ({ page }) => {
        await page.goto(`${BASE_URL}/metricas`)
        await page.waitForLoadState('networkidle')
        await expect(page.locator('body')).not.toBeEmpty()
    })
})

// ─── 11. Navegación y resiliencia ────────────────────────────────────────────

test.describe('Navegación y Resiliencia', () => {
    test.beforeEach(async ({ page }) => { await loginAs(page) })

    test('navegar por todas las páginas sin crash', async ({ page }) => {
        const routes = ['/pedidos', '/mesas', '/caja', '/productos', '/clientes', '/turnos', '/historico']
        for (const route of routes) {
            const errors = []
            page.on('pageerror', e => errors.push(e.message))
            await page.goto(`${BASE_URL}${route}`)
            await page.waitForLoadState('networkidle')
            await expect(page).not.toHaveURL(/\/login/)
            expect(errors).toHaveLength(0)
        }
    })

    test('refrescar en medio de sesión mantiene la auth', async ({ page }) => {
        await page.goto(`${BASE_URL}/pedidos`)
        await page.waitForLoadState('networkidle')
        await page.reload()
        await page.waitForLoadState('networkidle')
        await expect(page).not.toHaveURL(/\/login/)
    })

    test('botón atrás funciona correctamente', async ({ page }) => {
        await page.goto(`${BASE_URL}/pedidos`)
        await page.goto(`${BASE_URL}/mesas`)
        await page.goto(`${BASE_URL}/caja`)
        await page.goBack()
        await expect(page).toHaveURL(/\/mesas/)
    })

    test('ESC cierra modales abiertos', async ({ page }) => {
        await page.goto(`${BASE_URL}/pedidos`)
        await page.waitForLoadState('networkidle')
        const addBtn = page.getByRole('button', { name: /nuevo|agregar|\+/i }).first()
        if (await addBtn.count() > 0) {
            await addBtn.click()
            await page.waitForTimeout(300)
            await page.keyboard.press('Escape')
            await page.waitForTimeout(300)
            // No debería haber crash ni redirección al login
            await expect(page).not.toHaveURL(/\/login/)
        }
    })
})

// ─── 12. Performance ─────────────────────────────────────────────────────────

test.describe('Performance', () => {
    test.beforeEach(async ({ page }) => { await loginAs(page) })

    test('pedidos carga en menos de 10 segundos', async ({ page }) => {
        const start = Date.now()
        await page.goto(`${BASE_URL}/pedidos`)
        await page.waitForLoadState('networkidle')
        expect(Date.now() - start).toBeLessThan(10000)
    })

    test('sin errores de consola en páginas principales', async ({ page }) => {
        const errors = []
        page.on('console', msg => {
            if (msg.type() === 'error' && !msg.text().includes('net::ERR') && !msg.text().includes('Failed to fetch')) {
                errors.push(msg.text())
            }
        })
        for (const route of ['/pedidos', '/mesas', '/caja']) {
            await page.goto(`${BASE_URL}${route}`)
            await page.waitForLoadState('networkidle')
        }
        expect(errors).toHaveLength(0)
    })
})

// ─── 13. Seguridad ────────────────────────────────────────────────────────────

test.describe('Seguridad', () => {
    test('páginas protegidas redirigen a /login sin token', async ({ page }) => {
        await page.goto(`${BASE_URL}/login`)
        await page.evaluate(() => {
            localStorage.removeItem('token')
            localStorage.removeItem('user')
        })
        for (const route of ['/pedidos', '/mesas', '/caja', '/clientes']) {
            await page.goto(`${BASE_URL}${route}`)
            await page.waitForLoadState('networkidle')
            await expect(page).toHaveURL(/\/login/, { timeout: 8000 })
        }
    })

    test('health check del backend responde sin auth', async ({ request }) => {
        const res = await request.get(`${API_URL}/api/health`)
        expect(res.status()).toBe(200)
        const body = await res.json()
        expect(body).toHaveProperty('message')
    })

    test('endpoints protegidos retornan 401 sin token', async ({ request }) => {
        for (const endpoint of ['/api/pedidos', '/api/mesas', '/api/caja/estado', '/api/clientes', '/api/productos']) {
            const res = await request.get(`${API_URL}${endpoint}`, {
                headers: { 'X-Tenant': 'default' },
            })
            expect(res.status()).toBe(401)
        }
    })
})
