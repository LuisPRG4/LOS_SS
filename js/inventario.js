// js/inventario.js (CÓDIGO MODIFICADO: SIN AUTO-ASIGNACIÓN DE IMÁGENES)

let productos = [];
let editIndex = null; 
let editId = null;    

// --- Eliminada la lista de imágenes predefinidas para auto-asignación ---
// const predefinedImages = [...]; // Ya no está aquí

document.addEventListener("DOMContentLoaded", async () => {
    await abrirDB(); 
    productos = await obtenerTodosLosProductos(); 
    mostrarProductos();
    cargarProveedores();
    setupPreview();
});

function mostrarProductos(filtrados = productos) {
    const lista = document.getElementById("listaProductos");
    lista.innerHTML = ""; 

    if (filtrados.length === 0) {
        lista.innerHTML = `<p class="mensaje-lista">No hay productos registrados.</p>`; 
        return;
    }

    filtrados.forEach((producto) => {
        const card = crearCardProducto(producto); 
        lista.appendChild(card);
    });
}

// Función para crear la tarjeta HTML de un producto con el estilo "modern-card"
function crearCardProducto(producto) {
    const card = document.createElement("div");
    card.className = "modern-card"; 

    // Prepara la URL de la imagen del producto. Si no hay imagen, usa un placeholder genérico.
    const imagenProductoUrl = producto.imagen || 'https://placehold.co/100x100/e0e0e0/5B2D90?text=Producto';

    card.innerHTML = `
        <div class="card-header">
            <h3 title="${producto.nombre}">${producto.nombre}</h3>
            <span class="card-meta">Categoría: ${producto.categoria || 'Sin Categoría'}</span> 
        </div>
        <div class="card-content">
            <p>
                <img src="${imagenProductoUrl}" 
                     alt="Imagen de ${producto.nombre}" 
                     style="width: 50px; height: 50px; border-radius: 8px; margin-right: 10px; object-fit: cover; vertical-align: middle; display: inline-block;">
                <strong>Stock:</strong> ${producto.stock} ${producto.unidadMedida || 'unidad(es)'}
            </p>
            <p><strong>Vendidos:</strong> ${producto.vendidos || 0} ${producto.unidadMedida || 'unidad(es)'}</p>
            <p><strong>Proveedor:</strong> ${producto.proveedor || "Propio"}</p>
            <p><strong>Costo:</strong> $${producto.costo?.toFixed(2) || '0.00'}</p>
            <p><strong>Precio Venta:</strong> $${producto.precio?.toFixed(2) || '0.00'}</p>
            <p><strong>Stock Mínimo:</strong> ${producto.stockMin !== undefined && producto.stockMin !== null ? producto.minStock : 'N/D'}</p>
            <p><strong>Stock Máximo:</strong> ${producto.stockMax !== undefined && producto.stockMax !== null ? producto.maxStock : 'N/D'}</p>
        </div>
        <div class="card-actions">
            <button onclick="cargarProductoParaEdicion(${producto.id})" class="btn-edit">✏️ Editar</button>
            <button onclick="eliminarProductoDesdeUI(${producto.id})" class="btn-delete">🗑️ Eliminar</button>
        </div>
    `;
    return card;
}

async function cargarProductoParaEdicion(idProducto) { 
    const producto = productos.find(p => p.id === idProducto);
    
    if (!producto) {
        mostrarToast("Error: Producto no encontrado para edición.", "error");
        console.error("Producto con ID", idProducto, "no encontrado en el array local de productos.");
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
    document.getElementById("unidadMedida").value = producto.unidadMedida || "unidad";
    document.getElementById("categoriaProducto").value = producto.categoria || ""; 

    const preview = document.getElementById("imagenPreview");
    preview.src = producto.imagen || "";
    preview.style.display = producto.imagen ? "block" : "none";

    editId = producto.id;
    editIndex = productos.indexOf(producto); 

    document.getElementById("btnGuardar").textContent = "Actualizar";
    document.getElementById("btnCancelar").style.display = "inline-block";
    window.scrollTo({ top: 0, behavior: "smooth" });
}

async function eliminarProductoDesdeUI(idProducto) {
    console.log("Intentando eliminar producto. ID recibido:", idProducto);
    const confirmacion = await mostrarConfirmacion("¿Estás seguro de eliminar este producto?", "Eliminar Producto");
    if (confirmacion) {
        console.log("Confirmación aceptada para eliminar producto. ID a eliminar en DB:", idProducto);
        try {
            await eliminarProducto(Number(idProducto));
            mostrarToast("Producto eliminado 🗑️");
        } catch (error) {
            console.error("Error al eliminar el producto de la DB:", error);
            mostrarToast("Error al eliminar el producto. 😔");
        }
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
    const unidadMedida = document.getElementById("unidadMedida").value.trim();
    const stockMin = parseInt(document.getElementById("stockMin").value) || null;
    const stockMax = parseInt(document.getElementById("stockMax").value) || null;
    const vendidos = parseInt(document.getElementById("vendidos").value) || 0;
    const costo = parseFloat(document.getElementById("costo").value) || 0;
    const precio = parseFloat(document.getElementById("precio").value) || 0;
    const proveedor = document.getElementById("proveedor").value.trim();
    const categoria = document.getElementById("categoriaProducto").value.trim(); 
    const imagenInput = document.getElementById("imagen");
    const archivo = imagenInput.files[0]; 

    if (!nombre) return mostrarToast("El nombre del producto es obligatorio ⚠️", "error");
    if (stock < 0 || vendidos < 0 || costo < 0 || precio < 0)
        return mostrarToast("Los valores no pueden ser negativos ⚠️", "error");

    const productoData = { nombre, stock, unidadMedida, vendidos, costo, precio, proveedor, stockMin, stockMax, categoria }; 

    if (archivo) {
        // Si el usuario sube un archivo, esa imagen tiene prioridad
        const lector = new FileReader();
        lector.onload = function (e) {
            productoData.imagen = e.target.result;
            guardarProductoFinal(productoData);
        };
        lector.readAsDataURL(archivo);
    } else {
        // Si no hay archivo nuevo, mantener la imagen existente si es edición, o dejar vacía si es nuevo.
        if (editId !== null) {
            const productoExistente = productos.find(p => p.id === editId);
            if (productoExistente && productoExistente.imagen) {
                productoData.imagen = productoExistente.imagen;
            } else {
                productoData.imagen = ""; // Si no hay imagen previa en edición, queda vacía
            }
        } else {
            productoData.imagen = ""; // Si es un producto nuevo y no hay archivo, queda vacía
        }
        guardarProductoFinal(productoData);
    }
}

async function guardarProductoFinal(producto) {
    if (editId === null) { 
        await agregarProducto(producto); 
        mostrarToast("Producto guardado ✅");
    } else { 
        producto.id = editId; 
        await actualizarProducto(editId, producto); 
        mostrarToast("Producto actualizado ✏️");
        
        editId = null; 
        editIndex = null; 
        document.getElementById("btnGuardar").textContent = "Guardar";
        document.getElementById("btnCancelar").style.display = "none";
    }

    productos = await obtenerTodosLosProductos();
    mostrarProductos();
    limpiarCampos();
}


function limpiarCampos() {
    document.getElementById("nombre").value = "";
    document.getElementById("stock").value = "";
    document.getElementById("unidadMedida").value = "unidad"; 
    document.getElementById("stockMin").value = "";
    document.getElementById("stockMax").value = "";
    document.getElementById("vendidos").value = "";
    document.getElementById("costo").value = "";
    document.getElementById("precio").value = "";
    document.getElementById("imagen").value = "";
    document.getElementById("proveedor").value = "";
    document.getElementById("categoriaProducto").value = ""; 
    document.getElementById("btnGuardar").textContent = "Guardar";
    document.getElementById("btnCancelar").style.display = "none";
    editIndex = null;
    editId = null;

    const preview = document.getElementById("imagenPreview");
    preview.src = "";
    preview.style.display = "none";
}

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

function cargarProveedores() {
    const select = document.getElementById("proveedor");
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
