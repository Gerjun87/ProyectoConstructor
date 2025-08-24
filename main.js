// ===============================
// Constantes Google Sheets
// ===============================
const SPREADSHEET_ID = '17NWdiemzo2kocMgVeIZ9YyfL8yEux9VtKwvkRmnG1hQ';
const API_KEY = 'AIzaSyCblactvvgWRsauiiFvKk3YBNJWOKw0ZPM';
const APPS_SCRIPT_URL = 'https://proyecto-constructor.vercel.app/api/proxy';

// ===============================
// Helpers de notificación
// ===============================
function showNotification(message, type = "success") {
    const notification = document.getElementById("notification");
    if (!notification) return; // seguridad por si no existe el div

    notification.textContent = message;

    // Resetear clases
    notification.className = "notification";
    if (type === "error") notification.classList.add("error");

    // Mostrar
    notification.classList.add("show");

    // Ocultar después de 3s
    setTimeout(() => {
        notification.classList.remove("show");
    }, 3000);
}

// ===============================
// Helpers de red
// ===============================
async function getSheetData(sheetName) {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${sheetName}!A1:Z?key=${API_KEY}`;
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
        const data = await response.json();
        if (!data.values) return [];
        const headers = data.values[0];
        const rows = data.values.slice(1);
        return rows.map(row => {
            const obj = {};
            headers.forEach((h, i) => obj[h] = row[i]);
            return obj;
        });
    } catch (error) {
        console.error('Error al obtener datos:', error);
        return [];
    }
}

async function writeSheetData(data) {
    try {
        const response = await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await response.json();
        return result.status === 'success';
    } catch (error) {
        console.error('Error al guardar datos:', error);
        return false;
    }
}

// ===============================
// Sesión
// ===============================
function checkAuth() {
    if (!localStorage.getItem('currentUser')) {
        window.location.href = 'index.html';
    }
}

// ===============================
// Boot
// ===============================
document.addEventListener('DOMContentLoaded', () => {
    // ---- Login
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            const errorMessage = document.getElementById('error-message');
            errorMessage.style.display = 'none';

            const users = await getSheetData('Usuarios');
            if (!users) {
                errorMessage.textContent = 'Error al conectar con la base de datos.';
                errorMessage.style.display = 'block';
                return;
            }

            const userFound = users.find(u => u.Usuario === username && u.Contraseña === password);
            if (userFound) {
                localStorage.setItem('currentUser', JSON.stringify(userFound));
                window.location.href = 'registro.html';
            } else {
                errorMessage.textContent = 'Usuario o contraseña incorrectos.';
                errorMessage.style.display = 'block';
            }
        });
    }

    // ---- Registro
    if (document.body.classList.contains('registro-page')) {
        checkAuth();
        setupRegistro();
        document.getElementById('logout-btn')?.addEventListener('click', () => {
            localStorage.removeItem('currentUser');
            window.location.href = 'index.html';
        });
    }

    // ---- Reportes
    if (document.body.classList.contains('reportes-page')) {
        checkAuth();
        setupReportes();
        document.getElementById('logout-btn')?.addEventListener('click', () => {
            localStorage.removeItem('currentUser');
            window.location.href = 'index.html';
        });
    }

    // ---- Gestión
    if (document.body.classList.contains('gestion-page')) {
        checkAuth();
        //setupGestion();
        document.getElementById('logout-btn')?.addEventListener('click', () => {
            localStorage.removeItem('currentUser');
            window.location.href = 'index.html';
        });
    }
});

// ===============================
// REGISTRO
// ===============================
async function setupRegistro() {
    const obraSelect = document.getElementById('obra');
    const empleadosContainer = document.getElementById('empleados-lista');
    const selectedSpan = document.getElementById('selected-empleados');
    const selectBox = document.querySelector('.select-box');
    const costoInput = document.getElementById('costo');
    const registroForm = document.getElementById('registro-form');
    const fechaInput = document.getElementById('fecha');

    const obras = await getSheetData('Obras');
    const empleados = await getSheetData('Empleados');

    // Cargar obras (evitar duplicados)
    if (obraSelect.options.length <= 1 && obras) {
        obras.forEach(obra => {
            const option = document.createElement('option');
            option.value = obra.ID_Obra;
            option.textContent = obra.Nombre_Obra;
            obraSelect.appendChild(option);
        });
    }

    // --- Helper para normalizar fechas a YYYY-MM-DD ---
    const normalizarFecha = (f) => {
        if (!f) return '';
        const s = String(f).trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s; // ya está OK
        const d = new Date(s);
        if (!isNaN(d)) {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${day}`;
        }
        // fallback: cortar a 10 por si viene "YYYY-MM-DDThh:mm..."
        return s.slice(0, 10);
    };

    // Cargar empleados aplicando filtro por fecha seleccionada
    async function cargarEmpleadosParaFecha(fechaSeleccionada) {
        empleadosContainer.innerHTML = '';
        selectedSpan.textContent = 'Selecciona uno o más empleados';
        costoInput.value = 0;

        if (!fechaSeleccionada) return;

        // Traer registros SIEMPRE al momento de elegir fecha (datos frescos)
        const registros = await getSheetData('Registros_Diarios');
        const fechaNorm = normalizarFecha(fechaSeleccionada);

        // IDs de empleados ya ocupados ese día (en cualquier obra)
        const empleadosOcupadosSet = new Set(
            (registros || [])
                .filter(r => normalizarFecha(r.Fecha) === fechaNorm)
                .map(r => r.ID_Empleado)
        );

        // Pintar lista (ocultando ocupados)
        if (empleados && empleados.length) {
            empleados.forEach(empleado => {
                if (empleadosOcupadosSet.has(empleado.ID_Empleado)) {
                    // Ocultar los ocupados ese día
                    return;
                }

                const label = document.createElement('label');

                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.value = empleado.ID_Empleado;
                checkbox.dataset.costo = empleado.Costo_Diario;
                checkbox.dataset.nombre = empleado.Nombre_Completo;

                label.appendChild(checkbox);
                label.appendChild(document.createTextNode(` ${empleado.Nombre_Completo} ($${empleado.Costo_Diario})`));
                empleadosContainer.appendChild(label);

                checkbox.addEventListener('change', () => {
                    actualizarCostoTotal();
                    actualizarTextoSeleccionados();
                });
            });
        }
    }

    function actualizarCostoTotal() {
        const marcados = empleadosContainer.querySelectorAll('input[type="checkbox"]:checked');
        let total = 0;
        marcados.forEach(cb => total += parseFloat(cb.dataset.costo) || 0);
        costoInput.value = total;
    }

    function actualizarTextoSeleccionados() {
        const marcados = empleadosContainer.querySelectorAll('input[type="checkbox"]:checked');
        const nombres = Array.from(marcados).map(cb => cb.dataset.nombre);
        selectedSpan.textContent = nombres.length ? nombres.join(', ') : 'Selecciona uno o más empleados';
    }

    // Dropdown empleados: pedir fecha primero
    selectBox.addEventListener('click', () => {
        if (!fechaInput.value) {
            showNotification("Elegí una fecha primero.", "error");
            return;
        }
        const activo = empleadosContainer.classList.toggle('active');
        empleadosContainer.style.display = activo ? 'block' : 'none';
        selectBox.querySelector('.arrow').textContent = activo ? '❌' : '📠';
    });

    // Cuando cambia la fecha, recargar la lista con filtro
    fechaInput.addEventListener('change', async () => {
        await cargarEmpleadosParaFecha(fechaInput.value);
        // cerrar dropdown al cambiar fecha
        empleadosContainer.style.display = 'none';
        empleadosContainer.classList.remove('active');
        selectBox.querySelector('.arrow').textContent = '📠';
    });

    // Si ya hay fecha pre-cargada (autofill/navegador), cargar al inicio
    if (fechaInput.value) {
        await cargarEmpleadosParaFecha(fechaInput.value);
    }

    // Guardar registros diarios (con bloqueo anti-doble click)
    registroForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const submitBtn = registroForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = "Guardando...";

        const fecha = fechaInput.value;
        const obraId = obraSelect.value;
        const marcados = empleadosContainer.querySelectorAll('input[type="checkbox"]:checked');

        if (!fecha || !obraId || marcados.length === 0) {
            showNotification("Completa fecha, obra y al menos un empleado.", "error");
            submitBtn.disabled = false;
            submitBtn.textContent = "Guardar Registro";
            return;
        }

        let ok = true;
        for (const cb of marcados) {
            const payload = {
                ID_Registro: Date.now() + "_" + cb.value,
                Fecha: normalizarFecha(fecha), // guardamos normalizado
                ID_Obra: obraId,
                ID_Empleado: cb.value,
                Costo_Diario: cb.dataset.costo
            };
            const success = await writeSheetData(payload);
            if (!success) ok = false;
            await new Promise(r => setTimeout(r, 5)); // micro pausa para IDs únicos
        }

        if (ok) {
            showNotification("Registros guardados con éxito ✅", "success");
            setTimeout(() => location.reload(), 2500);
        } else {
            showNotification("Hubo un error al guardar uno o más registros.", "error");
            submitBtn.disabled = false;
            submitBtn.textContent = "Guardar Registro";
        }
    });
}

// ===============================
// REPORTES MEJORADOS
// ===============================
async function setupReportes() {
    const reporteForm = document.getElementById('reporte-form');
    const reporteResultados = document.getElementById('reporte-resultados');

    reporteForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const fechaInicio = document.getElementById('fecha-inicio').value;
        const fechaFin = document.getElementById('fecha-fin').value;
        reporteResultados.innerHTML = '';

        // Traer datos
        const registros = await getSheetData('Registros_Diarios');
        const obras = await getSheetData('Obras');
        const empleados = await getSheetData('Empleados');

        if (!registros || !obras || !empleados) {
            reporteResultados.innerHTML = `<p class="error-message">Error al cargar los datos para el reporte.</p>`;
            return;
        }

        // Filtrar por rango de fechas
        const registrosFiltrados = registros.filter(registro => {
            const fechaRegistro = new Date(registro.Fecha);
            const inicio = new Date(fechaInicio);
            const fin = new Date(fechaFin);
            fin.setDate(fin.getDate() + 1); // incluir último día
            return fechaRegistro >= inicio && fechaRegistro < fin;
        });

        // Agrupar por obra
        const reportePorObra = {};
        registrosFiltrados.forEach(registro => {
            const obraId = registro.ID_Obra;
            const costo = parseFloat(registro.Costo_Diario) || 0;
            if (!reportePorObra[obraId]) {
                reportePorObra[obraId] = { totalCosto: 0, registros: [] };
            }
            reportePorObra[obraId].totalCosto += costo;
            reportePorObra[obraId].registros.push(registro);
        });

        if (Object.keys(reportePorObra).length === 0) {
            reporteResultados.innerHTML = `<p>No se encontraron registros para el período seleccionado.</p>`;
            return;
        }

        // Construir HTML del reporte
        let html = `<table class="reporte-table">
                        <thead>
                            <tr>
                                <th>Obra</th>
                                <th>Total Obra</th>
                                <th>Detalles</th>
                            </tr>
                        </thead>
                        <tbody>`;

        let totalGeneral = 0;
        for (const obraId in reportePorObra) {
            const obra = obras.find(o => o.ID_Obra === obraId);
            const nombreObra = obra ? obra.Nombre_Obra : 'Obra desconocida';
            const totalObra = reportePorObra[obraId].totalCosto;
            totalGeneral += totalObra;

            html += `
                <tr class="obra-row">
                    <td>${nombreObra}</td>
                    <td>$${totalObra.toLocaleString('es-CL')}</td>
                    <td><button class="ver-detalles-btn" data-obra-id="${obraId}">Ver detalles</button></td>
                </tr>
                <tr class="detalles-row" style="display:none;">
                    <td colspan="3">
                        <ul>
                            ${reportePorObra[obraId].registros.map(reg => {
                                const empleado = empleados.find(e => e.ID_Empleado === reg.ID_Empleado);
                                const nombreEmpleado = empleado ? empleado.Nombre_Completo : 'Empleado desconocido';
                                const [yyyy, mm, dd] = reg.Fecha.split('-');
                                const fechaFormateada = `${dd}/${mm}/${yyyy}`;
                                return `<li>${fechaFormateada}: ${nombreEmpleado} - $${parseFloat(reg.Costo_Diario).toLocaleString('es-CL')}</li>`;
                            }).join('')}
                        </ul>
                    </td>
                </tr>`;
        }

        html += `</tbody>
                 <tfoot>
                     <tr class="total-general">
                         <td><strong>Total General</strong></td>
                         <td><strong>$${totalGeneral.toLocaleString('es-CL')}</strong></td>
                         <td></td>
                     </tr>
                 </tfoot>
                 </table>`;

        reporteResultados.innerHTML = html;

        // Toggle de detalles
        document.querySelectorAll('.ver-detalles-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tr = btn.closest('tr');
                const detallesRow = tr.nextElementSibling;
                const visible = detallesRow.style.display !== 'none';
                detallesRow.style.display = visible ? 'none' : 'table-row';
                btn.textContent = visible ? 'Ver detalles' : 'Ocultar detalles';
            });
        });
    });
}

// ===============================
// GESTIÓN (upsert Empleados/Obras)
// ===============================

document.addEventListener('DOMContentLoaded', async () => {

    const empleadoSelect = document.getElementById('empleado-select');
    const empleadoNombre = document.getElementById('empleado-nombre');
    const empleadoCosto = document.getElementById('empleado-costo');
    const empleadoForm = document.getElementById('empleado-form');

    const obraSelect = document.getElementById('obra-select');
    const obraNombre = document.getElementById('obra-nombre');
    const obraForm = document.getElementById('obra-form');

    const empleados = await getSheetData('Empleados');
    const obras = await getSheetData('Obras');

    // ===== Llenar selects =====
    empleados.forEach(emp => {
        const option = document.createElement('option');
        option.value = emp.ID_Empleado;
        option.textContent = emp.Nombre_Completo;
        empleadoSelect.appendChild(option);
    });

    obras.forEach(ob => {
        const option = document.createElement('option');
        option.value = ob.ID_Obra;
        option.textContent = ob.Nombre_Obra;
        obraSelect.appendChild(option);
    });

    // ===== Eventos de selección =====
    empleadoSelect.addEventListener('change', () => {
        const selected = empleados.find(emp => emp.ID_Empleado == empleadoSelect.value);
        if (selected) {
            empleadoNombre.value = selected.Nombre_Completo || '';
            empleadoCosto.value = selected.Costo_Diario || '';
        } else {
            empleadoNombre.value = '';
            empleadoCosto.value = '';
        }
    });

    obraSelect.addEventListener('change', () => {
        const selected = obras.find(ob => ob.ID_Obra == obraSelect.value);
        obraNombre.value = selected ? (selected.Nombre_Obra || '') : '';
    });

    // ===== Función para mostrar notificación igual que en registro =====
    function showNotification(message, type = "success") {
        const notif = document.getElementById('notification');
        notif.textContent = message;
        notif.className = 'notification show';
        if(type === 'error') {
            notif.classList.add('error');
        } else {
            notif.classList.remove('error');
        }
        setTimeout(() => {
            notif.classList.remove('show');
        }, 2500);
    }

    // ===== Guardar/Actualizar empleado =====
    empleadoForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = empleadoForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = "Guardando...";

        const id = empleadoSelect.value || Date.now().toString();
        const data = {
            ID_Empleado: id,
            Nombre_Completo: empleadoNombre.value,
            Costo_Diario: empleadoCosto.value
        };
        const success = await writeSheetData(data);
        if(success) {
            showNotification('Empleado guardado/actualizado con éxito ✅', "success");
            setTimeout(() => location.reload(), 2500);
        } else {
            showNotification('Error al guardar empleado', "error");
            submitBtn.disabled = false;
            submitBtn.textContent = "Guardar";
        }
    });

    // ===== Guardar/Actualizar obra =====
    obraForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = obraForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = "Guardando...";

        const id = obraSelect.value || Date.now().toString();
        const data = {
            ID_Obra: id,
            Nombre_Obra: obraNombre.value
        };
        const success = await writeSheetData(data);
        if(success) {
            showNotification('Obra guardada/actualizada con éxito ✅', "success");
            setTimeout(() => location.reload(), 2500);
        } else {
            showNotification('Error al guardar obra', "error");
            submitBtn.disabled = false;
            submitBtn.textContent = "Guardar";
        }
    });

});
