// Archivo: js/sw-register.js

let newWorker;
let refreshing = false;

// Función para forzar la actualización del Service Worker
async function forceUpdate() {
    if ('serviceWorker' in navigator) {
        try {
            const registrations = await navigator.serviceWorker.getRegistrations();
            for (let registration of registrations) {
                await registration.unregister();
                console.log('Service Worker desregistrado');
            }
            
            // Limpiar todas las cachés
            const cacheKeys = await caches.keys();
            await Promise.all(cacheKeys.map(key => caches.delete(key)));
            console.log('Cachés limpiadas');
            
            // Recargar la página para registrar el nuevo Service Worker
            window.location.reload(true);
        } catch (error) {
            console.error('Error al forzar actualización:', error);
        }
    }
}

// Función para verificar actualizaciones
async function checkForUpdates(registration) {
    try {
        await registration.update();
        console.log('Verificación de actualización completada');
    } catch (error) {
        console.error('Error al verificar actualizaciones:', error);
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const updateButton = document.getElementById('update-app-button');

    if ('serviceWorker' in navigator) {
        try {
            const registration = await navigator.serviceWorker.register('/Los_SS/service-worker.js');
            console.log('Service Worker registrado:', registration);

            // Verificar actualizaciones inmediatamente
            await checkForUpdates(registration);

            // Verificar actualizaciones cada minuto
            setInterval(() => checkForUpdates(registration), 60000);

            registration.addEventListener('updatefound', () => {
                newWorker = registration.installing;
                if (newWorker) {
                    console.log('Nuevo Service Worker en estado:', newWorker.state);
                    newWorker.addEventListener('statechange', () => {
                        console.log('Service Worker cambió a estado:', newWorker.state);
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            console.log('¡Nueva versión disponible!');
                            if (updateButton) {
                                updateButton.style.display = 'block';
                            }
                        }
                    });
                }
            });

            // Evitar múltiples recargas
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                if (!refreshing) {
                    refreshing = true;
                    console.log('Service Worker actualizado, recargando...');
                    window.location.reload(true);
                }
            });

        } catch (error) {
            console.error('Error al registrar el Service Worker:', error);
        }
    }

    if (updateButton) {
        updateButton.addEventListener('click', async () => {
            console.log('Botón de actualización clickeado');
            updateButton.disabled = true;
            updateButton.textContent = 'Actualizando...';
            
            try {
                if (newWorker) {
                    console.log('Enviando mensaje SKIP_WAITING');
                    newWorker.postMessage({ type: 'SKIP_WAITING' });
                } else {
                    console.log('Forzando actualización completa');
                    await forceUpdate();
                }
            } catch (error) {
                console.error('Error durante la actualización:', error);
                updateButton.disabled = false;
                updateButton.textContent = 'Reintentar Actualización';
            }
        });
    }
});
