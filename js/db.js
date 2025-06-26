// js/db.js (CÓDIGO COMPLETO Y CORREGIDO PARA INCLUIR MERMAS Y MODALES PERSONALIZADOS)

let db;

const DB_NAME = 'miTiendaDB';

// --- ¡¡¡IMPORTANTE!!! INCREMENTA ESTE NÚMERO CADA VEZ QUE CAMBIES LA ESTRUCTURA DE LA DB ---
// Incrementado a 14 para asegurar la recreación de la DB si hubo problemas con la versión anterior.
const DB_VERSION = 14; 

// Nombres de los Object Stores y sus configuraciones
const STORES = {
    productos: { keyPath: 'id', autoIncrement: true },
    clientes: { keyPath: 'id', autoIncrement: true },
    pedidos: { keyPath: 'id', autoIncrement: true },
    ventas: { keyPath: 'id', autoIncrement: true },
    movimientos: { keyPath: 'id', autoIncrement: true },
    proveedores: { keyPath: 'id', autoIncrement: true },
    abonos: { keyPath: 'id', autoIncrement: true },
    mermas: { keyPath: 'id', autoIncrement: true } 
};

/**
 * Abre la base de datos IndexedDB y crea/actualiza los object stores.
 * @returns {Promise<IDBDatabase>} Una promesa que resuelve con la instancia de la DB.
 */
function abrirDB() {
    return new Promise((resolve, reject) => {
        if (db) { 
            resolve(db);
            return;
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = event => {
            db = event.target.result; 

            console.log(`onupgradeneeded ejecutado. Versión actual: ${event.oldVersion}, Nueva versión: ${event.newVersion}`);
            console.log('Creando/Actualizando object stores...');

            for (const storeName in STORES) {
                if (db.objectStoreNames.contains(storeName)) {
                    db.deleteObjectStore(storeName);
                    console.log(`Object Store '${storeName}' existente eliminado para actualización.`);
                }

                const store = db.createObjectStore(storeName, STORES[storeName]);
                console.log(`Object Store '${storeName}' creado/recreado.`);

                switch (storeName) {
                    case 'productos':
                        store.createIndex('nombre', 'nombre', { unique: false });
                        store.createIndex('categoria', 'categoria', { unique: false });
                        store.createIndex('stock', 'stock', { unique: false });
                        break;
                    case 'clientes':
                        store.createIndex('nombre', 'nombre', { unique: false });
                        store.createIndex('telefono', 'telefono', { unique: false });
                        break;
                    case 'pedidos':
                        store.createIndex('fechaPedido', 'fechaPedido', { unique: false });
                        store.createIndex('estado', 'estado', { unique: false });
                        store.createIndex('clienteNombre', 'cliente.nombre', { unique: false }); 
                        store.createIndex('productoId', 'productoId', { unique: false }); 
                        store.createIndex('tipoVenta', 'tipoVenta', { unique: false }); 
                        store.createIndex('montoPendiente', 'montoPendiente', { unique: false }); 
                        store.createIndex('fechaVencimiento', 'fechaVencimiento', { unique: false });
                        store.createIndex('estadoPago', 'estadoPago', { unique: false });
                        break;
                    case 'ventas':
                        store.createIndex('clienteId', 'clienteId', { unique: false });
                        store.createIndex('fecha', 'fecha', { unique: false });
                        store.createIndex('tipoPago', 'tipoPago', { unique: false });
                        break;
                    case 'movimientos':
                        store.createIndex('fecha', 'fecha', { unique: false });
                        store.createIndex('tipo', 'tipo', { unique: false });
                        break;
                    case 'proveedores':
                        store.createIndex('nombre', 'nombre', { unique: false });
                        store.createIndex('contacto', 'contacto', { unique: false });
                        break;
                    case 'abonos':
                        store.createIndex('pedidoId', 'pedidoId', { unique: false });
                        store.createIndex('fechaAbono', 'fechaAbono', { unique: false });
                        store.createIndex('montoAbonado', 'montoAbonado', { unique: false });
                        break;
                    case 'mermas':
                        store.createIndex('productoId', 'productoId', { unique: false });
                        store.createIndex('fecha', 'fecha', { unique: false });
                        store.createIndex('motivo', 'motivo', { unique: false });
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

// Funciones genéricas para interactuar con cualquier Object Store
async function obtenerTodosItems(storeName) {
    const dbInstance = await abrirDB();
    return new Promise((resolve, reject) => {
        const transaction = dbInstance.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function agregarItem(storeName, item) {
    const dbInstance = await abrirDB();
    return new Promise((resolve, reject) => {
        const transaction = dbInstance.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.add(item);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function actualizarItem(storeName, id, item) {
    const dbInstance = await abrirDB();
    return new Promise((resolve, reject) => {
        const transaction = dbInstance.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const itemToUpdate = { ...item };
        itemToUpdate[STORES[storeName].keyPath] = Number(id); 

        const request = store.put(itemToUpdate);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function eliminarItem(storeName, id) {
    const dbInstance = await abrirDB();
    return new Promise((resolve, reject) => {
        const transaction = dbInstance.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.delete(Number(id)); 
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

async function obtenerItemPorId(storeName, id) {
    const dbInstance = await abrirDB();
    return new Promise((resolve, reject) => {
        const transaction = dbInstance.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.get(Number(id)); 
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function limpiarStore(storeName) {
    const dbInstance = await abrirDB();
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

async function obtenerProductoPorNombre(nombre) {
    const dbInstance = await abrirDB();
    return new Promise((resolve, reject) => {
        const transaction = dbInstance.transaction(['productos'], 'readonly');
        const store = transaction.objectStore('productos');
        const index = store.index('nombre');

        const request = index.get(nombre);
        request.onsuccess = () => {
            resolve(request.result);
        };
        request.onerror = () => {
            console.error("Error al obtener producto por nombre:", request.error);
            reject(request.error);
        };
    });
}
window.obtenerProductoPorNombre = obtenerProductoPorNombre;

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
window.obtenerPedidoPorId = (id) => obtenerItemPorId('pedidos', id); 
window.actualizarPedidoDB = (id, pedido) => actualizarItem('pedidos', id, pedido);
window.eliminarPedidoDB = (id) => eliminarItem('pedidos', id);
window.limpiarTodosLosPedidosDB = () => limpiarStore('pedidos');

// Ventas
window.agregarVenta = (venta) => agregarItem('ventas', venta);
window.obtenerTodasLasVentas = () => obtenerTodosItems('ventas');
window.obtenerVentaPorId = (id) => obtenerItemPorId('ventas', id);
window.actualizarVenta = (id, venta) => actualizarItem('ventas', id, venta);
window.eliminarVenta = (id) => eliminarItem('ventas', id);
window.limpiarTodasLasVentas = () => limpiarStore('ventas');

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

// Abonos
window.agregarAbonoDB = (abono) => agregarItem('abonos', abono);
window.obtenerTodosLosAbonos = () => obtenerTodosItems('abonos');
window.obtenerAbonoPorId = (id) => obtenerItemPorId('abonos', id);
window.actualizarAbonoDB = (id, abono) => actualizarItem('abonos', id, abono);
window.eliminarAbonoDB = (id) => eliminarItem('abonos', id);
window.limpiarTodosLosAbonosDB = () => limpiarStore('abonos');

// Mermas 
window.agregarMermaDB = (merma) => agregarItem('mermas', merma);
window.obtenerTodasLasMermasDB = () => obtenerTodosItems('mermas');
window.obtenerMermaPorId = (id) => obtenerItemPorId('mermas', id);
window.actualizarMermaDB = (id, merma) => actualizarItem('mermas', id, merma);
window.eliminarMermaDB = (id) => eliminarItem('mermas', id);
window.limpiarTodasLasMermasDB = () => limpiarStore('mermas');


// La función para obtener abonos por pedidoId que ya tenías (ajustada para el nuevo índice 'pedidoId')
async function obtenerAbonosPorPedidoId(pedidoId) {
    const dbInstance = await abrirDB();
    return new Promise((resolve, reject) => {
        const transaction = dbInstance.transaction(["abonos"], "readonly");
        const store = transaction.objectStore("abonos");
        const index = store.index("pedidoId"); 

        const abonos = [];
        const requestCursor = index.openCursor(IDBKeyRange.only(Number(pedidoId))); 
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
window.obtenerAbonosPorPedidoId = obtenerAbonosPorPedidoId; 

// Exportar las funciones principales para que estén disponibles globalmente
window.abrirDB = abrirDB;
window.limpiarStore = limpiarStore;

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

    toast.classList.add('show'); 

    setTimeout(() => {
        toast.classList.remove('show'); 
        toast.addEventListener('transitionend', () => {
            toast.remove();
        }, { once: true });
    }, duration);
}

// Haz que la función mostrarToast esté disponible globalmente
window.mostrarToast = mostrarToast;


/**
 * Reemplaza todos los datos existentes en la base de datos con los datos importados.
 * Esto borra todas las tiendas de objetos y luego inserta los nuevos datos.
 * @param {object} importedData - Objeto con los datos a importar, donde cada clave es el nombre de una tienda de objetos.
 */
async function reemplazarTodosLosDatos(importedData) {
    return new Promise((resolve, reject) => {
        if (!db) {
            console.error("La base de datos no está abierta. No se puede reemplazar datos.");
            return reject("DB no abierta.");
        }

        const transaction = db.transaction(
            ['productos', 'clientes', 'ventas', 'movimientos', 'pedidos', 'proveedores', 'abonos', 'mermas'], 
            'readwrite'
        );

        const objectStores = [
            'productos', 'clientes', 'ventas', 'movimientos',
            'pedidos', 'proveedores', 'abonos', 'mermas' 
        ];

        transaction.oncomplete = () => {
            console.log("Transacción de importación completada.");
            resolve();
        };

        transaction.onerror = (event) => {
            console.error("Error en la transacción de importación:", event.target.error);
            reject(event.target.error);
        };

        // Paso 1: Limpiar todas las tiendas de objetos
        objectStores.forEach(storeName => {
            try {
                const store = transaction.objectStore(storeName);
                store.clear(); 
                console.log(`Tienda '${storeName}' limpiada.`);
            } catch (e) {
                console.warn(`No se pudo limpiar la tienda '${storeName}', quizás no existe:`, e);
            }
        });

        // Paso 2: Insertar los datos importados en sus respectivas tiendas
        for (const storeName of objectStores) {
            if (importedData[storeName] && Array.isArray(importedData[storeName])) {
                const store = transaction.objectStore(storeName);
                importedData[storeName].forEach(item => {
                    const itemToStore = { ...item }; 
                    store.put(itemToStore); 
                });
                console.log(`Datos de '${storeName}' insertados: ${importedData[storeName].length} registros.`);
            }
        }
    });
}

// NUEVA FUNCIÓN: mostrarConfirmacion - Define el modal personalizado de confirmación
window.mostrarConfirmacion = async (message, title = "Confirmar") => {
    return new Promise(resolve => {
        const modalHtml = `
            <div id="customConfirmModal" style="
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0, 0, 0, 0.6); display: flex; align-items: center; justify-content: center;
                z-index: 1000;
            ">
                <div style="
                    background: #fff; padding: 25px; border-radius: 10px; box-shadow: 0 5px 15px rgba(0,0,0,0.3);
                    max-width: 400px; text-align: center; font-family: 'Segoe UI', sans-serif;
                ">
                    <h3 style="margin-top: 0; color: #333; font-size: 1.4em;">${title}</h3>
                    <p style="margin-bottom: 25px; color: #555; font-size: 1em;">${message}</p>
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
};
