// js/inventario.js (CÓDIGO CORREGIDO Y RECOMENDADO)

let productos = [];
let editIndex = null; // Mantiene el índice en el array 'productos' para edición
let editId = null;    // Mantiene el ID real del producto de la DB para edición

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

        // ¡MODIFICADO! Añadir la unidad de medida aquí
        card.innerHTML = `
            <img src="${producto.imagen || 'https://via.placeholder.com/80'}" alt="Imagen" class="producto-imagen" />
            <h3>${producto.nombre}</h3>
            <p><strong>Stock:</strong> ${producto.stock} ${producto.unidadMedida || 'unidad(es)'}</p> <!-- ¡UNIDAD DE MEDIDA AQUÍ! -->
            <p><strong>Vendidos:</strong> ${producto.vendidos} ${producto.unidadMedida || 'unidad(es)'}</p> <!-- ¡Y AQUÍ TAMBIÉN! -->
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
    // ¡MODIFICADO! Usar un modal en lugar de alert/confirm
    const confirmacion = await mostrarConfirmacion("¿Estás seguro de eliminar este producto?", "Eliminar Producto");
    if (confirmacion) {
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
    // ¡NUEVO! Obtener la unidad de medida
    const unidadMedida = document.getElementById("unidadMedida").value.trim();
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

    const productoData = { nombre, stock, unidadMedida, vendidos, costo, precio, proveedor, stockMin, stockMax }; // ¡unidadMedida incluida!

    if (archivo) {
        const lector = new FileReader();
        lector.onload = function (e) {
            productoData.imagen = e.target.result;
            guardarProductoFinal(productoData);
        };
        lector.readAsDataURL(archivo);
    } else {
        // Si no hay archivo nuevo, mantén la imagen existente si estás editando
        productoData.imagen = (editIndex !== null && productos[editIndex]) ? productos[editIndex].imagen : "";
        guardarProductoFinal(productoData);
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
    // ¡NUEVO! Cargar la unidad de medida
    document.getElementById("unidadMedida").value = producto.unidadMedida || "unidad"; // Valor por defecto si no existe

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
    // ¡NUEVO! Limpiar la unidad de medida
    document.getElementById("unidadMedida").value = "unidad"; // Restablecer al valor por defecto
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
        // ¡MODIFICADO! Quitado alert, no usar alert
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

// ¡NUEVA FUNCIÓN! Para reemplazar los confirm/alert del navegador
function mostrarConfirmacion(mensaje, titulo = "Confirmar") {
    return new Promise((resolve) => {
        const modalHtml = `
            <div id="customConfirmModal" style="
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0, 0, 0, 0.6); display: flex; align-items: center; justify-content: center;
                z-index: 1000;
            ">
                <div style="
                    background: #fff; padding: 25px; border-radius: 10px; box-shadow: 0 5px 15px rgba(0,0,0,0.3);
                    max-width: 400px; text-align: center; font-family: 'Inter', sans-serif;
                ">
                    <h3 style="margin-top: 0; color: #333; font-size: 1.4em;">${titulo}</h3>
                    <p style="margin-bottom: 25px; color: #555; font-size: 1em;">${mensaje}</p>
                    <div style="display: flex; justify-content: center; gap: 15px;">
                        <button id="confirmYes" style="
                            background-color: #4CAF50; color: white; padding: 10px 20px; border: none;
                            border-radius: 8px; cursor: pointer; font-size: 1em; transition: background-color 0.3s;
                        ">Sí</button>
                        <button id="confirmNo" style="
                            background-color: #f44336; color: white; padding: 10px 20px; border: none;
                            border-radius: 8px; cursor: pointer; font-size: 1em; transition: background-color 0.3s;
                        ">No</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        const modal = document.getElementById('customConfirmModal');
        document.getElementById('confirmYes').onclick = () => {
            modal.remove();
            resolve(true);
        };
        document.getElementById('confirmNo').onclick = () => {
            modal.remove();
            resolve(false);
        };
    });
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
