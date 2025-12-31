/**
 * @file security.js
 * @description Capa de seguridad v5.1 - RBAC y Renderizado Seguro
 */

import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const host = window.location.hostname;
const esLocal = host === "localhost" || host === "127.0.0.1" || host === "";
const esPaginaLogin = window.location.pathname.endsWith('index.html') || window.location.pathname === '/' || window.location.pathname.includes('index');
const esPaginaMantenimiento = window.location.href.includes('mantenimiento.html');

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

if (!esPaginaLogin && !esPaginaMantenimiento) {
    document.documentElement.style.display = 'none';
}

/**
 * Función para escribir texto en el HTML de forma segura (Previene XSS)
 * Se exporta para ser usada en los archivos .js externos
 */
export function renderSeguro(elemento, texto) {
    if (elemento) {
        elemento.textContent = texto;
    }
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
                
                // Prioridad al nombreReal, sino usa idProfesional, sino el email
                const nombreReal = userData.nombreReal || userData.idProfesional || user.email.split('@')[0];

                activarVigilanteMantenimiento(esSuper);

                const pathParts = window.location.pathname.split('/');
                const paginaActual = pathParts[pathParts.length - 1];

                if (PERMISOS_PAGINAS[paginaActual]) {
                    const rolesPermitidos = PERMISOS_PAGINAS[paginaActual];
                    if (!rolesPermitidos.includes(rol) && !esSuper) {
                        alert("⛔ Acceso Denegado: No tienes permisos para este módulo.");
                        window.location.href = "inicio.html";
                        return;
                    }
                }

                if (rolesManuales && !rolesManuales.includes(rol) && !esSuper) {
                    alert("⛔ No autorizado para esta acción.");
                    window.location.href = "inicio.html";
                    return;
                }

                document.documentElement.style.display = 'block';
                document.body.style.display = 'block';

                // Devolvemos el objeto con nombreReal para que inicio.js lo reconozca
                resolve({ user, rol, nombreReal, userData });

            } catch (error) {
                console.error("🚨 Error Crítico de Seguridad:", error);
                if (!esLocal) window.location.href = "index.html";
            }
        });
    });
}