// js/exportAll.js

document.addEventListener("DOMContentLoaded", () => {
    const btnExportarExcel = document.getElementById("btnExportarExcel");
    const btnExportarCSV = document.getElementById("btnExportarCSV");
    const btnExportarJSON = document.getElementById("btnExportarJSON");
    const btnExportarPDF = document.getElementById("btnExportarPDF"); // Nuevo botón PDF

    if (btnExportarExcel) {
        btnExportarExcel.addEventListener("click", () => exportarTodosLosDatos('excel'));
    }
    if (btnExportarCSV) {
        btnExportarCSV.addEventListener("click", () => exportarTodosLosDatos('csv'));
    }
    if (btnExportarJSON) {
        btnExportarJSON.addEventListener("click", () => exportarTodosLosDatos('json'));
    }
    if (btnExportarPDF) { // Event listener para el botón PDF
        btnExportarPDF.addEventListener("click", () => exportarTodosLosDatos('pdf'));
    }
});

async function exportarTodosLosDatos(formato = 'excel') {
    try {
        if (typeof mostrarToast === 'function') {
            mostrarToast(`Preparando exportación en formato ${formato.toUpperCase()}... ¡Por favor, espera! Esto puede tardar unos segundos.`, "info", 5000);
        } else {
            console.warn("La función 'mostrarToast' no está disponible.");
            alert(`Preparando exportación en formato ${formato.toUpperCase()}... ¡Por favor, espera!`);
        }
        
        const todosLosDatos = {
            inventario: await obtenerTodosLosProductos(), 
            clientes: await obtenerTodosLosClientes(),
            pedidos: await obtenerTodosLosPedidosDB(), 
            ventas: await obtenerTodasLasVentas(),
            movimientosFinancieros: await obtenerTodosLosMovimientos(), 
            proveedores: await obtenerTodosLosProveedoresDB(), 
            abonos: await obtenerTodosLosAbonos(), 
            cuentasPorCobrar: (await obtenerTodasLasVentas()).filter(venta => venta.tipoPago === "credito" && venta.montoPendiente > 0)
        };

        // Función auxiliar para pre-procesar datos para exportación.
        // Esto evita duplicar la lógica de formateo para Excel y PDF/CSV
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
                } else if (nombreHoja === 'movimientosFinancieros') {
                    if (typeof copia.monto === 'number') copia.monto = copia.monto.toFixed(2);
                    if (typeof copia.ganancia === 'number') copia.ganancia = copia.ganancia.toFixed(2);
                }

                // Convertir cualquier otro objeto o array anidado a string JSON
                for (const key in copia) {
                    if (Object.prototype.hasOwnProperty.call(copia, key) && typeof copia[key] === 'object' && copia[key] !== null) {
                        copia[key] = JSON.stringify(copia[key]);
                    }
                }
                return copia;
            });
        };

        const processedData = {};
        for (const [key, value] of Object.entries(todosLosDatos)) {
            if (value && value.length > 0) {
                processedData[key] = preprocesarDatosParaExport(key, value);
            }
        }

        if (formato === 'excel') {
            await exportarAExcel(processedData);
        } else if (formato === 'csv') {
            exportarACSV(processedData);
        } else if (formato === 'json') {
            exportarAJSON(processedData);
        } else if (formato === 'pdf') { // Nueva condición para PDF
            exportarAPDF(processedData);
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

            const headers = Object.keys(datos[0]); // Ya no filtramos 'id' aquí, se eliminó en preprocesar

            csvContent += headers.map(header => `"${header.replace(/"/g, '""')}"`).join(",") + "\n"; // Escapar comillas en headers

            datos.forEach(item => {
                const row = headers.map(header => {
                    let value = item[header];
                    // Si el valor es null o undefined, convertir a cadena vacía para CSV
                    if (value === null || typeof value === 'undefined') {
                        value = '';
                    }
                    if (typeof value === 'string') {
                        value = value.replace(/"/g, '""'); // Escape comillas dobles
                        if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
                            value = `"${value}"`; // Encerrar en comillas si contiene caracteres especiales
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
    document.body.appendChild(link); // Required for Firefox
    link.click();
    document.body.removeChild(link);
    if (typeof mostrarToast === 'function') mostrarToast("¡Datos exportados a CSV correctamente! 📄", "success");
    else alert("¡Datos exportados a CSV correctamente!");
}

function exportarAJSON(data) {
    const jsonData = JSON.stringify(data, null, 2); // pretty print with indentation
    const fecha = new Date().toISOString().slice(0, 10);
    const nombreArchivo = `BaseDeDatosLosSS_${fecha}.json`;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(jsonData);
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", nombreArchivo);
    document.body.appendChild(downloadAnchorNode); // required for firefox
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    if (typeof mostrarToast === 'function') mostrarToast("¡Datos exportados a JSON correctamente! 📦", "success");
    else alert("¡Datos exportados a JSON correctamente!");
}

// Nueva función para exportar a PDF
function exportarAPDF(data) {
    // Asegurarse de que jspdf esté disponible globalmente
    // window.jspdf está disponible si se carga jspdf.umd.min.js
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const fecha = new Date().toISOString().slice(0, 10);
    const nombreArchivo = `BaseDeDatosLosSS_${fecha}.pdf`;

    let yOffset = 20; // Posición Y inicial para el contenido
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
            const headers = Object.keys(datos[0]);
            const body = datos.map(item => headers.map(header => item[header]));

            doc.setFontSize(14);
            doc.text(capitalizarPrimeraLetra(nombreHoja), margin, yOffset);
            yOffset += 5; // Espacio entre título y tabla

            doc.autoTable({
                startY: yOffset,
                head: [headers],
                body: body,
                theme: 'striped', // 'striped', 'grid', 'plain'
                styles: {
                    fontSize: 8,
                    cellPadding: 2,
                    valign: 'middle',
                    halign: 'left'
                },
                headStyles: {
                    fillColor: [218, 165, 32], // Tono dorado para el encabezado
                    textColor: [255, 255, 255],
                    fontStyle: 'bold'
                },
                columnStyles: {
                    // Puedes definir estilos específicos por columna si lo necesitas
                },
                margin: { left: margin, right: margin },
                didDrawPage: function(data) {
                    // Footer de la página con número de página
                    let str = "Página " + doc.internal.getNumberOfPages();
                    doc.setFontSize(10);
                    // 'pageHeight - 10' es la posición desde la parte inferior
                    doc.text(str, pageWidth - margin, pageHeight - 10, { align: 'right' });
                }
            });

            // Actualiza la posición Y para la siguiente tabla
            yOffset = doc.autoTable.previous.finalY + 15;

            // Añade una nueva página si el próximo contenido no cabe
            if (yOffset > pageHeight - 30 && Object.keys(data).indexOf(nombreHoja) < Object.keys(data).length - 1) {
                doc.addPage();
                yOffset = 20; // Restablece yOffset para la nueva página
                // Opcional: Re-añadir encabezado de documento si se quiere en cada página
            }
        }
    }

    doc.save(nombreArchivo);

    if (typeof mostrarToast === 'function') mostrarToast("¡Datos exportados a PDF correctamente! 🖨️", "success");
    else alert("¡Datos exportados a PDF correctamente!");
}


// Función auxiliar para capitalizar la primera letra
function capitalizarPrimeraLetra(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}