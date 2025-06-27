// js/mermas.js (CÓDIGO COMPLETO Y RECOMENDADO - MIGRADO A INDEXEDDB Y CON MODERN-CARD)

// Almacenaremos las mermas en una variable local, pero su fuente principal será IndexedDB
let mermas = []; 
let productosDisponibles = []; // Para almacenar los productos del inventario
let editMermaId = null; // Usaremos el ID único de la merma para la edición

// --- IMPORTANTE: Asegúrate de que las siguientes funciones estén disponibles globalmente desde db.js ---
//     - obtenerTodosLosProductos()
//     - obtenerProductoPorId(id)
//     - actualizarProducto(id, producto)
//     - abrirDB()
//     - agregarMermaDB(merma) // NUEVA FUNCIÓN PARA AÑADIR A MERMAS_DB EN db.js
//     - obtenerTodasLasMermasDB() // NUEVA FUNCIÓN PARA OBTENER DESDE MERMAS_DB EN db.js
//     - actualizarMermaDB(id, merma) // NUEVA FUNCIÓN PARA ACTUALIZAR EN MERMAS_DB EN db.js
//     - eliminarMermaDB(id) // NUEVA FUNCIÓN PARA ELIMINAR EN MERMAS_DB EN db.js
//     - mostrarConfirmacion(mensaje, titulo) // Para modals bonitos en lugar de confirm()
//     - mostrarToast(mensaje, tipo) // Para notificaciones

// --- Elementos del DOM ---
const selectProductoMerma = document.getElementById("productoMerma");
const inputCantidadMerma = document.getElementById("cantidadMerma");
const selectMotivoMerma = document.getElementById("motivoMerma");
const inputOtroMotivo = document.getElementById("otroMotivoInput");
const btnGuardarMerma = document.getElementById("btnGuardarMerma");
const btnCancelarEdicionMerma = document.getElementById("btnCancelarEdicionMerma");
const listaMermas = document.getElementById("listaMermas"); // Ahora un div con clase 'mermas-grid'
const buscadorMerma = document.getElementById("buscadorMerma");
// const toastContainer = document.getElementById("toastContainer"); // Asumimos que mostrarToast ya lo maneja

// --- Inicialización al cargar la página ---
document.addEventListener("DOMContentLoaded", async () => {
    try {
        // Asegurarse de que la base de datos esté abierta ANTES de intentar obtener productos
        await abrirDB(); 

        // 1. Cargar productos en el select de mermas desde IndexedDB
        await cargarProductosParaSelectMerma();
        
        // 2. Cargar historial de mermas desde IndexedDB
        mermas = await obtenerTodasLasMermasDB(); // <-- AHORA DESDE INDEXEDDB
        mostrarMermas(); 

        // Añadir listeners para los botones y campos
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
    } catch (error) {
        console.error("Error al inicializar la aplicación de mermas:", error);
        mostrarToast("Error grave al cargar datos de mermas 😥", "error");
    }
});

// --- Funciones del Módulo de Mermas ---

/**
 * Carga los productos desde IndexedDB en el select de "Producto" del formulario de merma.
 */
async function cargarProductosParaSelectMerma() {
    try {
        productosDisponibles = await obtenerTodosLosProductos(); 
        selectProductoMerma.innerHTML = '<option value="">Selecciona un producto</option>';

        if (productosDisponibles.length === 0) {
            const option = document.createElement("option");
            option.value = "";
            option.textContent = "No hay productos disponibles en inventario";
            selectProductoMerma.appendChild(option);
            selectProductoMerma.disabled = true;
            mostrarToast("No hay productos en el inventario para registrar mermas.", "info");
            return;
        }

        productosDisponibles.forEach(producto => {
            const option = document.createElement("option");
            option.value = producto.id; // Usamos el ID de IndexedDB del producto
            option.textContent = `${producto.nombre} (Stock: ${producto.stock ?? 0} ${producto.unidadMedida || 'unidad(es)'})`; // Muestra stock actual y unidad
            option.dataset.stockActual = producto.stock ?? 0; 
            selectProductoMerma.appendChild(option);
        });

        selectProductoMerma.disabled = false;
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
    const productoId = selectProductoMerma.value;
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

    const productoAfectado = await obtenerProductoPorId(Number(productoId));

    if (!productoAfectado) {
        return mostrarToast("Producto no encontrado en el inventario. 😢", "error");
    }

    // Validación de stock
    if (productoAfectado.stock < cantidad) {
        return mostrarToast(`No hay suficiente stock (${productoAfectado.stock} ${productoAfectado.unidadMedida || 'unidad(es)'}) para esa merma (${cantidad}). 😢`, "error");
    }

    const mermaData = {
        productoId: Number(productoId), // Aseguramos que el ID es numérico
        nombreProducto: productoAfectado.nombre,
        cantidad: cantidad,
        motivo: motivoFinal,
        fecha: new Date().toISOString().slice(0, 10), // Formato YYYY-MM-DD
        hora: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }), // Formato HH:MM
        unidadMedida: productoAfectado.unidadMedida || 'unidad(es)' // Incluir unidad de medida
    };

    try {
        if (editMermaId) {
            // Edición de merma existente
            const mermaAnterior = mermas.find(m => m.id === editMermaId); // Encontrar la merma original en el array local
            if (mermaAnterior) {
                // Revertir el stock del producto de la merma anterior antes de aplicar la nueva cantidad
                const productoOriginalAlEditar = await obtenerProductoPorId(Number(mermaAnterior.productoId));
                if (productoOriginalAlEditar) {
                    const stockRevertido = productoOriginalAlEditar.stock + mermaAnterior.cantidad;
                    await actualizarProducto(productoOriginalAlEditar.id, { ...productoOriginalAlEditar, stock: stockRevertido });
                }
            }
            
            // Asignar el ID de edición a los datos de la merma para la actualización
            mermaData.id = editMermaId; 
            await actualizarMermaDB(editMermaId, mermaData); // Actualizar en IndexedDB
            mostrarToast("Merma actualizada ✅", "success");
        } else {
            // Nueva merma
            await agregarMermaDB(mermaData); // Añadir a IndexedDB
            mostrarToast("Merma registrada 📉", "success");
        }

        // --- Actualizar el stock del producto en IndexedDB (con la nueva cantidad de merma) ---
        const nuevoStock = Math.max(0, productoAfectado.stock - cantidad);
        await actualizarProducto(productoAfectado.id, { ...productoAfectado, stock: nuevoStock });

        // Recargar las mermas desde la DB y actualizar UI
        mermas = await obtenerTodasLasMermasDB(); 
        mostrarMermas(); 
        limpiarFormularioMerma(); 
        await cargarProductosParaSelectMerma(); // Recargar el select para mostrar stock actualizado
    } catch (error) {
        console.error("Error al guardar/actualizar merma y stock:", error);
        mostrarToast("Hubo un error al registrar la merma. Por favor, inténtalo de nuevo.", "error");
    }
}

/**
 * Muestra el historial de mermas en el DOM.
 * @param {Array} mermasAMostrar - La lista de mermas a renderizar (puede ser filtrada).
 */
function mostrarMermas(mermasAMostrar = mermas) {
    listaMermas.innerHTML = ""; // Limpia la lista antes de volver a renderizar

    if (mermasAMostrar.length === 0) {
        listaMermas.innerHTML = `<p class="mensaje-lista">No hay mermas registradas.</p>`;
        return;
    }

    // Ordenar mermas por fecha más reciente primero
    mermasAMostrar.sort((a, b) => {
        // Combinar fecha y hora para una ordenación precisa si ambos existen
        const dateTimeA = a.fecha + (a.hora ? `T${a.hora}` : '');
        const dateTimeB = b.fecha + (b.hora ? `T${b.hora}` : '');
        return new Date(dateTimeB) - new Date(dateTimeA);
    });

    mermasAMostrar.forEach((merma) => {
        const card = crearCardMerma(merma); // Llama a la nueva función crearCardMerma
        listaMermas.appendChild(card);
    });
}

/**
 * Función para crear la tarjeta HTML de una merma con el estilo "modern-card"
 */
function crearCardMerma(merma) {
    const card = document.createElement("div");
    card.className = "modern-card"; // Aplica la clase general de tarjeta

    // Formatear la fecha para que se vea bien
    const fechaMerma = new Date(merma.fecha).toLocaleDateString('es-ES', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    // La hora se guarda por separado en 'merma.hora'
    const horaMerma = merma.hora || 'N/D'; 

    card.innerHTML = `
        <div class="card-header">
            <h3 title="${merma.nombreProducto}">${merma.nombreProducto}</h3>
            <span class="card-meta">Fecha: ${fechaMerma}</span>
        </div>
        <div class="card-content">
            <p><strong>Cantidad:</strong> ${merma.cantidad} ${merma.unidadMedida || 'unidad(es)'}</p>
            <p><strong>Motivo:</strong> ${merma.motivo}</p>
            <p><strong>Hora:</strong> ${horaMerma}</p>
        </div>
        <div class="card-actions">
            <button onclick="editarMerma(${merma.id})" class="btn-edit">✏️ Editar</button>
            <button onclick="eliminarMerma(${merma.id})" class="btn-delete">🗑️ Eliminar</button>
        </div>
    `;
    return card;
}


/**
 * Carga los datos de una merma para su edición.
 * Ahora usa el ID de la merma, no el índice.
 */
async function editarMerma(idMerma) {
    const merma = mermas.find(m => m.id === idMerma); // Asegúrate de comparar con === para tipo
    if (!merma) {
        mostrarToast("Merma no encontrada para editar.", "error");
        return;
    }

    editMermaId = merma.id; // Guarda el ID de la merma que se está editando

    // Cargar el producto en el select (necesitamos cargarlos todos primero)
    await cargarProductosParaSelectMerma(); 
    selectProductoMerma.value = merma.productoId; // Selecciona el producto correcto por su ID
    
    inputCantidadMerma.value = merma.cantidad;

    const motivoSelect = document.getElementById("motivoMerma");
    const otroMotivoInput = document.getElementById("otroMotivoInput");

    // Verificar si el motivo es uno de los predefinidos
    const predefinedMotives = ["Vencido", "Dañado", "Roto"]; // Asegúrate de que esto coincide con tus <option>
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
    const confirmacion = await mostrarConfirmacion(
        "¿Estás seguro de eliminar esta merma? El stock del producto será revertido.",
        "Eliminar Merma"
    );

    if (!confirmacion) {
        mostrarToast("Eliminación cancelada.", "info");
        return;
    }

    try {
        const mermaAEliminar = mermas.find(m => m.id === idMerma); // Buscar por ID
        if (!mermaAEliminar) {
            mostrarToast("Merma no encontrada para eliminar.", "error");
            return;
        }

        // Revertir el stock del producto
        const productoOriginal = await obtenerProductoPorId(Number(mermaAEliminar.productoId)); 
        if (productoOriginal) {
            const nuevoStock = productoOriginal.stock + mermaAEliminar.cantidad;
            await actualizarProducto(productoOriginal.id, { ...productoOriginal, stock: nuevoStock });
            await cargarProductosParaSelectMerma(); // Recargar el select para reflejar el stock revertido
        }

        // Eliminar la merma de IndexedDB
        await eliminarMermaDB(idMerma); // USAR ELIMINARMERMADB DE db.js

        // Recargar mermas desde la DB y actualizar UI
        mermas = await obtenerTodasLasMermasDB(); 
        mostrarMermas();
        mostrarToast("Merma eliminada y stock revertido ✅", "success");
    } catch (error) {
        console.error("Error al eliminar merma o revertir stock:", error);
        mostrarToast("Hubo un error al eliminar la merma. 😔", "error");
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
        (merma.otroMotivo && merma.otroMotivo.toLowerCase().includes(textoBusqueda)) ||
        merma.fecha.includes(textoBusqueda) // Permitir buscar por fecha
    );
    mostrarMermas(mermasFiltradas);
}

// --- Funciones de Utilidad ---

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

// --- Funciones de exportación (requieren librerías como jsPDF y SheetJS) ---
// Asegúrate de tener estas librerías cargadas en tu HTML (ejemplo en mermas.html):
// <script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.17.0/xlsx.full.min.js"></script>
// <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
// <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.25/jspdf.autotable.min.js"></script>

async function exportarMermasExcel() {
    try {
        const mermasData = await obtenerTodasLasMermasDB();
        if (mermasData.length === 0) {
            mostrarToast("No hay mermas para exportar a Excel.", "info");
            return;
        }

        const dataForExcel = mermasData.map(m => ({
            "Producto": m.nombreProducto,
            "Cantidad": m.cantidad,
            "Unidad de Medida": m.unidadMedida || 'unidad(es)',
            "Motivo": m.motivo,
            "Fecha": m.fecha,
            "Hora": m.hora
        }));

        const ws = XLSX.utils.json_to_sheet(dataForExcel);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Mermas");
        
        const fecha = new Date().toISOString().slice(0, 10);
        XLSX.writeFile(wb, `Reporte_Mermas_${fecha}.xlsx`);
        mostrarToast("📊 Mermas exportadas a Excel con éxito!", "success");
    } catch (error) {
        console.error("Error al exportar mermas a Excel:", error);
        mostrarToast("Error al exportar mermas a Excel. 😔", "error");
    }
}

async function exportarMermasPDF() {
    try {
        const mermasData = await obtenerTodasLasMermasDB();
        if (mermasData.length === 0) {
            mostrarToast("No hay mermas para exportar a PDF.", "info");
            return;
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        doc.setFontSize(18);
        doc.text("Reporte de Mermas", doc.internal.pageSize.getWidth() / 2, 20, { align: 'center' });
        doc.setFontSize(10);
        doc.text(`Fecha de Reporte: ${new Date().toLocaleString()}`, doc.internal.pageSize.getWidth() / 2, 30, { align: 'center' });

        const tableColumn = ["Producto", "Cantidad", "Unidad", "Motivo", "Fecha", "Hora"];
        const tableRows = mermasData.map(m => [
            m.nombreProducto,
            m.cantidad,
            m.unidadMedida || 'unidad(es)',
            m.motivo,
            m.fecha,
            m.hora
        ]);

        doc.autoTable({
            startY: 40,
            head: [tableColumn],
            body: tableRows,
            theme: 'striped',
            styles: { fontSize: 8, cellPadding: 2 },
            headStyles: { fillColor: [218, 165, 32], textColor: [255, 255, 255], fontStyle: 'bold' },
            didDrawPage: function (data) {
                let str = "Página " + doc.internal.getNumberOfPages();
                doc.setFontSize(10);
                doc.text(str, doc.internal.pageSize.getWidth() - 10, doc.internal.pageSize.getHeight() - 10, { align: 'right' });
            }
        });

        const fecha = new Date().toISOString().slice(0, 10);
        doc.save(`Reporte_Mermas_${fecha}.pdf`);
        mostrarToast("📄 Mermas exportadas a PDF con éxito!", "success");

    } catch (error) {
        console.error("Error al exportar mermas a PDF:", error);
        mostrarToast("Error al exportar mermas a PDF. 😔", "error");
    }
}

// Asegurarse de que mostrarConfirmacion esté disponible (asumiendo que está en db.js o en un archivo global)
// Si no la tienes definida, puedes añadir una versión básica aquí:
if (typeof mostrarConfirmacion !== 'function') {
    window.mostrarConfirmacion = async (message, title = "Confirmar") => {
        return new Promise(resolve => {
            const result = confirm(`${title}\n\n${message}`); // Fallback to native confirm
            resolve(result);
        });
    };
}

// FUNCIONES PARA EXPORTAR DATOS DE MERMAS 

// === Exportar mermas ===
document.getElementById('exportarMermasBtn').addEventListener('click', async () => {
    const mermas = await obtenerTodasLasMermasDB(); // usa tu función existente
    if (mermas.length === 0) {
        mostrarToast('No hay mermas registradas.', "info");
        return;
    }

    const jsonContent = JSON.stringify(mermas, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mermas.json';
    a.click();
    URL.revokeObjectURL(url);
    mostrarToast('Mermas exportadas ✅');
});

// === Importar mermas ===
document.getElementById('importarMermasInput').addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file || file.type !== 'application/json') {
        mostrarToast('Archivo inválido. Solo se acepta JSON.', "error");
        return;
    }

    const confirmacion = await mostrarConfirmacion("¿Importar estas mermas?", "Confirmar");
    if (!confirmacion) {
        mostrarToast("Importación cancelada ❌");
        return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const mermasImportadas = JSON.parse(e.target.result);
            let agregadas = 0;
            for (const merma of mermasImportadas) {
                if (!merma || !merma.nombreProducto) continue;
                delete merma.id;
                await agregarMermaDB(merma);
                agregadas++;
            }
            mostrarToast(`${agregadas} mermas importadas ✅`);

            // --- ACTUALIZAR VARIABLE LOCAL Y UI ---
            mermas = await obtenerTodasLasMermasDB(); // Recarga desde IndexedDB
            mostrarMermas(); // Actualiza la lista visible en la página

        } catch (err) {
            mostrarToast("Error al importar JSON ❌", "error");
            console.error(err);
        }
    };
    reader.readAsText(file);
});

// === Descargar plantilla de mermas ===
document.getElementById('descargarPlantillaMermasBtn').addEventListener('click', () => {
        const ejemplo = [
        {
            productoId: 1,
            nombreProducto: "Ejemplo Producto",
            motivo: "Producto vencido",
            cantidad: 5,
            unidadMedida: "unidad",
            fecha: new Date().toISOString().slice(0, 10),
            hora: "12:00"
            }
        ];

    const blob = new Blob([JSON.stringify(ejemplo, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'plantilla_mermas.json';
    a.click();
    URL.revokeObjectURL(url);
    mostrarToast("Plantilla descargada ✅");
});
