# Dominio + PWA (instalable sin AppStore/PlayStore)

Esta app **se puede instalar como PWA** (Progressive Web App). Eso permite que tus clientes:

- entren a una URL (tu dominio),
- y el navegador les ofrezca **Instalar app** (Android/desktop) o **Agregar a pantalla de inicio** (iPhone).

> Requisito: **HTTPS**. En HTTP no aparece la instalación PWA.

---

## 1) Deploy recomendado (simple)

- **Frontend (React/Vite)**: Vercel
- **Backend (Express/Mongo)**: Render (ya tenés `render.yaml`)

---

## 2) Variables de entorno clave

### Backend (Render)

En Render ya está preparado:

- `AUTH_REQUIRED=true`
- `JWT_SECRET` (secret)
- `MONGODB_URI` (secret)
- `FRONTEND_URL` o `FRONTEND_URLS` (tu dominio final del frontend)

Ejemplos:

- `FRONTEND_URL=https://app.tudominio.com`
- `FRONTEND_URLS=https://app.tudominio.com,https://www.app.tudominio.com`

### Frontend (Vercel)

En Vercel agregá:

- `VITE_API_URL=https://TU-SERVICIO-RENDER.onrender.com/api`

Así el cliente llama al backend en producción (en dev se usa el proxy del `vite.config.js`).

---

## 3) PWA (instalación con logo)

Ya se agregó PWA en `client/` **sin plugins** (más estable para deploy):

- Manifest: `client/public/manifest.webmanifest`
- Service Worker: `client/public/sw.js`

### Importante sobre el logo en el celular

- **Android/Chrome** suele aceptar iconos SVG en el manifest, pero lo más compatible es PNG.
- **iPhone (Safari)** suele necesitar **PNG** (apple-touch-icon) para que se vea perfecto en el ícono.

Recomendación:

1. Exportá tu logo como:
   - `pwa-192x192.png`
   - `pwa-512x512.png`
   - `apple-touch-icon.png` (180x180)
2. Colocalos en: `client/public/`
3. Actualizá `client/public/manifest.webmanifest` y `client/index.html` para apuntar a esos archivos.

---

## 4) Conectar tu dominio (sin AppStore/PlayStore)

### En Vercel

1. Project → Settings → Domains
2. Agregá `app.tudominio.com`
   - Si vas a usar multi-cliente por subdominio: agregá también `*.tudominio.com` (wildcard)
3. Vercel te da los registros DNS a crear (CNAME o A según tu caso)
4. Esperás a que valide (queda con **SSL** automático)

### En tu DNS (donde compraste el dominio)

Creás los registros que te pide Vercel.

---

## 5) “Cómo la instala el cliente”

### Android (Chrome)

- Abre `https://app.tudominio.com`
- Menú del navegador (⋮) → **Instalar app** (o aparece un banner)

### iPhone (Safari)

- Abre `https://app.tudominio.com`
- Botón compartir → **Agregar a pantalla de inicio**

### Escritorio (Chrome / Edge)

- Abre `https://app.tudominio.com`
- En la barra de direcciones suele aparecer un ícono de **instalar** (monitor con flecha / “+”)
  - o Menú (⋮) → **Instalar Algarrobos**

### Importante (si no aparece instalar)

- Debe ser **HTTPS**
- Debe estar cargando el `manifest.webmanifest`
- A veces hay que refrescar 1 vez y navegar un poco (el navegador “detecta” que es instalable)

---

## 6) Multi-cliente (Opción A): 1 plataforma con subdominios + 1 DB por cliente

### Idea

- Cliente 1: `https://cliente1.tudominio.com`
- Cliente 2: `https://cliente2.tudominio.com`

El backend detecta el tenant por:

- Header `X-Tenant` (prioridad)
- o por subdominio (`cliente1`)

### Backend: 1 DB por cliente (Mongo)

Configurar una de estas opciones:

**A) URI por template (recomendado)**

- `MONGODB_URI_TEMPLATE=mongodb://localhost:27017/app-restos-{tenant}`
  - En Atlas: `mongodb+srv://.../app-restos-{tenant}?retryWrites=true&w=majority`

**B) Mapa fijo por tenant**

- `TENANT_MONGODB_URIS={"cliente1":"mongodb://.../db1","cliente2":"mongodb://.../db2"}`

### Dev local

En `localhost`, podés elegir el tenant con:

- `http://localhost:5173/?tenant=cliente1`
  - o `localStorage.setItem('tenant', 'cliente1')`

