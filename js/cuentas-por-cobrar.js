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
        llenarDatalistClientes();
        abonos = await obtenerTodosLosAbonos();

        // *** ¡AÑADE ESTA LÍNEA AQUÍ! ***
        if (typeof renderCalendar === 'function') { // Asegurarnos que la función exista
            renderCalendar(); // Llama a la función del calendario para que se dibuje
        } else {
            console.error("Error: renderCalendar() no está definido. Asegúrate de que js/calendar.js está enlazado correctamente.");
        }

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
            localStorage.removeItem('editVentaId'); // Limpiar después de usar si por alguna razón queda aquí
        }

    } catch (error) {
        console.error("Error al inicializar la aplicación de cuentas por cobrar:", error);
        mostrarToast("Error grave al cargar datos de cuentas por cobrar 😥", 'error'); // Usando tipo de toast
    }
});

function llenarDatalistClientes() {
    const datalist = document.getElementById("clientesLista");
    datalist.innerHTML = ""; // Limpiar por si ya había algo

    // Crear una lista de nombres únicos, limpios
    const nombresUnicos = [...new Set(clientes.map(c => c.nombre.trim()).filter(n => n))];

    // Insertar cada nombre como una opción en el datalist
    nombresUnicos.forEach(nombre => {
        const option = document.createElement("option");
        option.value = nombre;
        datalist.appendChild(option);
    });
}

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

        verificarRecordatorios(pendientesFiltradas);

        mostrarRankingMorosos(pendientesFiltradas); // o filteredCuentas si estás en aplicarFiltros

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

    agregarEventosHistorial(); // ¡Agrega los eventos a los botones!
}

//FUNCIÓN RECORDARTORIOS 25 DE JUNIO 2025
function verificarRecordatorios(pedidos) {
    const hoy = new Date();
    const proximosAVencer = pedidos.filter(pedido => {
        const fechaVencimiento = new Date(pedido.detallePago?.fechaVencimiento);
        if (pedido.estadoPago !== "Pagado Total" && !isNaN(fechaVencimiento)) {
            const diffDias = (fechaVencimiento - hoy) / (1000 * 60 * 60 * 24);
            return diffDias >= 0 && diffDias <= 3;
        }
        return false;
    });

    if (proximosAVencer.length > 0) {
        mostrarToast(`⚠️ Tienes ${proximosAVencer.length} cliente(s) por vencer en menos de 3 días.`, "warning", 5000);
    }
}

//NUEVA A LA 1 AM
function agregarEventosHistorial() {
    document.querySelectorAll('.btn-ver-historial').forEach(btn => {
        btn.removeEventListener('click', toggleHistorialPagos);
        btn.addEventListener('click', toggleHistorialPagos);
    });
}


function crearCardVentaCredito(venta) {
    const productosTexto = venta.productos.map(p => `${p.nombre} x${p.cantidad}`).join(", ");
    const fechaVencimiento = venta.detallePago.fechaVencimiento || "Sin fecha";

    let estadoPagoHTML = '';
    let cardStatusClass = 'card-status-info';
    let textColorClass = 'text-info';

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const vencimientoDate = new Date(fechaVencimiento);
    const vencimientoOnlyDate = new Date(vencimientoDate.getFullYear(), vencimientoDate.getMonth(), vencimientoDate.getDate());

    // Nueva lógica: texto de días de mora o por vencer
    let textoDias = '';
    if (fechaVencimiento !== "Sin fecha") {
        const diff = vencimientoOnlyDate - today;
        const dias = Math.floor(diff / (1000 * 60 * 60 * 24));

        if (dias < 0) {
            textoDias = `<span class="mora-text text-danger">Hace ${Math.abs(dias)} día${Math.abs(dias) === 1 ? '' : 's'} de mora</span>`;
        } else if (dias === 0) {
            textoDias = `<span class="mora-text text-warning">Vence hoy</span>`;
        } else {
            textoDias = `<span class="mora-text text-muted">Faltan ${dias} día${dias === 1 ? '' : 's'}</span>`;
        }
    } else {
        textoDias = `<span class="mora-text text-muted">Sin fecha de vencimiento</span>`;
    }

    // Colores y estados
    if (venta.montoPendiente <= 0) {
        cardStatusClass = 'card-status-success';
        textColorClass = 'text-success';
        estadoPagoHTML = `<span class="tag-status tag-success">(Pagado)</span>`;
    } else if (vencimientoOnlyDate < today) {
        cardStatusClass = 'card-status-danger';
        textColorClass = 'text-danger';
        estadoPagoHTML = `<span class="tag-status tag-danger">(Vencida)</span>`;
    } else if (vencimientoOnlyDate.getTime() - today.getTime() < (7 * 24 * 60 * 60 * 1000)) {
        cardStatusClass = 'card-status-warning';
        textColorClass = 'text-warning';
        estadoPagoHTML = `<span class="tag-status tag-warning">(Próxima a Vencer)</span>`;
    } else if (venta.estadoPago === 'Pagado Parcial') {
        cardStatusClass = 'card-status-primary';
        textColorClass = 'text-primary';
        estadoPagoHTML = `<span class="tag-status tag-primary">(Pagado Parcial)</span>`;
    } else {
        cardStatusClass = 'card-status-info';
        textColorClass = 'text-info';
        estadoPagoHTML = `<span class="tag-status tag-info">(Pendiente)</span>`;
    }

    const card = document.createElement("div");
    card.className = `venta-credito-card ${cardStatusClass}`;

    card.innerHTML = `
    <div class="card-header-flex">
        <h3 class="card-title ${textColorClass}">${venta.cliente}</h3>
        <span class="card-date">Reg: ${venta.fecha}</span>
    </div>
    <p class="card-text"><strong>Productos:</strong> ${productosTexto}</p>
    <p class="card-text"><strong>Total Venta:</strong> $${venta.ingreso.toFixed(2)}</p>
    <p class="card-text"><strong>Monto Pendiente:</strong> <span class="text-amount-danger">$${venta.montoPendiente.toFixed(2)}</span></p>
    <p class="card-text">
        <strong>Vencimiento:</strong> ${fechaVencimiento} ${estadoPagoHTML}<br>
        ${textoDias}
    </p>
    <div class="card-actions">
        ${venta.montoPendiente > 0 ?
            `<button onclick="abrirModalAbono(${venta.id})" class="btn-success">💰 Abonar</button>` :
            `<button class="btn-disabled">✅ Pagado</button>`
        }
        <button onclick="cargarVentaParaEditar(${venta.id})" class="btn-warning">✏️ Editar Venta</button>
        <button class="btn-info btn-ver-historial" data-venta-id="${venta.id}">📜 Ver Historial de Pagos</button>
    </div>
    <div class="historial-pagos" id="historial-${venta.id}" style="display:none; margin-top:10px;"></div>
    `;

    // Botón de WhatsApp si el cliente tiene teléfono
    const clienteDatos = clientes.find(c => c.nombre === venta.cliente); // Buscar por nombre
    if (clienteDatos?.telefono) {
    const numero = clienteDatos.telefono.replace(/\D/g, '');
    const mensaje = encodeURIComponent(`Hola ${clienteDatos.nombre}, tienes una cuenta pendiente con nosotros. ¿Podemos ayudarte a regularizarla?`);
    
    // Detectar si es dispositivo móvil
    const esMovil = /android|iphone|ipad|mobile/i.test(navigator.userAgent);
    const enlace = esMovil
        ? `https://wa.me/52${numero}?text=${mensaje}` // App en móvil
        : `https://web.whatsapp.com/send?phone=52${numero}&text=${mensaje}`; // Web en escritorio

    const botonWhatsapp = document.createElement("a");
    botonWhatsapp.href = enlace;
    botonWhatsapp.target = "_blank";
    botonWhatsapp.className = "btn-whatsapp";
    botonWhatsapp.innerHTML = "📱 Contactar por WhatsApp";

    // Evento para mostrar ícono ✔️ al hacer clic
    botonWhatsapp.addEventListener("click", () => {
    botonWhatsapp.innerHTML = "✔️ Enviado por WhatsApp";
    botonWhatsapp.classList.add("enviado");

    setTimeout(() => {
        botonWhatsapp.innerHTML = "📱 Contactar por WhatsApp";
        botonWhatsapp.classList.remove("enviado");
    }, 5000); // Vuelve al estado original después de 5 segundos
    });

    card.querySelector(".card-actions").appendChild(botonWhatsapp);
    }

    return card;
}

//NUEVA A LA 1 AM
// Función para cargar y mostrar el historial de pagos de una venta
async function toggleHistorialPagos(event) {
    const btn = event.currentTarget;
    const ventaId = Number(btn.dataset.ventaId);
    const historialDiv = document.getElementById(`historial-${ventaId}`);

    if (!historialDiv) return;

    if (historialDiv.style.display === 'block') {
        // Ocultar historial
        historialDiv.style.display = 'none';
        btn.textContent = '📜 Ver Historial de Pagos';
        historialDiv.innerHTML = '';
        return;
    }

    // Mostrar historial
    btn.textContent = '❌ Ocultar Historial';

    try {
        // Obtener abonos desde IndexedDB (usamos la función que tienes)
        const abonos = await obtenerAbonosPorPedidoId(ventaId);

        if (abonos.length === 0) {
            historialDiv.innerHTML = '<p>No hay abonos registrados para esta venta.</p>';
        } else {
            // Crear listado bonito de abonos
            historialDiv.innerHTML = abonos.map(abono => `
                <div class="abono-item">
                    <p><strong>Fecha:</strong> ${abono.fechaAbono}</p>
                    <p><strong>Monto Abonado:</strong> $${abono.montoAbonado.toFixed(2)}</p>
                    ${abono.metodoPago ? `<p><strong>Método de Pago:</strong> ${abono.metodoPago}</p>` : ''}
                </div>
                <hr>
            `).join('');
        }
        historialDiv.style.display = 'block';
    } catch (error) {
        historialDiv.innerHTML = `<p class="text-danger">Error al cargar el historial: ${error}</p>`;
        historialDiv.style.display = 'block';
    }
}

// Abre la venta en el módulo de ventas.html para edición
function cargarVentaParaEditar(ventaId) {
    localStorage.setItem('editVentaId', ventaId);
    window.location.href = 'ventas.html';
}


async function aplicarFiltros() {
    const clienteFiltro = document.getElementById("filtroCliente").value.toLowerCase().trim();
    // Si hay coincidencia exacta en cliente, mostrar solo el resumen
 const coincidenciaExacta = clientes.some(c => c.nombre.toLowerCase() === clienteFiltro);
 if (coincidenciaExacta) {
    mostrarResumenCliente(clienteFiltro);
    return; // Ya no seguimos con el filtro normal
 }

    const estadoFiltro = document.getElementById("filtroEstado").value;
    const fechaVencimientoFiltro = document.getElementById("filtroFechaVencimiento").value;

    // Asegurarse de tener los datos más recientes antes de filtrar
    await cargarYMostrarCuentasPorCobrar(); // Esto recarga y recalcula ventasCredito

    let filteredCuentas = ventasCredito.filter(venta => {
        // Solo mostrar ventas a crédito que aún tienen monto pendiente,
        // a menos que el filtro de estado esté vacío ("Todas las Pendientes")
        // o si queremos ver específicamente "Pagado Parcial" o "Pendiente"
        if (venta.montoPendiente <= 0 && estadoFiltro !== "") return false; // Si está pagada y no estamos en "Todas", no mostrar

        const idVentaTexto = String(venta.id || "").toLowerCase();
        const nombreCliente = venta.cliente?.toLowerCase() || "";
        const matchesCliente = clienteFiltro === "" || nombreCliente.includes(clienteFiltro) || idVentaTexto.includes(clienteFiltro);


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
function mostrarResumenCliente(clienteNombre) {
    const ventasDelCliente = ventasCredito.filter(v => v.cliente.toLowerCase() === clienteNombre.toLowerCase());

    if (ventasDelCliente.length === 0) {
        mostrarToast("Este cliente no tiene cuentas por cobrar pendientes. ✅", "info");
        mostrarCuentasEnUI([]); // Limpia la vista
        return;
    }

    const totalPendiente = ventasDelCliente.reduce((sum, v) => sum + v.montoPendiente, 0);

    const card = document.createElement("div");
    card.className = "venta-credito-card card-status-primary"; // Tarjeta azul/morado

    card.innerHTML = `
        <div class="card-header-flex">
            <h3 class="card-title text-primary">${clienteNombre}</h3>
            <span class="card-date">Ventas: ${ventasDelCliente.length}</span>
        </div>
        <p class="card-text"><strong>Total Pendiente:</strong> <span class="text-amount-danger">$${totalPendiente.toFixed(2)}</span></p>
        <p class="card-text"><strong>Última Venta:</strong> ${ventasDelCliente[ventasDelCliente.length - 1].fecha}</p>
        <div class="card-actions">
            <button class="btn-secondary btn-toggle-detalles">📄 Ver detalles</button>
            <button class="btn-imprimir-resumen">🧾 Exportar resumen</button>
        </div>

        <div class="ventas-detalladas" style="display:none; margin-top:10px;"></div>
    `;

    const listaCuentas = document.getElementById("listaCuentasPorCobrar");
    listaCuentas.innerHTML = ""; // Limpiar lista
    listaCuentas.appendChild(card);

    actualizarEstadisticas(ventasDelCliente); // Mostrar estadísticas solo de este cliente

    // Agregar evento toggle para mostrar/ocultar detalles
    const btnToggle = card.querySelector(".btn-toggle-detalles");
    const detallesDiv = card.querySelector(".ventas-detalladas");

    btnToggle.addEventListener("click", () => {
        if (detallesDiv.style.display === "none") {
            // Mostrar detalles
            detallesDiv.style.display = "block";
            btnToggle.textContent = "📄 Ocultar detalles";
            // Rellenar detalles con las ventas detalladas
            detallesDiv.innerHTML = ""; // limpiar
            ventasDelCliente.forEach(venta => {
                const ventaDiv = document.createElement("div");
                ventaDiv.className = "venta-detalle";
                ventaDiv.innerHTML = `
                    <p><strong>ID Venta:</strong> ${venta.id} — <strong>Fecha:</strong> ${venta.fecha} — <strong>Monto Pendiente:</strong> $${venta.montoPendiente.toFixed(2)}</p>
                `;
                detallesDiv.appendChild(ventaDiv);
            });
        } else {
            // Ocultar detalles
            detallesDiv.style.display = "none";
            btnToggle.textContent = "📄 Ver detalles";
            detallesDiv.innerHTML = ""; // Opcional: limpiar cuando se oculta
        }
    });

    const btnImprimir = card.querySelector(".btn-imprimir-resumen");
    btnImprimir.addEventListener("click", () => {
    const contenido = `
        <html>
        <head>
            <title>Resumen de ${clienteNombre}</title>
            <style>
                body { font-family: sans-serif; padding: 20px; }
                h1 { color: #5b2d90; }
                .venta-item { margin-bottom: 10px; }
                .venta-item span { display: inline-block; min-width: 120px; }
                .total { font-weight: bold; font-size: 18px; margin-top: 20px; }
                .footer { margin-top: 40px; font-size: 12px; color: #555; }
            </style>
        </head>
        <body>
            <h1>Resumen de cuenta: ${clienteNombre}</h1>
            <div class="total">Total pendiente: $${totalPendiente.toFixed(2)}</div>
            <h3>Ventas pendientes:</h3>
            <div>
                ${ventasDelCliente.map(v => `
                    <div class="venta-item">
                        <span><strong>ID:</strong> ${v.id}</span>
                        <span><strong>Fecha:</strong> ${v.fecha}</span>
                        <span><strong>Monto:</strong> $${v.montoPendiente.toFixed(2)}</span>
                    </div>
                `).join('')}
            </div>
            <div class="footer">
                Generado el ${new Date().toLocaleString()}
            </div>
        </body>
        </html>
    `;

    const ventana = window.open('', '_blank');
    ventana.document.write(contenido);
    ventana.document.close();
    ventana.print();
});

}

function mostrarVentasDetalladas(clienteNombre) {
    const ventasDelCliente = ventasCredito.filter(v => v.cliente.toLowerCase() === clienteNombre.toLowerCase());
    mostrarCuentasEnUI(ventasDelCliente);
    actualizarEstadisticas(ventasDelCliente);
}

//RANKING DE MOROSOS
function calcularRankingMorosos(ventas) {
  const resumenClientes = {};

  ventas.forEach(venta => {
    if (!resumenClientes[venta.cliente]) {
      resumenClientes[venta.cliente] = 0;
    }
    resumenClientes[venta.cliente] += venta.montoPendiente;
  });

  const ranking = Object.entries(resumenClientes)
    .sort((a, b) => b[1] - a[1]) // Orden descendente
    .slice(0, 5); // Top 5

  return ranking; // [['Juan', 500], ['Ana', 300], ...]
}

//MOSTRAR MOROSOS
function mostrarRankingMorosos(ventas) {
  const lista = document.getElementById("listaRankingMorosos");
  if (!lista) return;

  const ranking = calcularRankingMorosos(ventas);

  if (ranking.length === 0) {
    lista.innerHTML = "<li>No hay clientes con deuda significativa.</li>";
    return;
  }

  lista.innerHTML = ranking.map(([nombre, total]) =>
    `<li><strong>${nombre}</strong>: $${total.toFixed(2)}</li>`
  ).join('');
}
