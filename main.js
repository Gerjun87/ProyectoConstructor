// Constantes para tu Google Sheet
const SPREADSHEET_ID = '17NWdiemzo2kocMgVeIZ9YyfL8yEux9VtKwvkRmnG1hQ';
const API_KEY = 'AIzaSyCblactvvgWRsauiiFvKk3YBNJWOKw0ZPM';
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzA074QM-7_pZKI-1XQxqcOpcZ1kRXZ_BrTgwI7n87ASwlmRZDWRJqAiG51_sVbMPU/exec';

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
            headers.forEach((header, index) => {
                rowObject[header] = row[index];
            });
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
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
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
// LÓGICA DEL LOGIN (en index.html)
// ======================================================
document.addEventListener('DOMContentLoaded', () => {
    // Lógica del Login
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
                window.location.href = 'registro.html'; // Redirige a la página de registro
            } else {
                errorMessage.textContent = 'Usuario o contraseña incorrectos.';
                errorMessage.style.display = 'block';
            }
        });
    }

    // Lógica del Dashboard para Registro
    if (document.body.classList.contains('registro-page')) {
        checkAuth();
        setupRegistro();
    }

    // Lógica del Dashboard para Reportes
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
// LÓGICA DE REGISTRO
// ======================================================
async function setupRegistro() {
    const obraSelect = document.getElementById('obra');
    const empleadoSelect = document.getElementById('empleado');
    const costoInput = document.getElementById('costo');
    const registroForm = document.getElementById('registro-form');
    const logoutBtn = document.getElementById('logout-btn');

    const obras = await getSheetData('Obras');
    const empleados = await getSheetData('Empleados');

    if (obras) {
        obras.forEach(obra => {
            const option = document.createElement('option');
            option.value = obra.ID_Obra;
            option.textContent = obra.Nombre_Obra;
            obraSelect.appendChild(option);
        });
    }

    if (empleados) {
        empleados.forEach(empleado => {
            const option = document.createElement('option');
            option.value = empleado.ID_Empleado;
            option.textContent = empleado.Nombre_Completo;
            empleadoSelect.appendChild(option);
        });
    }

    empleadoSelect.addEventListener('change', () => {
        const selectedEmpleado = empleados.find(emp => emp.ID_Empleado === empleadoSelect.value);
        if (selectedEmpleado) {
            costoInput.value = selectedEmpleado.Costo_Diario;
        }
    });

    registroForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const registro = {
            ID_Registro: Date.now(),
            Fecha: document.getElementById('fecha').value,
            ID_Obra: obraSelect.value,
            ID_Empleado: empleadoSelect.value,
            Costo_Diario: costoInput.value
        };

        const success = await writeSheetData(registro);

        if (success) {
            alert("Registro guardado con éxito.");
            registroForm.reset();
        } else {
            alert("Hubo un error al guardar el registro. Inténtalo de nuevo.");
        }
    });

    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('currentUser');
        window.location.href = 'index.html';
    });
}

// ======================================================
// LÓGICA DE REPORTES
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
                reportePorObra[obraId] = {
                    totalCosto: 0,
                    registros: []
                };
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
                </div>
            `;
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