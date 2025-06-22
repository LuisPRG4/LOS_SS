// js/mermas.js (CÓDIGO CORREGIDO)

// Almacenaremos las mermas en una variable local, pero su fuente principal será IndexedDB
let mermas = []; 
let productosDisponibles = []; // Para almacenar los productos del inventario
let editMermaId = null; // Usaremos el ID único de la merma para la edición

// --- IMPORTANTE: Asegúrate de que las siguientes funciones estén disponibles globalmente desde db.js ---
//    - obtenerTodosLosProductos()
//    - obtenerProductoPorId(id)  <-- ESTA FUNCIÓN ES CLAVE Y DEBE VENIR DE db.js
//    - actualizarProducto(id, producto)
//    - abrirDB() // Para asegurar que la DB esté abierta al inicio

// --- Elementos del DOM ---
const selectProductoMerma = document.getElementById("productoMerma");
const inputCantidadMerma = document.getElementById("cantidadMerma");
const selectMotivoMerma = document.getElementById("motivoMerma");
const inputOtroMotivo = document.getElementById("otroMotivoInput");
const btnGuardarMerma = document.getElementById("btnGuardarMerma");
const btnCancelarEdicionMerma = document.getElementById("btnCancelarEdicionMerma");
const listaMermas = document.getElementById("listaMermas");
const buscadorMerma = document.getElementById("buscadorMerma");
const toastContainer = document.getElementById("toastContainer");

// --- Inicialización al cargar la página ---
document.addEventListener("DOMContentLoaded", async () => {
    // Asegurarse de que la base de datos esté abierta ANTES de intentar obtener productos
    await abrirDB(); // <-- Asegúrate de que esta función exista en db.js y se llame aquí.

    // 1. Cargar productos en el select de mermas desde IndexedDB
    await cargarProductosParaSelectMerma();
    
    // 2. Cargar historial de mermas (por ahora desde localStorage, te recomiendo migrar a IndexedDB)
    mermas = JSON.parse(localStorage.getItem("mermas")) || [];
    mostrarMermas(); 

    // Añadir listener para el botón de guardar merma
    btnGuardarMerma.addEventListener('click', guardarMerma);
    btnCancelarEdicionMerma.addEventListener('click', cancelarEdicionMerma);
    buscadorMerma.addEventListener('input', filtrarMermas);
    selectMotivoMerma.addEventListener('change', () => {
        if (selectMotivoMerma.value === 'Otro') {
            inputOtroMotivo.style.display = 'block';
            inputOtroMotivo.focus();
        } else {
            inputOtroMotivo.style.display = 'none';
            inputOtroMotivo.value = '';
        }
    });
});

// --- Funciones del Módulo de Mermas ---

/**
 * Carga los productos desde IndexedDB en el select de "Producto" del formulario de merma.
 */
async function cargarProductosParaSelectMerma() {
    try {
        // Usamos la función de db.js para obtener los productos
        productosDisponibles = await obtenerTodosLosProductos(); 

        // Limpiamos el select y añadimos la opción por defecto
        selectProductoMerma.innerHTML = '<option value="">Selecciona un producto</option>';

        if (productosDisponibles.length === 0) {
            const option = document.createElement("option");
            option.value = "";
            option.textContent = "No hay productos disponibles en inventario";
            selectProductoMerma.appendChild(option);
            selectProductoMerma.disabled = true; // Deshabilita el select si no hay productos
            mostrarToast("No hay productos en el inventario para registrar mermas.", "info");
            return;
        }

        // Llenamos el select con los productos obtenidos de IndexedDB
        productosDisponibles.forEach(producto => {
            const option = document.createElement("option");
            option.value = producto.id; // ¡Importante! Usamos el ID de IndexedDB del producto
            option.textContent = `${producto.nombre} (Stock: ${producto.stock ?? 0})`; // Muestra stock actual
            // Guardamos el stock actual en un atributo de datos para validación rápida
            option.dataset.stockActual = producto.stock ?? 0; 
            selectProductoMerma.appendChild(option);
        });

        selectProductoMerma.disabled = false; // Asegura que el select esté habilitado
        console.log("Productos cargados en el select de mermas desde IndexedDB.");

    } catch (error) {
        console.error("Error al cargar productos para el select de mermas:", error);
        mostrarToast("Error al cargar productos del inventario.", "error");
    }
}

/**
 * Guarda una nueva merma o actualiza una existente.
 */
async function guardarMerma() {
    const productoId = selectProductoMerma.value; // Ahora obtenemos el ID del producto
    const cantidad = parseInt(inputCantidadMerma.value);
    const motivoSeleccionado = selectMotivoMerma.value;
    const motivoPersonalizado = inputOtroMotivo.value.trim();

    // Validaciones
    if (!productoId) {
        return mostrarToast("Por favor, selecciona un producto. ⚠️", "error");
    }
    if (isNaN(cantidad) || cantidad <= 0) {
        return mostrarToast("La cantidad debe ser un número positivo. ⚠️", "error");
    }
    if (!motivoSeleccionado) {
        return mostrarToast("Por favor, selecciona un motivo. ⚠️", "error");
    }

    let motivoFinal = motivoSeleccionado === "Otro" ? motivoPersonalizado : motivoSeleccionado;
    if (!motivoFinal) {
        return mostrarToast("Por favor, especifica el otro motivo. 📝", "error");
    }

    // Obtener el producto completo de IndexedDB por su ID para validar y actualizar stock
    // **CORRECCIÓN:** Asegúrate de que obtenerProductoPorId esté globalmente disponible desde db.js
    const productoAfectado = await obtenerProductoPorId(Number(productoId)); // <-- Aseguramos que el ID es numérico

    if (!productoAfectado) {
        // console.error("Producto no encontrado en el inventario con ID:", productoId); // Para depuración
        return mostrarToast("Producto no encontrado en el inventario. 😢", "error");
    }

    // Validación de stock
    if (productoAfectado.stock < cantidad) {
        return mostrarToast(`No hay suficiente stock (${productoAfectado.stock}) para esa merma (${cantidad}). 😢`, "error");
    }

    // Determinar el nombre del producto para la merma (para mostrar en la lista)
    const nombreProductoMerma = productoAfectado.nombre;

    const mermaData = {
        id: editMermaId || Date.now(), // Usamos Date.now() como ID temporal si es nuevo
        productoId: productoId, // Guardamos el ID del producto (string si vino del select)
        nombreProducto: nombreProductoMerma, // Guardamos el nombre para mostrarlo fácil en el historial
        cantidad: cantidad,
        motivo: motivoFinal,
        fecha: new Date().toISOString().split("T")[0] // Formato YYYY-MM-DD
    };

    try {
        if (editMermaId) {
            // Lógica para actualizar merma existente
            const index = mermas.findIndex(m => m.id == editMermaId);
            if (index !== -1) {
                // Para una edición robusta:
                // 1. Revertir el stock de la merma anterior antes de aplicar la nueva cantidad
                const mermaAnterior = mermas[index];
                const productoParaRevertir = await obtenerProductoPorId(Number(mermaAnterior.productoId)); // Asegura numérico
                if (productoParaRevertir) {
                    await actualizarProducto(productoParaRevertir.id, {
                        ...productoParaRevertir,
                        stock: productoParaRevertir.stock + mermaAnterior.cantidad
                    });
                }
                
                mermas[index] = mermaData; // Actualiza el objeto merma en el array local
            }
            mostrarToast("Merma actualizada ✅", "success");
        } else {
            // Lógica para nueva merma
            mermas.push(mermaData); // Añade al array local
            mostrarToast("Merma registrada 📉", "success");
        }

        // --- Actualizar el stock del producto en IndexedDB ---
        const nuevoStock = Math.max(0, productoAfectado.stock - cantidad);
        await actualizarProducto(productoAfectado.id, { ...productoAfectado, stock: nuevoStock });

        // Guardar mermas en localStorage (¡Idealmente esto también debería ir a IndexedDB!)
        localStorage.setItem("mermas", JSON.stringify(mermas));

        mostrarMermas(); // Refrescar la lista de mermas
        limpiarFormularioMerma(); // Limpiar el formulario
        await cargarProductosParaSelectMerma(); // Recargar el select para mostrar stock actualizado
    } catch (error) {
        console.error("Error al guardar/actualizar merma y stock:", error);
        mostrarToast("Hubo un error al registrar la merma. Por favor, inténtalo de nuevo.", "error");
    }
}

/**
 * Muestra el historial de mermas.
 * @param {Array} mermasAMostrar - La lista de mermas a renderizar (puede ser filtrada).
 */
function mostrarMermas(mermasAMostrar = mermas) {
    listaMermas.innerHTML = "";

    if (mermasAMostrar.length === 0) {
        listaMermas.innerHTML = '<p>No hay mermas registradas.</p>';
        return;
    }

    mermasAMostrar.forEach(merma => {
        const li = document.createElement("li");
        li.className = "merma-card"; // Usa una clase específica para mermas
        li.innerHTML = `
            <div>
                <strong>Producto:</strong> ${merma.nombreProducto}<br>
                <strong>Cantidad:</strong> ${merma.cantidad} <br>
                <strong>Motivo:</strong> ${merma.motivo} <br>
                <strong>Fecha:</strong> ${merma.fecha}
            </div>
            <div class="merma-acciones">
                <button onclick="editarMerma('${merma.id}')" class="boton-editar">✏️ Editar</button>
                <button onclick="eliminarMerma('${merma.id}')" class="boton-eliminar">🗑️ Eliminar</button>
            </div>
        `;
        listaMermas.appendChild(li);
    });
}

/**
 * Carga los datos de una merma para su edición.
 * Ahora usa el ID de la merma, no el índice.
 */
async function editarMerma(idMerma) {
    const merma = mermas.find(m => m.id == idMerma);
    if (!merma) {
        mostrarToast("Merma no encontrada para editar.", "error");
        return;
    }

    editMermaId = merma.id; // Guarda el ID de la merma que se está editando

    // Cargar el producto en el select
    // Esto asegura que el select se seleccione correctamente incluso si los productos se recargaron
    await cargarProductosParaSelectMerma(); 
    selectProductoMerma.value = merma.productoId; // Selecciona el producto correcto por su ID
    
    inputCantidadMerma.value = merma.cantidad;

    const motivoSelect = document.getElementById("motivoMerma");
    const otroMotivoInput = document.getElementById("otroMotivoInput");

    // Verificar si el motivo es uno de los predefinidos
    const predefinedMotives = ["Vencido", "Dañado", "Roto"];
    if (predefinedMotives.includes(merma.motivo)) {
        motivoSelect.value = merma.motivo;
        otroMotivoInput.style.display = "none";
        otroMotivoInput.value = "";
    } else {
        motivoSelect.value = "Otro";
        otroMotivoInput.style.display = "block";
        otroMotivoInput.value = merma.motivo; // Si es un motivo personalizado, lo pone en el campo "Otro"
    }

    btnGuardarMerma.textContent = "Actualizar Merma";
    btnCancelarEdicionMerma.style.display = "inline-block";

    // Pequeño retardo para asegurar que el DOM se actualice antes de hacer scroll
    setTimeout(() => {
        document.getElementById("formularioMerma").scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
}

/**
 * Cancela la edición de una merma y limpia el formulario.
 */
function cancelarEdicionMerma() {
    limpiarFormularioMerma();
    editMermaId = null; // Resetea el ID de edición
    btnGuardarMerma.textContent = "Guardar Merma";
    btnCancelarEdicionMerma.style.display = "none";
    mostrarToast("Edición cancelada ❌", "info");
}

/**
 * Elimina una merma y revierte el stock del producto.
 */
async function eliminarMerma(idMerma) {
    if (!confirm("¿Estás seguro de eliminar esta merma? El stock del producto será revertido.")) {
        return;
    }

    try {
        const mermaAEliminar = mermas.find(m => m.id == idMerma);
        if (!mermaAEliminar) {
            mostrarToast("Merma no encontrada para eliminar.", "error");
            return;
        }

        // Revertir el stock del producto
        const productoOriginal = await obtenerProductoPorId(Number(mermaAEliminar.productoId)); // Asegura numérico
        if (productoOriginal) {
            const nuevoStock = productoOriginal.stock + mermaAEliminar.cantidad;
            await actualizarProducto(productoOriginal.id, { ...productoOriginal, stock: nuevoStock });
            await cargarProductosParaSelectMerma(); // Recargar el select para reflejar el stock revertido
        }

        // Eliminar la merma del array local
        mermas = mermas.filter(m => m.id != idMerma);
        localStorage.setItem("mermas", JSON.stringify(mermas)); // Actualizar localStorage

        mostrarMermas();
        mostrarToast("Merma eliminada y stock revertido ✅", "success");
    } catch (error) {
        console.error("Error al eliminar merma o revertir stock:", error);
        mostrarToast("Hubo un error al eliminar la merma.", "error");
    }
}

/**
 * Filtra las mermas mostradas en el historial.
 */
function filtrarMermas() {
    const textoBusqueda = buscadorMerma.value.toLowerCase();
    const mermasFiltradas = mermas.filter(merma => 
        merma.nombreProducto.toLowerCase().includes(textoBusqueda) ||
        merma.motivo.toLowerCase().includes(textoBusqueda) ||
        (merma.otroMotivo && merma.otroMotivo.toLowerCase().includes(textoBusqueda))
    );
    mostrarMermas(mermasFiltradas);
}

// --- Funciones de Utilidad ---

/**
 * Muestra mensajes de notificación (toast).
 * @param {string} mensaje - El mensaje a mostrar.
 * @param {string} tipo - El tipo de mensaje (e.g., 'success', 'error', 'info').
 */
function mostrarToast(mensaje, tipo = 'info') {
    if (!toastContainer) {
        console.warn("toastContainer no encontrado. No se puede mostrar el toast.");
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

/**
 * Limpia el formulario de registro de mermas.
 */
function limpiarFormularioMerma() {
    selectProductoMerma.value = "";
    inputCantidadMerma.value = "";
    selectMotivoMerma.value = "";
    inputOtroMotivo.value = "";
    inputOtroMotivo.style.display = "none";
    btnGuardarMerma.textContent = "Guardar Merma";
    btnCancelarEdicionMerma.style.display = "none";
    editMermaId = null; // Resetea el estado de edición
}

/**
 * Muestra u oculta las opciones de exportación.
 */
function toggleOpcionesExport() {
    const opciones = document.getElementById("opcionesExportMerma");
    opciones.style.display = opciones.style.display === "none" ? "block" : "none";
}

// --- Funciones de exportación (ejemplos, requieren librerías externas) ---
// Mantenemos estas funciones como estaban, ya que no dependen directamente de la DB
function exportarMermasExcel() {
    mostrarToast("Funcionalidad de exportar a Excel en desarrollo...", "info");
    let tabla = [["Producto", "Cantidad", "Motivo", "Fecha"]];
    mermas.forEach(m => tabla.push([m.nombreProducto, m.cantidad, m.motivo, m.fecha])); // Usar nombreProducto

    let csv = tabla.map(fila => fila.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" }); // Añadir charset
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "mermas.csv";
    document.body.appendChild(a); // Es buena práctica añadirlo al DOM antes de hacer click
    a.click();
    document.body.removeChild(a); // Limpiar después de la descarga
    URL.revokeObjectURL(url); // Liberar la URL del objeto
}

function exportarMermasPDF() {
    mostrarToast("Funcionalidad de exportar a PDF en desarrollo...", "info");
    const ventana = window.open("", "_blank");
    ventana.document.write("<!DOCTYPE html><html lang='es'><head><title>Historial de Mermas</title>");
    ventana.document.write("<style>table {width:100%; border-collapse:collapse;} th, td {border:1px solid black; padding: 8px; text-align: left;}</style>");
    ventana.document.write("</head><body><h1>Historial de Mermas</h1>");
    ventana.document.write("<table>");
    ventana.document.write("<tr><th>Producto</th><th>Cantidad</th><th>Motivo</th><th>Fecha</th></tr>");

    mermas.forEach(m => {
        ventana.document.write(`<tr>
            <td>${m.nombreProducto}</td>
            <td>${m.cantidad}</td>
            <td>${m.motivo}</td>
            <td>${m.fecha}</td>
        </tr>`);
    });

    ventana.document.write("</table></body></html>");
    ventana.document.close(); // Cierra el flujo de escritura
    ventana.print();
    // ventana.close(); // Comentar o usar con precaución, algunos navegadores bloquean el cierre automático
}