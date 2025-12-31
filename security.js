/**
 * @file security.js
 * @description Capa de seguridad v5.0 - Control de Acceso Basado en Roles (RBAC)
 */

import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const host = window.location.hostname;
const esLocal = host === "localhost" || host === "127.0.0.1" || host === "";
const esPaginaLogin = window.location.pathname.endsWith('index.html') || window.location.pathname === '/' || window.location.pathname.includes('index');
const esPaginaMantenimiento = window.location.href.includes('mantenimiento.html');

// --- MATRIZ DE PERMISOS OFICIAL ---
const PERMISOS_PAGINAS = {
    'apuntes.html': ['operario-apuntes', 'supervisor-apuntes', 'superusuario'],
    'ventas.html': ['operario-fotocop', 'supervisor-fotocop', 'superusuario'],
    'cierre_apuntes.html': ['operario-apuntes', 'supervisor-apuntes', 'superusuario'],
    'cierres.html': ['supervisor-fotocop', 'superusuario'],
    'stock.html': ['operario-apuntes', 'supervisor-apuntes', 'adm-eco', 'superusuario'],
    'insumos.html': ['supervisor-fotocop', 'adm-eco', 'superusuario'],
    'estado.html': ['operario-fotocop', 'supervisor-fotocop', 'adm-eco', 'superusuario'],
    'editor.html': ['supervisor-apuntes', 'supervisor-fotocop', 'adm-eco', 'superusuario'],
    'reportes.html': ['superusuario'],
    'dashboard-financiero.html': ['adm-eco', 'superusuario'],
    'rendimiento.html': ['adm-eco', 'superusuario'],
    'usuarios.html': ['superusuario'],
    'configuracio.html': ['adm-eco', 'superusuario'],
    'importador.html': ['superusuario']
};

// Ocultar contenido por defecto para evitar parpadeo de datos privados
if (!esPaginaLogin && !esPaginaMantenimiento) {
    document.documentElement.style.display = 'none';
}

function activarVigilanteMantenimiento(esSuperusuario) {
    const configRef = doc(db, "configuracion", "global");
    onSnapshot(configRef, (docSnap) => {
        if (docSnap.exists()) {
            const mantenimientoActivo = docSnap.data().modoMantenimiento;
            if (mantenimientoActivo && !esSuperusuario && !esPaginaMantenimiento) {
                window.location.href = "mantenimiento.html";
            }
        }
    });
}

export const sanitizar = (data) => {
    if (typeof data !== 'string') return data;
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return data.replace(/[&<>"']/g, m => map[m]);
};

export async function verificarAcceso(rolesManuales = null) {
    return new Promise((resolve) => {
        onAuthStateChanged(auth, async (user) => {
            if (!user) {
                if (!esPaginaLogin) window.location.href = "index.html";
                return;
            }

            try {
                const userRef = doc(db, "usuarios", user.email);
                const docSnap = await getDoc(userRef);

                if (!docSnap.exists()) {
                    await signOut(auth);
                    window.location.href = "index.html?error=unauthorized";
                    return;
                }

                const userData = docSnap.data();
                const rol = userData.rol;
                const esSuper = rol === 'superusuario';
                const nombreReal = userData.nombreReal || user.email.split('@')[0];

                // 1. Vigilante de mantenimiento
                activarVigilanteMantenimiento(esSuper);

                // 2. Validación de Acceso por Matriz
                const pathParts = window.location.pathname.split('/');
                const paginaActual = pathParts[pathParts.length - 1];
                
                // Si la página está en nuestra matriz, verificamos permiso
                if (PERMISOS_PAGINAS[paginaActual]) {
                    const rolesPermitidos = PERMISOS_PAGINAS[paginaActual];
                    if (!rolesPermitidos.includes(rol) && !esSuper) {
                        alert("⛔ Acceso Denegado: No tienes permisos para este módulo.");
                        window.location.href = "inicio.html";
                        return;
                    }
                }

                // 3. Validación manual (si se llama desde la página con roles específicos)
                if (rolesManuales && !rolesManuales.includes(rol) && !esSuper) {
                    alert("⛔ No autorizado para esta acción.");
                    window.location.href = "inicio.html";
                    return;
                }

                // Mostrar sitio si todo está OK
                document.documentElement.style.display = 'block';
                document.body.style.display = 'block';

                resolve({ user, rol, nombreReal, userData });

            } catch (error) {
                console.error("🚨 Error Crítico de Seguridad:", error);
                if (!esLocal) window.location.href = "index.html";
            }
        });
    });
}