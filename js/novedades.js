// Este archivo JavaScript contiene funcionalidades específicas para el módulo de Novedades.

document.addEventListener("DOMContentLoaded", () => {
    console.log("Módulo de Novedades cargado.");
    
    // Aquí puedes añadir lógica específica para el contenido de novedades
    // Por ejemplo, si las novedades se cargaran dinámicamente desde una API o IndexedDB.
});

// --- Funciones para la Ayuda Contextual (Únicas para Novedades) ---

function novedadesMostrarAyuda() {
    const ayuda = document.getElementById("ayuda");
    ayuda.classList.add("visible");
    ayuda.scrollIntoView({ behavior: "smooth", block: "start" });
}

function novedadesCerrarAyuda() {
    const ayuda = document.getElementById("ayuda");
    ayuda.classList.remove("visible");
}