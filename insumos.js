/**
 * @file insumos.js
 * @description Gestión de gastos, insumos y mantenimiento técnico con CSP.
 */
import { db, auth } from './firebase-config.js';
import { collection, addDoc, query, where, getDocs, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { verificarAcceso, sanitizar } from './security.js';
import { cargarSidebar } from './sidebar.js';

// Referencias al DOM
const formInsumos = document.getElementById('formInsumos');
const selectCat = document.getElementById('categoriaInsumo');
const grupoOtro = document.getElementById('grupoOtro');
const labelDinamico = document.getElementById('labelDinamico');
const inputPlaceholder = document.getElementById('inputPlaceholder');
const contenedor = document.getElementById('historialContenedor');
const btnFiltrar = document.getElementById('btnFiltrarInsumos');

// --- INICIO Y SEGURIDAD ---
verificarAcceso(['supervisor-fotocop', 'supervisor-apuntes', 'adm-eco', 'superusuario']).then(() => {
    cargarSidebar('insumos');
    inicializarFechas();
    vincularEventos();
    cargarHistorial();
}).catch(err => {
    console.error("Acceso denegado:", err);
    window.location.href = "index.html";
});

function inicializarFechas() {
    const hoy = new Date();
    const mesAtras = new Date();
    mesAtras.setMonth(hoy.getMonth() - 1);
    document.getElementById('filtroHasta').value = hoy.toISOString().split('T')[0];
    document.getElementById('filtroDesde').value = mesAtras.toISOString().split('T')[0];
}

// --- VINCULACIÓN DE EVENTOS (CSP Safe) ---
function vincularEventos() {
    // 1. Cambio de categoría (Lógica Dinámica)
    selectCat.addEventListener('change', () => {
        const categoria = selectCat.value;
        grupoOtro.style.display = (categoria === 'otros') ? 'block' : 'none';
        
        if (categoria === 'mantenimiento') {
            labelDinamico.innerText = "Máquina intervenida:";
            // Inyectamos el select de máquinas de forma segura
            inputPlaceholder.innerHTML = `
                <select id="maquinaInsumo" required>
                    <option value="M1">Máquina 1</option>
                    <option value="M2">Máquina 2</option>
                    <option value="M3">Máquina 3</option>
                    <option value="M4">Máquina 4</option>
                    <option value="M5">Máquina 5</option>
                    <option value="M6">Máquina 6</option>
                    <option value="M7">Máquina 7</option>
                </select>`;
        } else {
            labelDinamico.innerText = "Cantidad:";
            inputPlaceholder.innerHTML = `<input type="number" id="cantidadInsumo" required min="1" value="1">`;
        }
    });

    // 2. Envío del Formulario
    formInsumos.addEventListener('submit', guardarRegistro);

    // 3. Filtros
    btnFiltrar.addEventListener('click', cargarHistorial);
}

// --- LÓGICA DE GUARDADO ---
async function guardarRegistro(e) {
    e.preventDefault();
    const btn = document.getElementById('btnGuardar');
    btn.disabled = true;
    btn.innerText = "⏳ Guardando...";

    const esMantenimiento = selectCat.value === 'mantenimiento';
    
    const data = {
        fecha: new Date().toISOString().split('T')[0],
        timestamp: serverTimestamp(),
        categoria: selectCat.value,
        detalle: selectCat.value === 'otros' ? sanitizar(document.getElementById('detalleOtro').value) : '',
        cantidad: esMantenimiento ? 1 : Number(document.getElementById('cantidadInsumo').value),
        maquina: esMantenimiento ? document.getElementById('maquinaInsumo').value : '',
        costo: Number(document.getElementById('costoInsumo').value),
        notas: sanitizar(document.getElementById('notasInsumo').value),
        usuario: auth.currentUser.email
    };

    try {
        await addDoc(collection(db, "insumos"), data);
        alert("✅ Registro guardado con éxito.");
        formInsumos.reset();
        // Resetear el estado dinámico del formulario
        selectCat.dispatchEvent(new Event('change'));
        cargarHistorial();
    } catch (err) {
        alert("Error al guardar: " + err.message);
    } finally {
        btn.disabled = false;
        btn.innerText = "REGISTRAR EN HISTORIAL";
    }
}

// --- CARGA DE HISTORIAL ---
async function cargarHistorial() {
    const desde = document.getElementById('filtroDesde').value;
    const hasta = document.getElementById('filtroHasta').value;
    if(!desde || !hasta) return;

    contenedor.innerHTML = '<p style="grid-column: 1/-1; text-align: center;">Cargando historial seguro...</p>';

    try {
        const q = query(
            collection(db, "insumos"),
            where("fecha", ">=", desde),
            where("fecha", "<=", hasta),
            orderBy("fecha", "desc")
        );

        const querySnapshot = await getDocs(q);
        contenedor.innerHTML = '';

        querySnapshot.forEach((doc) => {
            const item = doc.data();
            const catClass = `cat-${item.categoria}`;
            const icono = { papel:'📄', tonner:'🧪', repuestos:'⚙️', mantenimiento:'🛠️', otros:'➕' }[item.categoria] || '📦';

            let sLabel = "Cantidad";
            let sValue = item.cantidad;
            if (item.categoria === 'mantenimiento') {
                sLabel = "Máquina";
                sValue = item.maquina || "N/A";
            }

            const titulo = item.categoria === 'otros' ? item.detalle : item.categoria.toUpperCase();
            const notas = item.notas || 'Sin observaciones';

            // Construcción segura del elemento para evitar XSS
            const card = document.createElement('div');
            card.className = `history-card ${catClass}`;
            card.innerHTML = `
                <div class="card-header">
                    <span class="card-date">${item.fecha}</span>
                    <span class="card-category">${item.categoria}</span>
                </div>
                <div class="card-main">
                    <p class="card-title">${icono} ${titulo}</p>
                </div>
                <div class="card-stats">
                    <div class="stat-item">
                        <span class="stat-label">${sLabel}</span>
                        <span class="stat-value">${sValue}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Costo</span>
                        <span class="stat-value">$${Number(item.costo).toLocaleString('es-AR')}</span>
                    </div>
                </div>
                <div class="card-footer">
                    <strong>Nota:</strong> ${notas}
                </div>`;
            contenedor.appendChild(card);
        });

        if (querySnapshot.empty) {
            contenedor.innerHTML = '<p style="grid-column: 1/-1; text-align: center; padding: 40px; color: #999;">No hay registros en este rango.</p>';
        }
    } catch (error) {
        console.error("Error cargando historial:", error);
        contenedor.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: red;">Error de conexión. Verifique su red.</p>';
    }
}