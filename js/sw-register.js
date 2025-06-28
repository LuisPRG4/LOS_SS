// Archivo: js/sw-register.js

let newWorker;
let refreshing = false;

// Función para forzar la actualización del Service Worker
async function forceUpdate() {
    if ('serviceWorker' in navigator) {
        try {
            // Desregistrar todos los service workers existentes
            const registrations = await navigator.serviceWorker.getRegistrations();
            for (let registration of registrations) {
                await registration.unregister();
            }
            
            // Limpiar todas las cachés
            const cacheNames = await caches.keys();
            await Promise.all(cacheNames.map(cacheName => caches.delete(cacheName)));
            
            // Recargar la página para registrar el nuevo Service Worker
            window.location.reload(true);
        } catch (error) {
            console.error('Error al forzar la actualización:', error);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const updateButton = document.getElementById('update-app-button');

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/Los_SS/service-worker.js')
            .then(reg => {
                console.log('Service Worker registrado con éxito:', reg);

                // Verificar si hay una actualización al cargar la página
                reg.update();

                reg.addEventListener('updatefound', () => {
                    newWorker = reg.installing;
                    if (newWorker) {
                        console.log('Nuevo Service Worker en estado:', newWorker.state);
                        newWorker.addEventListener('statechange', () => {
                            console.log('Service Worker cambió a estado:', newWorker.state);
                            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                console.log('¡Nueva versión disponible! Mostrando botón de actualización');
                                if (updateButton) {
                                    updateButton.style.display = 'block';
                                }
                            }
                        });
                    }
                });
            })
            .catch(error => {
                console.error('Error al registrar el Service Worker:', error);
            });

        // Evitar múltiples recargas
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (!refreshing) {
                refreshing = true;
                console.log('Service Worker actualizado. Recargando...');
                window.location.reload(true);
            }
        });
    }

    if (updateButton) {
        updateButton.addEventListener('click', async () => {
            console.log('Botón de actualización clickeado');
            
            // Primero intentamos la actualización normal
            if (newWorker) {
                console.log('Enviando mensaje SKIP_WAITING al nuevo Service Worker');
                newWorker.postMessage({ type: 'SKIP_WAITING' });
            } else {
                console.log('No hay nuevo Service Worker, forzando actualización completa');
                await forceUpdate();
            }
        });
    }

    // Verificar actualizaciones cada 5 minutos
    setInterval(() => {
        if (navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({ type: 'CHECK_UPDATE' });
        }
    }, 300000);
});
