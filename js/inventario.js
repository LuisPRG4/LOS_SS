// js/inventario.js (CÓDIGO CORREGIDO Y RECOMENDADO)

let productos = [];
let editIndex = null; // Mantiene el índice en el array 'productos' para edición
let editId = null;    // Mantiene el ID real del producto de la DB para edición

document.addEventListener("DOMContentLoaded", async () => {
    await abrirDB(); // Asegúrate de abrir la DB primero, si no lo hace db.js
    productos = await obtenerTodosLosProductos(); // Carga inicial de productos
    mostrarProductos();
    cargarProveedores();
    setupPreview();
});

function mostrarProductos(filtrados = productos) {
    const lista = document.getElementById("listaProductos");
    lista.innerHTML = ""; // Limpia la lista antes de volver a renderizar

    if (filtrados.length === 0) {
        lista.innerHTML = `<p class="text-center text-gray-400">No hay productos registrados.</p>`;
        return;
    }

    filtrados.forEach((producto, index) => { // Mantén el índice para la función 'cargarProducto' si es necesario
        const card = document.createElement("div");
        card.className = "producto-card";

        const minMax = (producto.stockMin !== undefined || producto.stockMax !== undefined)
            ? `<p><strong>Stock mínimo:</strong> ${producto.stockMin ?? 'N/D'}</p>
               <p><strong>Stock máximo:</strong> ${producto.stockMax ?? 'N/D'}</p>` : '';

        card.innerHTML = `
            <img src="${producto.imagen || 'https://via.placeholder.com/80'}" alt="Imagen" class="producto-imagen" />
            <h3>${producto.nombre}</h3>
            <p><strong>Stock:</strong> ${producto.stock}</p>
            <p><strong>Vendidos:</strong> ${producto.vendidos}</p>
            <p><strong>Proveedor:</strong> ${producto.proveedor || "N/A"}</p>
            <p><strong>Costo:</strong> $${producto.costo?.toFixed(2) || "0.00"}</p>
            <p><strong>Precio:</strong> $${producto.precio?.toFixed(2) || "0.00"}</p>
            ${minMax}
            <div class="botones-producto">
                <button onclick="cargarProducto(${index})" class="btn-editar">✏️ Editar</button>
                <button onclick="eliminarProductoDesdeUI(${producto.id})" class="btn-eliminar">🗑️ Eliminar</button>
            </div>
        `;

        lista.appendChild(card);
    });
}

// Renombré la función para evitar confusión con la de db.js
async function eliminarProductoDesdeUI(idProducto) { // Ahora recibe el ID directamente desde el onclick
    console.log("Intentando eliminar producto. ID recibido:", idProducto); 
    if (confirm("¿Estás seguro de eliminar este producto?")) {
        console.log("Confirmación aceptada para eliminar producto. ID a eliminar en DB:", idProducto); 
        try {
            // Llama a la función global 'eliminarProducto' que viene de db.js
            // Aseguramos que el ID es un número para IndexedDB
            await eliminarProducto(Number(idProducto)); 
            mostrarToast("Producto eliminado 🗑️");
        } catch (error) {
            console.error("Error al eliminar el producto de la DB:", error);
            mostrarToast("Error al eliminar el producto. 😔");
        }
        // Después de cualquier operación de DB (agregar, actualizar, eliminar),
        // recargar la lista completa y volver a mostrarla
        productos = await obtenerTodosLosProductos(); 
        mostrarProductos(); 
    } else {
        console.log("Eliminación cancelada por el usuario."); 
        mostrarToast("Eliminación cancelada ❌"); 
    }
}


function guardarProducto() {
    const nombre = document.getElementById("nombre").value.trim();
    const stock = parseInt(document.getElementById("stock").value) || 0;
    const stockMin = parseInt(document.getElementById("stockMin").value) || null;
    const stockMax = parseInt(document.getElementById("stockMax").value) || null;
    const vendidos = parseInt(document.getElementById("vendidos").value) || 0;
    const costo = parseFloat(document.getElementById("costo").value) || 0;
    const precio = parseFloat(document.getElementById("precio").value) || 0;
    const proveedor = document.getElementById("proveedor").value.trim();
    const imagenInput = document.getElementById("imagen");
    const archivo = imagenInput.files[0];

    if (!nombre) return mostrarToast("El nombre del producto es obligatorio ⚠️", "error");
    if (stock < 0 || vendidos < 0 || costo < 0 || precio < 0)
        return mostrarToast("Los valores no pueden ser negativos ⚠️", "error");

    if (archivo) {
        const lector = new FileReader();
        lector.onload = function (e) {
            const imagenBase64 = e.target.result;
            guardarProductoFinal({ nombre, stock, vendidos, costo, precio, imagen: imagenBase64, proveedor, stockMin, stockMax });
        };
        lector.readAsDataURL(archivo);
    } else {
        // Si no hay archivo nuevo, mantén la imagen existente si estás editando
        const imagenBase64 = (editIndex !== null && productos[editIndex]) ? productos[editIndex].imagen : "";
        guardarProductoFinal({ nombre, stock, vendidos, costo, precio, imagen: imagenBase64, proveedor, stockMin, stockMax });
    }
}

async function guardarProductoFinal(producto) {
    if (editIndex === null) { // Es un producto nuevo
        await agregarProducto(producto); // Función de db.js
        mostrarToast("Producto guardado ✅");
    } else { // Es un producto existente (editando)
        producto.id = editId; // Asigna el ID real al objeto producto antes de actualizar
        await actualizarProducto(editId, producto); // Función de db.js
        mostrarToast("Producto actualizado ✏️");
        // Reinicia las variables de edición
        editIndex = null;
        editId = null;
        document.getElementById("btnGuardar").textContent = "Guardar";
        document.getElementById("btnCancelar").style.display = "none";
    }

    // Siempre recargar y mostrar después de guardar/actualizar
    productos = await obtenerTodosLosProductos(); 
    mostrarProductos(); 
    limpiarCampos();
}

function cargarProducto(index) {
    const producto = productos[index]; // Obtiene el producto del array local
    if (!producto) {
        mostrarToast("Error: Producto no encontrado para edición.", "error");
        return;
    }

    document.getElementById("nombre").value = producto.nombre;
    document.getElementById("stock").value = producto.stock;
    document.getElementById("vendidos").value = producto.vendidos;
    document.getElementById("costo").value = producto.costo;
    document.getElementById("precio").value = producto.precio;
    document.getElementById("proveedor").value = producto.proveedor || "";
    document.getElementById("stockMin").value = producto.stockMin ?? "";
    document.getElementById("stockMax").value = producto.stockMax ?? "";

    const preview = document.getElementById("imagenPreview");
    preview.src = producto.imagen || "";
    preview.style.display = producto.imagen ? "block" : "none";

    editIndex = index; // Guarda el índice del array local
    editId = producto.id; // Guarda el ID real de la base de datos
    document.getElementById("btnGuardar").textContent = "Actualizar";
    document.getElementById("btnCancelar").style.display = "inline-block";
    window.scrollTo({ top: 0, behavior: "smooth" });
}

function limpiarCampos() {
    document.getElementById("nombre").value = "";
    document.getElementById("stock").value = "";
    document.getElementById("stockMin").value = "";
    document.getElementById("stockMax").value = "";
    document.getElementById("vendidos").value = "";
    document.getElementById("costo").value = "";
    document.getElementById("precio").value = "";
    document.getElementById("imagen").value = "";
    document.getElementById("proveedor").value = "";
    document.getElementById("btnGuardar").textContent = "Guardar";
    document.getElementById("btnCancelar").style.display = "none";
    editIndex = null;
    editId = null;

    const preview = document.getElementById("imagenPreview");
    preview.src = "";
    preview.style.display = "none";
}

function mostrarToast(mensaje, tipo = "info") { // Añadido 'tipo' para posibles estilos (error, éxito)
    const toastContainer = document.getElementById("toastContainer");
    if (!toastContainer) { // Pequeña verificación si el contenedor no existe
        console.warn("No se encontró el contenedor de toasts. Mensaje:", mensaje);
        alert(mensaje); // Fallback para mostrar el mensaje
        return;
    }
    
    const toast = document.createElement("div");
    toast.className = `toast ${tipo}`; // Agrega clase de tipo (info, error, success)
    toast.textContent = mensaje;
    toastContainer.appendChild(toast);

    setTimeout(() => toast.classList.add("show"), 100);
    setTimeout(() => {
        toast.classList.remove("show");
        setTimeout(() => toast.remove(), 400);
    }, 3000);
}


function cargarProveedores() {
    const select = document.getElementById("proveedor");
    // Asume que los proveedores se gestionan en localStorage o similar
    const proveedoresGuardados = JSON.parse(localStorage.getItem("proveedores")) || [];

    select.innerHTML = '<option value="">Seleccione un proveedor</option>';
    const optionSS = document.createElement("option");
    optionSS.value = "propio";
    optionSS.textContent = "Propio";
    select.appendChild(optionSS);

    proveedoresGuardados.forEach(p => {
        const option = document.createElement("option");
        option.value = p.nombre;
        option.textContent = p.nombre;
        select.appendChild(option);
    });
}

function cancelarEdicion() {
    limpiarCampos();
    mostrarToast("Edición cancelada ❌");
}

function setupPreview() {
    document.getElementById("imagen").addEventListener("change", function () {
        const archivo = this.files[0];
        const preview = document.getElementById("imagenPreview");

        if (archivo) {
            const lector = new FileReader();
            lector.onload = function (e) {
                preview.src = e.target.result;
                preview.style.display = "block";
            };
            lector.readAsDataURL(archivo);
        } else {
            preview.src = "";
            preview.style.display = "none";
        }
    });
}