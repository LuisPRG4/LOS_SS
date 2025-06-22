// db.js (VERSION CORREGIDA Y COMPLETA)

let db;

const DB_NAME = 'miTiendaDB';

// --- ¡¡¡IMPORTANTE!!! INCREMENTA ESTE NÚMERO CADA VEZ QUE CAMBIES LA ESTRUCTURA DE LA DB ---
// Tu código original decía 8. Para forzar la actualización ahora, debe ser al menos 9.
const DB_VERSION = 9; // <--- ¡ASEGÚRATE DE QUE ESTE NÚMERO SEA MAYOR QUE EL ÚLTIMO QUE USÓ TU APP!


// Nombres de los Object Stores y sus configuraciones
const STORES = {
    productos: { keyPath: 'id', autoIncrement: true },
    clientes: { keyPath: 'id', autoIncrement: true },
    pedidos: { keyPath: 'id', autoIncrement: true },
    ventas: { keyPath: 'id', autoIncrement: true }, // Entiendo que 'ventas' es para ventas completadas
    movimientos: { keyPath: 'id', autoIncrement: true },
    proveedores: { keyPath: 'id', autoIncrement: true },
    abonos: { keyPath: 'id', autoIncrement: true } // Confirmamos que 'abonos' es un store principal
};


/**
 * Abre la base de datos IndexedDB y crea/actualiza los object stores.
 * @returns {Promise<IDBDatabase>} Una promesa que resuelve con la instancia de la DB.
 */
function abrirDB() {
    return new Promise((resolve, reject) => {
        if (db) { // Si la DB ya está abierta, la devolvemos directamente
            resolve(db);
            return;
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = event => {
            db = event.target.result; // ASIGNAR la DB dentro de onupgradeneeded

            console.log(`onupgradeneeded ejecutado. Versión actual: ${event.oldVersion}, Nueva versión: ${event.newVersion}`);
            console.log('Creando/Actualizando object stores...');

            // --- Lógica para asegurar que todos los stores y sus índices están actualizados ---
            // Recorremos todos los stores definidos en STORES
            for (const storeName in STORES) {
                // Si el store ya existe, pero la versión cambió, lo borramos para recrearlo
                // y asegurar que tenga todos los índices y la estructura correcta.
                // ¡ADVERTENCIA: ESTO BORRA TODOS LOS DATOS EN ESE STORE!
                if (db.objectStoreNames.contains(storeName)) {
                    db.deleteObjectStore(storeName);
                    console.log(`Object Store '${storeName}' existente eliminado para actualización.`);
                }

                // Creamos el objectStore (o lo recreamos si se borró)
                const store = db.createObjectStore(storeName, STORES[storeName]);
                console.log(`Object Store '${storeName}' creado/recreado.`);

                // Crear índices específicos para cada store
                switch (storeName) {
                    case 'productos':
                        store.createIndex('nombre', 'nombre', { unique: false });
                        store.createIndex('categoria', 'categoria', { unique: false });
                        store.createIndex('stock', 'stock', { unique: false }); // Un índice útil
                        break;
                    case 'clientes':
                        store.createIndex('nombre', 'nombre', { unique: false });
                        store.createIndex('telefono', 'telefono', { unique: false });
                        break;
                    case 'pedidos':
                        // Índices existentes
                        store.createIndex('fechaPedido', 'fechaPedido', { unique: false });
                        store.createIndex('estado', 'estado', { unique: false }); // "Pendiente", "Preparado", "Entregado"
                        // Índices que tenías en la definición original de tu `abrirDB`
                        // Si 'cliente' es el ID del cliente o el nombre, asegúrate de la consistencia.
                        // Asumo que 'cliente' es el nombre del cliente en el pedido.
                        store.createIndex('clienteNombre', 'cliente.nombre', { unique: false }); // Si cliente es un objeto con propiedad 'nombre'
                        store.createIndex('productoId', 'productoId', { unique: false }); // Si guardas el ID del producto en los ítems del pedido

                        // --- NUEVOS ÍNDICES para Ventas a Crédito ---
                        // Asegúrate de que los pedidos tendrán campos como:
                        // tipoVenta: 'Contado' | 'Crédito'
                        // montoPendiente: número (0 si es contado, >0 si es crédito)
                        // fechaVencimiento: string de fecha
                        // estadoPago: 'Pendiente' | 'Pagado Parcial' | 'Pagado Total'
                        store.createIndex('tipoVenta', 'tipoVenta', { unique: false });
                        store.createIndex('montoPendiente', 'montoPendiente', { unique: false });
                        store.createIndex('fechaVencimiento', 'fechaVencimiento', { unique: false });
                        store.createIndex('estadoPago', 'estadoPago', { unique: false });
                        break;
                    case 'ventas':
                        store.createIndex('clienteId', 'clienteId', { unique: false });
                        store.createIndex('fecha', 'fecha', { unique: false });
                        store.createIndex('tipoPago', 'tipoPago', { unique: false }); // 'Efectivo', 'Tarjeta', 'Crédito' (si 'ventas' guarda la transacción final)
                        break;
                    case 'movimientos':
                        store.createIndex('fecha', 'fecha', { unique: false });
                        store.createIndex('tipo', 'tipo', { unique: false }); // 'entrada', 'salida'
                        break;
                    case 'proveedores':
                        store.createIndex('nombre', 'nombre', { unique: false });
                        store.createIndex('contacto', 'contacto', { unique: false });
                        break;
                    case 'abonos':
                        // Renombramos el índice a 'pedidoId' para ser consistente con el objectStore 'pedidos'
                        store.createIndex('pedidoId', 'pedidoId', { unique: false });
                        store.createIndex('fechaAbono', 'fechaAbono', { unique: false }); // Fecha específica del abono
                        store.createIndex('montoAbonado', 'montoAbonado', { unique: false }); // Si quieres reportar abonos por monto
                        break;
                }
            }
        };

        request.onsuccess = event => {
            db = event.target.result;
            console.log('IndexedDB abierta con éxito.');
            resolve(db);
        };

        request.onerror = event => {
            console.error('Error al abrir IndexedDB:', event.target.error);
            reject(event.target.error);
        };
    });
}


// === Funciones Genéricas CRUD (MEJOR ENFOQUE) ===

// Estas funciones operan sobre cualquier Object Store que les pases.
// Esto reduce la duplicación de código.

// Nota: Ya veo que tienes async functions. Asegúrate de que 'db' esté inicializado
// llamando a abrirDB() antes de usar estas funciones genéricas en tu app.
// Por ejemplo: await abrirDB(); antes de hacer cualquier operación.

async function obtenerTodosItems(storeName) {
    const dbInstance = await abrirDB(); // Asegura que la DB está abierta
    return new Promise((resolve, reject) => {
        const transaction = dbInstance.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function agregarItem(storeName, item) {
    const dbInstance = await abrirDB(); // Asegura que la DB está abierta
    return new Promise((resolve, reject) => {
        const transaction = dbInstance.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.add(item);
        request.onsuccess = () => resolve(request.result); // result es el ID de la clave
        request.onerror = () => reject(request.error);
    });
}

async function actualizarItem(storeName, id, item) {
    const dbInstance = await abrirDB(); // Asegura que la DB está abierta
    return new Promise((resolve, reject) => {
        const transaction = dbInstance.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const itemToUpdate = { ...item };
        // Asegúrate de que el 'id' del objeto a 'put' coincida con el 'keyPath'
        // y que sea numérico si el keyPath es autoIncrement.
        itemToUpdate[STORES[storeName].keyPath] = Number(id);

        const request = store.put(itemToUpdate); // put() actualiza si existe, añade si no
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function eliminarItem(storeName, id) {
    const dbInstance = await abrirDB(); // Asegura que la DB está abierta
    return new Promise((resolve, reject) => {
        const transaction = dbInstance.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        // ¡CRÍTICO! Asegurarse de que el ID sea numérico si el keyPath es autoIncrement
        const request = store.delete(Number(id));
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

async function obtenerItemPorId(storeName, id) {
    const dbInstance = await abrirDB(); // Asegura que la DB está abierta
    return new Promise((resolve, reject) => {
        const transaction = dbInstance.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        // ¡CRÍTICO! Asegurarse de que el ID sea numérico si el keyPath es autoIncrement
        const request = store.get(Number(id));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function limpiarStore(storeName) {
    const dbInstance = await abrirDB(); // Asegura que la DB está abierta
    return new Promise((resolve, reject) => {
        const transaction = dbInstance.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}


// === Funciones Específicas (Wrappers que llaman a las genéricas para mayor legibilidad) ===

// Productos
window.agregarProducto = (producto) => agregarItem('productos', producto);
window.obtenerTodosLosProductos = () => obtenerTodosItems('productos');
window.obtenerProductoPorId = (id) => obtenerItemPorId('productos', id);
window.actualizarProducto = (id, producto) => actualizarItem('productos', id, producto);
window.eliminarProducto = (id) => eliminarItem('productos', id);

// Clientes
window.agregarCliente = (cliente) => agregarItem('clientes', cliente);
window.obtenerTodosLosClientes = () => obtenerTodosItems('clientes');
window.obtenerClientePorId = (id) => obtenerItemPorId('clientes', id);
window.actualizarCliente = (id, cliente) => actualizarItem('clientes', id, cliente);
window.eliminarCliente = (id) => eliminarItem('clientes', id);
async function obtenerClientePorNombre(nombre) {
    const clientes = await obtenerTodosItems('clientes');
    return clientes.find(c => c.nombre === nombre);
}
window.obtenerClientePorNombre = obtenerClientePorNombre;


// Pedidos
window.agregarPedidoDB = (pedido) => agregarItem('pedidos', pedido);
window.obtenerTodosLosPedidosDB = () => obtenerTodosItems('pedidos');
window.obtenerPedidoPorId = (id) => obtenerItemPorId('pedidos', id); // Usamos obtenerPedidoPorId, no obtenerPedidoPorIdDB para consistencia
window.actualizarPedidoDB = (id, pedido) => actualizarItem('pedidos', id, pedido);
window.eliminarPedidoDB = (id) => eliminarItem('pedidos', id);
window.limpiarTodosLosPedidosDB = () => limpiarStore('pedidos'); // Usa la genérica


// Ventas
window.agregarVenta = (venta) => agregarItem('ventas', venta);
window.obtenerTodasLasVentas = () => obtenerTodosItems('ventas');
window.obtenerVentaPorId = (id) => obtenerItemPorId('ventas', id);
window.actualizarVenta = (id, venta) => actualizarItem('ventas', id, venta);
window.eliminarVenta = (id) => eliminarItem('ventas', id);
window.limpiarTodasLasVentas = () => limpiarStore('ventas'); // Nueva función de limpieza


// Movimientos
window.agregarMovimientoDB = (movimiento) => agregarItem('movimientos', movimiento);
window.obtenerTodosLosMovimientos = () => obtenerTodosItems('movimientos');
window.obtenerMovimientoPorId = (id) => obtenerItemPorId('movimientos', id);
window.actualizarMovimientoDB = (id, movimiento) => actualizarItem('movimientos', id, movimiento);
window.eliminarMovimientoDB = (id) => eliminarItem('movimientos', id);
window.limpiarTodosLosMovimientos = () => limpiarStore('movimientos');


// Proveedores
window.agregarProveedorDB = (proveedor) => agregarItem('proveedores', proveedor);
window.obtenerTodosLosProveedoresDB = () => obtenerTodosItems('proveedores');
window.obtenerProveedorPorId = (id) => obtenerItemPorId('proveedores', id);
window.actualizarProveedorDB = (id, proveedor) => actualizarItem('proveedores', id, proveedor);
window.eliminarProveedorDB = (id) => eliminarItem('proveedores', id);
window.limpiarTodosLosProveedoresDB = () => limpiarStore('proveedores');


// Abonos (¡NUEVAS FUNCIONES ESPECÍFICAS PARA EL NUEVO STORE!)
window.agregarAbonoDB = (abono) => agregarItem('abonos', abono);
window.obtenerTodosLosAbonos = () => obtenerTodosItems('abonos'); // Útil para depuración o reportes generales
window.obtenerAbonoPorId = (id) => obtenerItemPorId('abonos', id);
window.actualizarAbonoDB = (id, abono) => actualizarItem('abonos', id, abono);
window.eliminarAbonoDB = (id) => eliminarItem('abonos', id);
window.limpiarTodosLosAbonosDB = () => limpiarStore('abonos');

// La función para obtener abonos por pedidoId que ya tenías (ajustada para el nuevo índice 'pedidoId')
async function obtenerAbonosPorPedidoId(pedidoId) {
    const dbInstance = await abrirDB();
    return new Promise((resolve, reject) => {
        const transaction = dbInstance.transaction(["abonos"], "readonly");
        const store = transaction.objectStore("abonos");
        const index = store.index("pedidoId"); // Usamos el nuevo índice 'pedidoId'

        const abonos = [];
        const requestCursor = index.openCursor(IDBKeyRange.only(Number(pedidoId))); // Asegurarse de que el ID sea numérico
        requestCursor.onsuccess = (e) => {
            const cursor = e.target.result;
            if (cursor) {
                abonos.push(cursor.value);
                cursor.continue();
            } else {
                resolve(abonos);
            }
        };
        requestCursor.onerror = () => reject("Error al cargar abonos por pedido ID");
    });
}
window.obtenerAbonosPorPedidoId = obtenerAbonosPorPedidoId; // Exportar esta función


// Exportar las funciones para que estén disponibles globalmente
window.abrirDB = abrirDB;
window.limpiarStore = limpiarStore;

// (Tus exportaciones de funciones específicas ya están abajo, no es necesario duplicar)
// Ejemplos: window.agregarProducto = agregarProducto; etc.
// Asegúrate de que todas tus funciones específicas estén exportadas al final de db.js
// como ya lo tienes.

// db.js (AGREGA ESTO AL FINAL DEL ARCHIVO)

// ... (todas tus funciones existentes, como abrirDB, CRUD genéricas, y wrappers específicos) ...

// Función para mostrar toasts (asegúrate de tener el contenedor #toastContainer en tu HTML)
function mostrarToast(message, type = 'info', duration = 3000) {
    const toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) {
        console.error('No se encontró el contenedor de toasts #toastContainer');
        return;
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    toastContainer.appendChild(toast);

    void toast.offsetWidth; // Forzar reflow para la transición CSS

    toast.classList.add('show'); // Aplica la clase para mostrarlo (asumiendo CSS para .toast.show)

    setTimeout(() => {
        toast.classList.remove('show'); // Remueve la clase para ocultarlo
        // Espera a que la transición de ocultar termine antes de remover el elemento
        toast.addEventListener('transitionend', () => {
            toast.remove();
        }, { once: true });
    }, duration);
}

// Haz que la función mostrarToast esté disponible globalmente
window.mostrarToast = mostrarToast;

// Exportar las funciones principales para que estén disponibles globalmente (si no lo hiciste ya)
// Estas ya las tienes, solo asegúrate de que 'window.mostrarToast' esté con ellas.
window.abrirDB = abrirDB;
window.limpiarStore = limpiarStore;

// (Tus exportaciones de funciones específicas ya están abajo, no es necesario duplicar)
// Ejemplos: window.agregarProducto = agregarProducto; etc.
// Asegúrate de que todas tus funciones específicas estén exportadas al final de db.js
// como ya lo tienes.