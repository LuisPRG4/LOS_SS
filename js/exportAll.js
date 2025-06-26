// js/exportAll.js (CÓDIGO CORREGIDO Y ACTUALIZADO)

document.addEventListener("DOMContentLoaded", () => {
    // --- LÓGICA DE EXPORTACIÓN ---
    const btnExportarExcel = document.getElementById("btnExportarExcel");
    const btnExportarCSV = document.getElementById("btnExportarCSV");
    const btnExportarJSON = document.getElementById("btnExportarJSON");
    const btnExportarPDF = document.getElementById("btnExportarPDF");

    if (btnExportarExcel) {
        btnExportarExcel.addEventListener("click", () => exportarTodosLosDatos('excel'));
    }
    if (btnExportarCSV) {
        btnExportarCSV.addEventListener("click", () => exportarTodosLosDatos('csv'));
    }
    if (btnExportarJSON) {
        btnExportarJSON.addEventListener("click", () => exportarTodosLosDatos('json'));
    }
    if (btnExportarPDF) {
        btnExportarPDF.addEventListener("click", () => exportarTodosLosDatos('pdf'));
    }

    // --- LÓGICA DE IMPORTACIÓN ---
    const btnToggleImport = document.getElementById("btnToggleImport");
    const importOptionsContainer = document.getElementById("importOptionsContainer");
    const jsonFileInput = document.getElementById("jsonFileInput");
    const btnImportarJSONDelHTML = document.getElementById("btnImportarJSON");
    const fileNameDisplay = document.getElementById("fileNameDisplay");

    if (jsonFileInput && fileNameDisplay) {
        jsonFileInput.addEventListener("change", () => {
            if (jsonFileInput.files.length > 0) {
                fileNameDisplay.textContent = jsonFileInput.files[0].name;
            } else {
                fileNameDisplay.textContent = "Seleccionar archivo...";
            }
        });
    }

    if (btnToggleImport && importOptionsContainer) {
        btnToggleImport.addEventListener("click", () => {
            importOptionsContainer.classList.toggle("open");
            if (!importOptionsContainer.classList.contains("open")) {
                if (fileNameDisplay) fileNameDisplay.textContent = "Seleccionar archivo...";
                if (jsonFileInput) jsonFileInput.value = "";
            }
        });
    }

    if (btnImportarJSONDelHTML) {
        btnImportarJSONDelHTML.addEventListener("click", importarDatosDesdeJSON);
    }
});

/**
 * Obtiene todos los datos de los diferentes object stores de IndexedDB.
 * @returns {Promise<Object>} Objeto con todos los datos por nombre de store.
 */
async function obtenerTodosLosDatosDeLaDB() {
    return {
        productos: await obtenerTodosLosProductos(), // ¡Cambiado de 'inventario' a 'productos'!
        clientes: await obtenerTodosLosClientes(),
        pedidos: await obtenerTodosLosPedidosDB(),
        ventas: await obtenerTodasLasVentas(),
        movimientos: await obtenerTodosLosMovimientos(),
        proveedores: await obtenerTodosLosProveedoresDB(),
        abonos: await obtenerTodosLosAbonos(),
        // cuentasPorCobrar no es un store, es un filtro de 'ventas',
        // se calcula al momento si es necesario para reportes.
    };
}

/**
 * Exporta todos los datos de la DB en el formato especificado.
 * @param {string} formato - El formato de exportación ('excel', 'csv', 'json', 'pdf').
 */
async function exportarTodosLosDatos(formato = 'excel') {
    try {
        if (typeof mostrarToast === 'function') {
            mostrarToast(`Preparando exportación en formato ${formato.toUpperCase()}... ¡Por favor, espera! Esto puede tardar unos segundos.`, "info", 5000);
        } else {
            console.warn("La función 'mostrarToast' no está disponible.");
            alert(`Preparando exportación en formato ${formato.toUpperCase()}... ¡Por favor, espera!`);
        }

        const todosLosDatos = await obtenerTodosLosDatosDeLaDB();

        // Para PDF y Excel, podemos incluir cuentasPorCobrar como una hoja/sección adicional
        const cuentasPorCobrarData = (todosLosDatos.ventas || []).filter(venta => venta.tipoPago === "credito" && venta.montoPendiente > 0);
        
        let dataParaExportar;

        if (formato === 'json') {
            // Para JSON, solo exportamos los stores base que son importables
            dataParaExportar = {};
            for (const key in todosLosDatos) {
                // Excluir 'cuentasPorCobrar' y cualquier otro dato no-store si lo añades
                if (key !== 'cuentasPorCobrar' && todosLosDatos[key]) { // Asegurarse de que el dato exista
                    dataParaExportar[key] = preprocesarDatosParaExport(key, todosLosDatos[key]);
                }
            }
        } else {
            // Para Excel/CSV/PDF, preprocesamos todos los datos, incluyendo cuentasPorCobrar si se desea como una sección
            dataParaExportar = {};
            for (const key in todosLosDatos) {
                if (todosLosDatos[key]) {
                    dataParaExportar[key] = preprocesarDatosParaExport(key, todosLosDatos[key]);
                }
            }
            // Añadir cuentasPorCobrar si hay datos y no es formato JSON
            if (cuentasPorCobrarData.length > 0) {
                dataParaExportar.cuentasPorCobrar = preprocesarDatosParaExport('cuentasPorCobrar', cuentasPorCobrarData);
            }
        }

        // Ejecutar la exportación según el formato
        if (formato === 'excel') {
            await exportarAExcel(dataParaExportar);
        } else if (formato === 'csv') {
            exportarACSV(dataParaExportar);
        } else if (formato === 'json') {
            exportarAJSON(dataParaExportar);
        } else if (formato === 'pdf') {
            exportarAPDF(dataParaExportar);
        }

    } catch (error) {
        console.error("Error al exportar todos los datos:", error);
        if (typeof mostrarToast === 'function') {
            mostrarToast("Error al exportar los datos. Consulta la consola para más detalles. 😔", "error");
        } else {
            alert("Ocurrió un error al exportar los datos. Consulta la consola para más detalles.");
        }
    }
}

/**
 * Preprocesa los datos de un store para que sean más legibles en la exportación.
 * Por ejemplo, convierte arrays de objetos en cadenas, formatea números, etc.
 * @param {string} nombreHoja - Nombre del store o de la hoja de cálculo.
 * @param {Array<Object>} datosOriginales - Array de objetos a preprocesar.
 * @returns {Array<Object>} Array de objetos preprocesados.
 */
const preprocesarDatosParaExport = (nombreHoja, datosOriginales) => {
    return datosOriginales.map(item => {
        const copia = { ...item };
        delete copia.id; // Eliminar el ID interno de IndexedDB

        if (nombreHoja === 'ventas' || nombreHoja === 'cuentasPorCobrar') {
            if (copia.productos && Array.isArray(copia.productos)) {
                copia.productos = copia.productos.map(p => `${p.nombre} x${p.cantidad} ($${p.precio?.toFixed(2)})`).join('; ');
            }
            if (copia.detallePago && typeof copia.detallePago === 'object' && copia.detallePago !== null) {
                if (copia.tipoPago === 'contado') {
                    copia.metodoPago = copia.detallePago.metodo;
                } else if (copia.tipoPago === 'credito') {
                    copia.acreedor = copia.detallePago.acreedor || 'N/A';
                    copia.fechaVencimiento = copia.detallePago.fechaVencimiento || 'N/A';
                }
                delete copia.detallePago;
            }
            if (typeof copia.ingreso === 'number') copia.ingreso = copia.ingreso.toFixed(2);
            if (typeof copia.ganancia === 'number') copia.ganancia = copia.ganancia.toFixed(2);
            if (typeof copia.montoPendiente === 'number') copia.montoPendiente = copia.montoPendiente.toFixed(2);
        } else if (nombreHoja === 'abonos') {
            if (typeof copia.montoAbonado === 'number') copia.montoAbonado = copia.montoAbonado.toFixed(2);
        } else if (nombreHoja === 'movimientos') {
            if (typeof copia.monto === 'number') copia.monto = copia.monto.toFixed(2);
            if (typeof copia.ganancia === 'number') copia.ganancia = copia.ganancia.toFixed(2);
        } else if (nombreHoja === 'productos') { // Nuevo: Para inventario, asegura stock/costo/precio
            if (typeof copia.stock === 'number') copia.stock = copia.stock.toString(); // Convertir a string para exportación
            if (typeof copia.costo === 'number') copia.costo = copia.costo.toFixed(2);
            if (typeof copia.precio === 'number') copia.precio = copia.precio.toFixed(2);
        }

        // Convertir cualquier objeto anidado que quede a cadena JSON
        for (const key in copia) {
            if (Object.prototype.hasOwnProperty.call(copia, key) && typeof copia[key] === 'object' && copia[key] !== null) {
                copia[key] = JSON.stringify(copia[key]);
            }
        }
        return copia;
    });
};

async function exportarAExcel(data) {
    const wb = XLSX.utils.book_new();
    for (const [nombreHoja, datos] of Object.entries(data)) {
        if (datos && datos.length > 0) {
            const ws = XLSX.utils.json_to_sheet(datos);
            XLSX.utils.book_append_sheet(wb, ws, capitalizarPrimeraLetra(nombreHoja));
        }
    }
    const fecha = new Date().toISOString().slice(0, 10);
    const nombreArchivo = `BaseDeDatosLosSS_${fecha}.xlsx`;
    XLSX.writeFile(wb, nombreArchivo);
    if (typeof mostrarToast === 'function') mostrarToast("¡Datos exportados a Excel correctamente! 🚀", "success");
    else alert("¡Datos exportados a Excel correctamente!");
}

function exportarACSV(data) {
    let csvContent = "data:text/csv;charset=utf-8,";

    for (const [nombreHoja, datos] of Object.entries(data)) {
        if (datos && datos.length > 0) {
            csvContent += `\n--- Hoja: ${capitalizarPrimeraLetra(nombreHoja)} ---\n`;

            const headers = Object.keys(datos[0]);

            csvContent += headers.map(header => `"${header.replace(/"/g, '""')}"`).join(",") + "\n";

            datos.forEach(item => {
                const row = headers.map(header => {
                    let value = item[header];
                    if (value === null || typeof value === 'undefined') {
                        value = '';
                    }
                    if (typeof value === 'string') {
                        value = value.replace(/"/g, '""');
                        if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
                            value = `"${value}"`;
                        }
                    }
                    return value;
                }).join(",");
                csvContent += row + "\n";
            });
        }
    }

    const fecha = new Date().toISOString().slice(0, 10);
    const nombreArchivo = `BaseDeDatosLosSS_${fecha}.csv`;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", nombreArchivo);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    if (typeof mostrarToast === 'function') mostrarToast("¡Datos exportados a CSV correctamente! 📄", "success");
    else alert("¡Datos exportados a CSV correctamente!");
}

function exportarAJSON(data) {
    const jsonData = JSON.stringify(data, null, 2);
    const fecha = new Date().toISOString().slice(0, 10);
    const nombreArchivo = `BaseDeDatosLosSS_${fecha}.json`;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(jsonData);
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", nombreArchivo);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    if (typeof mostrarToast === 'function') mostrarToast("¡Datos exportados a JSON correctamente! 📦", "success");
    else alert("¡Datos exportados a JSON correctamente!");
}

function exportarAPDF(data) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const fecha = new Date().toISOString().slice(0, 10);
    const nombreArchivo = `BaseDeDatosLosSS_${fecha}.pdf`;

    let yOffset = 20;
    const margin = 10;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    doc.setFontSize(18);
    doc.text("Reporte General de Datos - Los SS", pageWidth / 2, yOffset, { align: 'center' });
    yOffset += 10;
    doc.setFontSize(10);
    doc.text(`Fecha de Exportación: ${new Date().toLocaleString()}`, pageWidth / 2, yOffset, { align: 'center' });
    yOffset += 20;

    for (const [nombreHoja, datos] of Object.entries(data)) {
        if (datos && datos.length > 0) {
            doc.setFontSize(14);
            doc.text(capitalizarPrimeraLetra(nombreHoja), margin, yOffset);
            yOffset += 5;

            const headers = Object.keys(datos[0]);
            const body = datos.map(item => headers.map(header => item[header]));

            // Verificar si hay espacio suficiente para la tabla actual, si no, agregar una nueva página
            if (yOffset + (body.length * 8) + 20 > pageHeight - margin && doc.internal.getNumberOfPages() > 1) { // 8 es aprox alto fila
                 doc.addPage();
                 yOffset = margin + 10; // Reiniciar yOffset en la nueva página
            }
             if (doc.autoTable.previous && doc.autoTable.previous.finalY + 15 > pageHeight - 30 && Object.keys(data).indexOf(nombreHoja) < Object.keys(data).length - 1) {
                doc.addPage();
                yOffset = margin + 10;
            }


            doc.autoTable({
                startY: yOffset,
                head: [headers],
                body: body,
                theme: 'striped',
                styles: {
                    fontSize: 8,
                    cellPadding: 2,
                    valign: 'middle',
                    halign: 'left'
                },
                headStyles: {
                    fillColor: [218, 165, 32],
                    textColor: [255, 255, 255],
                    fontStyle: 'bold'
                },
                columnStyles: {},
                margin: { left: margin, right: margin },
                didDrawPage: function(data) {
                    let str = "Página " + doc.internal.getNumberOfPages();
                    doc.setFontSize(10);
                    doc.text(str, pageWidth - margin, pageHeight - 10, { align: 'right' });
                }
            });

            yOffset = doc.autoTable.previous.finalY + 15; // Actualiza el yOffset para la siguiente tabla

            // Añadir una nueva página si el contenido de la próxima sección no cabe
            if (Object.keys(data).indexOf(nombreHoja) < Object.keys(data).length - 1) { // Si no es la última hoja
                if (yOffset > pageHeight - 30) { // Si queda poco espacio
                    doc.addPage();
                    yOffset = 20; // Reiniciar yOffset para la nueva página
                }
            }
        }
    }

    doc.save(nombreArchivo);

    if (typeof mostrarToast === 'function') mostrarToast("¡Datos exportados a PDF correctamente! 🖨️", "success");
    else alert("¡Datos exportados a PDF correctamente!");
}

function capitalizarPrimeraLetra(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

async function importarDatosDesdeJSON() {
    const fileInput = document.getElementById("jsonFileInput");
    const file = fileInput.files[0];

    if (!file) {
        mostrarToast("Por favor, selecciona un archivo JSON para importar.", "warning");
        return;
    }

    // Usar mostrarConfirmacion en lugar de confirm para mejor UI
    const confirmar = await mostrarConfirmacion(
        "ADVERTENCIA: Importar datos reemplazará toda tu información actual. ¿Estás seguro de que quieres continuar? ¡Asegúrate de tener una copia de seguridad!",
        "Confirmar Importación"
    );

    if (!confirmar) {
        mostrarToast("Importación cancelada.", "info");
        return;
    }

    mostrarToast("Iniciando importación... esto puede tardar un momento.", "info");

    const reader = new FileReader();

    reader.onload = async (event) => {
        try {
            const importedData = JSON.parse(event.target.result);
            console.log("Datos importados leídos:", importedData);

            await abrirDB(); // Asegurarse de que la DB esté abierta

            await reemplazarTodosLosDatos(importedData); // Llamar a la función para importar datos

            mostrarToast("¡Datos importados con éxito! La aplicación se recargará para mostrar los nuevos datos.", "success", 5000);
            setTimeout(() => {
                location.reload(); // Recargar la página para reflejar los nuevos datos
            }, 2000);

        } catch (error) {
            console.error("Error al procesar el archivo JSON o al importar:", error);
            mostrarToast("Error al importar el archivo. Asegúrate de que sea un JSON válido y con la estructura correcta. 😔", "error");
        }
    };

    reader.onerror = (error) => {
        console.error("Error al leer el archivo:", error);
        mostrarToast("Error al leer el archivo. Intenta de nuevo. 😔", "error");
    };

    reader.readAsText(file);
}

// Asegurarse de que mostrarConfirmacion esté disponible (asumiendo que está en db.js o en un archivo global)
// Si no la tienes definida, puedes añadir una versión básica aquí:
if (typeof mostrarConfirmacion !== 'function') {
    window.mostrarConfirmacion = async (message, title = "Confirmar") => {
        return new Promise(resolve => {
            const result = confirm(`${title}\n\n${message}`); // Fallback to native confirm
            resolve(result);
        });
    };
}
