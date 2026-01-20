# App Restos - Sistema de Gestión

Sistema de gestión con métricas para comandas de canchas de fútbol y restaurantes.

## Tecnologías

- **Frontend**: Vite + React + Tailwind CSS
- **Backend**: Node.js + Express
- **Base de datos**: JSON (puede migrarse a MongoDB/PostgreSQL)

## Estructura

```
├── client/     # Frontend React + Vite
└── server/     # Backend Node.js + Express
```

## Instalación

```bash
# Instalar dependencias del servidor
cd server
npm install

# Instalar dependencias del cliente
cd ../client
npm install
```

## Desarrollo

```bash
# Terminal 1 - Servidor
cd server
npm run dev

# Terminal 2 - Cliente
cd client
npm run dev
```

## Secciones

1. **Apertura/Cierre de Caja** - Resumen diario y mensual con métricas
2. **Mapa de Mesas** - Gestión visual de mesas con drag & drop
3. **Pedidos** - Gestión de pedidos para mesas y cocina
4. **Clientes** - Gestión de clientes con cuenta corriente
5. **Productos** - Gestión de productos con stock y precios


