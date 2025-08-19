// Constantes para tu Google Sheet
const SPREADSHEET_ID = '17NWdiemzo2kocMgVeIZ9YyfL8yEux9VtKwvkRmnG1hQ';
const API_KEY = 'AIzaSyCblactvvgWRsauiiFvKk3YBNJWOKw0ZPM';
const APPS_SCRIPT_URL = 'https://proyecto-constructor.vercel.app/api/proxy';

// Función genérica para obtener datos de una hoja
async function getSheetData(sheetName) {
    const range = `${sheetName}!A1:Z`;
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}?key=${API_KEY}`;
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
        const data = await response.json();
        if (!data.values) return [];
        const headers = data.values[0];
        const rows = data.values.slice(1);
        return rows.map(row => {
            let rowObject = {};
            headers.forEach((header, index) => rowObject[header] = row[index]);
            return rowObject;
        });
    } catch (error) {
        console.error('Error al obtener datos de Google Sheets:', error);
        return null;
    }
}

// Función para escribir datos en la hoja de cálculo
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

// ======================================================
// LOGIN
// ======================================================
document.addEventListener('DOMContentLoaded', () => {
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

            const userFound = users.find(user => user.Usuario === username && user.Contraseña === password);
            if (userFound) {
                localStorage.setItem('currentUser', JSON.stringify(userFound));
                window.location.href = 'registro.html';
            } else {
                errorMessage.textContent = 'Usuario o contraseña incorrectos.';
                errorMessage.style.display = 'block';
            }
        });
    }

    if (document.body.classList.contains('registro-page')) {
        checkAuth();
        setupRegistro();
    }

    if (document.body.classList.contains('reportes-page')) {
        checkAuth();
        setupReportes();
    }
});

// Funciones de control de sesión
function checkAuth() {
    if (!localStorage.getItem('currentUser')) {
        window.location.href = 'index.html';
    }
}

// ======================================================
// REGISTRO
// ======================================================
async function setupRegistro() {
    const obraSelect = document.getElementById('obra');
    const empleadosContainer = document.getElementById('empleados-lista');
    const selectedSpan = document.getElementById('selected-empleados');
    const selectBox = document.querySelector('.select-box');
    const costoInput = document.getElementById('costo');
    const registroForm = document.getElementById('registro-form');
    const logoutBtn = document.getElementById('logout-btn');

    const obras = await getSheetData('Obras');
    const empleados = await getSheetData('Empleados');

    // Cargar obras solo una vez
    if (obraSelect.options.length <= 1 && obras) {
        obras.forEach(obra => {
            const option = document.createElement('option');
            option.value = obra.ID_Obra;
            option.textContent = obra.Nombre_Obra;
            obraSelect.appendChild(option);
        });
    }

    // Función para cargar empleados
    function cargarEmpleados() {
        empleadosContainer.innerHTML = '';
        if (!empleados) return;

        empleados.forEach(empleado => {
            const checkboxWrapper = document.createElement('label');
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = empleado.ID_Empleado;
            checkbox.dataset.costo = empleado.Costo_Diario;
            checkbox.dataset.nombre = empleado.Nombre_Completo;

            checkboxWrapper.appendChild(checkbox);
            checkboxWrapper.appendChild(document.createTextNode(` ${empleado.Nombre_Completo} ($${empleado.Costo_Diario})`));
            empleadosContainer.appendChild(checkboxWrapper);

            checkbox.addEventListener('change', () => {
                actualizarCostoTotal();
                actualizarTextoSeleccionados();
            });
        });
    }

    cargarEmpleados();

    function actualizarCostoTotal() {
        const checkboxes = empleadosContainer.querySelectorAll('input[type="checkbox"]:checked');
        let total = 0;
        checkboxes.forEach(cb => total += parseFloat(cb.dataset.costo) || 0);
        costoInput.value = total;
    }

    function actualizarTextoSeleccionados() {
        const checkboxes = empleadosContainer.querySelectorAll('input[type="checkbox"]:checked');
        const nombres = Array.from(checkboxes).map(cb => cb.dataset.nombre);
        selectedSpan.textContent = nombres.length ? nombres.join(', ') : 'Selecciona uno o más';
    }

    // Toggle del dropdown
    selectBox.addEventListener('click', () => {
        empleadosContainer.classList.toggle('active');
        empleadosContainer.style.display = empleadosContainer.classList.contains('active') ? 'block' : 'none';
        selectBox.querySelector('.arrow').textContent = empleadosContainer.classList.contains('active') ? '❌' : '📠';
    });

    registroForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fecha = document.getElementById('fecha').value;
        const obraId = obraSelect.value;
        const checkboxes = empleadosContainer.querySelectorAll('input[type="checkbox"]:checked');

        if (checkboxes.length === 0) {
            alert("Debe seleccionar al menos un empleado.");
            return;
        }

        let successAll = true;
        for (const cb of checkboxes) {
            const registro = {
                ID_Registro: Date.now() + "_" + cb.value,
                Fecha: fecha,
                ID_Obra: obraId,
                ID_Empleado: cb.value,
                Costo_Diario: cb.dataset.costo
            };
            const success = await writeSheetData(registro);
            if (!success) successAll = false;
        }

        if (successAll) {
            alert("Registros guardados con éxito.");
            registroForm.reset();
            selectedSpan.textContent = 'Selecciona uno o más';
            cargarEmpleados(); // recargamos solo empleados
            empleadosContainer.style.display = 'none';
            selectBox.querySelector('.arrow').textContent = '📠';
            costoInput.value = 0;
        } else {
            alert("Hubo un error al guardar uno o más registros. Inténtalo de nuevo.");
        }
    });

    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('currentUser');
        window.location.href = 'index.html';
    });
}

// ======================================================
// REPORTES
// ======================================================
async function setupReportes() {
    const reporteForm = document.getElementById('reporte-form');
    const reporteResultados = document.getElementById('reporte-resultados');
    const logoutBtn = document.getElementById('logout-btn');

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
                detallesDiv.style.display = detallesDiv.style.display === 'none' ? 'block' : 'none';
                btn.textContent = detallesDiv.style.display === 'none' ? 'Ver detalles' : 'Ocultar detalles';
            });
        });
    });

    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('currentUser');
        window.location.href = 'index.html';
    });
}
