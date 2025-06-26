// js/proveedores.js (CÓDIGO CORREGIDO Y RECOMENDADO con Modern Card)

let proveedores = [];
let editProveedorId = null; // Ahora usamos ID real (IndexedDB)

document.addEventListener("DOMContentLoaded", async () => {
    await abrirDB();
    proveedores = await obtenerTodosLosProveedoresDB() || [];
    mostrarProveedores();
});

// Guardar o actualizar proveedor
async function agregarProveedor() {
    const nombre = document.getElementById("nombreProveedor").value.trim();
    const empresa = document.getElementById("empresa").value.trim();
    const telefono = document.getElementById("telefono").value.trim();
    const productosSuministra = document.getElementById("productos").value.trim(); // Renombrada para mayor claridad

    if (!nombre) {
        mostrarToast("El nombre del proveedor es obligatorio ⚠️", "error");
        return;
    }

    const nuevoProveedor = { 
        nombre: nombre, 
        empresa: empresa, 
        telefono: telefono, 
        productos: productosSuministra // Usamos el nuevo nombre
    };

    if (editProveedorId === null) {
        try {
            const id = await agregarProveedorDB(nuevoProveedor);
            nuevoProveedor.id = id; // Asignar el ID de la DB al objeto local
            proveedores.push(nuevoProveedor);
            mostrarToast("Proveedor agregado con éxito 🚚", "success");
        } catch (e) {
            console.error("Error al agregar proveedor:", e);
            mostrarToast("Error al guardar proveedor 😔", "error");
        }
    } else {
        try {
            nuevoProveedor.id = editProveedorId; // Aseguramos que el ID se mantiene para la actualización
            await actualizarProveedorDB(editProveedorId, nuevoProveedor);
            // Actualizar el array local 'proveedores' después de la actualización en la DB
            const index = proveedores.findIndex(p => p.id === editProveedorId);
            if (index !== -1) proveedores[index] = nuevoProveedor;
            
            mostrarToast("Proveedor actualizado ✏️", "success");
            editProveedorId = null; // Resetear ID de edición
            document.getElementById("btnGuardarProveedor").textContent = "Guardar Proveedor";
            document.getElementById("btnCancelarProveedor").style.display = "none";
        } catch (e) {
            console.error("Error al actualizar proveedor:", e);
            mostrarToast("Error al actualizar proveedor 😔", "error");
        }
    }

    mostrarProveedores(); // Volver a renderizar la lista
    limpiarFormulario(); // Limpiar el formulario
}

// Función para crear la tarjeta HTML de un proveedor con el estilo "modern-card"
function crearCardProveedor(proveedor) {
    const card = document.createElement("div");
    card.className = "modern-card"; // Aplica la clase general de tarjeta

    card.innerHTML = `
        <div class="card-header">
            <h3 title="${proveedor.nombre}">${proveedor.nombre}</h3>
            <span class="card-meta">Empresa: ${proveedor.empresa || 'N/D'}</span>
        </div>
        <div class="card-content">
            <p><strong>Teléfono:</strong> ${proveedor.telefono || 'No especificado'}</p>
            <p><strong>Productos:</strong> ${proveedor.productos || 'No especificados'}</p>
        </div>
        <div class="card-actions">
            <button onclick="editarProveedor(${proveedor.id})" class="btn-edit">✏️ Editar</button>
            <button onclick="eliminarProveedor(${proveedor.id})" class="btn-delete">🗑️ Eliminar</button>
        </div>
    `;
    return card;
}

// Mostrar lista de proveedores (ahora usa crearCardProveedor)
function mostrarProveedores(filtrados = proveedores) {
    if (!Array.isArray(filtrados)) filtrados = [];
    const lista = document.getElementById("listaProveedores"); // Este es ahora un <div> con clase 'proveedores-grid'
    lista.innerHTML = "";

    if (filtrados.length === 0) {
        lista.innerHTML = `<p class="mensaje-lista">No hay proveedores registrados.</p>`;
        return;
    }

    filtrados.forEach((proveedor) => {
        const card = crearCardProveedor(proveedor); // Crea la tarjeta usando la nueva función
        lista.appendChild(card);
    });
}

// Editar
async function editarProveedor(id) { // Asíncrona por si necesitas ir a la DB para cargar algo más
    const proveedor = proveedores.find(p => p.id === id); // Busca el proveedor por su ID
    if (!proveedor) {
        mostrarToast("Proveedor no encontrado para edición.", "error");
        return;
    }

    document.getElementById("nombreProveedor").value = proveedor.nombre;
    document.getElementById("empresa").value = proveedor.empresa;
    document.getElementById("telefono").value = proveedor.telefono;
    document.getElementById("productos").value = proveedor.productos;

    editProveedorId = proveedor.id; // Guarda el ID para la edición
    document.getElementById("btnGuardarProveedor").textContent = "Actualizar Proveedor";
    document.getElementById("btnCancelarProveedor").style.display = "inline-block";

    document.getElementById("nombreProveedor").scrollIntoView({ behavior: "smooth", block: "start" });
}

// Eliminar (ahora usa mostrarConfirmacion)
async function eliminarProveedor(id) {
    // Usamos el modal de confirmación personalizado
    const confirmacion = await mostrarConfirmacion(
        "¿Estás seguro de eliminar este proveedor? Esta acción no se puede deshacer.",
        "Eliminar Proveedor"
    );

    if (confirmacion) {
        try {
            await eliminarProveedorDB(id); // Función de db.js
            // Después de eliminar de la DB, actualizamos el array local y la UI
            proveedores = proveedores.filter(p => p.id !== id);
            mostrarProveedores();
            mostrarToast("Proveedor eliminado 🗑️", "success");
        } catch (e) {
            console.error("Error al eliminar proveedor:", e);
            mostrarToast("Error al eliminar proveedor 😔", "error");
        }
    } else {
        mostrarToast("Eliminación de proveedor cancelada.", "info");
    }
}

// Cancelar edición
function cancelarEdicionProveedor() {
    editProveedorId = null;
    limpiarFormulario();
    document.getElementById("btnGuardarProveedor").textContent = "Guardar Proveedor";
    document.getElementById("btnCancelarProveedor").style.display = "none";
    mostrarToast("Edición cancelada ❌", "info");
}

// Filtro
function filtrarProveedores() {
    const filtro = document.getElementById("buscadorProveedores").value.toLowerCase();
    const resultados = proveedores.filter(p =>
        p.nombre.toLowerCase().includes(filtro) ||
        p.empresa.toLowerCase().includes(filtro) ||
        p.telefono.toLowerCase().includes(filtro) ||
        p.productos.toLowerCase().includes(filtro)
    );
    mostrarProveedores(resultados);
}

// Limpiar form
function limpiarFormulario() {
    document.getElementById("nombreProveedor").value = "";
    document.getElementById("empresa").value = "";
    document.getElementById("telefono").value = "";
    document.getElementById("productos").value = "";
}

// Toast (asumo que esta función ya está globalmente disponible desde db.js)
// Si no lo está, asegúrate de que se carga antes o de que db.js la tiene y la exporta.
/*
function mostrarToast(mensaje, tipo = "info") {
    const toastContainer = document.getElementById("toastContainer");
    if (!toastContainer) {
        console.warn("No se encontró el contenedor de toasts. Mensaje:", mensaje);
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
*/
