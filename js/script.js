// script.js adaptado para usar IndexedDB

// --- Configuración ---
// Puedes ajustar este valor. Por ejemplo, 5 significa que si el stock es 5 o menos, se considera "bajo".
const STOCK_BAJO_UMBRAL = 0;

// --- Funciones del Dashboard ---

async function cargarDashboard() {
    // 1. Asegurarse de que la base de datos esté abierta.
    // Esto es crucial para que las funciones de db.js como obtenerTodosLosProductos() funcionen.
    await abrirDB(); // Asegúrate de que abrirDB() esté definido en db.js

    // 2. Cargar datos desde IndexedDB
    // Usamos las funciones que vienen de tu archivo db.js
    const productos = await obtenerTodosLosProductos(); // Asegúrate de que obtenerTodosLosProductos() esté definido en db.js
    const ventas = await obtenerTodasLasVentas();     // Asegúrate de que obtenerTodasLasVentas() esté definido en db.js

    // --- Lógica para Ventas Hoy y Ventas Semana ---
    // Verificar si los elementos existen antes de intentar manipularlos
    const ventasHoyElement = document.getElementById("ventasHoy");
    const ventasSemanaElement = document.getElementById("ventasSemana");

    if (ventasHoyElement || ventasSemanaElement) { // Solo ejecuta si al menos uno de los elementos existe
        const hoy = new Date().toISOString().slice(0, 10);
        const hace7Dias = new Date();
        hace7Dias.setDate(hace7Dias.getDate() - 7);
        const fecha7dias = hace7Dias.toISOString().slice(0, 10);

        let totalHoy = 0;
        let totalSemana = 0;

        ventas.forEach((venta) => {
            // Asegurarse de que 'monto' o 'ingreso' existan y sean numéricos.
            // Las ventas de IndexedDB deberían tener 'ingreso'.
            const monto = parseFloat(venta.monto ?? venta.ingreso) || 0; // Usar 'ingreso' como fallback para 'monto'
            if (venta.fecha === hoy) totalHoy += monto;
            if (venta.fecha >= fecha7dias) totalSemana += monto;
        });

        if (ventasHoyElement) {
            ventasHoyElement.textContent = totalHoy.toFixed(2);
        }
        if (ventasSemanaElement) {
            ventasSemanaElement.textContent = totalSemana.toFixed(2);
        }
    }

    // --- Lógica para Producto Más Vendido ---
    // Verificar si el elemento existe
    const productoTopElement = document.getElementById("productoTop");
    if (productoTopElement) { // Solo ejecuta si el elemento existe
        if (productos.length > 0) {
            // Filtramos solo los productos con vendidos > 0.
            // Asegurarse de que 'vendidos' exista y sea numérico.
            const productosConVentas = productos.filter(p => (p.vendidos || 0) > 0);

            if (productosConVentas.length > 0) {
                // El producto más vendido
                let top = productosConVentas.reduce((a, b) => ((a.vendidos || 0) > (b.vendidos || 0) ? a : b));
                productoTopElement.textContent = top.nombre;
            } else {
                productoTopElement.textContent = "-";
            }
        } else {
            productoTopElement.textContent = "-";
        }
    }

    // --- Lógica para Alertas de Stock ---
    // Verificar si el elemento existe
    const alertaStockContainer = document.getElementById("alertasStock"); // Este es el ID del contenedor en tu HTML
    if (alertaStockContainer) { // Solo ejecuta si el elemento existe
        alertaStockContainer.innerHTML = ""; // Limpiar contenido anterior para evitar duplicados

        // Filtramos los productos cuyo stock es igual o menor al umbral definido
        // He unificado la lógica de filtro para usar 'stockMin' si está presente, o 'STOCK_BAJO_UMBRAL' como fallback.
        const productosBajoStock = productos.filter(p => {
            const umbral = (p.stockMin !== undefined && p.stockMin !== null) ? p.stockMin : STOCK_BAJO_UMBRAL;
            return p.stock <= umbral;
        });

        if (productosBajoStock.length > 0) {
            // Si hay productos con stock bajo, creamos una lista para mostrarlos
            const ul = document.createElement("ul");
            ul.className = "list-disc list-inside text-red-700"; // Clases para un estilo de lista básico y color rojo

            productosBajoStock.forEach((p) => {
                let li = document.createElement("li");
                const minText = (p.stockMin !== undefined && p.stockMin !== null) ? `Mín: ${p.stockMin}` : `Umbral: ${STOCK_BAJO_UMBRAL}`;
                li.textContent = `🚨 ${p.nombre} - Stock bajo: ${p.stock} unidades (${minText})`;
                ul.appendChild(li);
            });
            alertaStockContainer.appendChild(ul);
        } else {
            // Si no hay productos con stock bajo, mostramos un mensaje positivo
            alertaStockContainer.innerHTML = `<p class="text-green-600">✅ ¡Excelente! No hay productos con stock bajo.</p>`;
        }
    }

    // --- Lógica para Total Productos, Total Stock, Total Vendidos, Total Ganancia Bruta (añadido previamente) ---
    // Estas se mantienen como las habías corregido con las verificaciones de 'if (elemento)'
    const totalProductosElement = document.getElementById('totalProductos');
    const totalStockElement = document.getElementById('totalStock');
    const totalVendidosElement = document.getElementById('totalVendidos');
    const totalGananciaBrutaElement = document.getElementById('totalGananciaBruta');

    if (totalProductosElement) {
        totalProductosElement.textContent = productos.length;
    }

    if (totalStockElement) {
        const totalStock = productos.reduce((sum, p) => sum + p.stock, 0);
        totalStockElement.textContent = totalStock;
    }

    if (totalVendidosElement) {
        const totalVendidos = productos.reduce((sum, p) => sum + p.vendidos, 0);
        totalVendidosElement.textContent = totalVendidos;
    }

    if (totalGananciaBrutaElement) {
        const totalGananciaBruta = productos.reduce((sum, p) => sum + (p.vendidos * (p.precio - p.costo)), 0);
        totalGananciaBrutaElement.textContent = totalGananciaBruta.toFixed(2);
    }
}

// --- Funciones Globales de Navegación y Sesión ---

// Función para alternar el menú de navegación (movida aquí para ser global)
function toggleMenu() {
    document.getElementById("navMenu").classList.toggle("open");
}

// Estos dos listeners aseguran que `cargarDashboard` se ejecute cuando la página esté lista
// (DOMContentLoaded) o cuando se regrese a ella desde la caché del navegador (pageshow).
// Importante: `cargarDashboard` ahora maneja internamente la ausencia de elementos del dashboard,
// por lo que es seguro llamarla en todas las páginas.
window.addEventListener("pageshow", cargarDashboard);
document.addEventListener("DOMContentLoaded", cargarDashboard);

// Opcional: Funciones de sesión si las tienes aquí
/*
function cerrarSesion() {
    sessionStorage.removeItem("sesionIniciada");
    window.location.href = "login.html";
}
*/
