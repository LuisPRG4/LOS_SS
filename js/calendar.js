// calendar.js - Lógica para generar y controlar el calendario

// Variables para el mes y año actual que el calendario está mostrando
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();

// Función principal para renderizar el calendario
function renderCalendar() {
    const calendarContainer = document.getElementById('calendarioVencimientos');
    if (!calendarContainer) {
        console.error("Contenedor del calendario no encontrado: #calendarioVencimientos");
        return;
    }
    calendarContainer.innerHTML = ''; // Limpiar el contenedor antes de dibujar

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

        // Aquí podrías añadir lógica para marcar días con eventos/vencimientos si tienes esa información
        // Por ejemplo, si tuvieras una lista de fechas de vencimiento:
        // const eventDates = ['2025-07-15', '2025-07-20']; // Ejemplo de fechas con eventos
        // const currentDayFormatted = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        // if (eventDates.includes(currentDayFormatted)) {
        //     dayCell.classList.add('has-event');
        // }

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

// Exportar la función para que pueda ser llamada desde cuentas-por-cobrar.js
// window.renderCalendarComponent = renderCalendar; // O simplemente llamarla al final de este archivo si se carga after DOMContentLoaded
