// js/exportAll.js

document.addEventListener("DOMContentLoaded", () => {
    // --- LÓGICA DE EXPORTACIÓN ---
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

    // --- LÓGICA DE IMPORTACIÓN ---
    const btnToggleImport = document.getElementById("btnToggleImport");
    const importOptionsContainer = document.getElementById("importOptionsContainer");
    const jsonFileInput = document.getElementById("jsonFileInput");
    // ¡¡¡CAMBIO AQUÍ!!! Apuntamos a 'btnImportarJSON' que es el ID en tu HTML
    const btnImportarJSONDelHTML = document.getElementById("btnImportarJSON"); 

    // ******************************************************************
    // !!! ESTA ES LA PARTE QUE NECESITAS AÑADIR O ASEGURARTE QUE ESTÉ !!!
    // ******************************************************************
    const fileNameDisplay = document.getElementById("fileNameDisplay"); 

    if (jsonFileInput && fileNameDisplay) {
        jsonFileInput.addEventListener("change", () => {
            if (jsonFileInput.files.length > 0) {
                fileNameDisplay.textContent = jsonFileInput.files[0].name;
            } else {
                fileNameDisplay.textContent = "Seleccionar archivo..."; // Texto por defecto si no se selecciona nada
            }
        });
    }
    // ******************************************************************
    // !!! FIN DE LA PARTE A AÑADIR !!!
    // ******************************************************************

    if (btnToggleImport && importOptionsContainer) {
        btnToggleImport.addEventListener("click", () => {
            importOptionsContainer.classList.toggle("open");
            // Opcional: Resetear el display del nombre del archivo y el input cuando se cierra/abre
            if (!importOptionsContainer.classList.contains("open")) {
                if (fileNameDisplay) fileNameDisplay.textContent = "Seleccionar archivo...";
                if (jsonFileInput) jsonFileInput.value = ""; // Limpiar el input file
            }
        });
    }

    // Usamos la nueva variable aquí
    if (btnImportarJSONDelHTML) {
        btnImportarJSONDelHTML.addEventListener("click", importarDatosDesdeJSON);
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
            movimientos: await obtenerTodosLosMovimientos(), // Nombre del store corregido a 'movimientos'
            proveedores: await obtenerTodosLosProveedoresDB(),
            abonos: await obtenerTodosLosAbonos(),
            cuentasPorCobrar: (await obtenerTodasLasVentas()).filter(venta => venta.tipoPago === "credito" && venta.montoPendiente > 0)
        };

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
                } else if (nombreHoja === 'movimientos') { // ¡CORREGIDO AQUÍ TAMBIÉN!
                    if (typeof copia.monto === 'number') copia.monto = copia.monto.toFixed(2);
                    if (typeof copia.ganancia === 'number') copia.ganancia = copia.ganancia.toFixed(2);
                }

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
        } else if (formato === 'pdf') {
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
            const headers = Object.keys(datos[0]);
            const body = datos.map(item => headers.map(header => item[header]));

            doc.setFontSize(14);
            doc.text(capitalizarPrimeraLetra(nombreHoja), margin, yOffset);
            yOffset += 5;

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

            yOffset = doc.autoTable.previous.finalY + 15;

            if (yOffset > pageHeight - 30 && Object.keys(data).indexOf(nombreHoja) < Object.keys(data).length - 1) {
                doc.addPage();
                yOffset = 20;
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

    if (!confirm("ADVERTENCIA: Importar datos reemplazará toda tu información actual. ¿Estás seguro de que quieres continuar? ¡Asegúrate de tener una copia de seguridad!")) {
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
