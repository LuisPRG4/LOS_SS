// js/ventas.js (CÓDIGO CORREGIDO Y RECOMENDADO)

let clientes = [];
let ventas = [];
let productos = []; // Ahora 'productos' globalmente contendrá la unidad de medida
let movimientos = [];
let abonos = []; // ¡NUEVO! Para cargar los abonos

let editVentaId = null; // Cambiado de editVentaIndex a editVentaId para usar el ID de la DB
let productosVenta = []; // Array temporal para los productos de la venta actual

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
        // select.innerHTML = '<option value="">Selecciona un cliente</option>'; // Ya no es un select, es un datalist input
        // Clientes para la datalist ya se cargan en cargarClientesEnDatalist
    } catch (error) {
        console.error("Error al cargar clientes:", error);
        mostrarToast("Error al cargar clientes ❌");
    }
}

async function cargarProductos() {
    try {
        productos = await obtenerTodosLosProductos(); // Asegúrate de que esto carga la unidad de medida
        const select = document.getElementById("productoVenta");
        select.innerHTML = '<option value="">Selecciona un producto</option>';
        productos.forEach(producto => {
            const option = document.createElement("option");
            option.value = producto.nombre;
            // ¡MODIFICADO! Mostrar la unidad de medida también en el select de producto
            option.textContent = `${producto.nombre} (${producto.stock} ${producto.unidadMedida || 'unidad(es)'} en stock)`;
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

function obtenerFechaVenta() {
    const usarFechaPersonalizada = document.getElementById("activarFechaManual")?.checked;
    const fechaPersonalizada = document.getElementById("fechaVentaPersonalizada")?.value; // Renombrado
    const horaPersonalizada = document.getElementById("horaVentaPersonalizada")?.value; // Nuevo

    if (usarFechaPersonalizada && fechaPersonalizada) {
        // Combinar fecha y hora si hay hora personalizada, sino solo la fecha
        return horaPersonalizada ? `${fechaPersonalizada}T${horaPersonalizada}:00` : `${fechaPersonalizada}T00:00:00`;
    }

    // Si no, usamos la fecha y hora actuales en formato ISO
    return new Date().toISOString().slice(0, 16); // YYYY-MM-DDTHH:mm
}

// Nueva función para el toggle de fecha manual
function toggleFechaManual() {
    const opcionFechaManual = document.getElementById("opcionFechaManual");
    const activarFechaManualCheckbox = document.getElementById("activarFechaManual");
    if (activarFechaManualCheckbox.checked) {
        opcionFechaManual.style.display = "block";
    } else {
        opcionFechaManual.style.display = "none";
        // Opcional: limpiar los campos si se desactiva
        document.getElementById("fechaVentaPersonalizada").value = "";
        document.getElementById("horaVentaPersonalizada").value = "";
    }
}


async function registrarVenta() {
    const clienteNombre = document.getElementById("clienteVenta").value.trim();
    const tipoPago = document.getElementById("tipoPago").value;

    clientes = await obtenerTodosLosClientes();
    productos = await obtenerTodosLosProductos(); // Recargar productos para stock y unidad

    const clienteExiste = clientes.some(c => c.nombre.toLowerCase() === clienteNombre.toLowerCase());

    // ¡MODIFICADO! Usar modal de confirmación en lugar de prompt
    if (!clienteNombre) {
        mostrarToast("Por favor ingresa o selecciona un cliente. 🚫");
        return;
    }

    if (!clienteExiste) {
        const confirmarRegistro = await mostrarConfirmacion(
            `El cliente "${clienteNombre}" no está registrado. ¿Quieres ir a registrarlo ahora?`,
            "Cliente no encontrado"
        );
        if (confirmarRegistro) {
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
        productos: [...productosVenta], // Aquí los productos ya tienen la unidad de medida
        tipoPago,
        detallePago,
        ingreso,
        ganancia,
        fecha: obtenerFechaVenta(),
        montoPendiente: montoPendiente,
        estadoPago: estadoPago
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
        productos = await obtenerTodosLosProductos(); // Recargar productos para actualizar stock en UI
        movimientos = await obtenerTodosLosMovimientos();
        abonos = await obtenerTodosLosAbonos(); // Sincroniza abonos también

        editVentaId = null; // Resetea el ID de edición
        document.getElementById("btnRegistrarVenta").textContent = "Registrar Venta";

        guardarVentas(); // Para actualizar gráficos si aplica
        mostrarVentas(); // Recarga la UI
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
        // Dentro de mostrarVentas, en el sort para ventas a crédito
        grupoCredito.sort((a, b) => {
            const fechaA = a.venta.detallePago?.fechaVencimiento ?? '9999-12-31';
            const fechaB = b.venta.detallePago?.fechaVencimiento ?? '9999-12-31';

            const dateA = new Date(fechaA);
            const dateB = new Date(fechaB);

            return dateA - dateB;
        });


        grupoCredito.forEach(({ venta, id }) => {
            const card = crearCardVenta(venta, id);
            lista.appendChild(card);
        });
    }
}

function crearCardVenta(venta, id) {
    // Generate product text with quantity and unit of measure
    const productosTexto = venta.productos.map(p => {
        const unidad = p.unidadMedida || 'unidad(es)'; // Fallback if no unit
        return `${p.nombre} x${p.cantidad} ${unidad}`;
    }).join(", ");

    // Format the sale date and time
    const fechaVenta = new Date(venta.fecha).toLocaleDateString('es-ES', { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit' 
    });
    const horaVenta = new Date(venta.fecha).toLocaleTimeString('es-ES', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });

    let detallePagoHTML = '';
    let estadoPagoHTML = '';
    let estadoClase = ''; // For applying color classes to payment status

    if (venta.tipoPago === "contado") {
        // For cash sales
        detallePagoHTML = `<p><strong>Método:</strong> ${venta.detallePago.metodo}</p>`;
        estadoPagoHTML = `<span class="estado-pago pagado-total">(Pagado)</span>`; // Always "Pagado" for cash
    } else { // Credit
        // For credit sales
        const fechaVencimiento = venta.detallePago.fechaVencimiento || "N/A";
        detallePagoHTML = `
            <p><strong>Acreedor:</strong> ${venta.detallePago.acreedor || "N/A"}</p>
            <p><strong>Vence:</strong> ${fechaVencimiento}</p>
        `;

        // Logic to determine the color class for payment status
        switch (venta.estadoPago) {
            case 'Pendiente':
                estadoPagoHTML = `<span class="estado-pago pendiente">(Pendiente: $${venta.montoPendiente.toFixed(2)})</span>`;
                estadoClase = 'border-red-400'; // Defines the border color for the card
                break;
            case 'Pagado Parcial':
                estadoPagoHTML = `<span class="estado-pago parcial">(Parcial: $${venta.montoPendiente.toFixed(2)} restantes)</span>`;
                estadoClase = 'border-orange-400';
                break;
            case 'Pagado Total':
                estadoPagoHTML = `<span class="estado-pago pagado-total">(Pagado)</span>`;
                estadoClase = 'border-green-400';
                break;
            default:
                estadoPagoHTML = `<span class="estado-pago">(Estado desconocido)</span>`;
                estadoClase = 'border-gray-300';
        }

        // Highlight if the due date has passed and it's still pending
        if (venta.tipoPago === 'credito' && venta.estadoPago !== 'Pagado Total' && fechaVencimiento && new Date(fechaVencimiento) < new Date()) {
            estadoClase = 'border-red-700 ring-2 ring-red-500'; // More striking for overdue
            estadoPagoHTML = `<span class="estado-pago vencido">(OVERDUE: $${venta.montoPendiente.toFixed(2)})</span>`; // Stronger text
        }
    }

    const card = document.createElement("div");
    // We assign the new 'venta-card' class and the dynamic border class
    card.className = `venta-card ${estadoClase}`; 

    // The inner HTML of the card, using the new structure and classes
    card.innerHTML = `
        <div class="header-venta">
            <h3>${venta.cliente}</h3>
            <span class="fecha-venta">${fechaVenta}, ${horaVenta}</span>
        </div>
        <div class="detalle-venta">
            <p><strong>Productos:</strong> ${productosTexto}</p>
            <p><strong>Total:</strong> $${venta.ingreso.toFixed(2)}</p>
            <p><strong>Condición:</strong> ${venta.tipoPago} ${estadoPagoHTML}</p>
            ${detallePagoHTML}
        </div>
        <div class="acciones-venta">
            <button onclick="cargarVenta(${id})" class="btn-editar">✏️ Editar</button>
            <button onclick="revertirVenta(${id})" class="btn-revertir">↩️ Revertir</button>
            <button onclick="eliminarVentaPermanente(${id})" class="btn-eliminar">🗑 Eliminar</button>
            ${venta.tipoPago === 'credito' && venta.montoPendiente > 0 ?
                `<button onclick="abrirModalAbono(${id})" class="btn-abonar">💰 Abonar</button>`
                : ''}
        </div>
    `;

    return card;
}

//FECHA PERSONALIZADA - Corregido para usar IDs correctos del HTML
function toggleFechaManual() {
    const mostrar = document.getElementById("activarFechaManual").checked;
    document.getElementById("opcionFechaManual").style.display = mostrar ? "block" : "none";
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
        const productos = v.productos.map(p => `${p.nombre.toLowerCase()} ${p.cantidad} ${p.unidadMedida || ''}`).join(" "); // ¡MODIFICADO! Incluye la unidad en el filtro de productos
        const cliente = v.cliente.toLowerCase();
        const fecha = v.fecha.toLowerCase();
        const metodo = (v.detallePago.metodo || "").toLowerCase();
        const acreedor = (v.detallePago.acreedor || "").toLowerCase();
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
            tipoVenta.includes(input) ||
            estadoPago.includes(input) ||
            fechaVencimiento.includes(input)
        );
    });

    mostrarVentas(filtradas);
}

function limpiarFormulario() {
    document.getElementById("clienteVenta").value = "";
    document.getElementById("productoVenta").value = "";
    document.getElementById("cantidadVenta").value = ""; // Limpiar cantidad
    document.getElementById("totalVenta").textContent = "0.00"; // Resetear total
    document.getElementById("tipoPago").value = "";
    document.getElementById("metodoContado").value = "";
    document.getElementById("fechaVencimiento").value = "";
    // Limpiar campos de fecha y hora personalizadas si estaban activos
    document.getElementById("activarFechaManual").checked = false;
    document.getElementById("opcionFechaManual").style.display = "none";
    document.getElementById("fechaVentaPersonalizada").value = "";
    document.getElementById("horaVentaPersonalizada").value = "";

    productosVenta = [];
    actualizarTablaProductos();
    mostrarOpcionesPago(); // Restablece la visibilidad de opciones de pago
    editVentaId = null; // Resetea el ID de edición
    document.getElementById("btnRegistrarVenta").textContent = "Registrar Venta";
}

// Se movió la definición de mostrarToast aquí arriba para que siempre esté disponible.
// Si ya tienes un mostrarToast global en otro lado (ej. db.js), asegúrate de que no haya conflicto.
function mostrarToast(mensaje, tipo = "info") { // Añadido 'tipo' para posibles estilos (error, éxito)
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
        // Aplica estilos básicos para las notificaciones (solo si no existen)
        if (!document.head.querySelector('style[data-toast-style]')) {
            const style = document.createElement('style');
            style.setAttribute('data-toast-style', true); // Marcador para evitar duplicados
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
        }
    }

    const toast = document.createElement("div");
    toast.className = `toast ${tipo}`; // Agrega clase de tipo (info, error, success)
    toast.textContent = mensaje;
    // Re-obtener la referencia al contenedor después de su posible creación
    const actualToastContainer = document.getElementById("toastContainer");
    if (actualToastContainer) {
        actualToastContainer.appendChild(toast);
        setTimeout(() => toast.classList.add("show"), 100);
        setTimeout(() => {
            toast.classList.remove("show");
            setTimeout(() => toast.remove(), 400);
        }, 3000);
    }
}


// ¡NUEVA FUNCIÓN! Para reemplazar los confirm/alert del navegador
function mostrarConfirmacion(mensaje, titulo = "Confirmar") {
    return new Promise((resolve) => {
        // Eliminar cualquier modal existente antes de crear uno nuevo
        const existingModal = document.getElementById('customConfirmModal');
        if (existingModal) {
            existingModal.remove();
        }

        const modalHtml = `
            <div id="customConfirmModal" style="
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0, 0, 0, 0.6); display: flex; align-items: center; justify-content: center;
                z-index: 10000; /* Asegurar que esté por encima de todo */
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


async function revertirVenta(id) {
    ventas = await obtenerTodasLasVentas();
    productos = await obtenerTodosLosProductos(); // Recargar para tener la unidad de medida
    movimientos = await obtenerTodosLosMovimientos();
    abonos = await obtenerTodosLosAbonos(); // Cargar abonos

    const venta = ventas.find(v => v.id === id);
    if (!venta) {
        mostrarToast("Venta no encontrada para revertir. 🚫");
        return;
    }

    // ¡MODIFICADO! Usar modal de confirmación
    const motivo = await mostrarPromptPersonalizado("¿Por qué deseas revertir esta venta?", "Motivo de Reversión", "Motivo:");
    if (motivo === null || motivo.trim() === "") {
        mostrarToast("Debes ingresar un motivo para revertir la venta. 🚫");
        return;
    }

    const confirmacion = await mostrarConfirmacion(
        `¿Seguro que quieres revertir la venta a ${venta.cliente}?\nMotivo: ${motivo}`,
        "Confirmar Reversión"
    );

    if (confirmacion) {
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
            productos = await obtenerTodosLosProductos(); // Recargar para que el stock se muestre actualizado
            movimientos = await obtenerTodosLosMovimientos();
            abonos = await obtenerTodosLosAbonos();

            guardarVentas(); // Para actualizar gráficos si aplica
            mostrarVentas();
            mostrarToast("Venta revertida y stock actualizado ✅");
        } catch (error) {
            console.error("Error al revertir venta:", error);
            mostrarToast("Error al revertir venta ❌");
        }
    } else {
        mostrarToast("Reversión de venta cancelada ❌");
    }
}

// ¡NUEVA FUNCIÓN! Para reemplazar prompt()
function mostrarPromptPersonalizado(mensaje, titulo = "Entrada Requerida", inputLabel = "Valor:") {
    return new Promise((resolve) => {
        // Eliminar cualquier modal existente antes de crear uno nuevo
        const existingModal = document.getElementById('customPromptModal');
        if (existingModal) {
            existingModal.remove();
        }

        const modalHtml = `
            <div id="customPromptModal" style="
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0, 0, 0, 0.6); display: flex; align-items: center; justify-content: center;
                z-index: 10001; /* Mayor z-index para prompts */
            ">
                <div style="
                    background: #fff; padding: 25px; border-radius: 10px; box-shadow: 0 5px 15px rgba(0,0,0,0.3);
                    max-width: 400px; text-align: center; font-family: 'Inter', sans-serif;
                ">
                    <h3 style="margin-top: 0; color: #333; font-size: 1.4em;">${titulo}</h3>
                    <p style="margin-bottom: 15px; color: #555; font-size: 1em;">${mensaje}</p>
                    <label for="promptInput" style="display: block; text-align: left; margin-bottom: 5px; color: #444;">${inputLabel}</label>
                    <input type="text" id="promptInput" style="
                        width: calc(100% - 20px); padding: 10px; margin-bottom: 20px; border: 1px solid #ccc;
                        border-radius: 8px; font-size: 1em;
                    ">
                    <div style="display: flex; justify-content: center; gap: 15px;">
                        <button id="promptOk" style="
                            background-color: #4CAF50; color: white; padding: 10px 20px; border: none;
                            border-radius: 8px; cursor: pointer; font-size: 1em; transition: background-color 0.3s;
                        ">Aceptar</button>
                        <button id="promptCancel" style="
                            background-color: #f44336; color: white; padding: 10px 20px; border: none;
                            border-radius: 8px; cursor: pointer; font-size: 1em; transition: background-color 0.3s;
                        ">Cancelar</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        const modal = document.getElementById('customPromptModal');
        const input = document.getElementById('promptInput');
        input.focus(); // Enfocar el input automáticamente

        document.getElementById('promptOk').onclick = () => {
            modal.remove();
            resolve(input.value);
        };
        document.getElementById('promptCancel').onclick = () => {
            modal.remove();
            resolve(null); // Retorna null si se cancela
        };

        // Permite cerrar con Enter en el input
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                document.getElementById('promptOk').click();
            }
        });
    });
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

    // ¡MODIFICADO! Usar modal de confirmación en lugar de confirm
    const confirmacion = await mostrarConfirmacion(
        `¿Estás seguro de eliminar la venta a ${venta.cliente} sin revertir stock? Esta acción es irreversible.`,
        "Eliminar Venta Permanentemente"
    );
    
    if (!confirmacion) {
        mostrarToast("Eliminación de venta cancelada ❌");
        return;
    }

    try {
        // Añadir movimiento de ajuste en Finanzas (a IndexedDB)
        await agregarMovimientoDB({
            tipo: "ajuste",
            monto: -venta.ingreso,
            ganancia: -venta.ganancia, // Ojo, esta ganancia podría ser negativa en un ajuste
            fecha: new Date().toISOString().split("T")[0], // Usar fecha actual para el ajuste
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
        productos = await obtenerTodosLosProductos(); // Recargar para que el stock se muestre actualizado
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

    // ¡MODIFICADO! Asegúrate de que productosVenta contenga la unidad de medida
    productosVenta = await Promise.all(venta.productos.map(async p => {
        const prodCompleto = await obtenerProductoPorNombre(p.nombre); // Asumiendo que esta función existe en db.js
        return {
            nombre: p.nombre,
            precio: p.precio,
            costo: p.costo,
            cantidad: p.cantidad,
            subtotal: p.subtotal,
            unidadMedida: prodCompleto ? prodCompleto.unidadMedida : (p.unidadMedida || 'unidad(es)') // Asegura la unidad
        };
    }));

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

    productos = await obtenerTodosLosProductos(); // Recargar productos para obtener la unidad de medida
    const producto = productos.find(p => p.nombre === productoNombre);

    if (!producto) {
        mostrarToast("Producto no encontrado en el inventario. 🚫");
        return;
    }

    const existente = productosVenta.find(p => p.nombre === productoNombre);
    const totalCantidad = (existente ? existente.cantidad : 0) + cantidad;

    if (producto.stock < totalCantidad) {
        mostrarToast(`Stock insuficiente. Disponible: ${producto.stock} ${producto.unidadMedida || 'unidad(es)'}, Solicitado: ${totalCantidad} ${producto.unidadMedida || 'unidad(es)'} 🚫`, "error");
        return;
    }

    if (existente) {
        // Si el producto ya estaba en la lista, sólo aumentamos cantidad y subtotal
        existente.cantidad += cantidad;
        existente.subtotal = existente.cantidad * producto.precio;
        // Si la unidad no estaba, la añadimos (aunque ya debería estar desde inventario)
        existente.unidadMedida = producto.unidadMedida || 'unidad(es)';
    } else {
        productosVenta.push({
            nombre: producto.nombre,
            precio: producto.precio,
            costo: producto.costo,
            cantidad,
            subtotal: cantidad * producto.precio,
            unidadMedida: producto.unidadMedida || 'unidad(es)' // ¡NUEVO! Guardar la unidad de medida del producto
        });
    }

    actualizarTablaProductos();

    document.getElementById("productoVenta").value = "";
    document.getElementById("cantidadVenta").value = "";
}

// Función para actualizar y renderizar la tabla de productos en la venta
function actualizarTablaProductos() {
    const tabla = document.getElementById("tablaProductosVenta");
    tabla.innerHTML = ""; // Limpia la tabla antes de volver a renderizar
    let total = 0; // Variable para calcular el total de la venta

    // Recorre cada producto en el array temporal 'productosVenta'
    productosVenta.forEach((p, index) => {
        const fila = document.createElement("tr"); // Crea una nueva fila para cada producto
        
        // Asigna el contenido HTML a la fila
        // Cada celda (<td>) incluye el atributo 'data-label' que es crucial para
        // el diseño responsivo en móvil. El CSS lo usará para mostrar el "encabezado"
        // de la columna al lado del valor en pantallas pequeñas.
        // También incluye la 'unidadMedida' para mayor claridad.
        fila.innerHTML = `
            <td data-label="Producto">${p.nombre}</td>
            <td data-label="Cantidad">${p.cantidad} ${p.unidadMedida || ''}</td>
            <td data-label="Precio Unitario">$${p.precio.toFixed(2)}</td>
            <td data-label="Subtotal">$${p.subtotal.toFixed(2)}</td>
            <td data-label="Acción">
                <button onclick="eliminarProductoVenta(${index})" class="text-red-500 hover:text-red-700">
                    ❌<span> Eliminar</span>
                </button>
            </td>
        `;
        tabla.appendChild(fila); // Añade la fila a la tabla
        total += p.subtotal; // Suma el subtotal del producto al total general
    });

    // Actualiza el elemento HTML que muestra el total de la venta
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
        // ¡MODIFICADO! Incluir unidad de medida en la exportación de productos
        Productos: venta.productos.map(p => `${p.nombre} x${p.cantidad} ${p.unidadMedida || ''}`).join(", "),
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
        // Asegúrate de que los campos con comas (como productos) estén entre comillas para CSV
        const escapeCsv = (val) => `"${String(val).replace(/"/g, '""')}"`;
        csv += `${escapeCsv(row.Cliente)},${escapeCsv(row.Productos)},${row.Ingreso},${row.Ganancia},${row.Fecha},${escapeCsv(row.Pago)},${escapeCsv(row.Detalle)},${row.Monto_Pendiente},${escapeCsv(row.Estado_Pago)}\n`;
    });

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "ventas.csv";
    document.body.appendChild(link); // Añadir al DOM para Firefox
    link.click();
    document.body.removeChild(link); // Eliminar después de click
    URL.revokeObjectURL(url); // Liberar el objeto URL
    mostrarToast("📊 CSV/Excel exportado"); // Cambiado el toast
}

async function exportarPDF() {
    ventas = await obtenerTodasLasVentas(); // Carga las ventas más recientes
    const ventana = window.open('', '_blank');
    let contenido = `
        <html>
            <head>
                <title>Reporte de Ventas</title>
                <style>
                    body { font-family: sans-serif; margin: 20px; }
                    h2 { color:#5b2d90; text-align: center; margin-bottom: 20px; }
                    table { border-collapse: collapse; width: 100%; margin-top: 20px; }
                    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                    th { background-color: #f2f2f2; }
                    .header { display: flex; align-items: center; justify-content: center; margin-bottom: 30px; }
                    .logo { height: 50px; margin-right: 15px; }
                    .titulo-header { font-size: 2em; color: #5b2d90; }
                </style>
            </head>
            <body>
                <div class="header">
                    <img src="logo/LOS SS.png" alt="Logo" class="logo" />
                    <h1 class="titulo-header">Reporte de Ventas</h1>
                </div>
                <table>
                    <thead>
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
                        </tr>
                    </thead>
                    <tbody>`;

    ventas.forEach(venta => {
        // ¡MODIFICADO! Incluir unidad de medida en la exportación de productos
        const productos = venta.productos.map(p => `${p.nombre} x${p.cantidad} ${p.unidadMedida || ''}`).join(", ");
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
                    </tbody>
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
        productos = await obtenerTodosLosProductos(); // Asegúrate de cargar productos con unidad de medida
        movimientos = await obtenerTodosLosMovimientos();
        abonos = await obtenerTodosLosAbonos(); // Cargar abonos al inicio

        mostrarVentas();
        mostrarOpcionesPago();
        cargarClientes();
        cargarProductos(); // Recarga el select de productos con info de stock y unidad
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
