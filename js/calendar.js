// calendar.js - Lógica para generar y controlar el calendario

// Variables para el mes y año actual que el calendario está mostrando
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();

// Variable global para almacenar las ventas a crédito pendientes
let ventasPendientesPorFecha = {};

// Función principal para renderizar el calendario
function renderCalendar() {
    const calendarContainer = document.getElementById('calendarioVencimientos');
    if (!calendarContainer) {
        console.error("Contenedor del calendario no encontrado: #calendarioVencimientos");
        return;
    }
    calendarContainer.innerHTML = ''; // Limpiar el contenedor antes de dibujar

    // Cargar las ventas pendientes para este mes antes de dibujar el calendario
    cargarVentasPendientesPorFecha();

    // Crear el encabezado del calendario (Mes y Año, botones de navegación)
    const header = document.createElement('div');
    header.className = 'calendar-header';
    header.innerHTML = `
        <div class="calendar-nav">
            <button id="prevMonth">←</button>
        </div>
        <h2>${new Date(currentYear, currentMonth).toLocaleString('es-ES', { month: 'long', year: 'numeric' })}</h2>
        <div class="calendar-nav">
            <button id="nextMonth">→</button>
        </div>
    `;
    calendarContainer.appendChild(header);

    // Días de la semana
    const weekdaysContainer = document.createElement('div');
    weekdaysContainer.className = 'calendar-weekdays';
    const weekdays = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    weekdays.forEach(day => {
        const dayElement = document.createElement('div');
        dayElement.textContent = day;
        weekdaysContainer.appendChild(dayElement);
    });
    calendarContainer.appendChild(weekdaysContainer);

    // Cuadrícula de los días del mes
    const daysGrid = document.createElement('div');
    daysGrid.className = 'calendar-days';
    calendarContainer.appendChild(daysGrid);

    // Calcular el primer día del mes y el número de días en el mes actual
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay(); // 0 = Domingo, 1 = Lunes, etc.
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate(); // El día 0 del siguiente mes es el último día del actual

    // Días del mes anterior (para rellenar el inicio de la cuadrícula)
    const prevMonthDays = new Date(currentYear, currentMonth, 0).getDate(); // Último día del mes anterior
    for (let i = firstDayOfMonth; i > 0; i--) {
        const dayCell = document.createElement('div');
        dayCell.className = 'calendar-day-cell inactive';
        dayCell.textContent = prevMonthDays - i + 1;
        daysGrid.appendChild(dayCell);
    }

    // Días del mes actual
    const today = new Date();
    for (let day = 1; day <= daysInMonth; day++) {
        const dayCell = document.createElement('div');
        dayCell.className = 'calendar-day-cell';
        dayCell.textContent = day;

        // Marcar el día actual
        if (day === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear()) {
            dayCell.classList.add('current-day');
        }

        // Formatear la fecha actual para buscar en ventasPendientesPorFecha
        const currentDayFormatted = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        
        // Verificar si este día tiene ventas pendientes
        if (ventasPendientesPorFecha[currentDayFormatted] && ventasPendientesPorFecha[currentDayFormatted].length > 0) {
            dayCell.classList.add('has-event');
            
            // Añadir un badge con la cantidad de ventas pendientes
            const ventasCount = ventasPendientesPorFecha[currentDayFormatted].length;
            const badge = document.createElement('span');
            badge.className = 'calendar-event-badge';
            badge.textContent = ventasCount;
            dayCell.appendChild(badge);
            
            // Añadir event listener para mostrar el modal con las ventas pendientes
            dayCell.addEventListener('click', () => {
                mostrarModalVentasPendientes(currentDayFormatted);
            });
        } else {
            // Añadir listener para seleccionar el día (si quieres que sea un selector de fecha)
            dayCell.addEventListener('click', () => {
                // Eliminar selección anterior
                const prevSelected = calendarContainer.querySelector('.selected-day');
                if (prevSelected) {
                    prevSelected.classList.remove('selected-day');
                }
                // Seleccionar el nuevo día
                dayCell.classList.add('selected-day');
                // Aquí puedes emitir un evento o actualizar un input oculto con la fecha seleccionada
                const selectedDate = new Date(currentYear, currentMonth, day);
                console.log("Fecha seleccionada:", selectedDate.toLocaleDateString());
                // Si tienes un input de filtro de fecha, actualízalo:
                const filtroFechaVencimientoInput = document.getElementById('filtroFechaVencimiento');
                if (filtroFechaVencimientoInput) {
                    filtroFechaVencimientoInput.value = selectedDate.toISOString().split('T')[0];
                    // Y si quieres que aplique el filtro automáticamente:
                    // document.getElementById('btnFiltrarCuentas')?.click(); 
                }
            });
        }

        daysGrid.appendChild(dayCell);
    }

    // Días del mes siguiente (para rellenar el final de la cuadrícula)
    const totalCells = firstDayOfMonth + daysInMonth;
    const remainingCells = (totalCells % 7 === 0) ? 0 : 7 - (totalCells % 7);
    for (let i = 1; i <= remainingCells; i++) {
        const dayCell = document.createElement('div');
        dayCell.className = 'calendar-day-cell inactive';
        dayCell.textContent = i;
        daysGrid.appendChild(dayCell);
    }

    // Añadir event listeners a los botones de navegación
    document.getElementById('prevMonth').addEventListener('click', () => {
        currentMonth--;
        if (currentMonth < 0) {
            currentMonth = 11;
            currentYear--;
        }
        renderCalendar(); // Volver a renderizar con el nuevo mes
    });

    document.getElementById('nextMonth').addEventListener('click', () => {
        currentMonth++;
        if (currentMonth > 11) {
            currentMonth = 0;
            currentYear++;
        }
        renderCalendar(); // Volver a renderizar con el nuevo mes
    });
}

/**
 * Carga las ventas a crédito pendientes y las organiza por fecha de vencimiento
 * Esta función es clave para marcar los días en el calendario con ventas pendientes
 * Se llama al inicio de renderCalendar() para asegurar datos actualizados
 */
async function cargarVentasPendientesPorFecha() {
    try {
        console.log("⏳ Cargando ventas pendientes para el calendario...");
        
        // Recargar ventas solo si la función global está disponible
        if (typeof obtenerTodasLasVentas === 'function') {
            const ventas = await obtenerTodasLasVentas();
            console.log(`📊 Total de ventas cargadas: ${ventas.length}`);
            
            // Filtrar solo ventas a crédito con monto pendiente
            // y que tengan fecha de vencimiento definida
            const ventasPendientes = ventas.filter(venta => {
                // Mostrar información de depuración para cada venta
                console.log(`Venta #${venta.id}:`, {
                    tipoPago: venta.tipoPago,
                    montoPendiente: venta.montoPendiente,
                    tieneDetallePago: !!venta.detallePago,
                    fechaVencimiento: venta.detallePago?.fechaVencimiento
                });
                
                return venta.tipoPago === 'credito' && 
                      venta.montoPendiente > 0 && 
                      venta.detallePago && 
                      venta.detallePago.fechaVencimiento;
            });
            
            console.log(`🔍 Ventas pendientes filtradas: ${ventasPendientes.length}`);
            
            // Agrupar por fecha de vencimiento
            ventasPendientesPorFecha = {};
            for (const venta of ventasPendientes) {
                // Normalizar el formato de fecha - manejar tanto YYYY-MM-DD como YYYY/MM/DD
                let fechaVencimiento = venta.detallePago.fechaVencimiento;
                
                // Si la fecha contiene barras, convertirlas a guiones
                fechaVencimiento = fechaVencimiento.replace(/\//g, '-');
                
                // Extraer solo la parte de fecha (YYYY-MM-DD) sin la hora
                fechaVencimiento = fechaVencimiento.split('T')[0];
                
                console.log(`📅 Fecha normalizada: ${fechaVencimiento} para venta #${venta.id}`);
                
                // Crear un array para esta fecha si no existe
                if (!ventasPendientesPorFecha[fechaVencimiento]) {
                    ventasPendientesPorFecha[fechaVencimiento] = [];
                }
                
                // Añadir la venta al array de esta fecha
                ventasPendientesPorFecha[fechaVencimiento].push(venta);
            }
            
            // Verificación específica para la fecha 2025-07-05 mencionada por el usuario
            const fechaBuscada = '2025-07-05';
            console.log(`🔎 Buscando ventas para la fecha ${fechaBuscada}: ${ventasPendientesPorFecha[fechaBuscada] ? ventasPendientesPorFecha[fechaBuscada].length : 0} encontradas`);
            
            // También verificar con formato de barras por si acaso
            const fechaAlternativa = '2025/07/05';
            console.log(`🔎 Buscando ventas con formato alternativo ${fechaAlternativa}: ${ventasPendientesPorFecha[fechaAlternativa] ? ventasPendientesPorFecha[fechaAlternativa].length : 0} encontradas`);
            
            // Mostrar todas las fechas con ventas pendientes
            console.log("📆 Todas las fechas con ventas pendientes:", Object.keys(ventasPendientesPorFecha));
        }
    } catch (error) {
        console.error("❌ Error al cargar ventas pendientes para el calendario:", error);
        ventasPendientesPorFecha = {};
    }
}

// Función para mostrar el modal con las ventas pendientes para una fecha específica
function mostrarModalVentasPendientes(fecha) {
    console.log(`📅 Mostrando modal para fecha: ${fecha}`);
    
    // Cerrar cualquier otro modal que pudiera estar abierto
    if (typeof cerrarTodosLosModales === 'function') {
        cerrarTodosLosModales();
    }
    
    // Verificar si existe el modal, si no, crearlo
    let modalVentas = document.getElementById('modalVentasCalendario');
    if (!modalVentas) {
        modalVentas = document.createElement('div');
        modalVentas.id = 'modalVentasCalendario';
        modalVentas.className = 'modal-overlay';
        
        const modalContent = document.createElement('div');
        modalContent.className = 'modal-content modal-calendar';
        
        modalContent.innerHTML = `
            <div class="modal-header">
                <h2>📅 Ventas Pendientes por Fecha</h2>
                <span class="close-button" id="cerrarModalVentas">&times;</span>
            </div>
            <div class="modal-body" id="ventasCalendarioModalBody">
            </div>
        `;
        
        modalVentas.appendChild(modalContent);
        document.body.appendChild(modalVentas);
        
        // Añadir event listener para cerrar el modal
        document.getElementById('cerrarModalVentas').addEventListener('click', () => {
            modalVentas.style.display = 'none';
        });
        
        // Cerrar el modal al hacer clic fuera del contenido
        modalVentas.addEventListener('click', (e) => {
            if (e.target === modalVentas) {
                modalVentas.style.display = 'none';
            }
        });
    }
    
    // Llenar el modal con las ventas de esta fecha
    const ventasDelDia = ventasPendientesPorFecha[fecha] || [];
    const modalBody = document.getElementById('ventasCalendarioModalBody');
    
    // Formatear la fecha para mostrarla en el título
    const fechaFormateada = new Date(fecha).toLocaleDateString('es-ES', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
    let contenido = `
        <h3>Fecha: ${fechaFormateada}</h3>
        <p>${ventasDelDia.length} venta(s) pendiente(s) para este día</p>
        <div class="ventas-calendario-lista">
    `;
    
    if (ventasDelDia.length === 0) {
        contenido += '<p class="no-ventas">No hay ventas pendientes para esta fecha.</p>';
    } else {
        ventasDelDia.forEach(venta => {
            const diasMora = calcularDiasMora(fecha);
            const estadoClase = diasMora > 0 ? 'venta-vencida' : 'venta-pendiente';
            
            contenido += `
                <div class="venta-item ${estadoClase}">
                    <div class="venta-header">
                        <h4>Cliente: ${venta.cliente}</h4>
                        <span class="venta-id">Factura #${venta.id}</span>
                    </div>
                    <p class="venta-monto">Monto Pendiente: $${venta.montoPendiente.toFixed(2)}</p>
                    <p class="venta-fecha">Fecha de Venta: ${venta.fecha}</p>
                    <p class="venta-estado">Estado: ${venta.estadoPago}</p>
                    <div class="venta-acciones">
                        <button class="btn-abonar" onclick="window.abrirModalAbono(${venta.id})">💰 Abonar</button>
                        <button class="btn-ver-detalle" onclick="window.mostrarDetalleVentaModal(${venta.id})">👁️ Ver Detalle</button>
                    </div>
                </div>
            `;
        });
    }
    
    contenido += '</div>';
    modalBody.innerHTML = contenido;
    
    // Mostrar el modal
    modalVentas.style.display = 'flex';
}

// Función auxiliar para calcular días de mora
function calcularDiasMora(fechaVencimiento) {
    const hoy = new Date();
    const fechaVenc = new Date(fechaVencimiento);
    
    // Eliminar la hora para comparar solo fechas
    hoy.setHours(0, 0, 0, 0);
    fechaVenc.setHours(0, 0, 0, 0);
    
    const diferencia = hoy - fechaVenc;
    return Math.floor(diferencia / (1000 * 60 * 60 * 24));
}

// Función para mostrar detalle completo de una venta
function mostrarDetalleVentaModal(ventaId) {
    // Esta función podría implementarse posteriormente para mostrar un modal con todos los detalles
    // de una venta específica, pero por ahora reutilizamos el modal existente de abonos
    abrirModalAbono(ventaId);
}

// Exportar la función para que pueda ser llamada desde cuentas-por-cobrar.js
// window.renderCalendarComponent = renderCalendar; // O simplemente llamarla al final de este archivo si se carga after DOMContentLoaded
