// js/finanzas.js
let movimientos = []; 
let filtroFechaDesde = null;
let filtroFechaHasta = null;
let busquedaTexto = "";

const listaMovimientos = document.getElementById("listaMovimientos");
const totalIngresosElem = document.getElementById("totalIngresos");
const totalGastosElem = document.getElementById("totalGastos");
const gananciaTotalElem = document.getElementById("gananciaTotal");
const movimientoMayorElem = document.getElementById("movimientoMayor");
const balanceTotalElem = document.getElementById("balanceTotal");

let grafico = null;

document.addEventListener("DOMContentLoaded", async () => {
    await abrirDB();
    await cargarMovimientosIniciales();

    document.getElementById("btnAgregarMovimiento")?.addEventListener("click", agregarMovimiento);
    document.getElementById("btnLimpiarFormulario")?.addEventListener("click", limpiarFormulario);

    document.getElementById("fechaDesde").addEventListener("change", filtrarPorFecha);
    document.getElementById("fechaHasta").addEventListener("change", filtrarPorFecha);
    document.getElementById("btnLimpiarFiltroFecha").addEventListener("click", limpiarFiltroFecha);
    document.getElementById("buscadorMovimientos").addEventListener("input", buscarMovimientos);

    document.getElementById("btnReiniciarFinanzas").addEventListener("click", reiniciarMovimientos);
    document.getElementById("btnExportarFinanzas").addEventListener("click", exportarExcel);

    // Mostrar inicial
    mostrarMovimientos();
    mostrarResumenFinanciero();
});

async function cargarMovimientosIniciales() {
    try {
        movimientos = await obtenerTodosLosMovimientos(); // Carga inicial
        mostrarMovimientos();
        mostrarResumenFinanciero();
    } catch (error) {
        console.error("Error al cargar movimientos iniciales:", error);
        mostrarToast("Error al cargar datos financieros. 😔", "error");
    }
}

function mostrarToast(mensaje, tipo = 'info') {
    const toastContainer = document.getElementById("toastContainer");
    if (!toastContainer) {
        alert(mensaje);
        return;
    }
    const toast = document.createElement("div");
    toast.className = `toast ${tipo}`;
    toast.textContent = mensaje;
    toastContainer.appendChild(toast);

    setTimeout(() => toast.classList.add("show"), 100);
    setTimeout(() => {
        toast.classList.remove("show");
        toast.addEventListener('transitionend', () => toast.remove(), { once: true });
    }, 3000);
}

async function agregarMovimiento() {
    const tipo = document.getElementById("tipoMovimiento").value;
    const montoInput = document.getElementById("monto");
    const descripcionInput = document.getElementById("descripcion");

    const monto = parseFloat(montoInput.value);
    const descripcion = descripcionInput.value.trim();

    if (isNaN(monto) || monto <= 0) {
        mostrarToast("Ingresa un monto válido. ⚠️", "error");
        return;
    }
    if (!descripcion) {
        mostrarToast("Agrega una descripción. 📝", "error");
        return;
    }

    const nuevoMovimiento = {
        id: Date.now(),
        tipo,
        monto,
        descripcion,
        fecha: new Date().toISOString().slice(0, 10),
    };

    try {
        await agregarMovimientoDB(nuevoMovimiento);
        movimientos.push(nuevoMovimiento);
        mostrarToast("Movimiento guardado ✔️", "success");
        limpiarFormulario();
        mostrarMovimientos();
        mostrarResumenFinanciero();
    } catch (error) {
        console.error("Error al agregar movimiento a la DB:", error);
        mostrarToast("Error al guardar el movimiento. 😔", "error");
    }
}

function limpiarFormulario() {
    document.getElementById("monto").value = "";
    document.getElementById("descripcion").value = "";
    document.getElementById("tipoMovimiento").value = "Ingreso";
}

// Modificación clave en mostrarMovimientos
async function mostrarMovimientos() { // Hacemos esta función async
    listaMovimientos.innerHTML = "";

    // **Paso clave: Recargar movimientos desde la DB antes de filtrar**
    movimientos = await obtenerTodosLosMovimientos(); 

    let filtrados = movimientos.filter(mov => {
        let cumpleFecha = true;
        // Asegúrate de que las fechas sean comparables como cadenas YYYY-MM-DD
        if (filtroFechaDesde) cumpleFecha = cumpleFecha && (mov.fecha >= filtroFechaDesde);
        if (filtroFechaHasta) cumpleFecha = cumpleFecha && (mov.fecha <= filtroFechaHasta);

        const texto = busquedaTexto.toLowerCase();
        const descripcionLower = (mov.descripcion || "").toLowerCase();
        const tipoLower = (mov.tipo || "").toLowerCase();

        const cumpleTexto = descripcionLower.includes(texto) || tipoLower.includes(texto) || String(mov.monto).includes(texto); // Incluir búsqueda por monto

        return cumpleFecha && cumpleTexto;
    });

    filtrados.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

    if (filtrados.length === 0) {
        listaMovimientos.innerHTML = `<li class="no-data-message">No hay movimientos que mostrar con los filtros actuales.</li>`;
        return;
    }

    // Nuevo código con las clases de estilo modernas
    filtrados.forEach(mov => {
        const li = document.createElement("li");
        
        // Aplicamos la clase base de tarjeta de movimiento
        li.className = "movimiento-card";
        
        // Aplicamos clase específica según el tipo
        const tipoLower = mov.tipo.toLowerCase();
        if (tipoLower === "ingreso") {
            li.classList.add("ingreso");
        } else if (tipoLower === "gasto") {
            li.classList.add("gasto");
        }
        
        // Añadir clase para animación de nuevos elementos
        if (mov.id > Date.now() - 5000) {
            li.classList.add("nuevo");
        }
        
        // Formatear la fecha correctamente
        let fechaFormateada = mov.fecha;
        if (fechaFormateada === "undefined" || !fechaFormateada) {
            fechaFormateada = `<span class="fecha-undefined">Fecha no definida</span>`;
        }
        
        li.innerHTML = `
            <div class="movimiento-tipo ${tipoLower}">
                ${tipoLower === "ingreso" ? "💰" : "💸"} ${mov.tipo}
            </div>
            <div class="movimiento-monto">
                $${mov.monto.toFixed(2)}
            </div>
            <div class="movimiento-descripcion">
                ${mov.descripcion}
            </div>
            <div class="movimiento-fecha">
                📅 ${fechaFormateada}
            </div>
            <div class="movimiento-acciones">
                <button class="btn-editar" onclick="editarMovimiento(${mov.id})">✏️ Editar</button>
                <button class="btn-eliminar" onclick="eliminarMovimiento(${mov.id})">🗑️ Eliminar</button>
            </div>
        `;
        listaMovimientos.appendChild(li);
    });
}

async function mostrarResumenFinanciero() {
    let ingresos = 0;
    let gastosManuales = 0;
    let gastosPorVenta = 0;

    movimientos.forEach(mov => {
        const tipo = mov.tipo.toLowerCase();
        if (tipo === "ingreso") ingresos += mov.monto;
        else if (tipo === "gasto") {
            const desc = (mov.descripcion || "").toLowerCase();
            if (desc.includes("costo de venta")) {
                gastosPorVenta += mov.monto;
            } else {
                gastosManuales += mov.monto;
            }
        }
    });

    const gastosTotales = gastosManuales + gastosPorVenta;
    const ganancia = ingresos - gastosTotales;

    totalIngresosElem.textContent = ingresos.toFixed(2);
    totalGastosElem.textContent = gastosTotales.toFixed(2);
    gananciaTotalElem.textContent = ganancia.toFixed(2);
    balanceTotalElem.textContent = `Balance total: $${ganancia.toFixed(2)}`;

    let productos = [];
    try {
        productos = await obtenerTodosLosProductos();
    } catch (error) {
        console.error("Error al obtener productos para ganancia potencial:", error);
    }
    
    const gananciaPotencial = productos.reduce((acc, prod) => {
        const precio = parseFloat(prod.precio) || 0;
        const costo = parseFloat(prod.costo) || 0;
        return acc + (precio - costo);
    }, 0);

    const gananciaPotencialElem = document.getElementById("gananciaPotencial");
    gananciaPotencialElem.textContent = gananciaPotencial.toFixed(2);

    if (movimientos.length === 0) {
        movimientoMayorElem.textContent = "-";
    } else {
        const mayor = movimientos.reduce((max, mov) => mov.monto > max.monto ? mov : max, movimientos[0]);
        movimientoMayorElem.textContent = `${mayor.tipo} de $${mayor.monto.toFixed(2)} (${mayor.descripcion})`;
    }

    // Mostrar explicación extra gastos
    const gastoExtraElem = document.getElementById("gastoExtraExplicacion");
    gastoExtraElem.textContent = `Gastos manuales: $${gastosManuales.toFixed(2)} + Gastos por ventas: $${gastosPorVenta.toFixed(2)} = Total gastos: $${gastosTotales.toFixed(2)}`;

    // Actualizar gráfico
    actualizarGrafico(ingresos, gastosTotales);
}

function actualizarGrafico(ingresos, gastos) {
    const ctx = document.getElementById("graficoFinanzas").getContext("2d");

    if (grafico) {
        grafico.destroy();
    }

    grafico = new Chart(ctx, {
        type: "bar",
        data: {
            labels: ["Ingresos", "Gastos"],
            datasets: [{
                label: "Montos en $",
                data: [ingresos, gastos],
                backgroundColor: [
                    "rgba(107, 70, 193, 0.7)",
                    "rgba(229, 62, 62, 0.7)"
                ],
                borderColor: [
                    "rgba(107, 70, 193, 1)",
                    "rgba(229, 62, 62, 1)"
                ],
                borderWidth: 1,
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                      callback: function(value) {
                        return '$' + value;
                      }
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                }
            }
        }
    });
}

function filtrarPorFecha() {
    filtroFechaDesde = document.getElementById("fechaDesde").value || null;
    filtroFechaHasta = document.getElementById("fechaHasta").value || null;
    mostrarMovimientos(); // Esto ya llamará a la versión asíncrona y recargará
}


function limpiarFiltroFecha() {
    document.getElementById("fechaDesde").value = "";
    document.getElementById("fechaHasta").value = "";
    filtroFechaDesde = null;
    filtroFechaHasta = null;
    mostrarMovimientos(); // Esto ya llamará a la versión asíncrona y recargará
}

function buscarMovimientos() {
    busquedaTexto = document.getElementById("buscadorMovimientos").value.trim();
    mostrarMovimientos(); // Esto ya llamará a la versión asíncrona y recargará
}

async function eliminarMovimiento(id) {
    if (!confirm("¿Seguro que quieres eliminar este movimiento?")) return;
    try {
        await eliminarMovimientoDB(id);
        movimientos = movimientos.filter(mov => mov.id !== id);
        mostrarToast("Movimiento eliminado 🗑️", "success");
        mostrarMovimientos();
        mostrarResumenFinanciero();
    } catch (error) {
        console.error("Error al eliminar movimiento:", error);
        mostrarToast("Error al eliminar movimiento. 😔", "error");
    }
}

function editarMovimiento(id) {
    const mov = movimientos.find(m => m.id === id);
    if (!mov) return;

    const nuevoMonto = prompt("Editar monto:", mov.monto);
    const nuevoDesc = prompt("Editar descripción:", mov.descripcion);

    if (nuevoMonto === null || nuevoDesc === null) return;

    const montoNum = parseFloat(nuevoMonto);
    if (isNaN(montoNum) || montoNum <= 0) {
        mostrarToast("Monto inválido", "error");
        return;
    }

    mov.monto = montoNum;
    mov.descripcion = nuevoDesc;

    // Actualizar DB
    actualizarMovimientoDB(mov.id, mov).then(() => {
    mostrarToast("Movimiento editado ✏️", "success");
    mostrarMovimientos();
    mostrarResumenFinanciero();
}).catch(err => {
    console.error("Error al actualizar movimiento:", err);
    mostrarToast("Error al editar movimiento. 😔", "error");
});

}

async function reiniciarMovimientos() {
    if (!confirm("¿Estás seguro que quieres reiniciar y borrar todos los movimientos? Esta acción es irreversible.")) return; // Mensaje más claro

    try {
        // **Cambio clave aquí: usar limpiarStore('movimientos')**
        await limpiarStore('movimientos'); // Llama a la función genérica de db.js
        movimientos = []; // Vacía el array local
        mostrarToast("Todos los movimientos han sido borrados 🧹", "success");
        mostrarMovimientos(); // Actualiza la UI sin movimientos
        mostrarResumenFinanciero(); // Recalcula el resumen
    } catch (error) {
        console.error("Error al reiniciar movimientos:", error);
        mostrarToast("Error al reiniciar movimientos. 😔", "error");
    }
}

function exportarExcel() {
    // Simple exportar CSV para Excel
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Tipo,Monto,Descripción,Fecha\n";

    movimientos.forEach(mov => {
        const fila = `${mov.tipo},${mov.monto},${mov.descripcion},${mov.fecha}`;
        csvContent += fila + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "finanzas_exportacion.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    mostrarToast("Exportación a CSV lista 📤", "success");
}
