// pedidos.js

// Importar funciones de db.js (asegúrate de que db.js esté cargado antes en el HTML)
// No es necesario "import" si db.js ya está incluido como un script normal antes de este.
// Las funciones de db.js son globales porque no están dentro de un módulo ES.

let editPedidoId = null; // Cambiamos de index a ID para edición

// Arrays temporales para almacenar datos de IndexedDB en memoria para fácil acceso.
// Se cargarán al inicio.
let pedidos = [];
let productos = [];
let clientes = [];

// Función para mostrar toast (notificación) - ya la tenías
function mostrarToast(mensaje) {
    const toastContainer = document.getElementById("toastContainer");
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = mensaje;
    toastContainer.appendChild(toast);

    setTimeout(() => toast.classList.add("show"), 100);
    setTimeout(() => {
        toast.classList.remove("show");
        setTimeout(() => toast.remove(), 400);
    }, 3000);
}

// Cargar productos para el <select> de productos desde IndexedDB
async function cargarProductosSelect() {
    const select = document.getElementById("producto");
    select.innerHTML = "<option value=''>Selecciona un producto</option>"; // Opción por defecto
    try {
        productos = await obtenerTodosLosProductos(); // Obtiene todos los productos de IndexedDB
        if (productos && productos.length > 0) {
            productos.forEach(p => {
                let option = document.createElement("option");
                option.value = p.id; // Usamos el ID del producto como valor
                option.textContent = `${p.nombre} (Stock: ${p.stock})`;
                select.appendChild(option);
            });
        } else {
            mostrarToast("No hay productos en el inventario. Agrega productos primero. 🚫");
        }
    } catch (error) {
        console.error("Error al cargar productos:", error);
        mostrarToast("Error al cargar productos. 😔");
    }
}

// Cargar lista de clientes para autocompletar input desde IndexedDB
async function cargarClientesDatalist() {
    const dataList = document.getElementById("clientesList");
    dataList.innerHTML = "";
    try {
        clientes = await obtenerTodosLosClientes(); // Obtiene todos los clientes de IndexedDB
        clientes.forEach(c => {
            const option = document.createElement("option");
            option.value = c.nombre;
            dataList.appendChild(option);
        });
    } catch (error) {
        console.error("Error al cargar clientes:", error);
        mostrarToast("Error al cargar clientes. 😔");
    }
}

// Limpiar campos del formulario
function limpiarCampos() {
    document.getElementById("cliente").value = "";
    document.getElementById("producto").selectedIndex = 0;
    document.getElementById("cantidad").value = "";
    document.getElementById("precioUnitario").value = "";
    // Asegurarse de que el precio unitario se resetea correctamente
    document.getElementById("precioUnitario").removeAttribute('readonly'); 
}

// Agregar o actualizar pedido
async function agregarPedido() {
    const clienteNombre = document.getElementById("cliente").value.trim();
    const productoId = parseInt(document.getElementById("producto").value); // Ahora es ID, no index
    const cantidad = parseInt(document.getElementById("cantidad").value);

    if (!clienteNombre || isNaN(productoId) || isNaN(cantidad) || cantidad <= 0) {
        mostrarToast("Completa todos los campos correctamente ⚠️");
        return;
    }

    let productoSeleccionado;
    try {
        productoSeleccionado = await obtenerProductoPorId(productoId); // Obtener producto por su ID
        if (!productoSeleccionado) {
            mostrarToast("Producto no encontrado en el inventario. 😢");
            return;
        }
    } catch (error) {
        console.error("Error al obtener producto por ID:", error);
        mostrarToast("Error al procesar el producto. 😔");
        return;
    }

    // Verificar si el cliente existe o si necesitamos agregarlo (opcional, pero buena práctica)
    let clienteExistente = clientes.find(c => c.nombre === clienteNombre);
    if (!clienteExistente) {
        // Podríamos preguntar al usuario si desea agregar este nuevo cliente
        // Por ahora, asumimos que se usará un cliente existente o uno que se agregará en el módulo de clientes
        // Si no existe, podemos crear un cliente "temporal" o mostrar un error.
        // Para este ejercicio, mostraremos un toast si no existe y no lo agregamos automáticamente.
        mostrarToast(`Cliente "${clienteNombre}" no encontrado. Considera agregarlo en el módulo de Clientes. 🤔`);
        // Opcionalmente: return; si el cliente debe existir previamente
    }

    const precioUnitarioProducto = productoSeleccionado.precio;

    if (editPedidoId !== null) {
        // Modo edición
        const pedidoAnterior = pedidos.find(p => p.id === editPedidoId);
        if (!pedidoAnterior) {
            mostrarToast("Error: Pedido anterior no encontrado para edición. 😢");
            return;
        }

        // Restaurar stock del pedido anterior antes de calcular el nuevo
        let productoAnterior;
        try {
            productoAnterior = await obtenerProductoPorId(pedidoAnterior.productoId); // Usar ID
            if (productoAnterior) {
                productoAnterior.stock += pedidoAnterior.cantidad; // Revertir stock
                await actualizarProducto(productoAnterior.id, productoAnterior); // Guardar en DB
            }
        } catch (error) {
            console.error("Error al revertir stock de producto anterior:", error);
            mostrarToast("Error al revertir stock del pedido anterior. 😔");
            return;
        }

        // Verificar stock disponible para el NUEVO pedido
        if (productoSeleccionado.id === productoAnterior.id) {
            // Si es el mismo producto, el stock disponible ya incluye el stock revertido
            if (productoSeleccionado.stock < cantidad) { // Comparar con el stock ya ajustado
                 mostrarToast(`No hay suficiente stock (${productoSeleccionado.stock}) para la cantidad solicitada (${cantidad}) 😢`);
                 // Si el stock no es suficiente, necesitamos revertir el stock de nuevo
                 productoAnterior.stock -= pedidoAnterior.cantidad; // Re-descontar lo que habíamos revertido
                 await actualizarProducto(productoAnterior.id, productoAnterior);
                 return;
            }
        } else {
            // Si se cambió el producto, el stock de productoSeleccionado NO incluye el revertido
            if (productoSeleccionado.stock < cantidad) {
                mostrarToast(`No hay suficiente stock (${productoSeleccionado.stock}) para la cantidad solicitada (${cantidad}) 😢`);
                return;
            }
        }

        // Descontar stock para el nuevo pedido
        productoSeleccionado.stock -= cantidad;
        try {
            await actualizarProducto(productoSeleccionado.id, productoSeleccionado); // Guardar en DB
        } catch (error) {
            console.error("Error al actualizar stock de producto:", error);
            mostrarToast("Error al actualizar stock del producto. 😔");
            return;
        }

        // Actualizar el pedido en IndexedDB
        const pedidoActualizado = {
            id: editPedidoId, // Mantenemos el mismo ID
            cliente: clienteNombre,
            producto: productoSeleccionado.nombre, // Guardamos el nombre para mostrar
            productoId: productoSeleccionado.id, // Guardamos el ID para futuras referencias
            cantidad,
            precioUnitario: precioUnitarioProducto,
            total: precioUnitarioProducto * cantidad,
            estado: pedidoAnterior.estado || "Pendiente" // Mantiene el estado anterior si existe
        };
        try {
            await actualizarPedidoDB(editPedidoId, pedidoActualizado);
            mostrarToast("Pedido actualizado ✏️");
        } catch (error) {
            console.error("Error al actualizar pedido en DB:", error);
            mostrarToast("Error al actualizar el pedido. 😔");
            return;
        }

        editPedidoId = null;
        document.getElementById("btnAgregarPedido").textContent = "Agregar Pedido";
        document.getElementById("btnCancelarEdicion").style.display = "none";
    } else {
        // Modo nuevo pedido
        if (productoSeleccionado.stock < cantidad) {
            mostrarToast(`No hay suficiente stock (${productoSeleccionado.stock}) para la cantidad solicitada (${cantidad}) 😢`);
            return;
        }

        productoSeleccionado.stock -= cantidad;
        try {
            await actualizarProducto(productoSeleccionado.id, productoSeleccionado); // Guardar en DB
        } catch (error) {
            console.error("Error al actualizar stock de producto:", error);
            mostrarToast("Error al actualizar stock del producto. 😔");
            return;
        }

        const nuevoPedido = {
            cliente: clienteNombre,
            producto: productoSeleccionado.nombre, // Guardamos el nombre para mostrar
            productoId: productoSeleccionado.id, // Guardamos el ID para futuras referencias
            cantidad,
            precioUnitario: precioUnitarioProducto,
            total: precioUnitarioProducto * cantidad,
            estado: "Pendiente"
        };
        try {
            await agregarPedidoDB(nuevoPedido);
            mostrarToast("Pedido agregado y stock actualizado 🧾");
        } catch (error) {
            console.error("Error al agregar pedido en DB:", error);
            mostrarToast("Error al agregar el pedido. 😔");
            return;
        }
    }

    await mostrarPedidos(); // Refrescar lista de pedidos
    limpiarCampos();
}

// Eliminar pedido y revertir stock solo si NO está entregado
async function eliminarPedido(id) { // Ahora recibe ID, no index
    const pedido = pedidos.find(p => p.id === id);
    if (!pedido) {
        mostrarToast("Pedido no encontrado para eliminar. ❌");
        return;
    }

    if (confirm(`¿Seguro que quieres eliminar el pedido de ${pedido.cliente} para ${pedido.producto}?`)) {
        if (pedido.estado !== "Entregado") {
            try {
                let productoEncontrado = await obtenerProductoPorId(pedido.productoId); // Usar ID
                if (productoEncontrado) {
                    productoEncontrado.stock += pedido.cantidad;
                    await actualizarProducto(productoEncontrado.id, productoEncontrado); // Guardar en DB
                    mostrarToast("Stock del producto revertido. ✅");
                }
            } catch (error) {
                console.error("Error al revertir stock al eliminar pedido:", error);
                mostrarToast("Error al revertir stock. 😔");
            }
        }

        try {
            await eliminarPedidoDB(id); // Eliminar de IndexedDB
            mostrarToast("Pedido eliminado" + (pedido.estado !== "Entregado" ? " y stock revertido ❌" : " ❌"));
        } catch (error) {
            console.error("Error al eliminar pedido en DB:", error);
            mostrarToast("Error al eliminar el pedido. 😔");
            return;
        }
        await mostrarPedidos(); // Refrescar lista de pedidos
    }
}

// Editar pedido: rellena formulario, cambia botones, y sube scroll
async function editarPedido(id) { // Ahora recibe ID, no index
    const pedido = pedidos.find(p => p.id === id);
    if (!pedido) {
        mostrarToast("Pedido no encontrado para edición. 😢");
        return;
    }

    document.getElementById("cliente").value = pedido.cliente;
    document.getElementById("cantidad").value = pedido.cantidad;

    // Seleccionar el producto correcto en el select
    // Necesitamos que el <select> tenga las opciones cargadas con los IDs de los productos
    const selectProducto = document.getElementById("producto");
    selectProducto.value = pedido.productoId; // Asigna el ID del producto

    // Actualizar el precio unitario y total al cargar el pedido
    document.getElementById("precioUnitario").value = (pedido.precioUnitario * pedido.cantidad).toFixed(2);
    document.getElementById("precioUnitario").setAttribute('readonly', true); // Bloquear edición

    editPedidoId = id; // Guardamos el ID del pedido que estamos editando
    document.getElementById("btnAgregarPedido").textContent = "Actualizar Pedido";
    document.getElementById("btnCancelarEdicion").style.display = "inline-block";

    // Subir el formulario suavemente
    document.querySelector('section').scrollIntoView({ behavior: "smooth", block: "start" });
}

// Cancelar edición: limpia, restablece botones y estado
function cancelarEdicion() {
    editPedidoId = null;
    limpiarCampos();
    document.getElementById("btnAgregarPedido").textContent = "Agregar Pedido";
    document.getElementById("btnCancelarEdicion").style.display = "none";
    mostrarToast("Edición cancelada ❌");
}

// Mostrar pedidos en lista desde IndexedDB
async function mostrarPedidos() {
    const lista = document.getElementById("listaPedidos");
    lista.innerHTML = "";
    try {
        pedidos = await obtenerTodosLosPedidosDB(); // Obtiene todos los pedidos de IndexedDB
        if (pedidos && pedidos.length > 0) {
            pedidos.forEach(p => {
                const li = document.createElement("li");
                li.className = "pedido-card";

                // Asegúrate de que los botones de editar y eliminar usen el ID
                li.innerHTML = `
                    <strong>${p.cliente}</strong><br>
                    ${p.producto} x ${p.cantidad} = <strong>$${p.total.toFixed(2)}</strong>
                    <br>
                    Estado: 
                    <select class="estado-select" onchange="cambiarEstado(${p.id}, this.value)">
                        <option ${p.estado === "Pendiente" ? "selected" : ""}>Pendiente</option>
                        <option ${p.estado === "Preparado" ? "selected" : ""}>Preparado</option>
                        <option ${p.estado === "Entregado" ? "selected" : ""}>Entregado</option>
                    </select>
                    <button onclick="editarPedido(${p.id})" class="boton-editar">✏️ Editar</button> 
                    <button onclick="eliminarPedido(${p.id})" class="boton-eliminar">🗑️ Eliminar</button>
                `;
                lista.appendChild(li);
            });
        } else {
            lista.innerHTML = "<p>No hay pedidos registrados.</p>";
        }
    } catch (error) {
        console.error("Error al mostrar pedidos:", error);
        mostrarToast("Error al mostrar la lista de pedidos. 😔");
    }
}

// Cambiar estado del pedido
async function cambiarEstado(id, nuevoEstado) { // Ahora recibe ID
    const pedido = pedidos.find(p => p.id === id);
    if (pedido) {
        pedido.estado = nuevoEstado;
        try {
            await actualizarPedidoDB(id, pedido); // Actualizar en IndexedDB
            mostrarToast(`Estado actualizado a "${nuevoEstado}" 🔄`);
            // No es necesario llamar a mostrarPedidos() de nuevo si solo actualizamos el estado,
            // ya que la lista en memoria se actualiza y la interfaz no necesita un redibujado completo.
            // Si el estado tiene impacto en otros datos (ej: finanzas), se manejaría en otro módulo.
        } catch (error) {
            console.error("Error al cambiar estado del pedido:", error);
            mostrarToast("Error al actualizar el estado del pedido. 😔");
        }
    }
}

// Limpiar todos los pedidos de IndexedDB
async function limpiarTodosLosPedidos() {
    if (confirm("¿Seguro quieres borrar TODOS los pedidos? Esto no afectará el inventario.")) {
        try {
            await limpiarTodosLosPedidosDB(); // Función en db.js
            pedidos = []; // Limpiar el array en memoria
            mostrarPedidos(); // Actualizar la vista
            mostrarToast("Todos los pedidos borrados sin afectar inventario 🧹");
        } catch (error) {
            console.error("Error al limpiar todos los pedidos:", error);
            mostrarToast("Error al limpiar todos los pedidos. 😔");
        }
    }
}

// Función para actualizar el precio unitario en el formulario
// (Ya la tenías, solo necesita que 'productos' esté cargado desde DB)
async function actualizarPrecioUnitario() {
    const productoId = parseInt(document.getElementById("producto").value);
    const cantidad = parseInt(document.getElementById("cantidad").value);
    const precioInput = document.getElementById("precioUnitario");

    if (!isNaN(productoId) && !isNaN(cantidad) && cantidad > 0) {
        // Asegúrate de que 'productos' global esté cargado y contenga los productos de IndexedDB
        const producto = productos.find(p => p.id === productoId);
        if (producto) {
            const total = producto.precio * cantidad;
            precioInput.value = total.toFixed(2);
        } else {
            precioInput.value = "";
        }
    } else {
        precioInput.value = "";
    }
    // No queremos que el usuario edite el precio unitario directamente
    precioInput.setAttribute('readonly', true);
}


// Código que corre cuando la página termina de cargar (inicialización)
document.addEventListener("DOMContentLoaded", async () => {
    // Asegurarse de que la DB esté abierta y stores creados antes de intentar usarla
    await abrirDB(); 

    // Cargar datos iniciales
    await cargarProductosSelect();
    await cargarClientesDatalist();
    await mostrarPedidos();

    // Event Listeners
    document.getElementById("btnLimpiarPedidos").addEventListener("click", limpiarTodosLosPedidos); // Usar la nueva función
    document.getElementById("producto").addEventListener("change", actualizarPrecioUnitario);
    document.getElementById("cantidad").addEventListener("input", actualizarPrecioUnitario);
});

// Función para el menú móvil (ya la tenías en el HTML)
function toggleMenu() {
    document.getElementById("navMenu").classList.toggle("open");
}

// Script para el botón flotante de ayuda (ya lo tenías en el HTML)
function mostrarAyuda() {
    const ayuda = document.getElementById("ayuda");
    ayuda.classList.add("visible");
    ayuda.scrollIntoView({ behavior: "smooth", block: "start" });
}

document.getElementById("cerrarAyuda").addEventListener("click", () => {
    document.getElementById("ayuda").classList.remove("visible");
});

// Redirección si la sesión no está iniciada (ya la tenías en el HTML)
if (sessionStorage.getItem("sesionIniciada") !== "true") {
    window.location.href = "login.html";
}
