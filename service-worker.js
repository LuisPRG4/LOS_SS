// Archivo: service-worker.js

// Incrementamos la versión y agregamos timestamp para forzar actualización
const CACHE_NAME = "los-ss-cache-v11";
const APP_VERSION = "1.0.4"; // Incrementa esto cuando hagas cambios importantes
const REPO_PREFIX = '/Los_SS/';

// Archivos críticos que siempre deben actualizarse
const CRITICAL_FILES = [
`${REPO_PREFIX}js/cuentas-por-cobrar.js`,
`${REPO_PREFIX}css/ventas-pagadas.css`,
`${REPO_PREFIX}cuentas-por-cobrar.html`
];

const urlsToCache = [
  `${REPO_PREFIX}`, // La raíz de tu aplicación en GitHub Pages
  `${REPO_PREFIX}clientes.html`,
  `${REPO_PREFIX}cuentas-por-cobrar.html`,
  `${REPO_PREFIX}datos.html`,
  `${REPO_PREFIX}finanzas.html`,
  `${REPO_PREFIX}index.html`,
  `${REPO_PREFIX}inventario.html`,
  `${REPO_PREFIX}login.html`,
  `${REPO_PREFIX}manifest.json`,
  `${REPO_PREFIX}mermas.html`,
  `${REPO_PREFIX}novedades.html`,
  `${REPO_PREFIX}offline.html`,
  `${REPO_PREFIX}pedidos.html`,
  `${REPO_PREFIX}proveedores.html`,
  `${REPO_PREFIX}reportesGraficos.html`,
  `${REPO_PREFIX}ventas.html`,

  // CSS:
  `${REPO_PREFIX}css/fontawesome web/css/all.min.css`,
  `${REPO_PREFIX}css/ayuda.css`,
  `${REPO_PREFIX}css/calendar.css`,
  `${REPO_PREFIX}css/cards-general.css`,
  `${REPO_PREFIX}css/chatbot-ayuda.css`,
  `${REPO_PREFIX}css/datos.css`,
  `${REPO_PREFIX}css/form-decoration.css`,
  `${REPO_PREFIX}css/index.css`,
  `${REPO_PREFIX}css/inventario.css`,
  `${REPO_PREFIX}css/login.css`,
  `${REPO_PREFIX}css/note.css`,
  `${REPO_PREFIX}css/novedades.css`,
  `${REPO_PREFIX}css/stockAlert.css`,
  `${REPO_PREFIX}css/style.css`,
  `${REPO_PREFIX}css/tablaVentas.css`,
  `${REPO_PREFIX}css/tailwind.min.css`,
  `${REPO_PREFIX}css/ventas.css`,
  `${REPO_PREFIX}css/whatsapp.css`,
  `${REPO_PREFIX}css/update-button.css`, // ¡Asegúrate de incluir este nuevo CSS!
  `${REPO_PREFIX}css/reportes.css`,

  // JS:
  `${REPO_PREFIX}js/calendar.js`,
  `${REPO_PREFIX}js/chart.js`,
  `${REPO_PREFIX}js/chatbot-ayuda.js`,
  `${REPO_PREFIX}js/clientes.js`,
  `${REPO_PREFIX}js/cuentas-por-cobrar.js`,
  `${REPO_PREFIX}js/dashboard.js`,
  `${REPO_PREFIX}js/datos.js`,
  `${REPO_PREFIX}js/db.js`,
  `${REPO_PREFIX}js/finanzas.js`,
  `${REPO_PREFIX}js/inventario.js`,
  `${REPO_PREFIX}js/login.js`,
  `${REPO_PREFIX}js/mermas.js`,
  `${REPO_PREFIX}js/nav-highlighter.js`,
  `${REPO_PREFIX}js/novedades.js`,
  `${REPO_PREFIX}js/pedidos.js`,
  `${REPO_PREFIX}js/proveedores.js`,
  `${REPO_PREFIX}js/reportes.js`,
  `${REPO_PREFIX}js/script.js`,
  `${REPO_PREFIX}js/ventas.js`,
  `${REPO_PREFIX}js/sw-register.js`, // ¡Asegúrate de incluir este JS!

  // Archivos externos (siempre y cuando GitHub Pages pueda acceder a ellos)
  `https://unpkg.com/xlsx/dist/xlsx.full.min.js`,
  `https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js`,
  `https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.25/jspdf.plugin.autotable.min.js`,

  // fav:
  `${REPO_PREFIX}fav/los ss.png`,

 // Fonts:
  `${REPO_PREFIX}fonts/Handlee-Regular.ttf`, 
  `${REPO_PREFIX}fonts/Montserrat-Italic.ttf`,
  `${REPO_PREFIX}fonts/Playfair.ttf`,

  // Icons:
  `${REPO_PREFIX}icons/1.EXCEL.png`,
  `${REPO_PREFIX}icons/2. CSV.png`,
  `${REPO_PREFIX}icons/3. JSON.png`,
  `${REPO_PREFIX}icons/4. PDF.png`,
  `${REPO_PREFIX}icons/5. SUBIR.png`,
  `${REPO_PREFIX}icons/6. CARGAR Y REEMPLAZAR.png`,
  `${REPO_PREFIX}icons/advertencia.png`,

  // Logo:
  `${REPO_PREFIX}logo/DiaDelPadre.png`,
  `${REPO_PREFIX}logo/LOS SS.png`,
  `${REPO_PREFIX}logo/Yogurt.png`,

  // Resources:
  `${REPO_PREFIX}resources/ORO.jpg`,
  `${REPO_PREFIX}resources/ICONO BOLSITA.png`,
];

// Función para verificar si un archivo es crítico
function isCriticalFile(url) {
    return CRITICAL_FILES.some(file => url.includes(file));
}

// Función para limpiar cachés antiguas
async function deleteOldCaches() {
    const cacheNames = await caches.keys();
    await Promise.all(
        cacheNames.map(cacheName => {
            if (cacheName !== CACHE_NAME) {
                console.log('[Service Worker] Eliminando caché antigua:', cacheName);
                return caches.delete(cacheName);
            }
        })
    );
}

// Instalación del Service Worker
self.addEventListener('install', event => {
    console.log('[Service Worker] Instalando nueva versión:', APP_VERSION);
    event.waitUntil(
        Promise.all([
            caches.open(CACHE_NAME).then(cache => {
                console.log('[Service Worker] Cacheando archivos');
                return cache.addAll(urlsToCache);
            }),
            self.skipWaiting() // Fuerza la activación inmediata
        ])
    );
});

// Activación del Service Worker
self.addEventListener('activate', event => {
    console.log('[Service Worker] Activando nueva versión:', APP_VERSION);
    event.waitUntil(
        Promise.all([
            deleteOldCaches(),
            self.clients.claim() // Toma el control inmediatamente
        ])
    );
});

// Interceptación de peticiones
self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') return;

    event.respondWith(
        (async () => {
            const url = event.request.url;
            
            // Para archivos críticos, siempre intentar obtener la última versión
            if (isCriticalFile(url)) {
                try {
                    console.log('[Service Worker] Obteniendo archivo crítico de la red:', url);
                    const networkResponse = await fetch(event.request);
                    const cache = await caches.open(CACHE_NAME);
                    cache.put(event.request, networkResponse.clone());
                    return networkResponse;
                } catch (error) {
                    console.log('[Service Worker] Error al obtener archivo crítico, usando caché:', url);
                    const cachedResponse = await caches.match(event.request);
                    return cachedResponse || new Response('Error de red', { status: 504 });
                }
            }

            // Para otros archivos, intentar red primero, caché como respaldo
            try {
                const networkResponse = await fetch(event.request);
                if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                    const cache = await caches.open(CACHE_NAME);
                    cache.put(event.request, networkResponse.clone());
                }
                return networkResponse;
            } catch (error) {
                const cachedResponse = await caches.match(event.request);
                if (cachedResponse) {
                    return cachedResponse;
                }
                
                // Si es una navegación y no hay caché, mostrar página offline
                if (event.request.mode === 'navigate') {
                    return caches.match(`${REPO_PREFIX}offline.html`);
                }
                
                return new Response('Error de red', { status: 504 });
            }
        })()
    );
});

// Manejo de mensajes
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        console.log('[Service Worker] Forzando activación inmediata');
        self.skipWaiting();
    } else if (event.data && event.data.type === 'CHECK_VERSION') {
        event.ports[0].postMessage({
            version: APP_VERSION
        });
    }
});
