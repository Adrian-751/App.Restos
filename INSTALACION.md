# Guía de Instalación - App Restos

## Requisitos Previos

- Node.js (versión 18 o superior)
- npm o yarn

## Pasos de Instalación

### 1. Instalar dependencias del servidor

```bash
cd server
npm install
```

### 2. Instalar dependencias del cliente

```bash
cd ../client
npm install
```

## Ejecutar la Aplicación

### Terminal 1 - Servidor Backend

```bash
cd server
npm run dev
```

El servidor estará disponible en: `http://localhost:3000`

### Terminal 2 - Cliente Frontend

```bash
cd client
npm run dev
```

El cliente estará disponible en: `http://localhost:5173`

## Estructura de Datos

Los datos se guardan en archivos JSON en la carpeta `server/data/`:
- `cajas.json` - Registros de apertura/cierre de caja
- `mesas.json` - Configuración de mesas
- `pedidos.json` - Pedidos realizados
- `clientes.json` - Clientes y cuenta corriente
- `productos.json` - Catálogo de productos

## Notas

- La aplicación usa almacenamiento local en archivos JSON
- Para producción, considera migrar a una base de datos (MongoDB, PostgreSQL)
- El diseño está optimizado para móviles y tablets