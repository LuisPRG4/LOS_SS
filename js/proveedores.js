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
  const productos = document.getElementById("productos").value.trim();

  if (!nombre) {
    mostrarToast("El nombre del proveedor es obligatorio ⚠️");
    return;
  }

  const nuevoProveedor = { nombre, empresa, telefono, productos };

  if (editProveedorId === null) {
    try {
      const id = await agregarProveedorDB(nuevoProveedor);
      nuevoProveedor.id = id;
      proveedores.push(nuevoProveedor);
      mostrarToast("Proveedor agregado con éxito 🚚");
    } catch (e) {
      console.error("Error al agregar proveedor:", e);
      mostrarToast("Error al guardar proveedor 😔");
    }
  } else {
    try {
      nuevoProveedor.id = editProveedorId;
      await actualizarProveedorDB(editProveedorId, nuevoProveedor);
      const index = proveedores.findIndex(p => p.id === editProveedorId);
      if (index !== -1) proveedores[index] = nuevoProveedor;
      mostrarToast("Proveedor actualizado ✏️");
      editProveedorId = null;
      document.getElementById("btnGuardarProveedor").textContent = "Guardar Proveedor";
      document.getElementById("btnCancelarProveedor").style.display = "none";
    } catch (e) {
      console.error("Error al actualizar proveedor:", e);
      mostrarToast("Error al actualizar proveedor 😔");
    }
  }

  mostrarProveedores();
  limpiarFormulario();
}

// Mostrar lista
function mostrarProveedores(filtrados = proveedores) {
  if (!Array.isArray(filtrados)) filtrados = [];
  const lista = document.getElementById("listaProveedores");
  lista.innerHTML = "";

  filtrados.forEach((proveedor) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <strong>${proveedor.nombre}</strong><br>
      Empresa: ${proveedor.empresa}<br>
      Teléfono: ${proveedor.telefono}<br>
      Productos: ${proveedor.productos}<br>
      <button onclick="editarProveedor(${proveedor.id})" class="btn-editar">✏️ Editar</button>
      <button onclick="eliminarProveedor(${proveedor.id})" class="btn-eliminar">🗑️ Eliminar</button>
    `;
    lista.appendChild(li);
  });
}

// Editar
function editarProveedor(id) {
  const proveedor = proveedores.find(p => p.id === id);
  if (!proveedor) return;

  document.getElementById("nombreProveedor").value = proveedor.nombre;
  document.getElementById("empresa").value = proveedor.empresa;
  document.getElementById("telefono").value = proveedor.telefono;
  document.getElementById("productos").value = proveedor.productos;

  editProveedorId = proveedor.id;
  document.getElementById("btnGuardarProveedor").textContent = "Actualizar Proveedor";
  document.getElementById("btnCancelarProveedor").style.display = "inline-block";

  document.getElementById("nombreProveedor").scrollIntoView({ behavior: "smooth", block: "start" });
}

// Eliminar
async function eliminarProveedor(id) {
  if (confirm("¿Eliminar este proveedor?")) {
    try {
      await eliminarProveedorDB(id);
      proveedores = proveedores.filter(p => p.id !== id);
      mostrarProveedores();
      mostrarToast("Proveedor eliminado 🗑️");
    } catch (e) {
      console.error("Error al eliminar proveedor:", e);
      mostrarToast("Error al eliminar proveedor 😔");
    }
  }
}

// Cancelar edición
function cancelarEdicionProveedor() {
  editProveedorId = null;
  limpiarFormulario();
  document.getElementById("btnGuardarProveedor").textContent = "Guardar Proveedor";
  document.getElementById("btnCancelarProveedor").style.display = "none";
  mostrarToast("Edición cancelada ❌");
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

// Toast
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
