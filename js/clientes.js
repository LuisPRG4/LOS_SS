// clientes.js

// Importar funciones de db.js (asegúrate de que db.js esté cargado antes en el HTML)
// Las funciones de db.js son globales porque no están dentro de un módulo ES.

let clientes = []; // Ahora se inicializa vacío, los datos se cargarán desde IndexedDB
let editClienteId = null; // Cambiamos de index a ID para edición

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

// RENOMBRADA: Antes era 'agregarCliente', ahora es 'manejarGuardarCliente'
// Función principal para agregar o actualizar un cliente
async function manejarGuardarCliente() {
    const nombre = document.getElementById("nombreCliente").value.trim();
    const direccion = document.getElementById("direccion").value.trim();
    const telefono = document.getElementById("telefono").value.trim();
    const email = document.getElementById("email").value.trim();

    if (!nombre) {
        mostrarToast("El nombre del cliente es obligatorio ⚠️");
        return;
    }

    const clienteData = { nombre, direccion, telefono, email };

    try {
        if (editClienteId === null) {
            // Modo: Agregar nuevo cliente
            await agregarCliente(clienteData); // Llama a la función global 'agregarCliente' de db.js
            mostrarToast("Cliente agregado 💼");
        } else {
            // Modo: Actualizar cliente existente
            await actualizarCliente(editClienteId, clienteData); // Llama a la función global 'actualizarCliente' de db.js
            mostrarToast("Cliente actualizado ✏️");
            
            // Restablecer el formulario y botones después de actualizar
            editClienteId = null;
            document.getElementById("btnGuardarCliente").textContent = "Guardar Cliente";
            document.getElementById("btnCancelarEdicionCliente").style.display = "none";
        }
    } catch (error) {
        console.error("Error al guardar cliente:", error);
        mostrarToast("Error al guardar cliente. 😔");
    }

    await mostrarClientes(); // Refrescar la lista de clientes desde la DB
    limpiarFormulario();
}

// Rellena el formulario con los datos del cliente para su edición
async function editarCliente(id) { // Ahora recibe el ID del cliente
    try {
        const cliente = await obtenerClientePorId(id); // Obtiene el cliente de db.js por ID
        if (!cliente) {
            mostrarToast("Cliente no encontrado para editar. 😢");
            return;
        }

        document.getElementById("nombreCliente").value = cliente.nombre;
        document.getElementById("direccion").value = cliente.direccion;
        document.getElementById("telefono").value = cliente.telefono;
        document.getElementById("email").value = cliente.email;

        editClienteId = id; // Almacenamos el ID del cliente que estamos editando
        document.getElementById("btnGuardarCliente").textContent = "Actualizar Cliente";
        document.getElementById("btnCancelarEdicionCliente").style.display = "inline-block";

        // Scroll automático
        document.getElementById("nombreCliente").scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
        console.error("Error al cargar cliente para edición:", error);
        mostrarToast("Error al cargar cliente para edición. 😔");
    }
}

// Cancela la edición y limpia el formulario
function cancelarEdicionCliente() {
    editClienteId = null;
    limpiarFormulario();
    document.getElementById("btnGuardarCliente").textContent = "Guardar Cliente";
    document.getElementById("btnCancelarEdicionCliente").style.display = "none";
    mostrarToast("Edición cancelada ❌");
}

// Muestra la lista de clientes en la interfaz
async function mostrarClientes() {
    const lista = document.getElementById("listaClientes");
    lista.innerHTML = ""; // Limpia la lista actual

    try {
        clientes = await obtenerTodosLosClientes(); // Carga todos los clientes de db.js
        if (clientes && clientes.length > 0) {
            clientes.forEach(cliente => {
                const card = document.createElement("div");
                card.className = "cliente-card";

                card.innerHTML = `
                    <h3>${cliente.nombre}</h3>
                    <p><strong>Dirección:</strong> ${cliente.direccion || "No especificada"}</p>
                    <p><strong>Teléfono:</strong> ${cliente.telefono || "No especificado"}</p>
                    <p><strong>Email:</strong> ${cliente.email || "No especificado"}</p>
                    <button onclick="editarCliente(${cliente.id})" class="btn-editar">✏️ Editar</button>
                    <button onclick="eliminarClienteDesdeUI(${cliente.id})" class="btn-eliminar">🗑️ Eliminar</button>
                `; // Importante: usar cliente.id en los onclick, y llamar a la nueva función de eliminación

                lista.appendChild(card);
            });
        } else {
            lista.innerHTML = "<p>No hay clientes registrados.</p>";
        }
    } catch (error) {
        console.error("Error al mostrar clientes:", error);
        lista.innerHTML = "<p>Error al cargar los clientes.</p>";
        mostrarToast("Error al cargar los clientes. 😔");
    }
}

// RENOMBRADA: Antes era 'eliminarCliente', ahora es 'eliminarClienteDesdeUI'
// Elimina un cliente de la base de datos (función manejadora de la UI)
async function eliminarClienteDesdeUI(id) { // Ahora recibe el ID del cliente
    if (confirm("¿Eliminar este cliente?")) {
        try {
            await eliminarCliente(id); // Llama a la función global 'eliminarCliente' de db.js
            mostrarToast("Cliente eliminado 🗑️");
        } catch (error) {
            console.error("Error al eliminar cliente:", error);
            mostrarToast("Error al eliminar cliente. 😔");
        }
        await mostrarClientes(); // Refrescar la lista
    }
}

// Limpia los campos del formulario
function limpiarFormulario() {
    document.getElementById("nombreCliente").value = "";
    document.getElementById("direccion").value = "";
    document.getElementById("telefono").value = "";
    document.getElementById("email").value = "";
}

// Filtra los clientes mostrados según el texto de búsqueda
async function filtrarClientes() {
    const filtro = document.getElementById("buscadorClientes").value.toLowerCase();
    const lista = document.getElementById("listaClientes");
    const contenedorBoton = document.getElementById("contenedorBotonAgregar");
    const botonAgregar = document.getElementById("btnAgregarDesdeBusqueda");

    lista.innerHTML = ""; // Limpia la lista para mostrar solo los filtrados

    // Si el filtro está vacío, muestra todos los clientes y oculta el botón
    if (filtro === "") { 
        await mostrarClientes(); // Llama a la función original para cargar todos
        contenedorBoton.style.display = "none";
        return;
    }

    // Asegurarse de que el array 'clientes' esté actualizado antes de filtrar.
    // Aunque `mostrarClientes` se llama en DOMContentLoaded, para un filtrado preciso
    // y si los datos pudieran cambiar a menudo sin un refresh completo, podrías considerar
    // `clientes = await obtenerTodosLosClientes();` aquí también, pero para la mayoría
    // de los casos de uso, el array en memoria es suficiente tras la carga inicial.
    const clientesFiltrados = clientes.filter(cliente => {
        return cliente.nombre.toLowerCase().includes(filtro) ||
               (cliente.direccion && cliente.direccion.toLowerCase().includes(filtro)) ||
               (cliente.telefono && cliente.telefono.toLowerCase().includes(filtro)) ||
               (cliente.email && cliente.email.toLowerCase().includes(filtro));
    });

    let encontrados = 0;

    clientesFiltrados.forEach(cliente => {
        const card = document.createElement("div");
        card.className = "cliente-card";

        card.innerHTML = `
            <h3>${cliente.nombre}</h3>
            <p><strong>Dirección:</strong> ${cliente.direccion || "No especificada"}</p>
            <p><strong>Teléfono:</strong> ${cliente.telefono || "No especificado"}</p>
            <p><strong>Email:</strong> ${cliente.email || "No especificado"}</p>
            <button onclick="editarCliente(${cliente.id})" class="btn-editar">✏️ Editar</button>
            <button onclick="eliminarClienteDesdeUI(${cliente.id})" class="btn-eliminar">🗑️ Eliminar</button>
        `;

        lista.appendChild(card);
        encontrados++;
    });

    if (encontrados === 0) { // Si no se encontraron clientes para el filtro
        contenedorBoton.style.display = "block";
        botonAgregar.textContent = `➕ Agregar nuevo cliente: ${document.getElementById("buscadorClientes").value.trim()}`;
    } else {
        contenedorBoton.style.display = "none";
    }
}

// Función para agregar un cliente directamente desde el campo de búsqueda
function agregarDesdeBusqueda() {
    const nombre = document.getElementById("buscadorClientes").value.trim();
    if (!nombre) return;

    // Rellena el campo de nombre del formulario de agregar cliente
    document.getElementById("nombreCliente").value = nombre;
    document.getElementById("direccion").focus(); // Mueve el foco al siguiente campo

    // Asegura que el botón diga "Guardar Cliente" para una nueva adición
    editClienteId = null; // Importantísimo para que se considere un nuevo cliente
    document.getElementById("btnGuardarCliente").textContent = "Guardar Cliente";
    document.getElementById("btnCancelarEdicionCliente").style.display = "none";

    // Opcional: Desplazar la vista al formulario de agregar
    window.scrollTo({ top: 0, behavior: "smooth" });

    mostrarToast(`Agregando nuevo cliente: ${nombre} 📝`);
}

// Inicialización: Cargar clientes al cargar el DOM
document.addEventListener("DOMContentLoaded", async () => {
    // Asegurarse de que la DB esté abierta y stores creados antes de intentar usarla
    await abrirDB(); 
    await mostrarClientes();

    // Event Listeners
    document.getElementById("btnGuardarCliente").addEventListener("click", manejarGuardarCliente);
    document.getElementById("btnCancelarEdicionCliente").addEventListener("click", cancelarEdicionCliente);
    document.getElementById("buscadorClientes").addEventListener("input", filtrarClientes);
    document.getElementById("btnAgregarDesdeBusqueda").addEventListener("click", agregarDesdeBusqueda);
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