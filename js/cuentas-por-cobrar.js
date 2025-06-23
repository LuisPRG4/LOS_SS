// js/cuentas-por-cobrar.js

// Variables globales para almacenar datos en memoria
let ventasCredito = []; // Solo las ventas a crédito
let clientes = [];
let abonos = []; // Para los abonos

let currentVentaIdAbono = null; // Para el modal de abonos

document.addEventListener("DOMContentLoaded", async () => {
    try {
        await abrirDB(); // Abre la base de datos (asegúrate de que db.js se carga antes)

        // Cargar todos los datos necesarios al inicio
        ventas = await obtenerTodasLasVentas(); // Obtener todas las ventas
        clientes = await obtenerTodosLosClientes();
        abonos = await obtenerTodosLosAbonos();

        // Inicializar la lista de ventas a crédito
        await cargarYMostrarCuentasPorCobrar();
        await actualizarEstadisticas();

        // Asignar eventos a los botones de filtro
        document.getElementById("btnFiltrarCuentas").addEventListener("click", aplicarFiltros);
        document.getElementById("btnLimpiarFiltros").addEventListener("click", limpiarFiltros);

        // Asociar eventos del modal de abono
        document.getElementById("btnRegistrarAbono").addEventListener("click", registrarAbono);
        document.getElementById("cerrarModalAbono").addEventListener("click", cerrarModalAbono);
        document.getElementById("modalAbono").addEventListener("click", (e) => {
            if (e.target.id === "modalAbono") {
                cerrarModalAbono();
            }
        });

        // Lógica para cargar venta desde localStorage si se viene de "Cuentas por Cobrar"
        // (Esto es en ventas.js, pero lo mantengo aquí por si acaso lo colocaste aquí)
        const storedEditVentaId = localStorage.getItem('editVentaId');
        if (storedEditVentaId) {
            // No hacemos nada aquí, esta lógica va en ventas.js para redireccionar.
            // Aquí solo nos aseguramos de que no haya conflicto si se carga este script en otra página.
            localStorage.removeItem('editVentaId'); // Limpiar después de usar si por alguna razón queda aquí
        }

    } catch (error) {
        console.error("Error al inicializar la aplicación de cuentas por cobrar:", error);
        mostrarToast("Error grave al cargar datos de cuentas por cobrar 😥", 'error'); // Usando tipo de toast
    }
});

async function cargarYMostrarCuentasPorCobrar() {
    try {
        // Obtener todas las ventas y filtrar solo las de crédito
        const allVentas = await obtenerTodasLasVentas();
        ventasCredito = allVentas.filter(venta => venta.tipoPago === 'credito');
        abonos = await obtenerTodosLosAbonos(); // Asegurar que los abonos estén actualizados

        // Recalcular montos pendientes y estados para cada venta a crédito
        for (const venta of ventasCredito) {
            const abonosDeVenta = abonos.filter(abono => abono.pedidoId === venta.id);
            const totalAbonado = abonosDeVenta.reduce((sum, abono) => sum + abono.montoAbonado, 0);
            venta.montoPendiente = Math.max(0, venta.ingreso - totalAbonado); // Evitar negativos

            // Asignar estado de pago basado en el monto pendiente
            if (venta.montoPendiente === 0) {
                venta.estadoPago = 'Pagado Total';
            } else if (totalAbonado > 0 && totalAbonado < venta.ingreso) {
                venta.estadoPago = 'Pagado Parcial';
            } else {
                venta.estadoPago = 'Pendiente';
            }
            // Persistir el estado actualizado en la DB (útil para que el estado se guarde)
            await actualizarVenta(venta.id, venta);
        }

        // Filtrar solo las ventas que aún tienen un monto pendiente por defecto
        const pendientesFiltradas = ventasCredito.filter(v => v.montoPendiente > 0);

        mostrarCuentasEnUI(pendientesFiltradas);
        await actualizarEstadisticas(pendientesFiltradas); // Actualiza estadísticas con los datos filtrados
    } catch (error) {
        console.error("Error al cargar y mostrar cuentas por cobrar:", error);
        mostrarToast("Error al cargar cuentas por cobrar ❌", 'error');
    }
}

function mostrarCuentasEnUI(cuentasParaMostrar) {
    const listaCuentas = document.getElementById("listaCuentasPorCobrar");
    listaCuentas.innerHTML = "";

    if (cuentasParaMostrar.length === 0) {
        listaCuentas.innerHTML = `<p class="mensaje-lista">No hay cuentas por cobrar pendientes que coincidan con los filtros.</p>`;
        return;
    }

    // Ordenar las ventas: primero las vencidas, luego las próximas, luego las demás, por fecha.
    cuentasParaMostrar.sort((a, b) => {
        const now = new Date();
        const dateA = new Date(a.detallePago.fechaVencimiento || '9999-12-31'); // Poner fecha lejana si no hay vencimiento
        const dateB = new Date(b.detallePago.fechaVencimiento || '9999-12-31');

        const isAVencida = dateA < now && a.montoPendiente > 0;
        const isBVencida = dateB < now && b.montoPendiente > 0;

        if (isAVencida && !isBVencida) return -1; // A viene antes si está vencida y B no
        if (!isAVencida && isBVencida) return 1;  // B viene antes si está vencida y A no

        // Si ambos o ninguno están vencidos, ordenar por la fecha de vencimiento (ascendente)
        return dateA - dateB;
    });


    cuentasParaMostrar.forEach(venta => {
        const card = crearCardVentaCredito(venta);
        listaCuentas.appendChild(card);
    });
}

function crearCardVentaCredito(venta) {
    const productosTexto = venta.productos.map(p => `${p.nombre} x${p.cantidad}`).join(", ");
    const fechaVencimiento = venta.detallePago.fechaVencimiento || "Sin fecha";

    let estadoPagoHTML = '';
    let cardStatusClass = 'card-status-info'; // Clase base para el borde de la tarjeta
    let textColorClass = 'text-info'; // Clase base para el color del texto del título/cliente

    const now = new Date();
    // Ajustar `now` para solo comparar fechas sin tiempo (para evitar que "hoy" ya sea vencido a las 00:01)
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const vencimientoDate = new Date(fechaVencimiento);
    const vencimientoOnlyDate = new Date(vencimientoDate.getFullYear(), vencimientoDate.getMonth(), vencimientoDate.getDate());

    // Lógica para el color y el estado
    if (venta.montoPendiente <= 0) {
        cardStatusClass = 'card-status-success'; // Verde
        textColorClass = 'text-success';
        estadoPagoHTML = `<span class="tag-status tag-success">(Pagado)</span>`;
    } else if (vencimientoOnlyDate < today) {
        cardStatusClass = 'card-status-danger'; // Rojo
        textColorClass = 'text-danger';
        estadoPagoHTML = `<span class="tag-status tag-danger">(Vencida)</span>`;
    } else if (vencimientoOnlyDate.getTime() - today.getTime() < (7 * 24 * 60 * 60 * 1000)) { // Menos de 7 días para vencer
        cardStatusClass = 'card-status-warning'; // Naranja
        textColorClass = 'text-warning';
        estadoPagoHTML = `<span class="tag-status tag-warning">(Próxima a Vencer)</span>`;
    } else {
        // Por defecto: pendiente y no vencida, o parcialmente pagada y no vencida
        if (venta.estadoPago === 'Pagado Parcial') {
            cardStatusClass = 'card-status-primary'; // Tu color principal
            textColorClass = 'text-primary';
            estadoPagoHTML = `<span class="tag-status tag-primary">(Pagado Parcial)</span>`;
        } else { // Pendiente total y no vencida
            cardStatusClass = 'card-status-info'; // Azul claro
            textColorClass = 'text-info';
            estadoPagoHTML = `<span class="tag-status tag-info">(Pendiente)</span>`;
        }
    }


    const card = document.createElement("div");
    // Usamos las clases específicas de tarjeta y el estado para el borde izquierdo
    card.className = `venta-credito-card ${cardStatusClass}`;

    card.innerHTML = `
        <div class="card-header-flex">
            <h3 class="card-title ${textColorClass}">${venta.cliente}</h3>
            <span class="card-date">Reg: ${venta.fecha}</span>
        </div>
        <p class="card-text"><strong>Productos:</strong> ${productosTexto}</p>
        <p class="card-text"><strong>Total Venta:</strong> $${venta.ingreso.toFixed(2)}</p>
        <p class="card-text"><strong>Monto Pendiente:</strong> <span class="text-amount-danger">$${venta.montoPendiente.toFixed(2)}</span></p>
        <p class="card-text"><strong>Vencimiento:</strong> ${fechaVencimiento} ${estadoPagoHTML}</p>
        <div class="card-actions">
            ${venta.montoPendiente > 0 ?
                `<button onclick="abrirModalAbono(${venta.id})" class="btn-success">💰 Abonar</button>`
                : `<button class="btn-disabled">✅ Pagado</button>`
            }
            <button onclick="cargarVentaParaEditar(${venta.id})" class="btn-warning">✏️ Editar Venta</button>
        </div>
    `;
    return card;
}

// Abre la venta en el módulo de ventas.html para edición
function cargarVentaParaEditar(ventaId) {
    localStorage.setItem('editVentaId', ventaId);
    window.location.href = 'ventas.html';
}


async function aplicarFiltros() {
    const clienteFiltro = document.getElementById("filtroCliente").value.toLowerCase().trim();
    const estadoFiltro = document.getElementById("filtroEstado").value;
    const fechaVencimientoFiltro = document.getElementById("filtroFechaVencimiento").value;

    // Asegurarse de tener los datos más recientes antes de filtrar
    await cargarYMostrarCuentasPorCobrar(); // Esto recarga y recalcula ventasCredito

    let filteredCuentas = ventasCredito.filter(venta => {
        // Solo mostrar ventas a crédito que aún tienen monto pendiente,
        // a menos que el filtro de estado esté vacío ("Todas las Pendientes")
        // o si queremos ver específicamente "Pagado Parcial" o "Pendiente"
        if (venta.montoPendiente <= 0 && estadoFiltro !== "") return false; // Si está pagada y no estamos en "Todas", no mostrar

        const matchesCliente = clienteFiltro === "" || venta.cliente.toLowerCase().includes(clienteFiltro);

        let matchesEstado = true;
        if (estadoFiltro === "Pendiente") {
            matchesEstado = venta.estadoPago === "Pendiente";
        } else if (estadoFiltro === "Pagado Parcial") {
            matchesEstado = venta.estadoPago === "Pagado Parcial";
        }
        // Si estadoFiltro es "", coincide con ambos "Pendiente" y "Pagado Parcial" ya que filtramos al inicio por montoPendiente > 0

        let matchesFechaVencimiento = true;
        if (fechaVencimientoFiltro) {
            const vencimientoDate = new Date(venta.detallePago.fechaVencimiento);
            const filtroDate = new Date(fechaVencimientoFiltro);
            // Compara solo las fechas (sin la parte de la hora)
            matchesFechaVencimiento = vencimientoDate.setHours(0,0,0,0) <= filtroDate.setHours(0,0,0,0);
        }

        return matchesCliente && matchesEstado && matchesFechaVencimiento;
    });

    mostrarCuentasEnUI(filteredCuentas);
    await actualizarEstadisticas(filteredCuentas); // Actualiza estadísticas con los filtros aplicados
}

function limpiarFiltros() {
    document.getElementById("filtroCliente").value = "";
    document.getElementById("filtroEstado").value = ""; // Restablece al valor inicial "Todas las Pendientes"
    document.getElementById("filtroFechaVencimiento").value = "";
    cargarYMostrarCuentasPorCobrar(); // Recargar sin filtros
}

async function actualizarEstadisticas(currentFilteredVentas = null) {
    let ventasParaEstadisticas = currentFilteredVentas || ventasCredito.filter(v => v.montoPendiente > 0);

    const totalCredito = ventasParaEstadisticas.reduce((sum, v) => sum + v.ingreso, 0);
    const montoPendienteGlobal = ventasParaEstadisticas.reduce((sum, v) => sum + v.montoPendiente, 0);

    let vencidasCount = 0;
    let proximasVencerCount = 0;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sevenDays = 7 * 24 * 60 * 60 * 1000; // 7 días en milisegundos

    ventasParaEstadisticas.forEach(venta => {
        if (venta.montoPendiente > 0 && venta.detallePago.fechaVencimiento) {
            const vencimientoDate = new Date(venta.detallePago.fechaVencimiento);
            const vencimientoOnlyDate = new Date(vencimientoDate.getFullYear(), vencimientoDate.getMonth(), vencimientoDate.getDate());

            if (vencimientoOnlyDate < today) {
                vencidasCount++;
            } else if (vencimientoOnlyDate.getTime() - today.getTime() < sevenDays) {
                proximasVencerCount++;
            }
        }
    });

    document.getElementById("totalCredito").textContent = `$${totalCredito.toFixed(2)}`;
    document.getElementById("montoPendienteGlobal").textContent = `$${montoPendienteGlobal.toFixed(2)}`;
    document.getElementById("ventasVencidasProximas").textContent = `${vencidasCount} / ${proximasVencerCount}`;
}


// --- Funciones del Modal de Abonos ---
// (Estas asumen que tienes obtenerVentaPorId y obtenerAbonosPorPedidoId en db.js)

async function abrirModalAbono(ventaId) {
    currentVentaIdAbono = ventaId;
    const venta = await obtenerVentaPorId(ventaId);
    
    if (!venta || venta.tipoPago !== 'credito') {
        mostrarToast("No se puede abonar a esta venta.", 'error');
        return;
    }

    // Aseguramos que el monto pendiente esté actualizado al momento de abrir el modal
    const abonosDeVenta = await obtenerAbonosPorPedidoId(ventaId);
    const totalAbonado = abonosDeVenta.reduce((sum, abono) => sum + abono.montoAbonado, 0);
    const montoPendienteActualizado = venta.ingreso - totalAbonado;
    venta.montoPendiente = Math.max(0, montoPendienteActualizado);

    // Actualizar el estado de pago de la venta si es necesario y persistir
    if (venta.montoPendiente === 0) {
        venta.estadoPago = 'Pagado Total';
    } else if (totalAbonado > 0 && totalAbonado < venta.ingreso) {
        venta.estadoPago = 'Pagado Parcial';
    } else {
        venta.estadoPago = 'Pendiente';
    }
    await actualizarVenta(venta.id, venta); // Persistir el estado actualizado

    document.getElementById("detalleVentaModal").innerHTML = `
        <p><strong>Cliente:</strong> ${venta.cliente}</p>
        <p><strong>Total Venta:</strong> $${venta.ingreso.toFixed(2)}</p>
        <p><strong>Monto Pendiente:</strong> <span class="text-amount-danger">$${venta.montoPendiente.toFixed(2)}</span></p>
        <p><strong>Estado:</strong> ${venta.estadoPago}</p>
        <p><strong>Vencimiento:</strong> ${venta.detallePago.fechaVencimiento || 'N/A'}</p>
    `;

    document.getElementById("montoAbono").value = venta.montoPendiente.toFixed(2);
    document.getElementById("modalAbono").style.display = "flex"; // Mostrar el modal

    await mostrarAbonosPrevios(ventaId);
}

function cerrarModalAbono() {
    document.getElementById("modalAbono").style.display = "none";
    document.getElementById("montoAbono").value = "";
    currentVentaIdAbono = null;
    cargarYMostrarCuentasPorCobrar(); // Recargar la lista de cuentas para que refleje los cambios
}

async function registrarAbono() {
    if (currentVentaIdAbono === null) {
        mostrarToast("No hay una venta seleccionada para abonar. 🚫", 'error');
        return;
    }

    const montoAbono = parseFloat(document.getElementById("montoAbono").value);
    if (isNaN(montoAbono) || montoAbono <= 0) {
        mostrarToast("Ingresa un monto de abono válido. 🚫", 'warning');
        return;
    }

    const venta = await obtenerVentaPorId(currentVentaIdAbono);
    if (!venta) {
        mostrarToast("Venta no encontrada. 🚫", 'error');
        return;
    }

    // Recalcular el monto pendiente justo antes de abonar para evitar condiciones de carrera
    const abonosDeVentaActuales = await obtenerAbonosPorPedidoId(currentVentaIdAbono);
    const totalAbonadoActual = abonosDeVentaActuales.reduce((sum, abono) => sum + abono.montoAbonado, 0);
    venta.montoPendiente = Math.max(0, venta.ingreso - totalAbonadoActual);

    if (montoAbono > venta.montoPendiente) {
        mostrarToast(`El abono ($${montoAbono.toFixed(2)}) no puede ser mayor que el monto pendiente ($${venta.montoPendiente.toFixed(2)}). 🚫`, 'warning');
        return;
    }

    const nuevoAbono = {
        pedidoId: currentVentaIdAbono,
        fechaAbono: new Date().toISOString().split("T")[0],
        montoAbonado: montoAbono
    };

    try {
        await agregarAbonoDB(nuevoAbono);
        // Quita o mantén el toast aquí según tu preferencia
        mostrarToast("Abono registrado con éxito ✅", 'success'); 

        // Actualizar el monto pendiente y estado de pago de la venta en el modelo
        venta.montoPendiente -= montoAbono;
        if (venta.montoPendiente <= 0.01) { // Pequeña tolerancia para flotantes
            venta.montoPendiente = 0;
            venta.estadoPago = 'Pagado Total';
        } else {
            venta.estadoPago = 'Pagado Parcial';
        }
        await actualizarVenta(venta.id, venta); // Persistir el estado actualizado en la DB

        // Registrar el movimiento de ingreso por el abono
        await agregarMovimientoDB({
            tipo: "ingreso",
            monto: montoAbono,
            fecha: nuevoAbono.fechaAbono,
            descripcion: `Abono a venta a crédito de ${venta.cliente} (ID Venta: ${venta.id})`
        });

        // --- INICIO DE CAMBIOS CLAVE PARA ACTUALIZACIÓN DINÁMICA ---

        // 1. Actualizar el detalle de la venta dentro del modal con los nuevos montos
        document.getElementById("detalleVentaModal").innerHTML = `
            <p><strong>Cliente:</strong> ${venta.cliente}</p>
            <p><strong>Total Venta:</strong> $${venta.ingreso.toFixed(2)}</p>
            <p><strong>Monto Pendiente:</strong> <span class="text-amount-danger">$${venta.montoPendiente.toFixed(2)}</span></p>
            <p><strong>Estado:</strong> ${venta.estadoPago}</p>
            <p><strong>Vencimiento:</strong> ${venta.detallePago.fechaVencimiento || 'N/A'}</p>
        `;

        // 2. Recargar la lista de abonos previos en el modal
        await mostrarAbonosPrevios(currentVentaIdAbono);

        // Opcional: Reiniciar el campo de monto de abono para la siguiente entrada
        document.getElementById("montoAbono").value = venta.montoPendiente > 0 ? venta.montoPendiente.toFixed(2) : "0.00";

        // --- FIN DE CAMBIOS CLAVE ---

        if (venta.montoPendiente === 0) {
            mostrarToast("Venta a crédito completamente pagada! 🎉", 'success');
            cerrarModalAbono(); // Cerrar el modal automáticamente si ya se pagó todo
        }

        // Finalmente, recargar la vista principal de cuentas por cobrar para reflejar los cambios
        // (Esto también se encarga de recargar las variables globales ventasCredito y abonos)
        cargarYMostrarCuentasPorCobrar();

    } catch (error) {
        console.error("Error al registrar abono:", error);
        mostrarToast("Error al registrar abono. 😔", 'error');
    }
}

async function mostrarAbonosPrevios(ventaId) {
    const listaAbonos = document.getElementById("listaAbonosModal");
    listaAbonos.innerHTML = '';
    const abonosDeVenta = await obtenerAbonosPorPedidoId(ventaId);

    if (abonosDeVenta.length === 0) {
        listaAbonos.innerHTML = '<p class="text-center text-gray-500 text-sm mt-2">No hay abonos previos registrados para esta venta.</p>';
        return;
    }

    const ul = document.createElement('ul');
    ul.className = 'list-style-none abonos-list'; // Nueva clase para la lista de abonos

    abonosDeVenta.sort((a, b) => new Date(a.fechaAbono) - new Date(b.fechaAbono));

    abonosDeVenta.forEach(abono => {
        const li = document.createElement('li');
        li.innerHTML = `<strong>Fecha:</strong> ${abono.fechaAbono}, <strong>Monto:</strong> $${abono.montoAbonado.toFixed(2)}`;
        li.className = 'abono-item'; // Nueva clase para cada ítem de abono
        ul.appendChild(li);
    });
    listaAbonos.appendChild(ul);
}

// Nota: La función mostrarToast se asume que está definida en db.js o script.js
// y que db.js se carga antes de este script.
