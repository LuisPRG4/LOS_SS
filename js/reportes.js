let graficos = {};
let listaActual = null; // rastrea qué lista está activa

document.addEventListener("DOMContentLoaded", async () => {
    const ventas = await obtenerVentas();
    await generarGraficoTipoPago(ventas);
    await generarGraficoPorProducto(ventas);
    await generarGraficoPorCliente(ventas);
});

async function obtenerVentas() {
    return await obtenerTodasLasVentas();
}

function obtenerTipoGraficoSeleccionado() {
    return document.getElementById("tipoGrafico")?.value || "pie";
}

async function generarGraficoTipoPago(ventas = null) {
    if (!ventas) ventas = await obtenerVentas();

    const tipos = { contado: 0, credito: 0 };
    ventas.forEach(v => {
        if (v.tipoPago === "contado") tipos.contado++;
        else if (v.tipoPago === "credito") tipos.credito++;
    });

    const tipo = obtenerTipoGraficoSeleccionado();
    const ctx = document.getElementById("graficoTipoPago").getContext("2d");

    if (graficos["tipoPago"]) graficos["tipoPago"].destroy();
    graficos["tipoPago"] = new Chart(ctx, {
        type: tipo,
        data: {
            labels: ["Contado", "Crédito"],
            datasets: [{
                data: [tipos.contado, tipos.credito],
                backgroundColor: ["#5b2d90", "#d1a7ff"]
            }]
        }
    });
}

async function generarGraficoPorProducto(ventas = null) {
    if (!ventas) ventas = await obtenerVentas();

    const conteo = {};
    ventas.forEach(v => {
        (v.productos || []).forEach(p => {
            conteo[p.nombre] = (conteo[p.nombre] || 0) + 1;
        });
    });

    const tipo = obtenerTipoGraficoSeleccionado();
    const ctx = document.getElementById("graficoProducto").getContext("2d");

    if (graficos["producto"]) graficos["producto"].destroy();
    graficos["producto"] = new Chart(ctx, {
        type: tipo,
        data: {
            labels: Object.keys(conteo),
            datasets: [{
                data: Object.values(conteo),
                backgroundColor: generarColores(Object.keys(conteo).length)
            }]
        }
    });
}

async function generarGraficoPorCliente(ventas = null) {
    if (!ventas) ventas = await obtenerVentas();

    const conteo = {};
    ventas.forEach(v => {
        conteo[v.cliente] = (conteo[v.cliente] || 0) + 1;
    });

    const tipo = obtenerTipoGraficoSeleccionado();
    const ctx = document.getElementById("graficoCliente").getContext("2d");

    if (graficos["cliente"]) graficos["cliente"].destroy();
    graficos["cliente"] = new Chart(ctx, {
        type: tipo,
        data: {
            labels: Object.keys(conteo),
            datasets: [{
                data: Object.values(conteo),
                backgroundColor: generarColores(Object.keys(conteo).length)
            }]
        }
    });
}

function generarColores(cantidad) {
    const colores = [];
    for (let i = 0; i < cantidad; i++) {
        colores.push(`hsl(${Math.floor(Math.random() * 360)}, 70%, 75%)`);
    }
    return colores;
}

async function exportarVentasExcel() {
    const ventas = await obtenerVentas();

    if (!ventas || ventas.length === 0) {
        window.mostrarToast("No hay ventas para exportar.", "warning");
        return;
    }

    try {
        const datos = ventas.map(v => {
            const fila = {
                Cliente: v.cliente || "",
                Producto: (v.productos || []).map(p => `${p.nombre} x${p.cantidad}`).join(", "),
                Monto: v.ingreso || 0,
                TipoPago: v.tipoPago || "",
                Fecha: v.fecha || v.fechaVenta || ""
            };

            if (v.tipoPago === "contado") {
                fila.MetodoPagoContado = v.detallePago?.metodo || "";
            } else if (v.tipoPago === "credito") {
                fila.AcreedorCredito = v.detallePago?.acreedor || "";
                fila.VencimientoCredito = v.detallePago?.fechaVencimiento || "";
            }

            return fila;
        });

        const ws = XLSX.utils.json_to_sheet(datos);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Ventas");

        XLSX.writeFile(wb, "ventas.xlsx");

        window.mostrarToast("¡Archivo exportado correctamente!", "success");
    } catch (error) {
        console.error("Error al exportar Excel:", error);
        window.mostrarToast("Ocurrió un error al exportar el archivo.", "error");
    }
}
window.exportarVentasExcel = exportarVentasExcel;

async function aplicarFiltroFechas() {
    const desde = document.getElementById("fechaInicio").value;
    const hasta = document.getElementById("fechaFin").value;

    if (!desde || !hasta) {
        window.mostrarToast("Selecciona ambas fechas para filtrar.", "warning");
        return;
    }

    const ventas = await obtenerVentas();
    const ventasFiltradas = ventas.filter(v => {
        const fecha = v.fecha || v.fechaVenta;
        return fecha >= desde && fecha <= hasta;
    });

    await generarGraficoTipoPago(ventasFiltradas);
    await generarGraficoPorProducto(ventasFiltradas);
    await generarGraficoPorCliente(ventasFiltradas);

    if (listaActual) {
        let ventasParaLista = ventasFiltradas;
        if (listaActual === "credito") ventasParaLista = ventasFiltradas.filter(v => v.tipoPago === "credito");
        else if (listaActual === "contado") ventasParaLista = ventasFiltradas.filter(v => v.tipoPago === "contado");
        else if (listaActual === "cobranzas") {
            const hoy = new Date().toISOString().slice(0, 10);
            ventasParaLista = ventasFiltradas.filter(v =>
                v.tipoPago === "credito" && v.detallePago?.fechaVencimiento && v.detallePago.fechaVencimiento <= hoy
            );
        }
        if (listaActual === "porProducto") await mostrarPorProducto(ventasFiltradas);
        else if (listaActual === "porFecha") await mostrarPorFecha(ventasFiltradas);
        else if (listaActual === "recurrentes") await mostrarClientesRecurrentes(ventasFiltradas);
        else renderizarListaEspecial(ventasParaLista, listaActual);
    }
    window.mostrarToast(`Filtro por fechas aplicado. Se encontraron ${ventasFiltradas.length} ventas.`, "info");
}

async function actualizarTodosLosGraficos() {
    const desde = document.getElementById("fechaInicio").value;
    const hasta = document.getElementById("fechaFin").value;
    const tipoAgrupacion = document.getElementById("tipoAgrupacion").value;

    let ventas = await obtenerVentas();

    if (desde && hasta) {
        ventas = ventas.filter(v => {
            const fecha = v.fecha || v.fechaVenta;
            return fecha >= desde && fecha <= hasta;
        });
    }

    if (tipoAgrupacion === "semana") {
        if (typeof agruparVentasPor === 'function') {
            ventas = agruparVentasPor(ventas, "semana");
        } else {
            console.warn("La función 'agruparVentasPor' no está definida para agrupar por semana.");
        }
    } else if (tipoAgrupacion === "mes") {
        if (typeof agruparVentasPor === 'function') {
            ventas = agruparVentasPor(ventas, "mes");
        } else {
            console.warn("La función 'agruparVentasPor' no está definida para agrupar por mes.");
        }
    }

    await generarGraficoTipoPago(ventas);
    await generarGraficoPorProducto(ventas);
    await generarGraficoPorCliente(ventas);
}

// ----------------------------------------------------
// *** FUNCIONES ACTUALIZADAS PARA LOS DETALLES DESPLEGABLES ***
// ----------------------------------------------------

async function mostrarVentasCredito(ventasFiltradas = null) {
    const ventas = ventasFiltradas || await obtenerVentas();
    const ventasCredito = ventas.filter(v => v.tipoPago === "credito");
    renderizarListaEspecial(ventasCredito, "Ventas a Crédito");
}

async function mostrarVentasContado(ventasFiltradas = null) {
    const ventas = ventasFiltradas || await obtenerVentas();
    const ventasContado = ventas.filter(v => v.tipoPago === "contado");
    renderizarListaEspecial(ventasContado, "Ventas al Contado");
}

async function mostrarCobranzas(ventasFiltradas = null) {
    const ventas = ventasFiltradas || await obtenerVentas();
    const hoy = new Date().toISOString().slice(0, 10);
    const ventasCobranza = ventas.filter(v =>
        v.tipoPago === "credito" && v.detallePago?.fechaVencimiento && v.detallePago.fechaVencimiento <= hoy
    );
    renderizarListaEspecial(ventasCobranza, "Cobranzas Vencidas");
}

async function mostrarPorProducto(ventasFiltradas = null) {
    const ventas = ventasFiltradas || await obtenerVentas();
    const resumenProductos = {};

    ventas.forEach(v => {
        (v.productos || []).forEach(p => {
            resumenProductos[p.nombre] = (resumenProductos[p.nombre] || 0) + (p.cantidad || 0);
        });
    });

    const lista = document.getElementById("listaEspecial");
    lista.innerHTML = "";

    const totalExistente = document.getElementById("totalReporteEspecial");
    if (totalExistente) {
        totalExistente.remove();
    }

    if (Object.keys(resumenProductos).length === 0) {
        lista.innerHTML = `<li class="reporte-venta-card no-results">No hay productos vendidos aún para este reporte.</li>`;
        return;
    }

    let totalUnidadesVendidas = 0;

    for (const [nombreProducto, cantidadVendida] of Object.entries(resumenProductos)) {
        const li = document.createElement("li");
        li.classList.add("reporte-venta-card");
        li.dataset.nombreProducto = nombreProducto;

        totalUnidadesVendidas += cantidadVendida;

        li.innerHTML = `
            <div class="reporte-venta-header">
                <div class="reporte-venta-titulo">
                    Producto: ${nombreProducto}
                </div>
            </div>
            <div class="reporte-venta-body" style="justify-content: center;">
                <div class="reporte-venta-info" style="text-align: center;">
                    <p class="reporte-venta-detalle" style="font-size: 1.1em; color: #B8860B; font-weight: bold;">
                        Unidades Vendidas: ${cantidadVendida}
                    </p>
                </div>
            </div>
            <div class="reporte-venta-acciones">
                <button class="btn-reporte-accion btn-ver-detalles">Ver Historial</button>
            </div>
            <div class="detalle-desplegable">
                <h4>Detalle de Historial</h4>
                <p>Aquí se mostraría un desglose de las ventas individuales de ${nombreProducto}.</p>
                <p>Puedes listar cada venta donde aparece este producto.</p>
            </div>
        `;
        lista.appendChild(li);

        li.querySelector(".btn-ver-detalles").addEventListener("click", () => {
            const detalleDiv = li.querySelector(".detalle-desplegable");
            detalleDiv.classList.toggle("mostrar"); // Toggle la clase para mostrar/ocultar
        });
    }

    const divTotal = document.createElement("div");
    divTotal.id = "totalReporteEspecial";
    divTotal.classList.add("total-reporte-especial");
    divTotal.innerHTML = `<strong>Total Unidades Vendidas:</strong> ${totalUnidadesVendidas}`;
    document.getElementById("contenedorListaEspecial").appendChild(divTotal);
}

async function mostrarPorFecha(ventasFiltradas = null) {
    const ventas = ventasFiltradas || await obtenerVentas();
    const resumenPorFecha = {};

    ventas.forEach(v => {
        const fecha = v.fecha || v.fechaVenta;
        if (fecha) {
            resumenPorFecha[fecha] = (resumenPorFecha[fecha] || 0) + (parseFloat(v.ingreso) || 0);
        }
    });

    const lista = document.getElementById("listaEspecial");
    lista.innerHTML = "";

    const totalExistente = document.getElementById("totalReporteEspecial");
    if (totalExistente) {
        totalExistente.remove();
    }

    const fechasOrdenadas = Object.keys(resumenPorFecha).sort();

    if (fechasOrdenadas.length === 0) {
        lista.innerHTML = `<li class="reporte-venta-card no-results">No hay ventas registradas por fecha para este reporte.</li>`;
        return;
    }

    let totalGlobalVentas = 0;

    fechasOrdenadas.forEach(fecha => {
        const li = document.createElement("li");
        li.classList.add("reporte-venta-card");
        li.dataset.fecha = fecha;

        const montoTotalFecha = resumenPorFecha[fecha];
        totalGlobalVentas += montoTotalFecha;

        li.innerHTML = `
            <div class="reporte-venta-header">
                <div class="reporte-venta-titulo">
                    Fecha: ${fecha}
                </div>
            </div>
            <div class="reporte-venta-body" style="justify-content: center;">
                <div class="reporte-venta-info" style="text-align: center;">
                    <p class="reporte-venta-detalle" style="font-size: 1.1em; color: #B8860B; font-weight: bold;">
                        Ventas del día: $${montoTotalFecha.toFixed(2)}
                    </p>
                </div>
            </div>
            <div class="reporte-venta-acciones">
                <button class="btn-reporte-accion btn-ver-detalles">Ver Detalles</button>
            </div>
            <div class="detalle-desplegable">
                <h4>Ventas de la Fecha ${fecha}</h4>
                <ul>
                    <li>Venta #1: $XX.XX</li>
                    <li>Venta #2: $YY.YY</li>
                </ul>
                <p>Esta sección se llenaría dinámicamente con las ventas exactas de este día.</p>
            </div>
        `;
        lista.appendChild(li);

        li.querySelector(".btn-ver-detalles").addEventListener("click", () => {
            const detalleDiv = li.querySelector(".detalle-desplegable");
            detalleDiv.classList.toggle("mostrar");
        });
    });

    const divTotal = document.createElement("div");
    divTotal.id = "totalReporteEspecial";
    divTotal.classList.add("total-reporte-especial");
    divTotal.innerHTML = `<strong>Total General de Ventas:</strong> $${totalGlobalVentas.toFixed(2)}`;
    document.getElementById("contenedorListaEspecial").appendChild(divTotal);
}

async function mostrarClientesRecurrentes(ventasFiltradas = null) {
    const ventas = ventasFiltradas || await obtenerVentas();
    const conteoClientes = {};
    const montoTotalPorCliente = {};
    const ventasPorCliente = {}; // Para almacenar las ventas de cada cliente

    ventas.forEach(v => {
        const cliente = v.cliente;
        if (cliente) {
            conteoClientes[cliente] = (conteoClientes[cliente] || 0) + 1;
            montoTotalPorCliente[cliente] = (montoTotalPorCliente[cliente] || 0) + (parseFloat(v.ingreso) || 0);
            if (!ventasPorCliente[cliente]) ventasPorCliente[cliente] = [];
            ventasPorCliente[cliente].push(v);
        }
    });

    const lista = document.getElementById("listaEspecial");
    lista.innerHTML = "";

    const totalExistente = document.getElementById("totalReporteEspecial");
    if (totalExistente) {
        totalExistente.remove();
    }

    const clientesRepetidos = Object.entries(conteoClientes).filter(([_, cant]) => cant > 1);

    if (clientesRepetidos.length === 0) {
        lista.innerHTML = `<li class="reporte-venta-card no-results">No hay clientes recurrentes aún para este reporte.</li>`;
        return;
    }

    let totalRecurrenteMonto = 0;

    clientesRepetidos.forEach(([cliente, veces]) => {
        const li = document.createElement("li");
        li.classList.add("reporte-venta-card");
        li.dataset.clienteNombre = cliente;

        const montoCliente = montoTotalPorCliente[cliente];
        totalRecurrenteMonto += montoCliente;

        const ventasDelCliente = ventasPorCliente[cliente] || [];
        const ventasHtml = ventasDelCliente.map(venta => `
            <li>
                Venta el ${venta.fecha || venta.fechaVenta}: $${(parseFloat(venta.ingreso) || 0).toFixed(2)} 
                (${venta.productos.map(p => p.nombre).join(', ')})
            </li>
        `).join('');


        li.innerHTML = `
            <div class="reporte-venta-header">
                <div class="reporte-venta-titulo">
                    Cliente: ${cliente}
                </div>
            </div>
            <div class="reporte-venta-body" style="justify-content: center;">
                <div class="reporte-venta-info" style="text-align: center;">
                    <p class="reporte-venta-detalle">Compras Registradas: <strong style="color:#B8860B;">${veces}</strong></p>
                    <p class="reporte-venta-detalle">Total Gastado: <strong style="color:#B8860B;">$${montoCliente.toFixed(2)}</strong></p>
                </div>
            </div>
            <div class="reporte-venta-acciones">
                <button class="btn-reporte-accion btn-ver-detalles">Ver Historial</button>
            </div>
            <div class="detalle-desplegable">
                <h4>Historial de Compras de ${cliente}</h4>
                <ul>
                    ${ventasHtml}
                </ul>
            </div>
        `;
        lista.appendChild(li);

        li.querySelector(".btn-ver-detalles").addEventListener("click", () => {
            const detalleDiv = li.querySelector(".detalle-desplegable");
            detalleDiv.classList.toggle("mostrar");
        });
    });

    const divTotal = document.createElement("div");
    divTotal.id = "totalReporteEspecial";
    divTotal.classList.add("total-reporte-especial");
    divTotal.innerHTML = `<strong>Total Clientes Recurrentes:</strong> $${totalRecurrenteMonto.toFixed(2)}`;
    document.getElementById("contenedorListaEspecial").appendChild(divTotal);
}


function renderizarListaEspecial(ventas, tipoReporte) {
    const lista = document.getElementById("listaEspecial");
    let totalMonto = 0;

    const totalExistente = document.getElementById("totalReporteEspecial");
    if (totalExistente) {
        totalExistente.remove();
    }

    if (ventas.length === 0) {
        lista.innerHTML = `<li class="reporte-venta-card no-results">No hay ${tipoReporte.toLowerCase()} para mostrar.</li>`;
        return;
    }

    lista.innerHTML = "";

    ventas.forEach(v => {
        const li = document.createElement("li");
        li.classList.add("reporte-venta-card");
        li.dataset.ventaId = v.id;

        if (v.tipoPago === "credito") {
            li.classList.add("tipo-credito");
        } else if (v.tipoPago === "contado") {
            li.classList.add("tipo-contado");
        }

        const montoVenta = parseFloat(v.ingreso || 0);
        totalMonto += montoVenta;

        const montoFormateado = montoVenta.toFixed(2);
        const fechaVencimientoHtml = v.detallePago?.fechaVencimiento ? `<p class="reporte-venta-detalle">Vence: ${v.detallePago.fechaVencimiento}</p>` : "";
        const productosVendidosHtml = (v.productos || [])
                                        .map(p => `<span class="producto-tag">${p.nombre} x${p.cantidad}</span>`)
                                        .join(", ");

        const metodoPagoContadoHtml = (v.tipoPago === "contado" && v.detallePago?.metodo) ? `<p class="reporte-venta-detalle">Método: ${v.detallePago.metodo}</p>` : "";
        const acreedorCreditoHtml = (v.tipoPago === "credito" && v.detallePago?.acreedor) ? `<p class="reporte-venta-detalle">Acreedor: ${v.detallePago.acreedor}</p>` : "";

        li.innerHTML = `
            <div class="reporte-venta-header">
                <div class="reporte-venta-titulo">
                    Cliente: ${v.cliente}
                </div>
                <span class="reporte-venta-tipo ${v.tipoPago === 'credito' ? 'credito' : 'contado'}">
                    ${v.tipoPago || tipoReporte.replace('Ventas ', '').replace(' Vencidas', '')}
                </span>
            </div>
            <div class="reporte-venta-body">
                <div class="reporte-venta-info">
                    <p class="reporte-venta-detalle">Fecha: ${v.fecha || v.fechaVenta}</p>
                    <p class="reporte-venta-detalle">Productos: ${productosVendidosHtml || 'N/A'}</p>
                </div>
                <div class="reporte-venta-monto">
                    $${montoFormateado}
                </div>
            </div>
            <div class="reporte-venta-acciones">
                <button class="btn-reporte-accion btn-ver-detalles">Ver Detalles</button>
                <button class="btn-reporte-accion btn-eliminar-reporte">Eliminar</button>
            </div>
            <div class="detalle-desplegable">
                <h4>Detalles Adicionales</h4>
                ${metodoPagoContadoHtml}
                ${acreedorCreditoHtml}
                ${fechaVencimientoHtml}
                <p class="reporte-venta-detalle-extra">ID de Venta: ${v.id}</p>
                </div>
        `;

        lista.appendChild(li);

        // AÑADIR LISTENERS A LOS BOTONES
        li.querySelector(".btn-ver-detalles").addEventListener("click", () => {
            const detalleDiv = li.querySelector(".detalle-desplegable");
            detalleDiv.classList.toggle("mostrar"); // Toggle la clase para mostrar/ocultar
        });

        li.querySelector(".btn-eliminar-reporte").addEventListener("click", async () => {
            const confirmacion = await window.mostrarConfirmacion(`¿Estás seguro de que quieres eliminar esta venta de ${v.cliente} por $${montoFormateado}?`, "Confirmar Eliminación");
            if (confirmacion) {
                try {
                    await window.eliminarVenta(v.id);
                    window.mostrarToast("Venta eliminada correctamente", "success");
                    await alternarLista(listaActual);
                } catch (error) {
                    console.error("Error al eliminar venta:", error);
                    window.mostrarToast("Error al eliminar la venta.", "error");
                }
            }
        });
    });

    const divTotal = document.createElement("div");
    divTotal.id = "totalReporteEspecial";
    divTotal.classList.add("total-reporte-especial");
    divTotal.innerHTML = `<strong>Total ${tipoReporte}:</strong> $${totalMonto.toFixed(2)}`;
    
    document.getElementById("contenedorListaEspecial").appendChild(divTotal);
}

function filtrarListaEspecial() {
    const filtro = document.getElementById("filtroEspecial").value.toLowerCase();
    const items = document.querySelectorAll("#listaEspecial .reporte-venta-card");

    let anyVisible = false;
    items.forEach(card => {
        let textToFilter = '';
        if (listaActual === "credito" || listaActual === "contado" || listaActual === "cobranzas") {
            const tituloElement = card.querySelector(".reporte-venta-titulo");
            if (tituloElement) {
                textToFilter = tituloElement.textContent.toLowerCase();
            }
        } else if (listaActual === "porProducto") {
            textToFilter = card.dataset.nombreProducto ? card.dataset.nombreProducto.toLowerCase() : '';
        } else if (listaActual === "porFecha") {
            textToFilter = card.dataset.fecha ? card.dataset.fecha.toLowerCase() : '';
        } else if (listaActual === "recurrentes") {
             textToFilter = card.dataset.clienteNombre ? card.dataset.clienteNombre.toLowerCase() : '';
        }

        if (textToFilter.includes(filtro)) {
            card.style.display = "flex";
            anyVisible = true;
        } else {
            card.style.display = "none";
        }
    });
    
    const totalElement = document.getElementById("totalReporteEspecial");
    if (totalElement) {
        totalElement.style.display = anyVisible ? "block" : "none";
    }
}

async function alternarLista(tipo) {
    const lista = document.getElementById("listaEspecial");
    const buscadorDiv = document.getElementById("buscadorEspecial");
    const buscadorInput = document.getElementById("filtroEspecial");

    const totalExistente = document.getElementById("totalReporteEspecial");
    if (totalExistente) {
        totalExistente.remove();
    }

    if (listaActual === tipo) {
        lista.innerHTML = "";
        buscadorDiv.style.display = "none";
        buscadorInput.value = "";
        listaActual = null;
    } else {
        listaActual = tipo;
        if (["credito", "contado", "cobranzas", "recurrentes", "porProducto", "porFecha"].includes(tipo)) {
            buscadorDiv.style.display = "block";
            if (tipo === "porProducto") {
                buscadorInput.placeholder = "🔍 Buscar por producto...";
            } else if (tipo === "porFecha") {
                buscadorInput.placeholder = "🔍 Buscar por fecha (YYYY-MM-DD)...";
            } else if (tipo === "recurrentes") {
                 buscadorInput.placeholder = "🔍 Buscar por cliente recurrente...";
            } else {
                buscadorInput.placeholder = "🔍 Buscar por cliente...";
            }
        } else {
            buscadorDiv.style.display = "none";
        }
        buscadorInput.value = "";

        lista.innerHTML = "";

        if (tipo === "credito") await mostrarVentasCredito();
        else if (tipo === "cobranzas") await mostrarCobranzas();
        else if (tipo === "contado") await mostrarVentasContado();
        else if (tipo === "porProducto") await mostrarPorProducto();
        else if (tipo === "porFecha") await mostrarPorFecha();
        else if (tipo === "recurrentes") await mostrarClientesRecurrentes();
    }
}

function agruparVentasPor(ventas, criterio) {
    const agrupado = {};
    ventas.forEach(venta => {
        let clave;
        const fechaVenta = new Date(venta.fecha || venta.fechaVenta);
        if (isNaN(fechaVenta.getTime())) {
            console.warn("Fecha inválida encontrada en venta:", venta);
            return;
        }

        if (criterio === "semana") {
            const tempDate = new Date(fechaVenta);
            const dayOfWeek = tempDate.getDay();
            const diff = tempDate.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
            const startOfWeek = new Date(tempDate.setDate(diff));
            clave = startOfWeek.toISOString().slice(0, 10);
        } else if (criterio === "mes") {
            clave = fechaVenta.toISOString().slice(0, 7);
        } else {
            clave = venta.id;
        }

        if (!agrupado[clave]) {
            agrupado[clave] = {
                ingreso: 0,
                ventas: [],
                label: clave
            };
        }
        agrupado[clave].ingreso += parseFloat(venta.ingreso || 0);
        agrupado[clave].ventas.push(venta);
    });

    return Object.values(agrupado);
}
