// Archivo: js/sw-register.js

document.addEventListener('DOMContentLoaded', () => {
    let newWorker;
    const updateButton = document.getElementById('update-app-button');

    if ('serviceWorker' in navigator) {
        // La ruta del Service Worker es directamente su nombre,
        // ya que está en la raíz del repositorio que es la raíz de la app en GitHub Pages.
        navigator.serviceWorker.register('/Los_SS/service-worker.js') // ¡IMPORTANTE! Aquí se especifica el subdirectorio del repositorio
            .then(reg => {
                console.log('Service Worker registrado con éxito:', reg);

                reg.addEventListener('updatefound', () => {
                    newWorker = reg.installing;
                    if (newWorker) {
                        newWorker.addEventListener('statechange', () => {
                            if (newWorker.state === 'installed') {
                                if (navigator.serviceWorker.controller) {
                                    console.log('¡Nueva versión de la app disponible!');
                                    if (updateButton) {
                                        updateButton.style.display = 'block';
                                    }
                                } else {
                                    console.log('Contenido cacheado para uso offline por primera vez.');
                                }
                            }
                        });
                    }
                });
            })
            .catch(error => {
                console.error('Fallo el registro del Service Worker:', error);
            });

        navigator.serviceWorker.addEventListener('controllerchange', () => {
            console.log('El Service Worker controlador ha cambiado. Recargando para aplicar la nueva versión.');
            window.location.reload();
        });
    }

    if (updateButton) {
        updateButton.addEventListener('click', () => {
            if (newWorker) {
                newWorker.postMessage({ type: 'SKIP_WAITING' });
                console.log('Enviando mensaje SKIP_WAITING al nuevo Service Worker.');
            } else {
                console.log('No hay un nuevo Service Worker esperando para actualizar.');
            }
        });
    }
});