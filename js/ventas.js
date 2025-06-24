// ventas.js adaptado para usar el nuevo db.js
// No necesitas definir 'db', 'DB_NAME', 'DB_VERSION' ni las funciones CRUD básicas aquí.
// Esas ahora vienen de tu archivo db.js.

// Arrays globales para almacenar los datos en memoria después de cargarlos de IndexedDB
let clientes = [];
let ventas = [];
let productos = [];
let movimientos = [];
let abonos = []; // ¡NUEVO! Para cargar los abonos

let editVentaId = null; // Cambiado de editVentaIndex a editVentaId para usar el ID de la DB
let productosVenta = [];

// Las funciones 'guardarVentas', 'mostrarToast', 'limpiarFormulario', 'actualizarTablaProductos',
// 'eliminarProductoVenta', 'toggleExportOptions' no interactúan directamente con la DB
// y no necesitan cambios en su lógica interna (salvo la carga de datos que se hace al inicio).

async function guardarVentas() {
    // Las ventas ya se guardan/actualizan a través de las funciones de db.js en registrarVenta.
    // Esta función solo necesita recargar los gráficos si es necesario.
    if (location.href.includes("reportesGraficos.html")) {
        // Asegúrate de que esta función (actualizarTodosLosGraficos) también
        // cargue sus datos de IndexedDB si es necesario.
        if (typeof actualizarTodosLosGraficos === 'function') {
            actualizarTodosLosGraficos();
        } else {
            console.warn("La función actualizarTodosLosGraficos no está definida o no es accesible.");
        }
    }
}

async function cargarClientes() {
    try {
        clientes = await obtenerTodosLosClientes();
        const select = document.getElementById("clienteVenta");
        select.innerHTML = '<option value="">Selecciona un cliente</option>';
        clientes.forEach(cliente => {
            const option = document.createElement("option");
            option.value = cliente.nombre;
            option.textContent = `${cliente.nombre} (${cliente.telefono || "sin número"})`;
            select.appendChild(option);
        });
    } catch (error) {
        console.error("Error al cargar clientes:", error);
        mostrarToast("Error al cargar clientes ❌");
    }
}

async function cargarProductos() {
    try {
        productos = await obtenerTodosLosProductos();
        const select = document.getElementById("productoVenta");
        select.innerHTML = '<option value="">Selecciona un producto</option>';
        productos.forEach(producto => {
            const option = document.createElement("option");
            option.value = producto.nombre;
            option.textContent = `${producto.nombre} (${producto.stock} en stock)`;
            select.appendChild(option);
        });
    } catch (error) {
        console.error("Error al cargar productos:", error);
        mostrarToast("Error al cargar productos ❌");
    }
}

async function cargarClientesEnDatalist() {
    try {
        clientes = await obtenerTodosLosClientes();
        const datalist = document.getElementById("clientesLista");
        datalist.innerHTML = "";
        clientes.forEach(cliente => {
            const option = document.createElement("option");
            option.value = cliente.nombre;
            datalist.appendChild(option);
        });
    } catch (error) {
        console.error("Error al cargar clientes en datalist:", error);
    }
}

function mostrarOpcionesPago() {
    const tipo = document.getElementById("tipoPago").value;
    document.getElementById("opcionesContado").style.display = tipo === "contado" ? "block" : "none";
    document.getElementById("opcionesCredito").style.display = tipo === "credito" ? "block" : "none";

    // Si se cambia a crédito, hacer la fecha de vencimiento requerida; de lo contrario, no.
    const inputFechaVencimiento = document.getElementById("fechaVencimiento");
    if (tipo === "credito") {
        inputFechaVencimiento.setAttribute('required', 'true');
    } else {
        inputFechaVencimiento.removeAttribute('required');
        inputFechaVencimiento.value = ''; // Limpiar si se cambia a contado
    }
}


async function registrarVenta() {
    const clienteNombre = document.getElementById("clienteVenta").value.trim();
    const tipoPago = document.getElementById("tipoPago").value;

    clientes = await obtenerTodosLosClientes();
    productos = await obtenerTodosLosProductos();

    const clienteExiste = clientes.some(c => c.nombre.toLowerCase() === clienteNombre.toLowerCase());

    if (!clienteNombre) {
        mostrarToast("Por favor ingresa o selecciona un cliente. 🚫");
        return;
    }

    if (!clienteExiste) {
        const confirmar = confirm(`El cliente "${clienteNombre}" no está registrado. ¿Quieres ir a registrar al cliente ahora?`);
        if (confirmar) {
            window.location.href = "clientes.html";
            return;
        }
        mostrarToast("Cliente no registrado. Por favor, regístralo antes de proceder. 🚫");
        return;
    }

    if (productosVenta.length === 0 || !tipoPago) {
        mostrarToast("Completa todos los campos principales y agrega productos. 🚫");
        return;
    }

    let detallePago = {};
    let montoPendiente = 0;
    let estadoPago = 'Pagado Total'; // Default para contado y al iniciar

    let ingreso = 0;
    productosVenta.forEach(p => {
        ingreso += p.subtotal;
    });

    if (tipoPago === "contado") {
        const metodo = document.getElementById("metodoContado").value;
        if (!metodo) {
            mostrarToast("Selecciona el método de pago. 🚫");
            return;
        }
        detallePago = { metodo };
        montoPendiente = 0; // Contado, no hay monto pendiente
        estadoPago = 'Pagado Total';
    } else if (tipoPago === "credito") {
        const fechaVencimiento = document.getElementById("fechaVencimiento").value;
        if (!fechaVencimiento) {
            mostrarToast("Por favor, selecciona una fecha de vencimiento para la venta a crédito. 🚫");
            return;
        }
        detallePago = { acreedor: clienteNombre, fechaVencimiento };
        montoPendiente = ingreso; // Al inicio, el monto pendiente es el total del ingreso
        estadoPago = 'Pendiente'; // Estado inicial para crédito
    }

    let ganancia = 0;
    productosVenta.forEach(p => {
        ganancia += (p.precio - p.costo) * p.cantidad;
    });

    const nuevaVenta = {
        cliente: clienteNombre,
        productos: [...productosVenta],
        tipoPago,
        detallePago,
        ingreso,
        ganancia,
        fecha: new Date().toISOString().split("T")[0],
        // --- NUEVOS CAMPOS DE CRÉDITO ---
        montoPendiente: montoPendiente,
        estadoPago: estadoPago // 'Pendiente', 'Pagado Parcial', 'Pagado Total'
    };

    try {
        let productosActualizados = [...productos]; // Copia de los productos actuales en memoria

        // Cargar movimientos para la actualización
        movimientos = await obtenerTodosLosMovimientos();

        if (editVentaId !== null) { // Usamos editVentaId
            // Edición de venta existente
            const ventaAnterior = ventas.find(v => v.id === editVentaId);
            if (ventaAnterior) {
                // Revertir stock de la venta anterior
                ventaAnterior.productos.forEach(p => {
                    const prod = productosActualizados.find(prod => prod.nombre === p.nombre);
                    if (prod) {
                        prod.stock += p.cantidad;
                        prod.vendidos = Math.max(0, (prod.vendidos || 0) - p.cantidad);
                    }
                });
            }

            // Aplicar stock de la nueva venta (cantidad vendida)
            productosVenta.forEach(p => {
                const prod = productosActualizados.find(prod => prod.nombre === p.nombre);
                if (prod) {
                    prod.stock = Math.max(0, prod.stock - p.cantidad);
                    prod.vendidos = (prod.vendidos || 0) + p.cantidad;
                }
            });

            // Actualizar la venta en IndexedDB usando su ID
            // ¡IMPORTANTE! Asegúrate de que los campos de crédito se actualicen también
            nuevaVenta.id = editVentaId; // Asegura que el ID esté en el objeto para put()
            await actualizarVenta(editVentaId, nuevaVenta);
            mostrarToast("Venta actualizada ✅");

        } else {
            // Nueva venta
            const idGenerado = await agregarVenta(nuevaVenta); // Añadir a IndexedDB y obtener el ID

            productosVenta.forEach(p => {
                const prod = productosActualizados.find(prod => prod.nombre === p.nombre);
                if (prod) {
                    prod.stock = Math.max(0, prod.stock - p.cantidad);
                    prod.vendidos = (prod.vendidos || 0) + p.cantidad;
                }
            });

            const costoTotal = productosVenta.reduce((total, p) => total + (p.costo * p.cantidad), 0);

            // Añadir movimientos a IndexedDB
            await agregarMovimientoDB({
                tipo: "ingreso",
                monto: ingreso,
                fecha: nuevaVenta.fecha,
                descripcion: `Venta a ${clienteNombre} (${tipoPago})`
            });

            await agregarMovimientoDB({
                tipo: "gasto",
                monto: costoTotal,
                fecha: nuevaVenta.fecha,
                descripcion: `Costo de venta a ${clienteNombre}`
            });

            mostrarToast("Venta registrada con éxito ✅");
        }

        // Actualizar todos los productos modificados en IndexedDB
        for (const prod of productosActualizados) {
            await actualizarProducto(prod.id, prod); // Asegúrate de que 'prod' tenga un ID
        }

        // Recargar los datos en memoria después de las operaciones de DB
        ventas = await obtenerTodasLasVentas();
        productos = await obtenerTodosLosProductos();
        movimientos = await obtenerTodosLosMovimientos();
        abonos = await obtenerTodosLosAbonos(); // Sincroniza abonos también

        editVentaId = null; // Resetea el ID de edición
        document.getElementById("btnRegistrarVenta").textContent = "Registrar Venta";

        guardarVentas(); // Para actualizar gráficos si aplica
        mostrarVentas(); // Recarga la UI

        // ¡¡¡AÑADE ESTA LÍNEA AQUÍ!!!
        await cargarProductos(); // <-- ¡NUEVA LÍNEA! Esto recarga el select de productos con el stock actualizado.
        
        limpiarFormulario();
    } catch (error) {
        console.error("Error al registrar/actualizar venta:", error);
        mostrarToast("Error al registrar venta ❌");
    }
}

// Actualizada para cargar desde IndexedDB
async function mostrarVentas(filtradas) {
    if (!filtradas) {
        ventas = await obtenerTodasLasVentas();
        // Para cada venta, calcular el monto pendiente actualizando desde abonos
        for (const venta of ventas) {
            if (venta.tipoPago === 'credito') {
                const abonosDeVenta = await obtenerAbonosPorPedidoId(venta.id); // Usamos obtenerAbonosPorPedidoId
                const totalAbonado = abonosDeVenta.reduce((sum, abono) => sum + abono.montoAbonado, 0);
                venta.montoPendiente = Math.max(0, venta.ingreso - totalAbonado); // Recalcular monto pendiente

                if (venta.montoPendiente === 0) {
                    venta.estadoPago = 'Pagado Total';
                } else if (totalAbonado > 0 && totalAbonado < venta.ingreso) {
                    venta.estadoPago = 'Pagado Parcial';
                } else {
                    venta.estadoPago = 'Pendiente';
                }
                // Si la venta se actualizó, persistir el cambio en la DB (opcional, pero buena práctica si el estado cambia)
                await actualizarVenta(venta.id, venta);
            }
        }
        filtradas = ventas;
    }

    const lista = document.getElementById("listaVentas");
    lista.innerHTML = "";

    if (filtradas.length === 0) {
        lista.innerHTML = `<p class="text-center text-gray-400">No hay ventas registradas.</p>`;
        return;
    }

    const grupoContado = {};
    const grupoCredito = [];

    filtradas.forEach((venta) => {
        if (venta.tipoPago === "contado") {
            const metodo = venta.detallePago.metodo || "Efectivo"; // Default por si no existe
            if (!grupoContado[metodo]) grupoContado[metodo] = [];
            grupoContado[metodo].push({ venta, id: venta.id });
        } else {
            grupoCredito.push({ venta, id: venta.id });
        }
    });

    // Categoría: Contado
    if (Object.keys(grupoContado).length > 0) {
        const titulo = document.createElement("h2");
        titulo.textContent = "🟣 Ventas al Contado";
        titulo.className = "text-lg font-bold text-purple-700 mt-4";
        lista.appendChild(titulo);

        for (const metodo in grupoContado) {
            const subtitulo = document.createElement("h3");
            subtitulo.textContent = `💠 Método: ${metodo}`;
            subtitulo.className = "text-md font-semibold text-purple-600 mt-3";
            lista.appendChild(subtitulo);

            grupoContado[metodo].forEach(({ venta, id }) => {
                const card = crearCardVenta(venta, id);
                lista.appendChild(card);
            });
        }
    }

    // Categoría: Crédito
    if (grupoCredito.length > 0) {
        const titulo = document.createElement("h2");
        titulo.textContent = "🔵 Ventas a Crédito";
        titulo.className = "text-lg font-bold text-blue-700 mt-6";
        lista.appendChild(titulo);

        // Opcional: Ordenar ventas a crédito por fecha de vencimiento
        grupoCredito.sort((a, b) => {
            const dateA = new Date(a.venta.detallePago.fechaVencimiento || '9999-12-31');
            const dateB = new Date(b.venta.detallePago.fechaVencimiento || '9999-12-31');
            return dateA - dateB;
        });

        grupoCredito.forEach(({ venta, id }) => {
            const card = crearCardVenta(venta, id);
            lista.appendChild(card);
        });
    }
}


function crearCardVenta(venta, id) {
    const productosTexto = venta.productos.map(p => `${p.nombre} x${p.cantidad}`).join(", ");

    let detallePagoHTML = '';
    let estadoPagoHTML = '';
    let bgColorClass = 'border-purple-200'; // Default color

    if (venta.tipoPago === "contado") {
        detallePagoHTML = `<span class="text-sm text-gray-600">Método: ${venta.detallePago.metodo}</span>`;
        bgColorClass = 'border-purple-200';
    } else { // Crédito
        const fechaVencimiento = venta.detallePago.fechaVencimiento || "Sin fecha";
        detallePagoHTML = `
            <span class="text-sm text-gray-600">Acreedor: ${venta.detallePago.acreedor || "N/A"}<br>
            Vence: ${fechaVencimiento}
            </span>`;

        // Colores y estado de pago
        switch (venta.estadoPago) {
            case 'Pendiente':
                estadoPagoHTML = `<span class="text-red-600 font-semibold text-sm">(Pendiente: $${venta.montoPendiente.toFixed(2)})</span>`;
                bgColorClass = 'border-red-400';
                break;
            case 'Pagado Parcial':
                estadoPagoHTML = `<span class="text-orange-600 font-semibold text-sm">(Parcial: $${venta.montoPendiente.toFixed(2)} restantes)</span>`;
                bgColorClass = 'border-orange-400';
                break;
            case 'Pagado Total':
                estadoPagoHTML = `<span class="text-green-600 font-semibold text-sm">(Pagado)</span>`;
                bgColorClass = 'border-green-400';
                break;
            default:
                estadoPagoHTML = `<span class="text-gray-600 font-semibold text-sm">(Estado desconocido)</span>`;
                bgColorClass = 'border-gray-300';
        }

        // Resaltar si la fecha de vencimiento está pasada y sigue pendiente
        if (venta.tipoPago === 'credito' && venta.estadoPago !== 'Pagado Total' && fechaVencimiento && new Date(fechaVencimiento) < new Date()) {
            bgColorClass = 'border-red-700 ring-2 ring-red-500'; // Más llamativo para vencido
        }
    }


    const card = document.createElement("div");
    // Usamos la clase de color de borde dinámicamente
    card.className = `bg-white border ${bgColorClass} rounded-2xl p-4 shadow-md mt-2 transition-all duration-300`;

    card.innerHTML = `
        <div class="flex justify-between items-center mb-2">
            <h3 class="text-lg font-semibold text-purple-700">${venta.cliente}</h3>
            <span class="text-sm text-gray-500">${venta.fecha}</span>
        </div>
        <p class="text-sm text-gray-800"><strong>Productos:</strong> ${productosTexto}</p>
        <p class="text-sm text-gray-800"><strong>Total:</strong> $${venta.ingreso.toFixed(2)}</p>
        <p class="text-sm text-gray-800"><strong>Pago:</strong> ${venta.tipoPago} ${estadoPagoHTML}</p>
        ${detallePagoHTML}
        <div class="mt-3 flex gap-2">
            <button onclick="cargarVenta(${id})" class="bg-yellow-400 hover:bg-yellow-500 text-white px-3 py-1 rounded-md text-sm transition">✏️ Editar</button>
            <button onclick="revertirVenta(${id})" class="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-md text-sm transition">↩️ Revertir</button>
            <button onclick="eliminarVentaPermanente(${id})" class="bg-gray-500 hover:bg-gray-700 text-white px-3 py-1 rounded-md text-sm transition">🗑 Eliminar</button>
            ${venta.tipoPago === 'credito' && venta.montoPendiente > 0 ?
                `<button onclick="abrirModalAbono(${id})" class="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded-md text-sm transition">💰 Abonar</button>`
                : ''}
        </div>
    `;

    return card;
}


async function filtrarVentas() {
    const input = document.getElementById("buscadorVentas").value.toLowerCase().trim();
    ventas = await obtenerTodasLasVentas(); // Asegúrate de tener la lista completa y actualizada

    // Recalcular montos pendientes antes de filtrar
    for (const venta of ventas) {
        if (venta.tipoPago === 'credito') {
            const abonosDeVenta = await obtenerAbonosPorPedidoId(venta.id);
            const totalAbonado = abonosDeVenta.reduce((sum, abono) => sum + abono.montoAbonado, 0);
            venta.montoPendiente = Math.max(0, venta.ingreso - totalAbonado);
            if (venta.montoPendiente === 0) {
                venta.estadoPago = 'Pagado Total';
            } else if (totalAbonado > 0 && totalAbonado < venta.ingreso) {
                venta.estadoPago = 'Pagado Parcial';
            } else {
                venta.estadoPago = 'Pendiente';
            }
            await actualizarVenta(venta.id, venta); // Persistir el estado actualizado
        }
    }


    const filtradas = ventas.filter(v => {
        const productos = v.productos.map(p => p.nombre.toLowerCase()).join(" ");
        const cliente = v.cliente.toLowerCase();
        const fecha = v.fecha.toLowerCase();
        const metodo = (v.detallePago.metodo || "").toLowerCase();
        const acreedor = (v.detallePago.acreedor || "").toLowerCase();
        // Incluir los nuevos campos de crédito en el filtro
        const tipoVenta = (v.tipoPago || "").toLowerCase();
        const estadoPago = (v.estadoPago || "").toLowerCase();
        const fechaVencimiento = (v.detallePago.fechaVencimiento || "").toLowerCase();


        return (
            cliente.includes(input) ||
            fecha.includes(input) ||
            productos.includes(input) ||
            metodo.includes(input) ||
            acreedor.includes(input) ||
            v.ingreso.toString().includes(input) ||
            tipoVenta.includes(input) || // Nuevo: permite buscar por "crédito" o "contado"
            estadoPago.includes(input) || // Nuevo: permite buscar por "pendiente", "parcial", "total"
            fechaVencimiento.includes(input)
        );
    });

    mostrarVentas(filtradas);
}

function limpiarFormulario() {
    document.getElementById("clienteVenta").value = "";
    document.getElementById("productoVenta").value = "";
    document.getElementById("tipoPago").value = "";
    document.getElementById("metodoContado").value = "";
    document.getElementById("fechaVencimiento").value = "";
    productosVenta = [];
    actualizarTablaProductos();
    mostrarOpcionesPago(); // Restablece la visibilidad de opciones de pago
    editVentaId = null; // Resetea el ID de edición
    document.getElementById("btnRegistrarVenta").textContent = "Registrar Venta";
}

function mostrarToast(mensaje) {
    const toastContainer = document.getElementById("toastContainer");
    if (!toastContainer) { // Crea el contenedor si no existe
        const body = document.querySelector('body');
        const newContainer = document.createElement('div');
        newContainer.id = 'toastContainer';
        newContainer.style.position = 'fixed';
        newContainer.style.bottom = '20px';
        newContainer.style.right = '20px';
        newContainer.style.zIndex = '1000';
        newContainer.style.display = 'flex';
        newContainer.style.flexDirection = 'column';
        newContainer.style.alignItems = 'flex-end';
        newContainer.style.gap = '10px';
        body.appendChild(newContainer);
        // Aplica estilos básicos para las notificaciones
        const style = document.createElement('style');
        style.textContent = `
            .toast {
                background-color: #333;
                color: #fff;
                padding: 10px 20px;
                border-radius: 5px;
                opacity: 0;
                transition: opacity 0.3s ease-in-out, transform 0.3s ease-in-out;
                transform: translateY(20px);
            }
            .toast.show {
                opacity: 1;
                transform: translateY(0);
            }
        `;
        document.head.appendChild(style);
        // Vuelve a obtener la referencia después de crear
        const updatedToastContainer = document.getElementById("toastContainer");
        const toast = document.createElement("div");
        toast.className = "toast";
        toast.textContent = mensaje;
        updatedToastContainer.appendChild(toast);
        setTimeout(() => toast.classList.add("show"), 100);
        setTimeout(() => {
            toast.classList.remove("show");
            setTimeout(() => toast.remove(), 400);
        }, 3000);
        return; // Salimos para evitar duplicar el toast
    }

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


async function revertirVenta(id) {
    ventas = await obtenerTodasLasVentas();
    productos = await obtenerTodosLosProductos();
    movimientos = await obtenerTodosLosMovimientos();
    abonos = await obtenerTodosLosAbonos(); // Cargar abonos

    const venta = ventas.find(v => v.id === id);
    if (!venta) {
        mostrarToast("Venta no encontrada para revertir. 🚫");
        return;
    }

    const motivo = prompt("¿Por qué deseas revertir esta venta?");
    if (motivo === null || motivo.trim() === "") {
        mostrarToast("Debes ingresar un motivo para revertir la venta. 🚫");
        return;
    }

    if (confirm(`¿Seguro que quieres revertir la venta a ${venta.cliente}?\nMotivo: ${motivo}`)) {
        try {
            // Revertir stock de productos
            for (const p of venta.productos) {
                const prod = productos.find(prod => prod.nombre === p.nombre);
                if (prod) {
                    prod.stock += p.cantidad;
                    prod.vendidos = Math.max(0, (prod.vendidos || 0) - p.cantidad);
                    await actualizarProducto(prod.id, prod);
                }
            }

            // Si es una venta a crédito, eliminar los abonos asociados
            if (venta.tipoPago === 'credito') {
                const abonosDeVenta = abonos.filter(ab => ab.pedidoId === venta.id);
                for (const abono of abonosDeVenta) {
                    await eliminarAbonoDB(abono.id); // Usamos eliminarAbonoDB
                }
                mostrarToast(`Eliminados ${abonosDeVenta.length} abonos de la venta a crédito.`);
            }

            // Eliminar la venta de IndexedDB
            await eliminarVenta(id);

            // Recargar los datos después de las operaciones
            ventas = await obtenerTodasLasVentas();
            productos = await obtenerTodosLosProductos();
            movimientos = await obtenerTodosLosMovimientos();
            abonos = await obtenerTodosLosAbonos();

            guardarVentas(); // Para actualizar gráficos si aplica
            mostrarVentas();
            mostrarToast("Venta revertida y stock actualizado ✅");
        } catch (error) {
            console.error("Error al revertir venta:", error);
            mostrarToast("Error al revertir venta ❌");
        }
    }
}

async function eliminarVentaPermanente(id) {
    ventas = await obtenerTodasLasVentas();
    movimientos = await obtenerTodosLosMovimientos();
    abonos = await obtenerTodosLosAbonos(); // Cargar abonos

    const venta = ventas.find(v => v.id === id);
    if (!venta) {
        mostrarToast("Venta no encontrada para eliminar. 🚫");
        return;
    }

    if (!confirm(`¿Estás seguro de eliminar la venta a ${venta.cliente} sin revertir stock? Esta acción es irreversible.`)) return;

    try {
        // Añadir movimiento de ajuste en Finanzas (a IndexedDB)
        await agregarMovimientoDB({
            tipo: "ajuste",
            monto: -venta.ingreso,
            ganancia: -venta.ganancia, // Ojo, esta ganancia podría ser negativa en un ajuste
            fecha: new Date().toISOString().split("T")[0],
            descripcion: `Eliminación manual de venta a ${venta.cliente} (ID: ${id})`
        });

        // Si es una venta a crédito, eliminar los abonos asociados
        if (venta.tipoPago === 'credito') {
            const abonosDeVenta = abonos.filter(ab => ab.pedidoId === venta.id);
            for (const abono of abonosDeVenta) {
                await eliminarAbonoDB(abono.id);
            }
            mostrarToast(`Eliminados ${abonosDeVenta.length} abonos de la venta eliminada.`);
        }

        // Eliminar la venta de IndexedDB
        await eliminarVenta(id);

        // Re-sincronizar arrays globales después de las operaciones
        ventas = await obtenerTodasLasVentas();
        movimientos = await obtenerTodosLosMovimientos();
        abonos = await obtenerTodosLosAbonos();

        guardarVentas(); // Para actualizar gráficos si aplica
        mostrarVentas();
        mostrarToast("Venta eliminada permanentemente 🗑️");
    } catch (error) {
        console.error("Error al eliminar venta:", error);
        mostrarToast("Error al eliminar venta ❌");
    }
}

async function cargarVenta(id) {
    ventas = await obtenerTodasLasVentas();
    const venta = ventas.find(v => v.id === id);
    if (!venta) return;

    document.getElementById("clienteVenta").value = venta.cliente;
    document.getElementById("tipoPago").value = venta.tipoPago;
    mostrarOpcionesPago(); // Para que se muestren las opciones correctas

    if (venta.tipoPago === "contado") {
        document.getElementById("metodoContado").value = venta.detallePago.metodo;
    } else { // Crédito
        document.getElementById("fechaVencimiento").value = venta.detallePago.fechaVencimiento;
        // Podrías cargar el monto pendiente aquí si lo tuvieras en el formulario
        // document.getElementById("montoPendienteInput").value = venta.montoPendiente.toFixed(2);
    }

    productosVenta = [...venta.productos];
    actualizarTablaProductos();
    editVentaId = id; // Almacena el ID de la venta que se está editando
    document.getElementById("btnRegistrarVenta").textContent = "Actualizar Venta";

    setTimeout(() => {
        const formulario = document.getElementById("formularioVenta");
        if (formulario) {
            formulario.scrollIntoView({ behavior: "smooth", block: "start" });
        }
    }, 100);
}

async function agregarProductoAVenta() {
    const productoNombre = document.getElementById("productoVenta").value;
    const cantidad = parseInt(document.getElementById("cantidadVenta").value);

    if (!productoNombre || isNaN(cantidad) || cantidad < 1) {
        mostrarToast("Selecciona un producto válido y una cantidad. 🚫");
        return;
    }

    productos = await obtenerTodosLosProductos();
    const producto = productos.find(p => p.nombre === productoNombre);
    if (!producto) {
        mostrarToast("Producto no encontrado en el inventario. 🚫");
        return;
    }

    const existente = productosVenta.find(p => p.nombre === productoNombre);
    const totalCantidad = (existente ? existente.cantidad : 0) + cantidad;

    if (producto.stock < totalCantidad) {
        mostrarToast(`Stock insuficiente. Disponible: ${producto.stock}, Solicitado: ${totalCantidad} 🚫`);
        return;
    }

    if (existente) {
        existente.cantidad += cantidad;
        existente.subtotal = existente.cantidad * producto.precio;
    } else {
        productosVenta.push({
            nombre: producto.nombre,
            precio: producto.precio,
            costo: producto.costo,
            cantidad,
            subtotal: cantidad * producto.precio
        });
    }

    actualizarTablaProductos();

    document.getElementById("productoVenta").value = "";
    document.getElementById("cantidadVenta").value = "";
}

function actualizarTablaProductos() {
    const tabla = document.getElementById("tablaProductosVenta");
    tabla.innerHTML = "";
    let total = 0;

    productosVenta.forEach((p, index) => {
        const fila = document.createElement("tr");
        fila.innerHTML = `
            <td>${p.nombre}</td>
            <td>${p.cantidad}</td>
            <td>$${p.precio.toFixed(2)}</td>
            <td>$${p.subtotal.toFixed(2)}</td>
            <td><button onclick="eliminarProductoVenta(${index})" class="text-red-500 hover:text-red-700">❌</button></td>
        `;
        tabla.appendChild(fila);
        total += p.subtotal;
    });

    document.getElementById("totalVenta").textContent = total.toFixed(2);
}

function eliminarProductoVenta(index) {
    productosVenta.splice(index, 1);
    actualizarTablaProductos();
}

function toggleExportOptions() {
    const opciones = document.getElementById("opcionesExportacion");
    opciones.style.display = opciones.style.display === "none" ? "block" : "none";
}

async function exportarExcel() {
    ventas = await obtenerTodasLasVentas(); // Carga las ventas más recientes
    const data = ventas.map(venta => ({
        Cliente: venta.cliente,
        Productos: venta.productos.map(p => `${p.nombre} x${p.cantidad}`).join(", "),
        Ingreso: venta.ingreso.toFixed(2),
        Ganancia: venta.ganancia.toFixed(2),
        Fecha: venta.fecha,
        Pago: venta.tipoPago,
        Detalle: venta.tipoPago === "contado" ? venta.detallePago.metodo : `Vence: ${venta.detallePago.fechaVencimiento || "N/A"}`,
        Monto_Pendiente: venta.tipoPago === "credito" ? venta.montoPendiente.toFixed(2) : "N/A",
        Estado_Pago: venta.tipoPago === "credito" ? venta.estadoPago : "N/A"
    }));

    let csv = "Cliente,Productos,Ingreso,Ganancia,Fecha,Pago,Detalle,Monto_Pendiente,Estado_Pago\n";
    data.forEach(row => {
        csv += `${row.Cliente},"${row.Productos}",${row.Ingreso},${row.Ganancia},${row.Fecha},${row.Pago},"${row.Detalle}",${row.Monto_Pendiente},${row.Estado_Pago}\n`;
    });

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "ventas.csv";
    link.click();
    mostrarToast("📊 Excel exportado");
}

async function exportarPDF() {
    ventas = await obtenerTodasLasVentas(); // Carga las ventas más recientes
    const ventana = window.open('', '_blank');
    let contenido = `
        <html>
            <head><title>Reporte de Ventas</title></head>
            <body>
                <h2 style="color:#5b2d90;">📋 Historial de Ventas</h2>
                <table border="1" cellpadding="5" cellspacing="0" style="border-collapse: collapse; width: 100%;">
                    <tr>
                        <th>Cliente</th>
                        <th>Productos</th>
                        <th>Ingreso</th>
                        <th>Ganancia</th>
                        <th>Fecha</th>
                        <th>Pago</th>
                        <th>Detalle</th>
                        <th>Monto Pendiente</th>
                        <th>Estado Pago</th>
                    </tr>`;

    ventas.forEach(venta => {
        const productos = venta.productos.map(p => `${p.nombre} x${p.cantidad}`).join(", ");
        const detalle = venta.tipoPago === "contado"
            ? venta.detallePago.metodo
            : `Vence: ${venta.detallePago.fechaVencimiento || "N/A"}`;
        const montoPendiente = venta.tipoPago === "credito" ? `$${venta.montoPendiente.toFixed(2)}` : "N/A";
        const estadoPago = venta.tipoPago === "credito" ? venta.estadoPago : "N/A";

        contenido += `
                    <tr>
                        <td>${venta.cliente}</td>
                        <td>${productos}</td>
                        <td>$${venta.ingreso.toFixed(2)}</td>
                        <td>$${venta.ganancia.toFixed(2)}</td>
                        <td>${venta.fecha}</td>
                        <td>${venta.tipoPago}</td>
                        <td>${detalle}</td>
                        <td>${montoPendiente}</td>
                        <td>${estadoPago}</td>
                    </tr>`;
    });

    contenido += `
                </table>
            </body>
        </html>`;

    ventana.document.write(contenido);
    ventana.document.close();
    ventana.print();
    mostrarToast("📄 PDF preparado para impresión");
}

async function validarClienteIngresado() {
    clientes = await obtenerTodosLosClientes();

    const inputCliente = document.getElementById("clienteVenta");
    const texto = inputCliente.value.trim().toLowerCase();
    const existe = clientes.some(c => c.nombre.toLowerCase() === texto);

    let divAgregar = document.getElementById("agregarClientePendiente");
    if (!divAgregar) {
        divAgregar = document.createElement("div");
        divAgregar.id = "agregarClientePendiente";
        divAgregar.style.marginTop = "5px";
        divAgregar.style.display = "none";

        const btnAgregar = document.createElement("button");
        btnAgregar.textContent = "➕ Agregar cliente no registrado";
        btnAgregar.className = "btn-agregar-cliente";
        btnAgregar.onclick = () => window.location.href = "clientes.html";
        divAgregar.appendChild(btnAgregar);

        inputCliente.insertAdjacentElement("afterend", divAgregar);
    }

    if (texto !== "" && !existe) {
        divAgregar.style.display = "block";
    } else {
        divAgregar.style.display = "none";
    }
}

// === Funciones para Abonos / Modal de Cobro ===

let currentVentaIdAbono = null; // Para saber qué venta se está abonando

// Abre el modal para registrar un abono
async function abrirModalAbono(ventaId) {
    currentVentaIdAbono = ventaId;
    const venta = ventas.find(v => v.id === ventaId);

    if (!venta || venta.tipoPago !== 'credito') {
        mostrarToast("No se puede abonar a esta venta.");
        return;
    }

    // Aseguramos que el monto pendiente esté actualizado
    const abonosDeVenta = await obtenerAbonosPorPedidoId(ventaId);
    const totalAbonado = abonosDeVenta.reduce((sum, abono) => sum + abono.montoAbonado, 0);
    const montoPendienteActualizado = venta.ingreso - totalAbonado;
    venta.montoPendiente = Math.max(0, montoPendienteActualizado); // Para evitar negativos

    // Actualizar el estado de pago de la venta si es necesario
    if (venta.montoPendiente === 0) {
        venta.estadoPago = 'Pagado Total';
    } else if (totalAbonado > 0 && totalAbonado < venta.ingreso) {
        venta.estadoPago = 'Pagado Parcial';
    } else {
        venta.estadoPago = 'Pendiente';
    }
    await actualizarVenta(venta.id, venta); // Persistir el estado actualizado

    document.getElementById("detalleVentaModal").innerHTML = `
        <p><strong>Cliente:</strong> ${venta.cliente}</p>
        <p><strong>Total Venta:</strong> $${venta.ingreso.toFixed(2)}</p>
        <p><strong>Monto Pendiente:</strong> <span class="text-red-500 font-bold">$${venta.montoPendiente.toFixed(2)}</span></p>
        <p><strong>Estado:</strong> ${venta.estadoPago}</p>
        <p><strong>Vencimiento:</strong> ${venta.detallePago.fechaVencimiento || 'N/A'}</p>
    `;

    document.getElementById("montoAbono").value = venta.montoPendiente.toFixed(2); // Valor por defecto
    document.getElementById("modalAbono").style.display = "flex";

    document.getElementById("modalAbono").scrollIntoView({ behavior: 'smooth', block: 'center' }); 

    // Cargar y mostrar abonos previos de esta venta
    await mostrarAbonosPrevios(ventaId);
}

// Cierra el modal de abono
function cerrarModalAbono() {
    document.getElementById("modalAbono").style.display = "none";
    document.getElementById("montoAbono").value = "";
    currentVentaIdAbono = null;
}

// Registra el abono
async function registrarAbono() {
    if (currentVentaIdAbono === null) {
        mostrarToast("No hay una venta seleccionada para abonar. 🚫");
        return;
    }

    const montoAbono = parseFloat(document.getElementById("montoAbono").value);
    if (isNaN(montoAbono) || montoAbono <= 0) {
        mostrarToast("Ingresa un monto de abono válido. 🚫");
        return;
    }

    const venta = ventas.find(v => v.id === currentVentaIdAbono);
    if (!venta) {
        mostrarToast("Venta no encontrada. 🚫");
        return;
    }

    if (montoAbono > venta.montoPendiente) {
        mostrarToast(`El abono ($${montoAbono.toFixed(2)}) no puede ser mayor que el monto pendiente ($${venta.montoPendiente.toFixed(2)}). 🚫`);
        return;
    }

    const nuevoAbono = {
        pedidoId: currentVentaIdAbono, // Es el ID de la venta, para el objectStore abonos
        fechaAbono: new Date().toISOString().split("T")[0],
        montoAbonado: montoAbono
    };

    try {
        await agregarAbonoDB(nuevoAbono);
        mostrarToast("Abono registrado con éxito ✅");

        // Actualizar el monto pendiente y estado de pago de la venta
        venta.montoPendiente -= montoAbono;
        if (venta.montoPendiente <= 0.01) { // Usamos un pequeño delta por seguridad flotante
            venta.montoPendiente = 0;
            venta.estadoPago = 'Pagado Total';
        } else {
            venta.estadoPago = 'Pagado Parcial';
        }
        await actualizarVenta(venta.id, venta); // Actualizar la venta en la DB

        // Registrar un movimiento de ingreso por el abono
        await agregarMovimientoDB({
            tipo: "ingreso",
            monto: montoAbono,
            fecha: nuevoAbono.fechaAbono,
            descripcion: `Abono a venta a crédito de ${venta.cliente}`
        });

        // Recargar datos y actualizar UI
        ventas = await obtenerTodasLasVentas();
        movimientos = await obtenerTodosLosMovimientos();
        abonos = await obtenerTodosLosAbonos(); // Recargar abonos para el modal
        mostrarVentas(); // Para que se actualicen las tarjetas en la lista

        // Actualizar el modal de abonos y la lista de abonos previos
        document.getElementById("montoAbono").value = venta.montoPendiente.toFixed(2);
        document.getElementById("detalleVentaModal").innerHTML = `
            <p><strong>Cliente:</strong> ${venta.cliente}</p>
            <p><strong>Total Venta:</strong> $${venta.ingreso.toFixed(2)}</p>
            <p><strong>Monto Pendiente:</strong> <span class="text-red-500 font-bold">$${venta.montoPendiente.toFixed(2)}</span></p>
            <p><strong>Estado:</strong> ${venta.estadoPago}</p>
            <p><strong>Vencimiento:</strong> ${venta.detallePago.fechaVencimiento || 'N/A'}</p>
        `;
        await mostrarAbonosPrevios(currentVentaIdAbono); // Recargar la lista de abonos dentro del modal

        if (venta.montoPendiente === 0) {
            mostrarToast("Venta a crédito completamente pagada! 🎉");
            cerrarModalAbono(); // Cerrar modal si ya se pagó todo
        }

    } catch (error) {
        console.error("Error al registrar abono:", error);
        mostrarToast("Error al registrar abono. 😔");
    }
}

// Muestra los abonos previos en el modal
async function mostrarAbonosPrevios(ventaId) {
    const listaAbonos = document.getElementById("listaAbonosModal");
    listaAbonos.innerHTML = '';
    const abonosDeVenta = await obtenerAbonosPorPedidoId(ventaId);

    if (abonosDeVenta.length === 0) {
        listaAbonos.innerHTML = '<p class="text-center text-gray-500 text-sm mt-2">No hay abonos previos registrados para esta venta.</p>';
        return;
    }

    const ul = document.createElement('ul');
    ul.className = 'list-disc pl-5 mt-2 text-sm text-gray-700';

    abonosDeVenta.sort((a, b) => new Date(a.fechaAbono) - new Date(b.fechaAbono)); // Ordenar por fecha

    abonosDeVenta.forEach(abono => {
        const li = document.createElement('li');
        li.innerHTML = `<strong>Fecha:</strong> ${abono.fechaAbono}, <strong>Monto:</strong> $${abono.montoAbonado.toFixed(2)}`;
        ul.appendChild(li);
    });
    listaAbonos.appendChild(ul);
}


document.addEventListener("DOMContentLoaded", async () => {
    try {
        await abrirDB();

        ventas = await obtenerTodasLasVentas();
        clientes = await obtenerTodosLosClientes();
        productos = await obtenerTodosLosProductos();
        movimientos = await obtenerTodosLosMovimientos();
        abonos = await obtenerTodosLosAbonos(); // Cargar abonos al inicio

        mostrarVentas();
        mostrarOpcionesPago();
        cargarClientes();
        cargarProductos();
        cargarClientesEnDatalist();

        const inputCliente = document.getElementById("clienteVenta");
        inputCliente.addEventListener("input", validarClienteIngresado);

        // Asociar eventos del modal de abono
        document.getElementById("btnRegistrarAbono").addEventListener("click", registrarAbono);
        document.getElementById("cerrarModalAbono").addEventListener("click", cerrarModalAbono);
        // Cerrar modal al hacer clic fuera del contenido del modal
        document.getElementById("modalAbono").addEventListener("click", (e) => {
            if (e.target.id === "modalAbono") {
                cerrarModalAbono();
            }
        });

    } catch (error) {
        console.error("Error al inicializar la aplicación:", error);
        mostrarToast("Error grave al cargar datos 😥");
    }
});
