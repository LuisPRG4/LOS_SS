// clientes.js

let clientes = []; // Ahora se inicializa vacío, los datos se cargarán desde IndexedDB
let editClienteId = null; // Cambiamos de index a ID para edición

// La función mostrarToast ya está definida en db.js y se hace global (window.mostrarToast)
// así que puedes eliminar esta definición local si quieres, o dejarla si prefieres una versión específica para clientes.
// Por consistencia con db.js, recomiendo usar la global.
// function mostrarToast(mensaje) {
//     const toastContainer = document.getElementById("toastContainer");
//     const toast = document.createElement("div");
//     toast.className = "toast";
//     toast.textContent = mensaje;
//     toastContainer.appendChild(toast);

//     setTimeout(() => toast.classList.add("show"), 100);
//     setTimeout(() => {
//         toast.classList.remove("show");
//         setTimeout(() => toast.remove(), 400);
//     }, 3000);
// }

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
        mostrarToast("El nombre del cliente es obligatorio ⚠️", "error"); // Usar tipo 'error'
        return;
    }

    const clienteData = { nombre, direccion, telefono, email, nota };

    try {
        if (editClienteId === null) {
            // Verificar si el cliente ya existe por nombre antes de agregar
            const clienteExistente = clientes.find(c => c.nombre.toLowerCase() === nombre.toLowerCase());
            if (clienteExistente) {
                mostrarToast("Ya existe un cliente con ese nombre. Por favor, usa uno diferente o edita el existente.", "error");
                return;
            }
            await agregarCliente(clienteData);
            mostrarToast("Cliente agregado 💼", "success"); // Usar tipo 'success'
        } else {
            // Cuando es una actualización, buscar por ID para asegurar que no se duplica el nombre
            const clienteExistente = clientes.find(c => c.nombre.toLowerCase() === nombre.toLowerCase() && c.id !== editClienteId);
            if (clienteExistente) {
                mostrarToast("Ya existe otro cliente con ese nombre. Por favor, usa uno diferente o edita el existente.", "error");
                return;
            }

            clienteData.id = editClienteId; // Asegurarse de que el ID esté en los datos a actualizar
            await actualizarCliente(editClienteId, clienteData);
            mostrarToast("Cliente actualizado ✏️", "info"); // Usar tipo 'info'

            editClienteId = null;
            document.getElementById("btnGuardarCliente").textContent = "Guardar Cliente";
            document.getElementById("btnCancelarEdicionCliente").style.display = "none";
        }
    } catch (error) {
        console.error("Error al guardar cliente:", error);
        mostrarToast("Error al guardar cliente. 😔", "error"); // Usar tipo 'error'
    }

    await mostrarClientes();
    limpiarFormulario();
}

async function editarCliente(id) {
    try {
        const cliente = await obtenerClientePorId(id);
        if (!cliente) {
            mostrarToast("Cliente no encontrado para editar. 😢", "error");
            return;
        }

        document.getElementById("nombreCliente").value = cliente.nombre;
        document.getElementById("direccion").value = cliente.direccion;
        document.getElementById("telefono").value = cliente.telefono;
        document.getElementById("email").value = cliente.email;
        document.getElementById("notaCliente").value = cliente.nota || ""; // Asegurarse que nota no sea undefined

        editClienteId = id;
        document.getElementById("btnGuardarCliente").textContent = "Actualizar Cliente";
        document.getElementById("btnCancelarEdicionCliente").style.display = "inline-block";

        document.getElementById("nombreCliente").scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
        console.error("Error al cargar cliente para edición:", error);
        mostrarToast("Error al cargar cliente para edición. 😔", "error");
    }
}

function cancelarEdicionCliente() {
    editClienteId = null;
    limpiarFormulario();
    document.getElementById("btnGuardarCliente").textContent = "Guardar Cliente";
    document.getElementById("btnCancelarEdicionCliente").style.display = "none";
    mostrarToast("Edición cancelada ❌", "info");
}

async function mostrarClientes() {
    try {
        clientes = await obtenerTodosLosClientes();
        renderizarClientes(clientes);
    } catch (error) {
        console.error("Error al mostrar clientes:", error);
        document.getElementById("listaClientes").innerHTML = "<p>Error al cargar los clientes.</p>";
        mostrarToast("Error al cargar los clientes. 😔", "error");
    }
}

async function eliminarClienteDesdeUI(id) {
    const confirmacion = await mostrarConfirmacion(
        "¿Estás seguro de eliminar este cliente? Esta acción no se puede deshacer.",
        "Eliminar Cliente"
    );

    if (confirmacion) {
        try {
            await eliminarCliente(id);
            mostrarToast("Cliente eliminado 🗑️", "success");
        } catch (error) {
            console.error("Error al eliminar cliente:", error);
            mostrarToast("Error al eliminar cliente. 😔", "error");
        }
        await mostrarClientes();
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
        renderizarClientes(clientes);
        return;
    }

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
        document.getElementById("listaClientes").innerHTML = "";
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

    mostrarToast(`Agregando nuevo cliente: ${nombre} 📝`, "info");
}

document.addEventListener("DOMContentLoaded", async () => {
    await abrirDB();
    await mostrarClientes();

    document.getElementById("btnGuardarCliente").addEventListener("click", manejarGuardarCliente);
    document.getElementById("btnCancelarEdicionCliente").addEventListener("click", cancelarEdicionCliente);
    document.getElementById("buscadorClientes").addEventListener("input", filtrarClientes);
    document.getElementById("btnAgregarDesdeBusqueda").addEventListener("click", agregarDesdeBusqueda);

    // *** NUEVO: Event Listeners para los botones de Exportar/Importar/Plantilla (JSON) ***
    document.getElementById('exportarClientesBtn').addEventListener('click', exportarClientesJSON);
    document.getElementById('importarClientesInput').addEventListener('change', importarClientesJSON);
    document.getElementById('descargarPlantillaClientesBtn').addEventListener('click', descargarPlantillaClientesJSON);
});

// --- FUNCIONES DE EXPORTACIÓN / IMPORTACIÓN (SÓLO JSON) para Clientes ---

async function exportarClientesJSON() {
    const clientesAExportar = await obtenerTodosLosClientes(); // Obtiene clientes directamente de IndexedDB
    if (clientesAExportar.length === 0) {
        mostrarToast('No hay clientes en el registro para exportar.', "info");
        return;
    }

    const jsonContent = JSON.stringify(clientesAExportar, null, 2); // Formatea el JSON con indentación para legibilidad

    const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', 'clientes_registro.json'); // Nombre del archivo para clientes
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    mostrarToast('Registro de clientes exportado a clientes_registro.json ✅', "success");
}

async function importarClientesJSON(event) {
    const file = event.target.files[0];
    if (!file) {
        return;
    }

    if (file.type !== 'application/json') {
        mostrarToast('Por favor, selecciona un archivo JSON válido.', "error");
        event.target.value = '';
        return;
    }

    const confirmacion = await mostrarConfirmacion(
        "¿Estás seguro de importar estos datos de clientes? Esto puede agregar o actualizar clientes existentes.",
        "Confirmar Importación de Clientes"
    );
    if (!confirmacion) {
        mostrarToast("Importación de clientes cancelada ❌", "info");
        event.target.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
        const jsonContent = e.target.result;
        let clientesImportados = [];
        try {
            clientesImportados = JSON.parse(jsonContent);
            if (!Array.isArray(clientesImportados)) {
                throw new Error("El archivo JSON no contiene un array de clientes válido.");
            }
        } catch (error) {
            console.error('Error al parsear el archivo JSON de clientes:', error);
            mostrarToast('Error al procesar el archivo JSON de clientes. Asegúrate de que el formato sea correcto. ' + error.message, "error");
            event.target.value = '';
            return;
        }

        if (clientesImportados.length === 0) {
            mostrarToast('El archivo JSON no contiene datos de clientes.', "info");
            event.target.value = '';
            return;
        }

        const clientesActuales = await obtenerTodosLosClientes();
        let clientesAgregados = 0;
        let clientesActualizados = 0;
        const erroresImportacion = [];

        for (const nuevoCliente of clientesImportados) {
            if (!nuevoCliente || typeof nuevoCliente !== 'object' || !nuevoCliente.nombre) {
                erroresImportacion.push(`Objeto de cliente inválido o sin nombre. Saltando.`);
                continue;
            }

            // Normalizar tipos de datos si es necesario (ej. teléfono como string)
            nuevoCliente.telefono = String(nuevoCliente.telefono || '');
            nuevoCliente.direccion = String(nuevoCliente.direccion || '');
            nuevoCliente.email = String(nuevoCliente.email || '');
            nuevoCliente.nota = String(nuevoCliente.nota || ''); // Asegúrate que el campo se llama 'nota'

            let clienteExistenteDB = null;
            if (nuevoCliente.id) {
                clienteExistenteDB = clientesActuales.find(c => c.id === parseInt(nuevoCliente.id));
            }
            if (!clienteExistenteDB) {
                clienteExistenteDB = clientesActuales.find(c => c.nombre.toLowerCase() === nuevoCliente.nombre.toLowerCase());
            }

            if (clienteExistenteDB) {
                const clienteActualizado = { ...clienteExistenteDB, ...nuevoCliente };
                clienteActualizado.id = clienteExistenteDB.id; // Mantener el ID original de IndexedDB
                await actualizarCliente(clienteActualizado.id, clienteActualizado);
                clientesActualizados++;
            } else {
                const clienteParaAgregar = { ...nuevoCliente };
                delete clienteParaAgregar.id; // Permitir que IndexedDB asigne un nuevo ID
                await agregarCliente(clienteParaAgregar);
                clientesAgregados++;
            }
        }

        clientes = await obtenerTodosLosClientes();
        mostrarClientes();

        let mensajeFinal = `Importación de clientes completada:\n${clientesAgregados} clientes agregados.\n${clientesActualizados} clientes actualizados.`;
        if (erroresImportacion.length > 0) {
            mensajeFinal += `\n\nErrores (${erroresImportacion.length}):\n${erroresImportacion.join('\n')}`;
            mostrarToast(mensajeFinal, "error", 5000);
        } else {
            mostrarToast(mensajeFinal, "success");
        }
    };
    reader.readAsText(file);
}

async function descargarPlantillaClientesJSON() {
    const plantillaClientes = [
        {
            "id": null, // Dejar en null para que IndexedDB asigne un nuevo ID
            "nombre": "Ejemplo Cliente 1",
            "direccion": "Calle Falsa 123, Ciudad",
            "telefono": "5551234567",
            "email": "cliente1@example.com",
            "nota": "Cliente frecuente, paga al contado." // Asegúrate que el campo se llama 'nota'
        },
        {
            "id": null,
            "nombre": "Ejemplo Cliente 2",
            "direccion": "Avenida Siempre Viva 456, Pueblo",
            "telefono": "5559876543",
            "email": "cliente2@example.com",
            "nota": "Paga a 30 días, verificar historial de crédito."
        }
    ];

    const jsonContent = JSON.stringify(plantillaClientes, null, 2);

    const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', 'plantilla_clientes.json'); // Nombre del archivo para plantilla
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    mostrarToast('Plantilla de clientes JSON descargada ✅', "success");
}


// Las siguientes funciones son del HTML y no necesitan ir en el JS principal si ya están en un script en el HTML o en otro archivo
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

// Este bloque de redirección debería ir al inicio del script o en un archivo dedicado a la seguridad
if (sessionStorage.getItem("sesionIniciada") !== "true") {
    window.location.href = "login.html";
}
