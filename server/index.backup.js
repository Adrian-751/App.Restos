import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

const DATA_DIR = path.join(__dirname, "data");

// Asegurar que el directorio data existe
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Helper para leer datos JSON
const readData = (filename) => {
    const filePath = path.join(DATA_DIR, filename);
    if (!fs.existsSync(filePath)) {
        return [];
    }
    try {
        const data = fs.readFileSync(filePath, "utf8");
        return JSON.parse(data);
    } catch (error) {
        return [];
    }
};

// Helper para escribir datos JSON
const writeData = (filename, data) => {
    const filePath = path.join(DATA_DIR, filename);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
};

// ========== RUTAS DE CAJA ==========
app.get("/api/caja/estado", (req, res) => {
    const cajas = readData("cajas.json");
    const hoy = new Date().toISOString().split("T")[0];
    const cajaHoy = cajas.find((c) => c.fecha === hoy && !c.cerrada);
    res.json(cajaHoy || null);
});

app.post("/api/caja/abrir", (req, res) => {
    const { montoInicial } = req.body;
    const cajas = readData("cajas.json");
    const hoy = new Date().toISOString().split("T")[0];

    const nuevaCaja = {
        id: Date.now().toString(),
        fecha: hoy,
        montoInicial: parseFloat(montoInicial) || 0,
        ventas: [],
        totalEfectivo: 0,
        totalTransferencia: 0,
        cerrada: false,
        createdAt: new Date().toISOString(),
    };

    cajas.push(nuevaCaja);
    writeData("cajas.json", cajas);
    res.json(nuevaCaja);
});

app.post("/api/caja/cerrar", (req, res) => {
    const { id } = req.body;
    const cajas = readData("cajas.json");
    const caja = cajas.find((c) => c.id === id);

    if (caja) {
        caja.cerrada = true;
        caja.cerradaAt = new Date().toISOString();
        //Guardar el total del dia al cerrar caja
        caja.totalDia = (caja.totalEfectivo || 0) + (caja.totalTransferencia || 0);
        writeData("cajas.json", cajas);
        res.json(caja);
    } else {
        res.status(404).json({ error: "Caja no encontrada" });
    }
});

app.get("/api/caja/resumen/:fecha?", (req, res) => {
    const fecha = req.params.fecha || new Date().toISOString().split("T")[0];
    const cajas = readData("cajas.json");
    const cajasFecha = cajas.filter((c) => c.fecha === fecha);
    res.json(cajasFecha);
});

// ========== RUTAS DE MÉTRICAS ==========
app.get("/api/metricas/semana", (req, res) => {
    const cajas = readData("cajas.json");
    const pedidos = readData("pedidos.json");

    // Calcular fecha de inicio de semana (lunes)
    const hoy = new Date();
    const diaSemana = hoy.getDay(); // 0 = domingo, 1 = lunes, etc.
    const diasDesdeLunes = diaSemana === 0 ? 6 : diaSemana - 1;
    const inicioSemana = new Date(hoy);
    inicioSemana.setDate(hoy.getDate() - diasDesdeLunes);
    inicioSemana.setHours(0, 0, 0, 0);

    const finSemana = new Date(inicioSemana);
    finSemana.setDate(inicioSemana.getDate() + 6);
    finSemana.setHours(23, 59, 59, 999);

    // Filtrar cajas de esta semana
    const cajasSemana = cajas.filter(c => {
        const fechaCaja = new Date(c.fecha);
        return fechaCaja >= inicioSemana && fechaCaja <= finSemana;
    });

    // Filtrar pedidos cobrados de esta semana
    const pedidosSemana = pedidos.filter(p => {
        if (p.estado?.toLowerCase() !== "cobrado") return false;
        const fechaPedido = new Date(p.createdAt);
        return fechaPedido >= inicioSemana && fechaPedido <= finSemana;
    });

    const totalEfectivo = cajasSemana.reduce((sum, c) => sum + (c.totalEfectivo || 0), 0);
    const totalTransferencia = cajasSemana.reduce((sum, c) => sum + (c.totalTransferencia || 0), 0);
    const totalVentas = pedidosSemana.reduce((sum, p) => sum + (p.total || 0), 0);
    const cantidadPedidos = pedidosSemana.length;

    res.json({
        inicioSemana: inicioSemana.toISOString().split("T")[0],
        finSemana: finSemana.toISOString().split("T")[0],
        totalEfectivo,
        totalTransferencia,
        totalVentas,
        total: totalEfectivo + totalTransferencia,
        cantidadPedidos,
        cantidadCajas: cajasSemana.length
    });
});

app.get("/api/metricas/mes", (req, res) => {
    const cajas = readData("cajas.json");
    const pedidos = readData("pedidos.json");

    const hoy = new Date();
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    inicioMes.setHours(0, 0, 0, 0);

    const finMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
    finMes.setHours(23, 59, 59, 999);

    // Filtrar cajas de este mes
    const cajasMes = cajas.filter(c => {
        const fechaCaja = new Date(c.fecha);
        return fechaCaja >= inicioMes && fechaCaja <= finMes;
    });

    // Filtrar pedidos cobrados de este mes
    const pedidosMes = pedidos.filter(p => {
        if (p.estado?.toLowerCase() !== "cobrado") return false;
        const fechaPedido = new Date(p.createdAt);
        return fechaPedido >= inicioMes && fechaPedido <= finMes;
    });

    const totalEfectivo = cajasMes.reduce((sum, c) => sum + (c.totalEfectivo || 0), 0);
    const totalTransferencia = cajasMes.reduce((sum, c) => sum + (c.totalTransferencia || 0), 0);
    const totalVentas = pedidosMes.reduce((sum, p) => sum + (p.total || 0), 0);
    const cantidadPedidos = pedidosMes.length;

    res.json({
        mes: hoy.getMonth() + 1,
        año: hoy.getFullYear(),
        inicioMes: inicioMes.toISOString().split("T")[0],
        finMes: finMes.toISOString().split("T")[0],
        totalEfectivo,
        totalTransferencia,
        totalVentas,
        total: totalEfectivo + totalTransferencia,
        cantidadPedidos,
        cantidadCajas: cajasMes.length
    });
});

// ========== RUTAS DE MESAS ==========
app.get("/api/mesas", (req, res) => {
    const mesas = readData("mesas.json");
    res.json(mesas);
});

app.post("/api/mesas", (req, res) => {
    const mesas = readData("mesas.json");
    const nuevaMesa = {
        id: Date.now().toString(),
        numero: req.body.numero,
        nombre: req.body.nombre || `Mesa ${req.body.numero}`,
        x: req.body.x || 0,
        y: req.body.y || 0,
        color: req.body.color || "#e11d48",
        estado: "libre",
        createdAt: new Date().toISOString(),
    };
    mesas.push(nuevaMesa);
    writeData("mesas.json", mesas);
    res.json(nuevaMesa);
});

app.put("/api/mesas/:id", (req, res) => {
    const mesas = readData("mesas.json");
    const index = mesas.findIndex((m) => m.id === req.params.id);
    if (index !== -1) {
        mesas[index] = { ...mesas[index], ...req.body };
        writeData("mesas.json", mesas);
        res.json(mesas[index]);
    } else {
        res.status(404).json({ error: "Mesa no encontrada" });
    }
});

app.delete("/api/mesas/:id", (req, res) => {
    const mesas = readData("mesas.json");
    const filtradas = mesas.filter((m) => m.id !== req.params.id);
    writeData("mesas.json", filtradas);
    res.json({ success: true });
});

// ========== RUTAS DE PEDIDOS ==========
app.get("/api/pedidos", (req, res) => {
    const pedidos = readData("pedidos.json");
    res.json(pedidos);
});

app.post("/api/pedidos", (req, res) => {
    const pedidos = readData("pedidos.json");
    const clientes = readData("clientes.json");

    const nuevoPedido = {
        id: Date.now().toString(),
        mesaId: req.body.mesaId || null,
        clienteId: req.body.clienteId || null, // NUEVO
        items: req.body.items || [],
        total: req.body.total || 0,
        efectivo: req.body.efectivo || 0,
        transferencia: req.body.transferencia || 0,
        observaciones: req.body.observaciones || "",
        estado: req.body.clienteId ? "Cuenta Corriente" : "Pendiente", // Si tiene cliente, es cuenta corriente
        createdAt: new Date().toISOString(),
    };

    // Si el pedido es para un cliente con cuenta corriente, actualizar su cuenta
    if (req.body.clienteId) {
        const clienteIndex = clientes.findIndex(c => c.id === req.body.clienteId);
        if (clienteIndex !== -1) {
            clientes[clienteIndex].cuentaCorriente = (clientes[clienteIndex].cuentaCorriente || 0) + (req.body.total || 0);
            writeData("clientes.json", clientes);
        }
    }

    pedidos.push(nuevoPedido);
    writeData("pedidos.json", pedidos);
    res.json(nuevoPedido);
});

app.put("/api/pedidos/:id", (req, res) => {
    const pedidos = readData("pedidos.json");
    const index = pedidos.findIndex((p) => p.id === req.params.id);
    if (index === -1) {
        return res.status(404).json({ error: "Pedido no encontrado" });
    }

    const pedidoAnterior = pedidos[index];
    const pedidoActualizado = { ...pedidoAnterior, ...req.body };

    // Si el pedido cambió de estado a "cobrado" y antes no estaba cobrado
    if (req.body.estado?.toLowerCase() === "cobrado" &&
        pedidoAnterior.estado?.toLowerCase() !== "cobrado") {
        // Actualizar la caja abierta
        const cajas = readData("cajas.json");
        const hoy = new Date().toISOString().split("T")[0];
        const cajaIndex = cajas.findIndex((c) => c.fecha === hoy && !c.cerrada);

        if (cajaIndex !== -1) {
            const cajaHoy = cajas[cajaIndex];

            // Asegurar que los valores sean números
            const efectivo = parseFloat(pedidoActualizado.efectivo) || 0;
            const transferencia = parseFloat(pedidoActualizado.transferencia) || 0;

            // Sumar el efectivo y transferencia a la caja
            cajaHoy.totalEfectivo = (parseFloat(cajaHoy.totalEfectivo) || 0) + efectivo;
            cajaHoy.totalTransferencia = (parseFloat(cajaHoy.totalTransferencia) || 0) + transferencia;

            // Agregar el pedido a las ventas de la caja
            if (!cajaHoy.ventas) {
                cajaHoy.ventas = [];
            }
            cajaHoy.ventas.push({
                pedidoId: pedidoActualizado.id,
                total: parseFloat(pedidoActualizado.total) || 0,
                efectivo: efectivo,
                transferencia: transferencia,
                fecha: new Date().toISOString(),
            });

            // Actualizar el array de cajas
            cajas[cajaIndex] = cajaHoy;
            writeData("cajas.json", cajas);
        }

        // Si el pedido es de cuenta corriente, restar de la cuenta del cliente
        if (pedidoActualizado.clienteId) {
            const clientes = readData("clientes.json");
            const clienteIndex = clientes.findIndex(c => c.id === pedidoActualizado.clienteId);
            if (clienteIndex !== -1) {
                const totalPedido = parseFloat(pedidoActualizado.total) || 0;
                clientes[clienteIndex].cuentaCorriente = (clientes[clienteIndex].cuentaCorriente || 0) - totalPedido;
                writeData("clientes.json", clientes);
            }
        }
    }

    pedidos[index] = pedidoActualizado;
    writeData("pedidos.json", pedidos);
    res.json(pedidos[index]);
});

app.delete("/api/pedidos/:id", (req, res) => {
    const pedidos = readData("pedidos.json");
    const filtrados = pedidos.filter((p) => p.id !== req.params.id);
    writeData("pedidos.json", filtrados);
    res.json({ success: true });
});

// ========== RUTAS DE HISTÓRICO ==========
app.get("/api/historico", (req, res) => {
    const pedidos = readData("pedidos.json");
    const turnos = readData("turnos.json");
    const mesas = readData("mesas.json");
    const clientes = readData("clientes.json");

    // Filtrar solo pedidos cobrados
    const pedidosCobrados = pedidos.filter((p) => p.estado?.toLowerCase() === "cobrado");

    // Enriquecer pedidos con información de mesas y clientes
    const historicoPedidos = pedidosCobrados.map((pedido) => {
        const historicoItem = { ...pedido, tipo: 'pedido' };

        // Agregar información de la mesa si existe
        if (pedido.mesaId) {
            const mesa = mesas.find((m) => m.id === pedido.mesaId);
            if (mesa) {
                historicoItem.mesaNombre = mesa.nombre;
                historicoItem.mesaNumero = mesa.numero;
            }
        } else {
            historicoItem.mesaNombre = null;
            historicoItem.mesaNumero = null;
        }

        // Agregar información del cliente si existe
        if (pedido.clienteId) {
            const cliente = clientes.find((c) => c.id === pedido.clienteId);
            if (cliente) {
                historicoItem.clienteNombre = cliente.nombre;
            }
        } else {
            historicoItem.clienteNombre = null;
        }

        return historicoItem;
    });

    // Filtrar solo turnos cobrados
    const turnosCobrados = turnos.filter((t) => t.estado?.toLowerCase() === "cobrado");

    // Enriquecer turnos con información de pedidos, mesas y clientes
    const historicoTurnos = turnosCobrados.map((turno) => {
        const historicoItem = { ...turno, tipo: 'turno' };

        // Agregar información del pedido si existe
        if (turno.pedidoId) {
            const pedido = pedidos.find((p) => p.id === turno.pedidoId);
            if (pedido) {
                historicoItem.pedidoInfo = {
                    id: pedido.id,
                    total: pedido.total,
                    estado: pedido.estado
                };

                // Agregar información de la mesa si el pedido tiene mesa
                if (pedido.mesaId) {
                    const mesa = mesas.find((m) => m.id === pedido.mesaId);
                    if (mesa) {
                        historicoItem.mesaNombre = mesa.nombre;
                        historicoItem.mesaNumero = mesa.numero;
                    }
                }

                // Agregar información del cliente si el pedido tiene cliente
                if (pedido.clienteId) {
                    const cliente = clientes.find((c) => c.id === pedido.clienteId);
                    if (cliente) {
                        historicoItem.clienteNombre = cliente.nombre;
                    }
                }
            }
        }

        return historicoItem;
    });

    // Combinar pedidos y turnos
    const historicoCompleto = [...historicoPedidos, ...historicoTurnos];

    // Ordenar por fecha de creación (más recientes primero)
    historicoCompleto.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json(historicoCompleto);
});

app.delete("/api/historico/:id", (req, res) => {
    const pedidos = readData("pedidos.json");
    const turnos = readData("turnos.json");

    // Buscar en pedidos
    const pedidoIndex = pedidos.findIndex((p) => p.id === req.params.id);
    if (pedidoIndex !== -1) {
        // Solo permitir eliminar pedidos cobrados
        if (pedidos[pedidoIndex].estado?.toLowerCase() !== "cobrado") {
            return res.status(400).json({ error: "Solo se pueden eliminar pedidos cobrados del histórico" });
        }
        const filtrados = pedidos.filter((p) => p.id !== req.params.id);
        writeData("pedidos.json", filtrados);
        return res.json({ success: true });
    }

    // Buscar en turnos
    const turnoIndex = turnos.findIndex((t) => t.id === req.params.id);
    if (turnoIndex !== -1) {
        // Solo permitir eliminar turnos cobrados
        if (turnos[turnoIndex].estado?.toLowerCase() !== "cobrado") {
            return res.status(400).json({ error: "Solo se pueden eliminar turnos cobrados del histórico" });
        }
        const filtrados = turnos.filter((t) => t.id !== req.params.id);
        writeData("turnos.json", filtrados);
        return res.json({ success: true });
    }

    return res.status(404).json({ error: "Item no encontrado" });
});

// ========== RUTAS DE CLIENTES ==========
app.get("/api/clientes", (req, res) => {
    const clientes = readData("clientes.json");
    res.json(clientes);
});

app.post("/api/clientes", (req, res) => {
    const clientes = readData("clientes.json");
    const nuevoCliente = {
        id: Date.now().toString(),
        numero: req.body.numero || clientes.length + 1,
        nombre: req.body.nombre,
        cuentaCorriente: 0,
        pagos: [],
        createdAt: new Date().toISOString(),
    };
    clientes.push(nuevoCliente);
    writeData("clientes.json", clientes);
    res.json(nuevoCliente);
});

app.put("/api/clientes/:id", (req, res) => {
    const clientes = readData("clientes.json");
    const index = clientes.findIndex((c) => c.id === req.params.id);
    if (index !== -1) {
        clientes[index] = { ...clientes[index], ...req.body };
        writeData("clientes.json", clientes);
        res.json(clientes[index]);
    } else {
        res.status(404).json({ error: "Cliente no encontrado" });
    }
});

app.delete("/api/clientes/:id", (req, res) => {
    const clientes = readData("clientes.json");
    const filtrados = clientes.filter((c) => c.id !== req.params.id);
    writeData("clientes.json", filtrados);
    res.json({ success: true });
});

app.post("/api/clientes/:id/pago", (req, res) => {
    const clientes = readData("clientes.json");
    const cliente = clientes.find((c) => c.id === req.params.id);
    if (cliente) {
        const pago = {
            id: Date.now().toString(),
            monto: parseFloat(req.body.monto),
            efectivo: parseFloat(req.body.efectivo) || 0,
            transferencia: parseFloat(req.body.transferencia) || 0,
            observaciones: req.body.observaciones || "",
            fecha: new Date().toISOString(),
        };
        cliente.pagos = cliente.pagos || [];
        cliente.pagos.push(pago);
        cliente.cuentaCorriente = (cliente.cuentaCorriente || 0) - pago.monto;
        writeData("clientes.json", clientes);
        res.json(cliente);
    } else {
        res.status(404).json({ error: "Cliente no encontrado" });
    }
});

// ========== RUTAS DE TURNOS ==========
app.get("/api/turnos", (req, res) => {
    const turnos = readData("turnos.json");
    const mesas = readData("mesas.json");
    const clientes = readData("clientes.json");
    const pedidos = readData("pedidos.json");

    // Filtrar turnos que fueron eliminados de esta sección (pero siguen en el archivo para Histórico)
    const turnosVisibles = turnos.filter((t) => !t.eliminadoDeTurnos);

    // Enriquecer con información de mesas, clientes y pedidos
    const turnosCompletos = turnosVisibles.map((turno) => {
        const turnoCompleto = { ...turno };

        // Agregar información del pedido si existe
        if (turno.pedidoId) {
            const pedido = pedidos.find((p) => p.id === turno.pedidoId);
            if (pedido) {
                turnoCompleto.pedidoInfo = {
                    id: pedido.id,
                    total: pedido.total,
                    estado: pedido.estado
                };

                // Agregar información de la mesa si el pedido tiene mesa
                if (pedido.mesaId) {
                    const mesa = mesas.find((m) => m.id === pedido.mesaId);
                    if (mesa) {
                        turnoCompleto.mesaNombre = mesa.nombre;
                        turnoCompleto.mesaNumero = mesa.numero;
                    }
                }

                // Agregar información del cliente si el pedido tiene cliente
                if (pedido.clienteId) {
                    const cliente = clientes.find((c) => c.id === pedido.clienteId);
                    if (cliente) {
                        turnoCompleto.clienteNombre = cliente.nombre;
                    }
                }
            }
        }

        return turnoCompleto;
    });

    res.json(turnosCompletos);
});

app.post("/api/turnos", (req, res) => {
    const turnos = readData("turnos.json");
    const hoy = new Date().toISOString().split("T")[0];

    // Contar turnos del día para asignar número automático
    const turnosHoy = turnos.filter((t) => {
        const fechaTurno = new Date(t.createdAt).toISOString().split("T")[0];
        return fechaTurno === hoy;
    });
    const numeroTurno = turnosHoy.length + 1;

    const nuevoTurno = {
        id: Date.now().toString(),
        nombre: req.body.nombre || "",
        numero: numeroTurno,
        pedidoId: req.body.pedidoId || null,
        total: parseFloat(req.body.total) || 0,
        efectivo: parseFloat(req.body.efectivo) || 0,
        transferencia: parseFloat(req.body.transferencia) || 0,
        observaciones: req.body.observaciones || "",
        estado: "Pendiente",
        createdAt: new Date().toISOString(),
    };

    turnos.push(nuevoTurno);
    writeData("turnos.json", turnos);
    res.json(nuevoTurno);
});

app.put("/api/turnos/:id", (req, res) => {
    const turnos = readData("turnos.json");
    const cajas = readData("cajas.json");
    const index = turnos.findIndex((t) => t.id === req.params.id);

    if (index === -1) {
        return res.status(404).json({ error: "Turno no encontrado" });
    }

    const turnoAnterior = turnos[index];
    const turnoActualizado = { ...turnoAnterior, ...req.body };

    // Si el turno cambió de estado a "cobrado" y antes no estaba cobrado
    if (req.body.estado?.toLowerCase() === "cobrado" &&
        turnoAnterior.estado?.toLowerCase() !== "cobrado") {
        // Actualizar la caja abierta
        const hoy = new Date().toISOString().split("T")[0];
        const cajaIndex = cajas.findIndex((c) => c.fecha === hoy && !c.cerrada);

        if (cajaIndex !== -1) {
            const cajaHoy = cajas[cajaIndex];

            // Asegurar que los valores sean números
            const efectivo = parseFloat(turnoActualizado.efectivo) || 0;
            const transferencia = parseFloat(turnoActualizado.transferencia) || 0;
            const total = parseFloat(turnoActualizado.total) || 0;

            // Sumar el efectivo y transferencia a la caja
            cajaHoy.totalEfectivo = (parseFloat(cajaHoy.totalEfectivo) || 0) + efectivo;
            cajaHoy.totalTransferencia = (parseFloat(cajaHoy.totalTransferencia) || 0) + transferencia;

            // Agregar el turno a las ventas de la caja
            if (!cajaHoy.ventas) {
                cajaHoy.ventas = [];
            }
            cajaHoy.ventas.push({
                turnoId: turnoActualizado.id,
                tipo: "turno",
                total: total,
                efectivo: efectivo,
                transferencia: transferencia,
                fecha: new Date().toISOString(),
            });

            // Actualizar el array de cajas
            cajas[cajaIndex] = cajaHoy;
            writeData("cajas.json", cajas);
        }

        // Si el turno está asignado a un pedido, actualizar el pedido también
        if (turnoActualizado.pedidoId) {
            const pedidos = readData("pedidos.json");
            const pedidoIndex = pedidos.findIndex((p) => p.id === turnoActualizado.pedidoId);
            if (pedidoIndex !== -1) {
                // No marcamos automáticamente el pedido como cobrado porque el turno puede ser solo una parte
                // Pero podemos agregar información de que tiene un turno asociado
            }
        }
    }

    turnos[index] = turnoActualizado;
    writeData("turnos.json", turnos);
    res.json(turnos[index]);
});

app.delete("/api/turnos/:id", (req, res) => {
    const turnos = readData("turnos.json");
    const turnoIndex = turnos.findIndex((t) => t.id === req.params.id);

    if (turnoIndex === -1) {
        return res.status(404).json({ error: "Turno no encontrado" });
    }

    const turno = turnos[turnoIndex];

    // Si el turno está cobrado, marcarlo como eliminado de Turnos pero mantenerlo en el archivo
    // para que siga apareciendo en Histórico
    if (turno.estado?.toLowerCase() === "cobrado") {
        turnos[turnoIndex] = { ...turno, eliminadoDeTurnos: true };
        writeData("turnos.json", turnos);
        return res.json({ success: true, message: "Turno removido de la sección Turnos, pero permanece en Histórico" });
    }

    // Para turnos no cobrados, eliminarlos normalmente del archivo
    const filtrados = turnos.filter((t) => t.id !== req.params.id);
    writeData("turnos.json", filtrados);
    res.json({ success: true });
});

// ========== RUTAS DE PRODUCTOS ==========
app.get("/api/productos", (req, res) => {
    const productos = readData("productos.json");
    res.json(productos);
});

app.post("/api/productos", (req, res) => {
    const productos = readData("productos.json");
    const nuevoProducto = {
        id: Date.now().toString(),
        numero: req.body.numero || productos.length + 1,
        nombre: req.body.nombre,
        precio: parseFloat(req.body.precio) || 0,
        stock: parseInt(req.body.stock) || 0,
        cantidadDisponible: parseInt(req.body.stock) || 0,
        categoria: req.body.categoria || "general",
        createdAt: new Date().toISOString(),
    };
    productos.push(nuevoProducto);
    writeData("productos.json", productos);
    res.json(nuevoProducto);
});

app.put("/api/productos/:id", (req, res) => {
    const productos = readData("productos.json");
    const index = productos.findIndex((p) => p.id === req.params.id);
    if (index !== -1) {
        productos[index] = { ...productos[index], ...req.body };
        writeData("productos.json", productos);
        res.json(productos[index]);
    } else {
        res.status(404).json({ error: "Producto no encontrado" });
    }
});

app.delete("/api/productos/:id", (req, res) => {
    const productos = readData("productos.json");
    const filtrados = productos.filter((p) => p.id !== req.params.id);
    writeData("productos.json", filtrados);
    res.json({ success: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});