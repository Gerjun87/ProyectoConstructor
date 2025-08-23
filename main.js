// ===============================
// Constantes Google Sheets
// ===============================
const SPREADSHEET_ID = '17NWdiemzo2kocMgVeIZ9YyfL8yEux9VtKwvkRmnG1hQ';
const API_KEY = 'AIzaSyCblactvvgWRsauiiFvKk3YBNJWOKw0ZPM';
const APPS_SCRIPT_URL = 'https://proyecto-constructor.vercel.app/api/proxy';

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
        setupGestion();
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

    function cargarEmpleados() {
        empleadosContainer.innerHTML = '';
        if (!empleados) return;
        empleados.forEach(empleado => {
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
    cargarEmpleados();

    function actualizarCostoTotal() {
        const marcados = empleadosContainer.querySelectorAll('input[type="checkbox"]:checked');
        let total = 0;
        marcados.forEach(cb => total += parseFloat(cb.dataset.costo) || 0);
        costoInput.value = total;
    }

    function actualizarTextoSeleccionados() {
        const marcados = empleadosContainer.querySelectorAll('input[type="checkbox"]:checked');
        const nombres = Array.from(marcados).map(cb => cb.dataset.nombre);
        selectedSpan.textContent = nombres.length ? nombres.join(', ') : 'Selecciona uno o más';
    }

    // Dropdown empleados
    selectBox.addEventListener('click', () => {
        const activo = empleadosContainer.classList.toggle('active');
        empleadosContainer.style.display = activo ? 'block' : 'none';
        selectBox.querySelector('.arrow').textContent = activo ? '❌' : '📠';
    });

    // Guardar registros diarios
    registroForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fecha = document.getElementById('fecha').value;
        const obraId = obraSelect.value;
        const marcados = empleadosContainer.querySelectorAll('input[type="checkbox"]:checked');

        if (!fecha || !obraId || marcados.length === 0) {
            alert("Completa fecha, obra y al menos un empleado.");
            return;
        }

        let ok = true;
        for (const cb of marcados) {
            const payload = {
                ID_Registro: Date.now() + "_" + cb.value,
                Fecha: fecha,
                ID_Obra: obraId,
                ID_Empleado: cb.value,
                Costo_Diario: cb.dataset.costo
            };
            const success = await writeSheetData(payload);
            if (!success) ok = false;
            await new Promise(r => setTimeout(r, 5)); // micro pausa para IDs únicos
        }

        if (ok) {
            alert("Registros guardados con éxito.");
            registroForm.reset();
            selectedSpan.textContent = 'Selecciona uno o más';
            cargarEmpleados();
            empleadosContainer.style.display = 'none';
            selectBox.querySelector('.arrow').textContent = '📠';
            costoInput.value = 0;
        } else {
            alert("Hubo un error al guardar uno o más registros.");
        }
    });
}

// ===============================
// REPORTES
// ===============================
async function setupReportes() {
    const reporteForm = document.getElementById('reporte-form');
    const reporteResultados = document.getElementById('reporte-resultados');

    reporteForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const fechaInicio = document.getElementById('fecha-inicio').value;
        const fechaFin = document.getElementById('fecha-fin').value;
        reporteResultados.innerHTML = '';

        const registros = await getSheetData('Registros_Diarios');
        const obras = await getSheetData('Obras');
        const empleados = await getSheetData('Empleados');

        if (!registros || !obras || !empleados) {
            reporteResultados.innerHTML = `<p class="error-message">Error al cargar los datos para el reporte.</p>`;
            return;
        }

        const registrosFiltrados = registros.filter(registro => {
            const fechaRegistro = new Date(registro.Fecha);
            const inicio = new Date(fechaInicio);
            const fin = new Date(fechaFin);
            fin.setDate(fin.getDate() + 1);
            return fechaRegistro >= inicio && fechaRegistro < fin;
        });

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

        let html = '';
        let totalGeneral = 0;
        for (const obraId in reportePorObra) {
            const obra = obras.find(o => o.ID_Obra === obraId);
            const nombreObra = obra ? obra.Nombre_Obra : 'Obra desconocida';
            const totalObra = reportePorObra[obraId].totalCosto;
            totalGeneral += totalObra;

            html += `
                <div class="reporte-obra">
                    <h3>Obra: ${nombreObra}</h3>
                    <p>Total a pagar: <strong>$${totalObra.toLocaleString('es-CL')}</strong></p>
                    <button class="ver-detalles-btn" data-obra-id="${obraId}">Ver detalles</button>
                    <div class="detalles" style="display: none;">
                        <ul>
                            ${reportePorObra[obraId].registros.map(reg => {
                                const empleado = empleados.find(e => e.ID_Empleado === reg.ID_Empleado);
                                const nombreEmpleado = empleado ? empleado.Nombre_Completo : 'Empleado desconocido';
                                return `<li>${reg.Fecha}: ${nombreEmpleado} - $${parseFloat(reg.Costo_Diario).toLocaleString('es-CL')}</li>`;
                            }).join('')}
                        </ul>
                    </div>
                </div>`;
        }
        html += `<h3>Total General: <strong>$${totalGeneral.toLocaleString('es-CL')}</strong></h3>`;
        reporteResultados.innerHTML = html;

        document.querySelectorAll('.ver-detalles-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const detallesDiv = btn.nextElementSibling;
                const visible = detallesDiv.style.display !== 'none';
                detallesDiv.style.display = visible ? 'none' : 'block';
                btn.textContent = visible ? 'Ver detalles' : 'Ocultar detalles';
            });
        });
    });
}

// ===============================
// GESTIÓN (upsert Empleados/Obras)
// ===============================
async function setupGestion() {
    const empleadoSelect = document.getElementById('empleado-select');
    const empleadoNombre = document.getElementById('empleado-nombre');
    const empleadoCosto = document.getElementById('empleado-costo');
    const empleadoForm = document.getElementById('empleado-form');

    const obraSelect = document.getElementById('obra-select');
    const obraNombre = document.getElementById('obra-nombre');
    const obraForm = document.getElementById('obra-form');

    const empleados = await getSheetData('Empleados');
    const obras = await getSheetData('Obras');

    // Empleados
    empleados.forEach(emp => {
        const option = document.createElement('option');
        option.value = emp.ID_Empleado;
        option.textContent = emp.Nombre_Completo;
        empleadoSelect.appendChild(option);
    });

    // Obras
    obras.forEach(ob => {
        const option = document.createElement('option');
        option.value = ob.ID_Obra;
        option.textContent = ob.Nombre_Obra;
        obraSelect.appendChild(option);
    });

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

    empleadoForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = empleadoSelect.value || Date.now().toString();
        const data = {
            ID_Empleado: id,
            Nombre_Completo: empleadoNombre.value,
            Costo_Diario: empleadoCosto.value
        };
        const success = await writeSheetData(data);
        alert(success ? 'Empleado guardado/actualizado con éxito' : 'Error al guardar empleado');
        location.reload();
    });

    obraForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = obraSelect.value || Date.now().toString();
        const data = {
            ID_Obra: id,
            Nombre_Obra: obraNombre.value
        };
        const success = await writeSheetData(data);
        alert(success ? 'Obra guardada/actualizada con éxito' : 'Error al guardar obra');
        location.reload();
    });
}
