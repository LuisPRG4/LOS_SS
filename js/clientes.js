// clientes.js

let clientes = []; // Ahora se inicializa vacío, los datos se cargarán desde IndexedDB
let editClienteId = null; // Cambiamos de index a ID para edición

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

// Nueva función para renderizar clientes (ahora usando modern-card)
function renderizarClientes(listaClientes) {
    const lista = document.getElementById("listaClientes"); // Este es ahora un <div> con clase 'clientes-grid'
    lista.innerHTML = ""; // Limpia la lista antes de mostrar

    if (!listaClientes || listaClientes.length === 0) {
        lista.innerHTML = `<p class="mensaje-lista">No hay clientes registrados.</p>`; // Usamos la clase para el mensaje de lista vacía
        return;
    }

    listaClientes.forEach(cliente => {
        const card = document.createElement("div");
        card.className = "modern-card"; // Aplica la clase general de tarjeta

        card.innerHTML = `
            <div class="card-header">
                <h3 title="${cliente.nombre}">${cliente.nombre}</h3>
                <!-- Aquí podrías añadir una "card-meta" si tuvieras una fecha de registro, o algo corto -->
                <!-- <span class="card-meta">Registrado: ${cliente.fechaRegistro || 'N/D'}</span> -->
            </div>
            <div class="card-content">
                <p><strong>Dirección:</strong> ${cliente.direccion || "No especificada"}</p>
                <p><strong>Teléfono:</strong> ${cliente.telefono || "No especificado"}</p>
                <p><strong>Email:</strong> ${cliente.email || "No especificado"}</p>
                ${cliente.nota ? `<p class="nota-cliente">📝 <strong>Nota:</strong> ${cliente.nota}</p>` : ''}
            </div>
            <div class="card-actions">
                <button onclick="editarCliente(${cliente.id})" class="btn-edit">✏️ Editar</button>
                <button onclick="eliminarClienteDesdeUI(${cliente.id})" class="btn-delete">🗑️ Eliminar</button>
            </div>
        `;
        lista.appendChild(card);
    });
}


async function manejarGuardarCliente() {
    const nombre = document.getElementById("nombreCliente").value.trim();
    const direccion = document.getElementById("direccion").value.trim();
    const telefono = document.getElementById("telefono").value.trim();
    const email = document.getElementById("email").value.trim();
    const nota = document.getElementById("notaCliente")?.value.trim() || "";

    if (!nombre) {
        mostrarToast("El nombre del cliente es obligatorio ⚠️");
        return;
    }

    const clienteData = { nombre, direccion, telefono, email, nota };

    try {
        if (editClienteId === null) {
            await agregarCliente(clienteData);
            mostrarToast("Cliente agregado 💼");
        } else {
            await actualizarCliente(editClienteId, clienteData);
            mostrarToast("Cliente actualizado ✏️");

            editClienteId = null;
            document.getElementById("btnGuardarCliente").textContent = "Guardar Cliente";
            document.getElementById("btnCancelarEdicionCliente").style.display = "none";
        }
    } catch (error) {
        console.error("Error al guardar cliente:", error);
        mostrarToast("Error al guardar cliente. 😔");
    }

    await mostrarClientes();
    limpiarFormulario();
}

async function editarCliente(id) {
    try {
        const cliente = await obtenerClientePorId(id);
        if (!cliente) {
            mostrarToast("Cliente no encontrado para editar. 😢");
            return;
        }

        document.getElementById("nombreCliente").value = cliente.nombre;
        document.getElementById("direccion").value = cliente.direccion;
        document.getElementById("telefono").value = cliente.telefono;
        document.getElementById("email").value = cliente.email;
        document.getElementById("notaCliente").value = cliente.nota || "";

        editClienteId = id;
        document.getElementById("btnGuardarCliente").textContent = "Actualizar Cliente";
        document.getElementById("btnCancelarEdicionCliente").style.display = "inline-block";

        document.getElementById("nombreCliente").scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
        console.error("Error al cargar cliente para edición:", error);
        mostrarToast("Error al cargar cliente para edición. 😔");
    }
}

function cancelarEdicionCliente() {
    editClienteId = null;
    limpiarFormulario();
    document.getElementById("btnGuardarCliente").textContent = "Guardar Cliente";
    document.getElementById("btnCancelarEdicionCliente").style.display = "none";
    mostrarToast("Edición cancelada ❌");
}

async function mostrarClientes() {
    try {
        clientes = await obtenerTodosLosClientes();
        renderizarClientes(clientes);
    } catch (error) {
        console.error("Error al mostrar clientes:", error);
        document.getElementById("listaClientes").innerHTML = "<p>Error al cargar los clientes.</p>";
        mostrarToast("Error al cargar los clientes. 😔");
    }
}

async function eliminarClienteDesdeUI(id) {
    // Usamos el modal de confirmación personalizado en lugar del confirm() nativo
    const confirmacion = await mostrarConfirmacion(
        "¿Estás seguro de eliminar este cliente? Esta acción no se puede deshacer.",
        "Eliminar Cliente" // Título del modal
    );

    if (confirmacion) {
        try {
            await eliminarCliente(id);
            mostrarToast("Cliente eliminado 🗑️");
        } catch (error) {
            console.error("Error al eliminar cliente:", error);
            mostrarToast("Error al eliminar cliente. 😔");
        }
        await mostrarClientes(); // Vuelve a cargar y renderizar la lista
    } else {
        mostrarToast("Eliminación de cliente cancelada.", "info");
    }
}

function limpiarFormulario() {
    document.getElementById("nombreCliente").value = "";
    document.getElementById("direccion").value = "";
    document.getElementById("telefono").value = "";
    document.getElementById("email").value = "";
    document.getElementById("notaCliente").value = "";
}

async function filtrarClientes() {
    const filtro = document.getElementById("buscadorClientes").value.toLowerCase();
    const contenedorBoton = document.getElementById("contenedorBotonAgregar");
    const botonAgregar = document.getElementById("btnAgregarDesdeBusqueda");

    if (filtro === "") {
        contenedorBoton.style.display = "none";
        renderizarClientes(clientes);  // Aquí cambié para usar renderizarClientes en vez de mostrarClientes
        return;
    }

    // Actualizamos clientes para estar seguros que filtramos con la data más actualizada
    clientes = await obtenerTodosLosClientes();

    const clientesFiltrados = clientes.filter(cliente => {
        return cliente.nombre.toLowerCase().includes(filtro) ||
               (cliente.direccion && cliente.direccion.toLowerCase().includes(filtro)) ||
               (cliente.telefono && cliente.telefono.toLowerCase().includes(filtro)) ||
               (cliente.email && cliente.email.toLowerCase().includes(filtro));
    });

    if (clientesFiltrados.length === 0) {
        contenedorBoton.style.display = "block";
        botonAgregar.textContent = `➕ Agregar nuevo cliente: ${document.getElementById("buscadorClientes").value.trim()}`;
        document.getElementById("listaClientes").innerHTML = ""; // No mostrar nada cuando no hay resultados
    } else {
        contenedorBoton.style.display = "none";
        renderizarClientes(clientesFiltrados);
    }
}

function agregarDesdeBusqueda() {
    const nombre = document.getElementById("buscadorClientes").value.trim();
    if (!nombre) return;

    document.getElementById("nombreCliente").value = nombre;
    document.getElementById("direccion").focus();

    editClienteId = null;
    document.getElementById("btnGuardarCliente").textContent = "Guardar Cliente";
    document.getElementById("btnCancelarEdicionCliente").style.display = "none";

    window.scrollTo({ top: 0, behavior: "smooth" });

    mostrarToast(`Agregando nuevo cliente: ${nombre} 📝`);
}

document.addEventListener("DOMContentLoaded", async () => {
    await abrirDB();
    await mostrarClientes();

    document.getElementById("btnGuardarCliente").addEventListener("click", manejarGuardarCliente);
    document.getElementById("btnCancelarEdicionCliente").addEventListener("click", cancelarEdicionCliente);
    document.getElementById("buscadorClientes").addEventListener("input", filtrarClientes);
    document.getElementById("btnAgregarDesdeBusqueda").addEventListener("click", agregarDesdeBusqueda);
});

function toggleMenu() {
    document.getElementById("navMenu").classList.toggle("open");
}

function mostrarAyuda() {
    const ayuda = document.getElementById("ayuda");
    ayuda.classList.add("visible");
    ayuda.scrollIntoView({ behavior: "smooth", block: "start" });
}

document.getElementById("cerrarAyuda").addEventListener("click", () => {
    document.getElementById("ayuda").classList.remove("visible");
});

if (sessionStorage.getItem("sesionIniciada") !== "true") {
    window.location.href = "login.html";
}
