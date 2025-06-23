let graficos = {};
let listaActual = null; // rastrea qué lista está activa

document.addEventListener("DOMContentLoaded", async () => {
  const ventas = await obtenerVentas();
  await generarGraficoTipoPago(ventas);
  await generarGraficoPorProducto(ventas);
  await generarGraficoPorCliente(ventas);
});

// OBTENER VENTAS DESDE LA BASE DE DATOS INDEXADA
async function obtenerVentas() {
  return await obtenerTodasLasVentas(); // llamada a IndexedDB async
}

// NUEVA FUNCIÓN PARA CAMBIAR OBTENER LOS GRÁFICOS DE BARRAS (14/06/2025):
function obtenerTipoGraficoSeleccionado() {
  return document.getElementById("tipoGrafico")?.value || "pie";
}

// 🎂 Tipo de pago
async function generarGraficoTipoPago(ventas = null) {
  if (!ventas) ventas = await obtenerVentas();

  const tipos = { contado: 0, credito: 0 };
  ventas.forEach(v => {
    if (v.tipoPago === "contado") tipos.contado++;
    else if (v.tipoPago === "credito") tipos.credito++;
  });

  const tipo = obtenerTipoGraficoSeleccionado();
  const ctx = document.getElementById("graficoTipoPago").getContext("2d");

  if (graficos["tipoPago"]) graficos["tipoPago"].destroy();
  graficos["tipoPago"] = new Chart(ctx, {
    type: tipo,
    data: {
      labels: ["Contado", "Crédito"],
      datasets: [{
        data: [tipos.contado, tipos.credito],
        backgroundColor: ["#5b2d90", "#d1a7ff"]
      }]
    }
  });
}

// 🍹 Por producto
async function generarGraficoPorProducto(ventas = null) {
  if (!ventas) ventas = await obtenerVentas();

  const conteo = {};
  ventas.forEach(v => {
    conteo[v.producto] = (conteo[v.producto] || 0) + 1;
  });

  const tipo = obtenerTipoGraficoSeleccionado();
  const ctx = document.getElementById("graficoProducto").getContext("2d");

  if (graficos["producto"]) graficos["producto"].destroy();
  graficos["producto"] = new Chart(ctx, {
    type: tipo,
    data: {
      labels: Object.keys(conteo),
      datasets: [{
        data: Object.values(conteo),
        backgroundColor: generarColores(Object.keys(conteo).length)
      }]
    }
  });
}

// 👤 Por cliente
async function generarGraficoPorCliente(ventas = null) {
  if (!ventas) ventas = await obtenerVentas();

  const conteo = {};
  ventas.forEach(v => {
    conteo[v.cliente] = (conteo[v.cliente] || 0) + 1;
  });

  const tipo = obtenerTipoGraficoSeleccionado();
  const ctx = document.getElementById("graficoCliente").getContext("2d");

  if (graficos["cliente"]) graficos["cliente"].destroy();
  graficos["cliente"] = new Chart(ctx, {
    type: tipo,
    data: {
      labels: Object.keys(conteo),
      datasets: [{
        data: Object.values(conteo),
        backgroundColor: generarColores(Object.keys(conteo).length)
      }]
    }
  });
}

// 🎨 Generar colores aleatorios suaves
function generarColores(cantidad) {
  const colores = [];
  for (let i = 0; i < cantidad; i++) {
    colores.push(`hsl(${Math.floor(Math.random() * 360)}, 70%, 75%)`);
  }
  return colores;
}

// EXPORTAR VENTAS A EXCEL (async y expuesta para el botón)
async function exportarVentasExcel() {
  const ventas = await obtenerVentas();

  if (!ventas || ventas.length === 0) {
    alert("No hay ventas para exportar.");
    return;
  }

  try {
    // Formatear datos para Excel
    const datos = ventas.map(v => {
      const fila = {
        Cliente: v.cliente || "",
        Producto: v.producto || "",
        Monto: v.monto || 0,
        TipoPago: v.tipoPago || ""
      };

      if (v.tipoPago === "contado") {
        fila.Metodo = v.detallePago?.metodo || "";
      } else if (v.tipoPago === "credito") {
        fila.Acreedor = v.detallePago?.acreedor || "";
        fila.Vencimiento = v.detallePago?.fechaVencimiento || "";
      }

      return fila;
    });

    const ws = XLSX.utils.json_to_sheet(datos);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Ventas");

    XLSX.writeFile(wb, "ventas.xlsx");

    alert("¡Archivo exportado correctamente!");
  } catch (error) {
    console.error("Error al exportar Excel:", error);
    alert("Ocurrió un error al exportar el archivo.");
  }
}
window.exportarVentasExcel = exportarVentasExcel;


// Exponer la función para que pueda ser llamada desde el botón HTML
window.exportarVentasExcel = exportarVentasExcel;

// FILTRAR POR RANGO DE FECHAS
async function aplicarFiltroFechas() {
  const desde = document.getElementById("fechaInicio").value;
  const hasta = document.getElementById("fechaFin").value;

  if (!desde || !hasta) {
    alert("Selecciona ambas fechas.");
    return;
  }

  const ventas = await obtenerVentas();
  const ventasFiltradas = ventas.filter(v => {
    const fecha = v.fecha || v.fechaVenta;
    return fecha >= desde && fecha <= hasta;
  });

  await generarGraficoTipoPago(ventasFiltradas);
  await generarGraficoPorProducto(ventasFiltradas);
  await generarGraficoPorCliente(ventasFiltradas);
}

async function actualizarTodosLosGraficos() {
  const desde = document.getElementById("fechaInicio").value;
  const hasta = document.getElementById("fechaFin").value;
  const tipoAgrupacion = document.getElementById("tipoAgrupacion").value;

  let ventas = await obtenerVentas();

  if (desde && hasta) {
    ventas = ventas.filter(v => {
      const fecha = v.fecha || v.fechaVenta;
      return fecha >= desde && fecha <= hasta;
    });
  }

  if (tipoAgrupacion === "semana") {
    ventas = agruparVentasPor(ventas, "semana");
  } else if (tipoAgrupacion === "mes") {
    ventas = agruparVentasPor(ventas, "mes");
  }

  await generarGraficoTipoPago(ventas);
  await generarGraficoPorProducto(ventas);
  await generarGraficoPorCliente(ventas);
}

async function mostrarVentasCredito() {
  const ventas = (await obtenerVentas()).filter(v => v.tipoPago === "credito");
  renderizarListaEspecial(ventas, "Ventas a Crédito");
}

async function mostrarVentasContado() {
  const ventas = (await obtenerVentas()).filter(v => v.tipoPago === "contado");
  renderizarListaEspecial(ventas, "Ventas al Contado");
}

async function mostrarCobranzas() {
  const hoy = new Date().toISOString().slice(0, 10);
  const ventas = (await obtenerVentas()).filter(v =>
    v.tipoPago === "credito" && v.detallePago?.fechaVencimiento <= hoy
  );
  renderizarListaEspecial(ventas, "Cobranzas");
}

async function mostrarPorProducto() {
  const ventas = await obtenerVentas();
  const resumen = {};

  ventas.forEach(v => {
    (v.productos || []).forEach(p => {
      resumen[p.nombre] = (resumen[p.nombre] || 0) + p.cantidad;
    });
  });

  const lista = document.getElementById("listaEspecial");
  if (Object.keys(resumen).length === 0) {
    lista.innerHTML = "<li>No hay productos vendidos aún.</li>";
    return;
  }

  lista.innerHTML = "";
  for (const [nombre, cantidad] of Object.entries(resumen)) {
    const li = document.createElement("li");
    li.classList.add("item-especial");
    li.innerHTML = `<strong>${nombre}</strong>: ${cantidad} unidades vendidas`;
    lista.appendChild(li);
  }
}

async function mostrarPorFecha() {
  const ventas = await obtenerVentas();
  const resumen = {};

  ventas.forEach(v => {
    const fecha = v.fecha || v.fechaVenta;
    resumen[fecha] = (resumen[fecha] || 0) + (v.ingreso || 0);
  });

  const lista = document.getElementById("listaEspecial");
  const fechasOrdenadas = Object.keys(resumen).sort();

  if (fechasOrdenadas.length === 0) {
    lista.innerHTML = "<li>No hay ventas registradas por fecha.</li>";
    return;
  }

  lista.innerHTML = "";
  fechasOrdenadas.forEach(fecha => {
    const li = document.createElement("li");
    li.classList.add("item-especial");
    li.innerHTML = `<strong>${fecha}</strong>: $${resumen[fecha].toFixed(2)} en ventas`;
    lista.appendChild(li);
  });
}

async function mostrarClientesRecurrentes() {
  const ventas = await obtenerVentas();
  const conteo = {};

  ventas.forEach(v => {
    conteo[v.cliente] = (conteo[v.cliente] || 0) + 1;
  });

  const lista = document.getElementById("listaEspecial");
  const repetidos = Object.entries(conteo).filter(([_, cant]) => cant > 1);

  if (repetidos.length === 0) {
    lista.innerHTML = "<li>No hay clientes recurrentes aún.</li>";
    return;
  }

  lista.innerHTML = "";
  repetidos.forEach(([cliente, veces]) => {
    const li = document.createElement("li");
    li.classList.add("item-especial");
    li.dataset.cliente = cliente.toLowerCase();
    li.innerHTML = `<strong>${cliente}</strong>: ${veces} compras registradas`;
    lista.appendChild(li);
  });
}

function renderizarListaEspecial(ventas, tipo) {
    const lista = document.getElementById("listaEspecial");
    let totalMonto = 0; // <--- ¡NUEVA VARIABLE PARA EL TOTAL!

    if (ventas.length === 0) {
        lista.innerHTML = "<li>No hay resultados para mostrar.</li>";
        // Si no hay ventas, asegurarse de que no haya total visible
        const totalExistente = document.getElementById("totalReporteEspecial");
        if (totalExistente) {
            totalExistente.remove();
        }
        return;
    }

    lista.innerHTML = ""; // Limpia la lista antes de añadir nuevos elementos

    ventas.forEach(v => {
        const li = document.createElement("li");
        li.classList.add("item-especial");
        li.dataset.cliente = v.cliente.toLowerCase();

        // Asegurarse de que 'ingreso' sea un número antes de sumar
        const montoVenta = parseFloat(v.ingreso || 0); 
        totalMonto += montoVenta; // <--- ¡SUMA EL MONTO!

        // Formato del monto para la lista individual
        const montoFormateado = montoVenta.toFixed(2);

        li.innerHTML = `
            <strong>${v.cliente}</strong><br>
            Fecha: ${v.fecha || v.fechaVenta}<br>
            Productos: ${(v.productos || []).map(p => `${p.nombre} x${p.cantidad}`).join(", ")}<br>
            Total: $${montoFormateado}<br>
            ${v.detallePago?.fechaVencimiento ? `Vence: ${v.detallePago.fechaVencimiento}` : ""}
        `;

        lista.appendChild(li);
    });

    // --- ¡AQUÍ ES DONDE AÑADIMOS EL TOTAL AL FINAL! ---
    // Eliminar un total previo si existe para evitar duplicados
    const totalExistente = document.getElementById("totalReporteEspecial");
    if (totalExistente) {
        totalExistente.remove();
    }

    // Crear el elemento para mostrar el total
    const divTotal = document.createElement("div");
    divTotal.id = "totalReporteEspecial"; // ID para poder referenciarlo y eliminarlo
    divTotal.classList.add("total-reporte-especial"); // Clase para estilos
    divTotal.innerHTML = `<strong>Total General:</strong> $${totalMonto.toFixed(2)}`;
    
    document.getElementById("contenedorListaEspecial").appendChild(divTotal); // Añadirlo al nuevo contenedor

}

function filtrarListaEspecial() {
  const filtro = document.getElementById("filtroEspecial").value.toLowerCase();
  const items = document.querySelectorAll(".item-especial");

  items.forEach(item => {
    const cliente = item.dataset.cliente || "";
    item.style.display = cliente.includes(filtro) ? "block" : "none";
  });
}

// IMPORTANTE: Si usas esta función en algún botón o evento, recuerda que ahora es async y debes llamarla con await o manejando promesa
async function alternarLista(tipo) {
  const lista = document.getElementById("listaEspecial");
  const buscador = document.getElementById("buscadorEspecial");

  if (listaActual === tipo) {
    lista.innerHTML = "";
    buscador.style.display = "none";
    listaActual = null;
  } else {
    listaActual = tipo;
    buscador.style.display = "block";

    if (tipo === "credito") await mostrarVentasCredito();
    else if (tipo === "cobranzas") await mostrarCobranzas();
    else if (tipo === "contado") await mostrarVentasContado();
    else if (tipo === "porProducto") await mostrarPorProducto();
    else if (tipo === "porFecha") await mostrarPorFecha();
    else if (tipo === "recurrentes") await mostrarClientesRecurrentes();
  }
  document.getElementById("filtroEspecial").value = "";
}
