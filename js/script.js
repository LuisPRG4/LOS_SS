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
    const btnRestaurarStock = document.getElementById("btnRestaurarStock");
    
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
                        <i class="fas fa-box"></i> Reponer
                    </button>
                `;
                // *** FIN DE CAMBIO IMPORTANTE AQUI ***

                ul.appendChild(li);
            });
            alertaStockContainer.appendChild(ul);
            
            // Mostrar el botón de restaurar stock
            if (btnRestaurarStock) {
                btnRestaurarStock.style.display = "block";
                btnRestaurarStock.onclick = () => abrirModalRestaurarStock(productosBajoStock);
            }
        } else {
            // Si no hay productos con stock bajo, mostramos un mensaje positivo
            alertaStockContainer.innerHTML = `<p class="text-green-600">✅ ¡Excelente! No hay productos con stock bajo.</p>`;
            
            // Ocultar el botón de restaurar stock
            if (btnRestaurarStock) {
                btnRestaurarStock.style.display = "none";
            }
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

/**
 * Abre el modal para restaurar stock de productos seleccionados
 * @param {Array} productosBajoStock - Lista de productos con stock bajo
 */
function abrirModalRestaurarStock(productosBajoStock) {
    const modal = document.getElementById("modalRestaurarStock");
    const span = modal.querySelector(".close-modal");
    const listaProductos = document.getElementById("listaProductosStock");
    const btnCancelar = document.getElementById("btnCancelarRestauracion");
    const btnConfirmar = document.getElementById("btnConfirmarRestauracion");
    
    // Limpiar la lista anterior
    listaProductos.innerHTML = "";
    
    // Llenar la lista con los productos de stock bajo y sus checkboxes
    productosBajoStock.forEach(producto => {
        const li = document.createElement("li");
        const umbral = (producto.stockMin !== undefined && producto.stockMin !== null) ? producto.stockMin : STOCK_BAJO_UMBRAL;
        
        li.innerHTML = `
            <label class="checkbox-producto">
                <input type="checkbox" data-id="${producto.id}" data-nombre="${producto.nombre}">
                <span class="checkmark"></span>
                ${producto.nombre} - Stock actual: ${producto.stock} ${producto.unidadMedida || 'unidad(es)'} (Mínimo: ${umbral})
            </label>
        `;
        
        listaProductos.appendChild(li);
    });
    
    // Mostrar el modal
    modal.style.display = "block";
    
    // Eventos para cerrar el modal
    span.onclick = cerrarModalRestaurarStock;
    btnCancelar.onclick = cerrarModalRestaurarStock;
    
    // Evento para confirmar la actualización
    btnConfirmar.onclick = async () => {
        await restaurarStockProductos();
    };
    
    // Cerrar modal al hacer clic fuera de su contenido
    window.onclick = (event) => {
        if (event.target === modal) {
            cerrarModalRestaurarStock();
        }
    };
}

/**
 * Cierra el modal de restauración de stock
 */
function cerrarModalRestaurarStock() {
    const modal = document.getElementById("modalRestaurarStock");
    modal.style.display = "none";
}

/**
 * Función auxiliar para agregar un movimiento (registro de cambio de stock)
 * @param {Object} movimiento - Objeto con los datos del movimiento
 * @returns {Promise} - Promesa que se resuelve cuando se ha agregado el movimiento
 */
async function agregarMovimiento(movimiento) {
    // Si existe la función agregarMovimientoDB, la usamos
    if (typeof agregarMovimientoDB === 'function') {
        return agregarMovimientoDB(movimiento);
    } 
    // Si no existe, usamos la función genérica agregarItem con el store 'movimientos'
    else if (typeof agregarItem === 'function') {
        return agregarItem('movimientos', movimiento);
    } 
    // Si nada existe, devolvemos una promesa rechazada
    else {
        console.error("No se encontró ninguna función para agregar movimientos");
        return Promise.reject(new Error("No se encontró ninguna función para agregar movimientos"));
    }
}

/**
 * Restaura el stock de los productos seleccionados
 */
async function restaurarStockProductos() {
    const checkboxes = document.querySelectorAll("#listaProductosStock input[type='checkbox']:checked");
    const nuevoStock = parseInt(document.getElementById("nuevoStock").value);
    
    if (checkboxes.length === 0) {
        mostrarToast("Selecciona al menos un producto para actualizar. ⚠️", "warning");
        return;
    }
    
    if (isNaN(nuevoStock) || nuevoStock < 1) {
        mostrarToast("Ingresa un valor válido para el nuevo stock. ⚠️", "warning");
        return;
    }
    
    try {
        // Obtener los productos actualizados de la base de datos
        const productosActuales = await obtenerTodosLosProductos();
        let contadorActualizados = 0;
        
        // Para cada checkbox seleccionado, actualizar el stock correspondiente
        for (const checkbox of checkboxes) {
            const productoId = checkbox.dataset.id;
            const productoNombre = checkbox.dataset.nombre;
            
            // Encontrar el producto completo en la base de datos
            const producto = productosActuales.find(p => p.id == productoId);
            
            if (producto) {
                // Crear un registro de movimiento para este cambio de stock
                const movimientoStock = {
                    fecha: new Date().toISOString(),
                    tipo: "ajuste",
                    producto: productoNombre,
                    cantidad: nuevoStock - producto.stock, // Positivo para incremento, negativo para decremento
                    stockAnterior: producto.stock,
                    stockNuevo: nuevoStock,
                    motivo: "Restauración de stock desde panel de control"
                };
                
                // Guardar el movimiento en la base de datos
                await agregarMovimiento(movimientoStock);
                
                // Actualizar el stock del producto
                producto.stock = nuevoStock;
                await actualizarProducto(productoId, producto);
                contadorActualizados++;
            }
        }
        
        // Mostrar mensaje de éxito
        mostrarToast(`${contadorActualizados} producto(s) actualizados correctamente. ✅`, "success");
        
        // Cerrar el modal
        cerrarModalRestaurarStock();
        
        // Recargar el dashboard para reflejar los cambios
        await cargarDashboard();
        
    } catch (error) {
        console.error("Error al restaurar stock:", error);
        mostrarToast("Error al actualizar los productos. ❌", "error");
    }
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

//---------------------------------------------------------------------------------------------------------
