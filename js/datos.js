// js/datos.js - Funcionalidad de exportación e importación de datos

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
    try {
        return {
            productos: await obtenerTodosLosProductos() || [],
            clientes: await obtenerTodosLosClientes() || [],
            pedidos: await obtenerTodosLosPedidosDB() || [],
            ventas: await obtenerTodasLasVentas() || [],
            movimientos: await obtenerTodosLosMovimientos() || [],
            proveedores: await obtenerTodosLosProveedoresDB() || [],
            abonos: await obtenerTodosLosAbonos() || [],
            mermas: await obtenerTodasLasMermasDB() || []
        };
    } catch (error) {
        console.error("Error al obtener todos los datos:", error);
        mostrarToast("Error al obtener datos de la base de datos", "error");
        return {};
    }
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
        
        // Verificar si hay datos para exportar
        const hayDatos = Object.values(todosLosDatos).some(datos => datos && datos.length > 0);
        if (!hayDatos) {
            mostrarToast("No hay datos para exportar. La base de datos está vacía.", "warning");
            return;
        }

        // Para PDF y Excel, podemos incluir cuentasPorCobrar como una hoja/sección adicional
        const cuentasPorCobrarData = (todosLosDatos.ventas || []).filter(venta => 
            venta.tipoPago === "credito" && venta.montoPendiente > 0
        );
        
        let dataParaExportar = {};

        if (formato === 'json') {
            // Para JSON, solo exportamos los stores base que son importables
            for (const key in todosLosDatos) {
                if (todosLosDatos[key] && todosLosDatos[key].length > 0) {
                    dataParaExportar[key] = preprocesarDatosParaExport(key, todosLosDatos[key]);
                }
            }
        } else {
            // Para Excel/CSV/PDF, preprocesamos todos los datos, incluyendo cuentasPorCobrar
            for (const key in todosLosDatos) {
                if (todosLosDatos[key] && todosLosDatos[key].length > 0) {
                    dataParaExportar[key] = preprocesarDatosParaExport(key, todosLosDatos[key]);
                }
            }
            
            // Añadir cuentasPorCobrar si hay datos
            if (cuentasPorCobrarData.length > 0) {
                dataParaExportar.cuentasPorCobrar = preprocesarDatosParaExport('cuentasPorCobrar', cuentasPorCobrarData);
            }
        }

        // Verificar una vez más que haya datos procesados para exportar
        if (Object.keys(dataParaExportar).length === 0) {
            mostrarToast("No hay datos para exportar después del procesamiento.", "warning");
            return;
        }

        // Ejecutar la exportación según el formato
        switch (formato) {
            case 'excel':
                await exportarAExcel(dataParaExportar);
                break;
            case 'csv':
                exportarACSV(dataParaExportar);
                break;
            case 'json':
                exportarAJSON(dataParaExportar);
                break;
            case 'pdf':
                exportarAPDF(dataParaExportar);
                break;
            default:
                mostrarToast(`Formato de exportación '${formato}' no reconocido`, "error");
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
 * @param {string} nombreHoja - Nombre del store o de la hoja de cálculo.
 * @param {Array<Object>} datosOriginales - Array de objetos a preprocesar.
 * @returns {Array<Object>} Array de objetos preprocesados.
 */
const preprocesarDatosParaExport = (nombreHoja, datosOriginales) => {
    try {
        if (!datosOriginales || !Array.isArray(datosOriginales) || datosOriginales.length === 0) {
            return [];
        }
        
        return datosOriginales.map(item => {
            if (!item) return {};
            
            const copia = { ...item };
            // Mantener el ID para posible reimportación
            
            if (nombreHoja === 'ventas' || nombreHoja === 'cuentasPorCobrar') {
                if (copia.productos && Array.isArray(copia.productos)) {
                    copia.productos = copia.productos.map(p => 
                        `${p.nombre || 'Sin nombre'} x${p.cantidad || 0} ($${(p.precio || 0).toFixed(2)})`
                    ).join('; ');
                }
                
                if (copia.detallePago && typeof copia.detallePago === 'object' && copia.detallePago !== null) {
                    if (copia.tipoPago === 'contado') {
                        copia.metodoPago = copia.detallePago.metodo || 'N/A';
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
            } else if (nombreHoja === 'productos') {
                if (typeof copia.stock === 'number') copia.stock = copia.stock.toString();
                if (typeof copia.costo === 'number') copia.costo = copia.costo.toFixed(2);
                if (typeof copia.precio === 'number') copia.precio = copia.precio.toFixed(2);
            }

            // Convertir objetos anidados a JSON para mejor visualización
            for (const key in copia) {
                if (Object.prototype.hasOwnProperty.call(copia, key) && 
                    typeof copia[key] === 'object' && copia[key] !== null) {
                    try {
                        copia[key] = JSON.stringify(copia[key]);
                    } catch (error) {
                        console.warn(`Error al stringificar ${key}:`, error);
                        copia[key] = "[Error al convertir objeto]";
                    }
                }
            }
            
            return copia;
        });
    } catch (error) {
        console.error("Error en preprocesarDatosParaExport:", error);
        return [];
    }
};

/**
 * Exporta los datos a un archivo Excel.
 * @param {Object} data - Objeto con datos a exportar, donde cada clave es una hoja.
 */
async function exportarAExcel(data) {
    try {
        const wb = XLSX.utils.book_new();
        for (const [nombreHoja, datos] of Object.entries(data)) {
            if (datos && datos.length > 0) {
                const ws = XLSX.utils.json_to_sheet(datos);
                XLSX.utils.book_append_sheet(wb, ws, capitalizarPrimeraLetra(nombreHoja).substring(0, 30)); // Excel limita el nombre de hoja a 31 caracteres
            }
        }
        
        const fecha = new Date().toISOString().slice(0, 10);
        const nombreArchivo = `BaseDeDatosLosSS_${fecha}.xlsx`;
        XLSX.writeFile(wb, nombreArchivo);
        
        mostrarToast("¡Datos exportados a Excel correctamente! 🚀", "success");
    } catch (error) {
        console.error("Error al exportar a Excel:", error);
        mostrarToast("Error al exportar a Excel. Verifica la consola para más detalles.", "error");
    }
}

/**
 * Exporta los datos a un archivo CSV.
 * @param {Object} data - Objeto con datos a exportar, donde cada clave es una sección.
 */
function exportarACSV(data) {
    try {
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
        
        mostrarToast("¡Datos exportados a CSV correctamente! 📄", "success");
    } catch (error) {
        console.error("Error al exportar a CSV:", error);
        mostrarToast("Error al exportar a CSV. Verifica la consola para más detalles.", "error");
    }
}

/**
 * Exporta los datos a un archivo JSON.
 * @param {Object} data - Objeto con datos a exportar.
 */
function exportarAJSON(data) {
    try {
        const jsonData = JSON.stringify(data, null, 2);
        const fecha = new Date().toISOString().slice(0, 10);
        const nombreArchivo = `BaseDeDatosLosSS_${fecha}.json`;
        
        const blob = new Blob([jsonData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", url);
        downloadAnchorNode.setAttribute("download", nombreArchivo);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
        
        URL.revokeObjectURL(url);
        mostrarToast("¡Datos exportados a JSON correctamente! 📦", "success");
    } catch (error) {
        console.error("Error al exportar a JSON:", error);
        mostrarToast("Error al exportar a JSON. Verifica la consola para más detalles.", "error");
    }
}

/**
 * Exporta los datos a un archivo PDF.
 * @param {Object} data - Objeto con datos a exportar, donde cada clave es una sección.
 */
function exportarAPDF(data) {
    try {
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
                const body = datos.map(item => headers.map(header => item[header] || ''));

                // Verificar si hay espacio suficiente para la tabla actual, si no, agregar una nueva página
                if (yOffset + (body.length * 8) + 20 > pageHeight - margin && doc.internal.getNumberOfPages() > 1) {
                    doc.addPage();
                    yOffset = margin + 10; // Reiniciar yOffset en la nueva página
                }
                 
                if (doc.autoTable && doc.autoTable.previous && 
                    doc.autoTable.previous.finalY + 15 > pageHeight - 30 && 
                    Object.keys(data).indexOf(nombreHoja) < Object.keys(data).length - 1) {
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
        mostrarToast("¡Datos exportados a PDF correctamente! 🖨️", "success");
    } catch (error) {
        console.error("Error al exportar a PDF:", error);
        mostrarToast("Error al exportar a PDF. Verifica la consola para más detalles.", "error");
    }
}

/**
 * Capitaliza la primera letra de una cadena.
 * @param {string} str - Cadena a capitalizar.
 * @returns {string} Cadena con la primera letra en mayúscula.
 */
function capitalizarPrimeraLetra(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Importa datos desde un archivo JSON.
 */
async function importarDatosDesdeJSON() {
    try {
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

        mostrarToast("Iniciando importación... esto puede tardar un momento.", "info", 5000);

        const reader = new FileReader();

        reader.onload = async (event) => {
            try {
                const importedData = JSON.parse(event.target.result);
                console.log("Datos importados leídos:", importedData);

                // Verificar la estructura básica de los datos
                if (typeof importedData !== 'object' || importedData === null) {
                    throw new Error("El archivo JSON no contiene un objeto válido");
                }

                const storesDisponibles = Object.keys(importedData);
                if (storesDisponibles.length === 0) {
                    throw new Error("El archivo JSON no contiene datos para importar");
                }

                await abrirDB(); // Asegurarse de que la DB esté abierta
                await reemplazarTodosLosDatos(importedData); // Llamar a la función para importar datos

                mostrarToast("¡Datos importados con éxito! La aplicación se recargará para mostrar los nuevos datos.", "success", 5000);
                setTimeout(() => {
                    location.reload(); // Recargar la página para reflejar los nuevos datos
                }, 2000);

            } catch (error) {
                console.error("Error al procesar el archivo JSON o al importar:", error);
                mostrarToast(`Error al importar: ${error.message}. Asegúrate de que sea un JSON válido y con la estructura correcta.`, "error", 5000);
            }
        };

        reader.onerror = (error) => {
            console.error("Error al leer el archivo:", error);
            mostrarToast("Error al leer el archivo. Intenta de nuevo.", "error");
        };

        reader.readAsText(file);
    } catch (error) {
        console.error("Error en importarDatosDesdeJSON:", error);
        mostrarToast(`Error general en la importación: ${error.message}`, "error");
    }
}