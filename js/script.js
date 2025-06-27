const STOCK_BAJO_UMBRAL = 0;

// --- Funciones del Dashboard ---
async function cargarDashboard() {
    // 1. Asegurarse de que la base de datos esté abierta.
    await abrirDB(); // Asegúrate de que abrirDB() esté definido en db.js

    // 2. Cargar datos desde IndexedDB
    const productos = await obtenerTodosLosProductos(); // Asegúrate de que obtenerTodosLosProductos() esté definido en db.js
    const ventas = await obtenerTodasLasVentas();     // Asegúrate de que obtenerTodasLasVentas() esté definido en db.js

    // --- Lógica para Ventas Hoy y Ventas Semana ---
    // Verificar si los elementos existen antes de intentar manipularlos
    const ventasHoyElement = document.getElementById("ventasHoy");
    const ventasSemanaElement = document.getElementById("ventasSemana");

    if (ventasHoyElement || ventasSemanaElement) { // Solo ejecuta si al menos uno de los elementos existe
        const hoy = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
        
        const hace7Dias = new Date();
        hace7Dias.setDate(hace7Dias.getDate() - 7);
        const fecha7dias = hace7Dias.toISOString().slice(0, 10); // "YYYY-MM-DD"

        let totalHoy = 0;
        let totalSemana = 0;

        ventas.forEach((venta) => {
            // Asegurarse de que 'monto' o 'ingreso' existan y sean numéricos.
            const monto = parseFloat(venta.monto ?? venta.ingreso) || 0; // Usar 'ingreso' como fallback para 'monto'
            
            // ¡MODIFICADO! Extraer solo la parte de la fecha (YYYY-MM-DD) de la venta
            const ventaFechaDia = venta.fecha ? venta.fecha.slice(0, 10) : ''; 

            if (ventaFechaDia === hoy) { // Comparar solo la parte del día con 'hoy'
                totalHoy += monto;
            }
            if (ventaFechaDia >= fecha7dias) { // Comparar solo la parte del día con 'fecha7dias'
                totalSemana += monto;
            }
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
            ul.className = "list-disc list-inside text-red-700"; 

            productosBajoStock.forEach((p) => {
                let li = document.createElement("li");
                const minText = (p.stockMin !== undefined && p.stockMin !== null) ? `Mín: ${p.stockMin}` : `Umbral: ${STOCK_BAJO_UMBRAL}`;
                
                // *** INICIO DE CAMBIO IMPORTANTE AQUI ***
                li.innerHTML = `
                    <img src="icons/advertencia.png" alt="Alerta de Stock Bajo" class="stock-alert-icon"> 
                    ${p.nombre} - Stock bajo: ${p.stock} ${p.unidadMedida || 'unidad(es)'} (${minText})
                    <button class="btn-ir-inventario" onclick="irAInventario('${p.id}')">
                        <i class="fas fa-box"></i> Ir a Inventario
                    </button>
                `;
                // *** FIN DE CAMBIO IMPORTANTE AQUI ***

                ul.appendChild(li);
            });
            alertaStockContainer.appendChild(ul);
        } else {
            // Si no hay productos con stock bajo, mostramos un mensaje positivo
            alertaStockContainer.innerHTML = `<p class="text-green-600">✅ ¡Excelente! No hay productos con stock bajo.</p>`;
        }
    }

    // --- Lógica para Total Productos, Total Stock, Total Vendidos, Total Ganancia Bruta (añadido previamente) ---
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

// *** NUEVA FUNCIÓN PARA IR A INVENTARIO ***
function irAInventario(productoId = null) {
    // Guarda el ID del producto en el sessionStorage para recuperarlo en el módulo de Inventario
    if (productoId) {
        sessionStorage.setItem('productoParaEditar', productoId);
    } else {
        sessionStorage.removeItem('productoParaEditar'); // Limpiar si no se pasa un ID
    }
    window.location.href = "inventario.html";
}

// --- Funciones Globales de Navegación y Sesión ---

// Función para alternar el menú de navegación (movida aquí para ser global)
function toggleMenu() {
    document.getElementById("navMenu").classList.toggle("open");
}

// Estos dos listeners aseguran que `cargarDashboard` se ejecute cuando la página esté lista
// (DOMContentLoaded) o cuando se regrese a ella desde la caché del navegador (pageshow).
window.addEventListener("pageshow", cargarDashboard);
document.addEventListener("DOMContentLoaded", cargarDashboard);
