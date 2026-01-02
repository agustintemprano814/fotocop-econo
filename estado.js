/**
 * @file estado.js
 * @description Gestión en tiempo real del estado técnico de las fotocopiadoras.
 */
import { db, auth } from './firebase-config.js';
import { doc, getDoc, collection, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { verificarAcceso } from './security.js';
import { cargarSidebar } from './sidebar.js';

const container = document.getElementById('maquinasContainer');

// --- SEGURIDAD Y ACCESO ---
verificarAcceso(['operario-fotocop', 'supervisor-fotocop', 'adm-eco', 'superusuario']).then(() => {
    cargarSidebar('estado');
    iniciarMonitoreo();
}).catch(err => {
    console.error("Acceso denegado:", err);
    window.location.href = "index.html";
});

// --- LÓGICA DE TIEMPO ---
function obtenerTiempoRelativo(fechaISO) {
    if (!fechaISO) return "Sin registros";
    const ahora = new Date();
    const cambio = new Date(fechaISO);
    const segundos = Math.floor((ahora - cambio) / 1000);

    if (segundos < 60) return "Recién ahora";
    const minutos = Math.floor(segundos / 60);
    if (minutos < 60) return `hace ${minutos} min`;
    const horas = Math.floor(minutos / 60);
    if (horas < 24) return `hace ${horas} hs`;
    const dias = Math.floor(horas / 24);
    return `hace ${dias} días`;
}

// --- ACTUALIZACIÓN DE ESTADO ---
async function cambiarEstado(idMaquina, nuevoEstado) {
    const inputNota = document.getElementById(`input-${idMaquina}`);
    const nota = inputNota ? inputNota.value.trim() : "";
    
    try {
        await setDoc(doc(db, "estado_maquinas", `M${idMaquina}`), {
            activa: nuevoEstado,
            nota: nota || (nuevoEstado ? "Operativa" : "En revisión"),
            fechaActualizacion: new Date().toISOString()
        }, { merge: true });
    } catch (e) {
        console.error("Error al actualizar estado:", e);
        alert("No tiene permisos para realizar esta acción.");
    }
}

// --- MONITOREO EN TIEMPO REAL ---
function iniciarMonitoreo() {
    onAuthStateChanged(auth, async (user) => {
        if (!user) return;

        try {
            // Verificar rol para permisos de edición
            const userDoc = await getDoc(doc(db, "usuarios", user.email));
            const rol = userDoc.exists() ? userDoc.data().rol : "operario-fotocop";
            const puedeEditar = ["supervisor-fotocop", "adm-eco", "superusuario"].includes(rol);

            // Escuchar cambios en la colección de máquinas
            onSnapshot(collection(db, "estado_maquinas"), (snapshot) => {
                container.innerHTML = "";
                
                // Generar tarjetas para las 7 máquinas del local
                for (let i = 1; i <= 7; i++) {
                    const docId = `M${i}`;
                    const docData = snapshot.docs.find(d => d.id === docId)?.data();
                    const data = docData || { activa: true, nota: "Operativa", fechaActualizacion: null };
                    
                    renderizarTarjetaMaquina(i, data, puedeEditar);
                }
            });
        } catch (e) { 
            console.error("Error en el monitor:", e); 
        }
    });
}

// --- RENDERIZADO DE TARJETAS (CSP Safe) ---
function renderizarTarjetaMaquina(numero, data, puedeEditar) {
    const card = document.createElement('div');
    card.className = 'card-maquina';
    
    const statusClass = data.activa ? 'online-label' : 'offline-label';
    const dotClass = data.activa ? 'dot-online' : 'dot-offline';
    const btnClass = data.activa ? 'btn-reportar' : 'btn-activar';
    const btnTexto = data.activa ? 'Reportar Falla' : 'Dar de Alta';

    card.innerHTML = `
        <div class="card-header">
            <h3>Máquina 0${numero}</h3>
            <div class="status-indicator ${statusClass}">
                <span class="dot ${dotClass}"></span>
                ${data.activa ? 'ONLINE' : 'OFFLINE'}
            </div>
        </div>
        <div class="card-body">
            <p style="font-size: 0.75rem; color: #aaa; margin-bottom: 8px;">OBSERVACIONES TÉCNICAS:</p>
            <div class="nota-box">${data.nota}</div>
            <div class="time-stamp">
                🕒 ${obtenerTiempoRelativo(data.fechaActualizacion)}
            </div>
        </div>
    `;

    if (puedeEditar) {
        const adminZone = document.createElement('div');
        adminZone.className = 'admin-zone';
        
        const input = document.createElement('input');
        input.type = 'text';
        input.id = `input-${numero}`;
        input.value = data.nota;
        input.className = 'input-nota';
        input.placeholder = 'Actualizar novedad...';

        const btn = document.createElement('button');
        btn.className = `btn-action ${btnClass}`;
        btn.textContent = btnTexto;
        
        // Vincular evento de clic de forma segura para CSP
        btn.addEventListener('click', () => cambiarEstado(numero, !data.activa));

        adminZone.appendChild(input);
        adminZone.appendChild(btn);
        card.appendChild(adminZone);
    }

    container.appendChild(card);
}