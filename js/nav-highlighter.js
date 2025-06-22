document.addEventListener('DOMContentLoaded', function() {
    // Selecciona todos los enlaces de la barra de navegación
    const navLinks = document.querySelectorAll('nav ul li a');

    // Obtiene la ruta de la página actual (ej. /index.html, /novedades.html)
    const currentPath = window.location.pathname;

    navLinks.forEach(link => {
        // Obtiene la ruta del enlace de navegación (ej. /index.html)
        // Usamos new URL() para manejar correctamente si el href es una URL completa
        const linkPath = new URL(link.href).pathname;

        // Compara la ruta actual con la ruta del enlace
        // También maneja el caso especial de la página de inicio (que puede ser '/' o '/index.html')
        let isHomePage = (linkPath === '/' || linkPath === '/index.html') && (currentPath === '/' || currentPath === '/index.html');

        if (linkPath === currentPath || isHomePage) {
            link.classList.add('active'); // Añade la clase 'active' si coincide
        } else {
            link.classList.remove('active'); // Asegura que la clase 'active' se elimine si no coincide
        }
    });
});