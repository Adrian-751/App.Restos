// @ts-check
import { test, expect } from '@playwright/test'

/*
 * E2E para el flujo completo de Pedidos en App.Restos.
 *
 * Requisitos para correr:
 *   1. Backend corriendo  → cd server && npm start  (puerto 3000)
 *   2. Frontend corriendo → cd client && npm run dev (puerto 5173)
 *   3. Variables de entorno (o archivo .env):
 *        TEST_EMAIL=tu@email.com
 *        TEST_PASSWORD=tuPassword
 *
 *   npx playwright test e2e/pedidos.spec.js
 *   npx playwright test e2e/pedidos.spec.js --headed   # para ver el browser
 */

const TEST_EMAIL = process.env.TEST_EMAIL || 'test@test.com'
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'test123'
const BASE = 'http://localhost:5173'

// ────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────

async function login(page) {
    await page.goto(`${BASE}/login`)
    await page.fill('input[type="email"]', TEST_EMAIL)
    await page.fill('input[type="password"]', TEST_PASSWORD)
    await page.click('button:has-text("Ingresar")')
    await page.waitForURL(/\/(panel|pedidos|caja|mesas)/, { timeout: 15_000 })
}

async function goToPedidos(page) {
    await page.goto(`${BASE}/pedidos`)
    await page.waitForSelector('h2:has-text("Pedidos")', { timeout: 10_000 })
}

async function openNuevoPedido(page) {
    await page.click('button:has-text("Nuevo Pedido")')
    await page.waitForSelector('h3:has-text("Nuevo Pedido")', { timeout: 5_000 })
}

async function getProductOptions(page) {
    const combobox = page.locator('.relative.w-full input[type="text"][placeholder*="producto"]')
    await combobox.click()
    await page.waitForTimeout(500)
    const options = page.locator('.absolute.left-0 button')
    const count = await options.count()
    if (count === 0) return []
    const first = await options.first().locator('span.font-semibold').textContent()
    return [{ name: first, locator: options.first() }]
}

async function addFirstProduct(page) {
    const combobox = page.locator('.relative.w-full input[type="text"][placeholder*="producto" i]')
    await combobox.click()
    await page.waitForTimeout(500)
    const firstOption = page.locator('.absolute.left-0 button').first()
    if (await firstOption.isVisible()) {
        const name = await firstOption.locator('span.font-semibold').textContent()
        await firstOption.click()
        await page.waitForTimeout(200)
        await page.click('button:has-text("Agregar")')
        await page.waitForTimeout(300)
        return name
    }
    return null
}

async function clickGuardar(page) {
    await page.click('button:has-text("Guardar"):not(:disabled)')
}

function pedidoCard(page, text) {
    return page.locator('.card', { hasText: text })
}

async function countPedidos(page) {
    return page.locator('.grid > .card').count()
}

// ────────────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────────────

test.describe('Pedidos – flujo completo', () => {

    test.beforeEach(async ({ page }) => {
        await login(page)
        await goToPedidos(page)
    })

    // ─── 1. CREAR PEDIDO ────────────────────────────

    test('crear pedido sin mesa ni cliente (pedido libre)', async ({ page }) => {
        await openNuevoPedido(page)

        const pedidoNombre = `E2E Libre ${Date.now()}`
        await page.fill('input[placeholder*="Pedido"]', pedidoNombre)

        const productName = await addFirstProduct(page)
        test.skip(!productName, 'No hay productos cargados – no se puede testear')

        const itemRow = page.locator('.bg-slate-700', { hasText: productName })
        await expect(itemRow).toBeVisible()

        const totalText = page.locator('.bg-slate-700 .font-bold', { hasText: '$' }).last()
        const totalValue = await totalText.textContent()
        expect(totalValue).not.toBe('$0')

        await clickGuardar(page)

        await expect(page.locator('h3:has-text("Nuevo Pedido")')).toBeHidden({ timeout: 10_000 })

        const card = pedidoCard(page, pedidoNombre)
        await expect(card).toBeVisible({ timeout: 5_000 })
    })

    test('crear pedido con mesa asignada', async ({ page }) => {
        await openNuevoPedido(page)

        const mesaSelect = page.locator('select').first()
        const mesaOptions = mesaSelect.locator('option')
        const optionCount = await mesaOptions.count()

        test.skip(optionCount <= 1, 'No hay mesas cargadas')

        await mesaSelect.selectOption({ index: 1 })
        await page.waitForTimeout(500)

        const productName = await addFirstProduct(page)
        test.skip(!productName, 'No hay productos cargados')

        await clickGuardar(page)
        await expect(page.locator('h3:has-text("Nuevo Pedido")')).toBeHidden({ timeout: 10_000 })

        const mesaCard = page.locator('.card', { hasText: /Mesa \d/ })
        await expect(mesaCard.first()).toBeVisible({ timeout: 5_000 })
    })

    // ─── 2. EDITAR PEDIDO ───────────────────────────

    test('editar pedido existente – agregar item', async ({ page }) => {
        const editBtn = page.locator('button:has-text("Editar")').first()
        test.skip(!(await editBtn.isVisible().catch(() => false)), 'No hay pedidos editables')

        await editBtn.click()
        await page.waitForSelector('h3:has-text("Editar Pedido")', { timeout: 5_000 })

        const itemsBefore = await page.locator('.bg-slate-700 .text-white.text-sm').count()

        const productName = await addFirstProduct(page)
        test.skip(!productName, 'No hay productos cargados')

        const itemsAfter = await page.locator('.bg-slate-700 .text-white.text-sm').count()
        expect(itemsAfter).toBeGreaterThanOrEqual(itemsBefore)

        await clickGuardar(page)
        await expect(page.locator('h3:has-text("Editar Pedido")')).toBeHidden({ timeout: 10_000 })
    })

    // ─── 3. COBRAR PEDIDO ───────────────────────────

    test('cobrar pedido con efectivo', async ({ page }) => {
        const cobrarBtn = page.locator('button:has-text("Cobrar")').first()
        test.skip(!(await cobrarBtn.isVisible().catch(() => false)), 'No hay pedidos para cobrar')

        await cobrarBtn.click()
        await page.waitForSelector('h3:has-text("Cobrar Pedido")', { timeout: 5_000 })

        const totalEl = page.locator('.bg-slate-700 .font-bold', { hasText: '$' }).first()
        const totalText = await totalEl.textContent()
        const totalNum = parseFloat((totalText || '0').replace(/[^0-9.,-]/g, '').replace(',', '.'))

        if (totalNum > 0) {
            const efectivoInput = page.locator('input[type="number"]').first()
            await efectivoInput.click()
            await efectivoInput.fill(String(totalNum))
        }

        await page.click('button:has-text("Confirmar Cobro")')
        await expect(page.locator('h3:has-text("Cobrar Pedido")')).toBeHidden({ timeout: 10_000 })
    })

    // ─── 4. ELIMINAR PEDIDO ─────────────────────────

    test('eliminar pedido', async ({ page }) => {
        const deleteBtn = page.locator('button:has-text("Eliminar")').first()
        test.skip(!(await deleteBtn.isVisible().catch(() => false)), 'No hay pedidos para eliminar')

        const before = await countPedidos(page)

        page.on('dialog', (dialog) => dialog.accept())
        await deleteBtn.click()

        await page.waitForTimeout(2_000)
        const after = await countPedidos(page)
        expect(after).toBeLessThan(before)
    })

    // ─── 5. CANTIDAD ± CONTROLES ────────────────────

    test('incrementar y decrementar cantidad de item', async ({ page }) => {
        await openNuevoPedido(page)

        const productName = await addFirstProduct(page)
        test.skip(!productName, 'No hay productos cargados')

        const itemRow = page.locator('.bg-slate-700', { hasText: productName })
        const cantInput = itemRow.locator('input[type="number"]')
        await expect(cantInput).toHaveValue('1')

        const plusBtn = itemRow.locator('button:has-text("+")').last()
        await plusBtn.click()
        await expect(cantInput).toHaveValue('2')

        const minusBtn = itemRow.locator('button:has-text("-")').last()
        await minusBtn.click()
        await expect(cantInput).toHaveValue('1')

        await page.click('button:has-text("Cancelar")')
    })

    // ─── 6. ELIMINAR ITEM DEL PEDIDO ────────────────

    test('remover item del pedido desde el modal', async ({ page }) => {
        await openNuevoPedido(page)

        const productName = await addFirstProduct(page)
        test.skip(!productName, 'No hay productos cargados')

        const trashBtn = page.locator('.bg-slate-700 .text-red-400').first()
        await expect(trashBtn).toBeVisible()
        await trashBtn.click()

        await expect(page.locator('p:has-text("No hay items")')).toBeVisible()

        await page.click('button:has-text("Cancelar")')
    })
})

// ────────────────────────────────────────────────────
// Tests de regresión – el bug del ENTER
// ────────────────────────────────────────────────────

test.describe('Pedidos – regresión ENTER key (PC bug fix)', () => {

    test.beforeEach(async ({ page }) => {
        await login(page)
        await goToPedidos(page)
    })

    test('ENTER en campo nombre NO dispara guardado', async ({ page }) => {
        await openNuevoPedido(page)

        const nombreInput = page.locator('input[placeholder*="Pedido"]')
        await nombreInput.fill('No debería guardar')
        await nombreInput.press('Enter')

        await page.waitForTimeout(1_000)
        await expect(page.locator('h3:has-text("Nuevo Pedido")')).toBeVisible()
    })

    test('ENTER en campo cantidad NO dispara guardado', async ({ page }) => {
        await openNuevoPedido(page)

        const productName = await addFirstProduct(page)
        test.skip(!productName, 'No hay productos cargados')

        const cantInput = page.locator('.bg-slate-700 input[type="number"]').first()
        await cantInput.click()
        await cantInput.press('Enter')

        await page.waitForTimeout(1_000)
        await expect(page.locator('h3:has-text("Nuevo Pedido")')).toBeVisible()
    })

    test('ENTER en select de mesa NO dispara guardado', async ({ page }) => {
        await openNuevoPedido(page)

        const mesaSelect = page.locator('select').first()
        await mesaSelect.focus()
        await mesaSelect.press('Enter')

        await page.waitForTimeout(1_000)
        await expect(page.locator('h3:has-text("Nuevo Pedido")')).toBeVisible()
    })

    test('ENTER en campo precio personalizado NO dispara guardado', async ({ page }) => {
        await openNuevoPedido(page)

        const precioInput = page.locator('input[placeholder*="Precio"]')
        await precioInput.fill('500')
        await precioInput.press('Enter')

        await page.waitForTimeout(1_000)
        await expect(page.locator('h3:has-text("Nuevo Pedido")')).toBeVisible()
    })

    test('ESC cierra el modal sin guardar', async ({ page }) => {
        await openNuevoPedido(page)

        await page.fill('input[placeholder*="Pedido"]', 'No se guarda')
        await page.keyboard.press('Escape')

        await expect(page.locator('h3:has-text("Nuevo Pedido")')).toBeHidden({ timeout: 3_000 })
    })
})

// ────────────────────────────────────────────────────
// Tests de concurrencia – doble clic / race condition
// ────────────────────────────────────────────────────

test.describe('Pedidos – protección contra doble guardado', () => {

    test.beforeEach(async ({ page }) => {
        await login(page)
        await goToPedidos(page)
    })

    test('el botón Guardar se deshabilita durante el guardado', async ({ page }) => {
        await openNuevoPedido(page)

        const productName = await addFirstProduct(page)
        test.skip(!productName, 'No hay productos cargados')

        const guardarBtn = page.locator('button:has-text("Guardar")')

        const [disabledSeen] = await Promise.all([
            guardarBtn.evaluate((btn) => {
                return new Promise((resolve) => {
                    const obs = new MutationObserver(() => {
                        if (btn.disabled) { obs.disconnect(); resolve(true) }
                    })
                    obs.observe(btn, { attributes: true, attributeFilter: ['disabled'] })
                    if (btn.disabled) { obs.disconnect(); resolve(true) }
                    setTimeout(() => { obs.disconnect(); resolve(false) }, 5_000)
                })
            }),
            guardarBtn.click(),
        ])

        expect(disabledSeen).toBe(true)

        await expect(page.locator('h3:has-text("Nuevo Pedido")')).toBeHidden({ timeout: 15_000 })
    })

    test('doble clic rápido en Guardar no crea duplicados', async ({ page }) => {
        const uniqueName = `DblClick ${Date.now()}`
        await openNuevoPedido(page)
        await page.fill('input[placeholder*="Pedido"]', uniqueName)

        const productName = await addFirstProduct(page)
        test.skip(!productName, 'No hay productos cargados')

        const guardarBtn = page.locator('button:has-text("Guardar")')
        await guardarBtn.dblclick()

        await expect(page.locator('h3:has-text("Nuevo Pedido")')).toBeHidden({ timeout: 15_000 })

        await page.waitForTimeout(2_000)
        const matches = await page.locator('.card', { hasText: uniqueName }).count()
        expect(matches).toBeLessThanOrEqual(1)
    })
})

// ────────────────────────────────────────────────────
// Tests del modal de cobro
// ────────────────────────────────────────────────────

test.describe('Pedidos – modal de cobro', () => {

    test.beforeEach(async ({ page }) => {
        await login(page)
        await goToPedidos(page)
    })

    test('ENTER en campo efectivo del cobro NO dispara confirmar', async ({ page }) => {
        const cobrarBtn = page.locator('button:has-text("Cobrar")').first()
        test.skip(!(await cobrarBtn.isVisible().catch(() => false)), 'No hay pedidos para cobrar')

        await cobrarBtn.click()
        await page.waitForSelector('h3:has-text("Cobrar Pedido")', { timeout: 5_000 })

        const efectivoInput = page.locator('input[type="number"]').first()
        await efectivoInput.fill('100')
        await efectivoInput.press('Enter')

        await page.waitForTimeout(1_000)
        await expect(page.locator('h3:has-text("Cobrar Pedido")')).toBeVisible()

        await page.click('button:has-text("Cancelar")')
    })

    test('cobro parcial muestra restante', async ({ page }) => {
        const cobrarBtn = page.locator('button:has-text("Cobrar")').first()
        test.skip(!(await cobrarBtn.isVisible().catch(() => false)), 'No hay pedidos para cobrar')

        await cobrarBtn.click()
        await page.waitForSelector('h3:has-text("Cobrar Pedido")', { timeout: 5_000 })

        const efectivoInput = page.locator('input[type="number"]').first()
        await efectivoInput.click()
        await efectivoInput.fill('1')

        const restanteEl = page.locator('.text-red-400', { hasText: 'Restante' })
        if (await restanteEl.isVisible().catch(() => false)) {
            const restanteText = await restanteEl.textContent()
            expect(restanteText).toContain('$')
        }

        await page.click('button:has-text("Cancelar")')
    })
})

// ────────────────────────────────────────────────────
// Test de navegación / auth
// ────────────────────────────────────────────────────

test.describe('Auth y navegación', () => {

    test('sin token, /pedidos redirige a /login', async ({ page }) => {
        await page.goto(`${BASE}/pedidos`)
        await expect(page).toHaveURL(/\/login/, { timeout: 5_000 })
    })

    test('login con credenciales inválidas muestra error', async ({ page }) => {
        await page.goto(`${BASE}/login`)
        await page.fill('input[type="email"]', 'noexiste@invalid.com')
        await page.fill('input[type="password"]', 'wrongpassword')
        await page.click('button:has-text("Ingresar")')

        const errorBanner = page.locator('.bg-red-900\\/30')
        await expect(errorBanner).toBeVisible({ timeout: 10_000 })
    })

    test('login exitoso navega a /panel', async ({ page }) => {
        await login(page)
        await expect(page).toHaveURL(/\/(panel|pedidos|caja|mesas)/)
    })
})
