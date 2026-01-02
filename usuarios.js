/**
 * @file usuarios.js
 * @description Gestión de permisos y roles de usuario con protección contra auto-eliminación.
 */
import { db } from './firebase-config.js';
import { collection, doc, setDoc, deleteDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { cargarSidebar } from './sidebar.js';
import { verificarAcceso, sanitizar } from './security.js';

let miCorreo = "";

// --- SEGURIDAD Y ACCESO ---
verificarAcceso(['superusuario']).then(info => {
    miCorreo = info.user.email;
    cargarSidebar('usuarios');
    escucharUsuarios();
    configurarFormulario();
}).catch(err => {
    console.error("Acceso restringido solo para Superusuarios maestros.");
    window.location.href = "inicio.html";
});

// --- LÓGICA DE LA TABLA (TIEMPO REAL) ---
function escucharUsuarios() {
    const tbody = document.getElementById('tablaUsuarios');
    
    onSnapshot(collection(db, "usuarios"), (snapshot) => {
        tbody.innerHTML = "";
        
        snapshot.forEach(d => {
            const u = d.data();
            const id = d.id;
            const esMiPropioUsuario = id === miCorreo;
            
            let badgeClass = "badge-staff";
            if(u.rol === 'superusuario') badgeClass = "badge-super";
            else if(u.rol === 'adm-eco') badgeClass = "badge-admin";

            const tr = document.createElement('tr');
            
            // Creamos la celda de info de usuario
            const tdInfo = document.createElement('td');
            tdInfo.innerHTML = `
                <div class="user-info-text">
                    <strong>${sanitizar(u.nombre)}</strong><br>
                    <small style="color:var(--gray)">${id}</small>
                </div>
            `;

            // Celda de Rol
            const tdRol = document.createElement('td');
            tdRol.innerHTML = `
                <span class="rol-badge ${badgeClass}">${u.rol}</span>
                <small style="margin-left:5px; color:var(--gray)">(${u.unidad?.toUpperCase() || 'ECO'})</small>
            `;

            // Celda de Acción (Borrar)
            const tdAccion = document.createElement('td');
            tdAccion.style.textAlign = 'center';
            
            if (esMiPropioUsuario) {
                tdAccion.innerHTML = '<small style="color:var(--primary); font-weight:bold;">TÚ</small>';
            } else {
                const btn = document.createElement('button');
                btn.className = 'btn-trash';
                btn.title = 'Revocar Acceso';
                btn.innerHTML = '🗑️';
                btn.addEventListener('click', () => eliminarUsuario(id));
                tdAccion.appendChild(btn);
            }

            tr.appendChild(tdInfo);
            tr.appendChild(tdRol);
            tr.appendChild(tdAccion);
            tbody.appendChild(tr);
        });
    });
}

// --- LÓGICA DEL FORMULARIO ---
function configurarFormulario() {
    const form = document.getElementById('formUser');
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = sanitizar(document.getElementById('userEmail').value.trim().toLowerCase());
        const nombre = sanitizar(document.getElementById('userNombre').value.trim());
        const rol = document.getElementById('userRol').value;
        const unidad = document.getElementById('userUnidad').value;

        // Regla de Seguridad: No se pueden crear otros superusuarios desde aquí
        if (rol === 'superusuario') {
            return alert("⚠️ Acción no permitida. Por motivos de seguridad, solo puede existir un Superusuario maestro definido manualmente en la base de datos.");
        }

        try {
            await setDoc(doc(db, "usuarios", email), {
                nombre,
                rol,
                unidad,
                fechaAlta: new Date().toISOString()
            }, { merge: true });
            
            alert("✅ Credenciales asignadas con éxito.");
            form.reset();
        } catch (error) {
            console.error(error);
            alert("❌ Error de permisos: Solo un Superusuario puede modificar la tabla de accesos.");
        }
    });
}

// --- ACCIONES ---
async function eliminarUsuario(id) {
    const confirmacion = confirm(`¿Está seguro de revocar permanentemente el acceso a ${id}?\nEsta persona ya no podrá entrar al sistema.`);
    
    if (confirmacion) {
        try {
            await deleteDoc(doc(db, "usuarios", id));
            // No es necesario recargar, onSnapshot actualiza la UI
        } catch (error) {
            alert("Error al intentar eliminar el usuario.");
        }
    }
}