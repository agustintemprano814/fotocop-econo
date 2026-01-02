/**
 * @file editor.js
 * @description Lógica del Editor Maestro con vinculación segura y CSP.
 */
import { db, auth } from './firebase-config.js';
import { collection, query, where, getDocs, doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { verificarAcceso, sanitizar } from './security.js';
import { cargarSidebar } from './sidebar.js';

let registroActual = null;
let infoUsuario = null;

// Referencias al DOM
const btnBuscar = document.getElementById('btnBuscar');
const resultsDiv = document.getElementById('resultsList');
const editCard = document.getElementById('editCard');
const formDinamico = document.getElementById('formDinamico');
const btnCancelar = document.getElementById('btnCancelar');

// --- INICIO Y SEGURIDAD ---
verificarAcceso(['supervisor-fotocop', 'supervisor-apuntes', 'adm-eco', 'superusuario']).then(info => {
    infoUsuario = info;
    cargarSidebar('editor');
    document.getElementById('filterFecha').value = new Date().toISOString().split('T')[0];
    inicializarEventos();
});

function inicializarEventos() {
    btnBuscar.addEventListener('click', ejecutarBusqueda);
    btnCancelar.addEventListener('click', () => location.reload());
    formDinamico.addEventListener('submit', guardarCambios);
}

// --- LÓGICA DE BÚSQUEDA ---
async function ejecutarBusqueda() {
    const col = document.getElementById('selectColeccion').value;
    const idDirecto = document.getElementById('inputID').value.trim();
    
    editCard.style.display = 'none';
    resultsDiv.innerHTML = "";
    resultsDiv.style.display = 'none';

    // Búsqueda por ID Directo
    if(idDirecto) {
        try {
            const snap = await getDoc(doc(db, col, idDirecto));
            if(snap.exists()) {
                cargarParaEditar(snap.id, snap.data(), col);
            } else {
                alert("ID no encontrado en esta colección.");
            }
        } catch (e) { 
            alert("Error buscando ID directo."); 
        }
        return;
    }

    // Búsqueda por Filtros
    const fecha = document.getElementById('filterFecha').value;
    const email = document.getElementById('filterEmail').value.trim().toLowerCase();
    
    resultsDiv.innerHTML = "<p style='padding:15px'>🔍 Buscando en base de datos...</p>";
    resultsDiv.style.display = 'block';

    try {
        let q = query(collection(db, col), where("fecha", "==", fecha));
        const snap = await getDocs(q);
        resultsDiv.innerHTML = "";

        if(snap.empty) {
            resultsDiv.innerHTML = "<p style='padding:15px'>❌ Sin resultados para esta fecha.</p>";
            return;
        }

        snap.forEach(d => {
            const data = d.data();
            const matchEmail = !email || 
                (data.operador && data.operador.includes(email)) || 
                (data.supervisor && data.supervisor.includes(email)) || 
                (data.nombreOperador && data.nombreOperador.toLowerCase().includes(email));
            
            if(matchEmail) {
                const item = document.createElement('div');
                item.className = 'result-item';
                let desc = data.total ? `Total: $${data.total}` : (data.rendidoEfectivo ? `Rendido: $${data.rendidoEfectivo}` : 'Ver Campos');
                let user = data.operador || data.supervisor || data.nombreOperador || 'Sistema';

                item.innerHTML = `<span><strong>${user}</strong> | ${desc}</span><span style="color:var(--primary)">Seleccionar ➔</span>`;
                
                // Vinculación segura del evento click
                item.addEventListener('click', () => cargarParaEditar(d.id, data, col));
                resultsDiv.appendChild(item);
            }
        });

        if(!resultsDiv.hasChildNodes()) {
            resultsDiv.innerHTML = "<p style='padding:15px'>❌ No se encontró el operador buscado.</p>";
        }

    } catch (e) { 
        alert("Error en filtros: Verifique su conexión."); 
    }
}

// --- RENDERIZADO DEL FORMULARIO DE EDICIÓN ---
function cargarParaEditar(id, data, col) {
    // Protección por Rol de Sector
    if(infoUsuario.rol === 'supervisor-fotocop' && data.sector === 'Apuntes') {
        return alert("⛔ Acceso Denegado: Su rol solo permite editar el sector Fotocopiadora.");
    }

    registroActual = { id, col, data };
    const container = document.getElementById('camposContenedor');
    container.innerHTML = "";
    
    document.getElementById('badgeID').innerText = `DOCUMENT_ID: ${id}`;
    editCard.style.display = 'block';
    resultsDiv.style.display = 'none';

    const modInfo = data.ultimaModificacionPor ? `Editado por: ${data.ultimaModificacionPor}` : "Registro original.";
    document.getElementById('auditMsg').innerText = `ℹ️ ${modInfo} - Al guardar se registrará tu firma digital.`;

    // Generar inputs dinámicos
    for(let key in data) {
        // Omitimos campos técnicos y objetos complejos
        if(typeof data[key] !== 'object' && !['fecha','timestamp','fechaString','ultimaModificacionPor','fechaModificacion'].includes(key)) {
            const row = document.createElement('div');
            row.className = 'field-row';
            
            const label = document.createElement('label');
            label.textContent = key.replace(/([A-Z])/g, ' $1'); // Formatea camelCase a texto con espacios
            
            const input = document.createElement('input');
            input.type = 'text';
            input.name = key;
            input.value = data[key];
            input.className = 'm-input';
            
            row.appendChild(label);
            row.appendChild(input);
            container.appendChild(row);
        }
    }
}

// --- GUARDAR CAMBIOS ---
async function guardarCambios(e) {
    e.preventDefault();
    if(!confirm("¿Confirmar edición? Se sobrescribirán los datos originales y se auditará el cambio.")) return;

    const formData = new FormData(formDinamico);
    const updates = {};
    
    formData.forEach((value, key) => {
        // Sanitizamos y detectamos si el valor es numérico
        const cleanValue = sanitizar(value);
        updates[key] = (isNaN(cleanValue) || cleanValue === "") ? cleanValue : Number(cleanValue);
    });

    // Auditoría automática
    updates.ultimaModificacionPor = auth.currentUser.email;
    updates.fechaModificacion = new Date().toISOString();

    try {
        await updateDoc(doc(db, registroActual.col, registroActual.id), updates);
        alert("✨ Registro corregido satisfactoriamente.");
        location.reload();
    } catch (e) { 
        console.error(e);
        alert("Error de escritura: Verifique sus permisos de administrador."); 
    }
}