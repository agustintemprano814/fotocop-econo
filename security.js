/**
 * @file security.js
 * @description Capa de seguridad v4.0 con Vigilante de Mantenimiento en Tiempo Real.
 */

import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const host = window.location.hostname;
const esLocal = host === "localhost" || host === "127.0.0.1" || host === "";
const esPaginaLogin = window.location.pathname.endsWith('index.html') || 
                     window.location.pathname === '/' || 
                     window.location.pathname.includes('index');
const esPaginaMantenimiento = window.location.href.includes('mantenimiento.html');

// Gestión visual inmediata
if (!esPaginaLogin && !esLocal && !esPaginaMantenimiento) {
    document.documentElement.style.display = 'none';
}


function activarVigilanteMantenimiento(esSuperusuario) {
    const configRef = doc(db, "configuracion", "global");
    

    onSnapshot(configRef, (docSnap) => {
        if (docSnap.exists()) {
            const mantenimientoActivo = docSnap.data().modoMantenimiento;

            if (mantenimientoActivo && !esSuperusuario && !esPaginaMantenimiento) {
                console.warn("🚨 Sistema apagado por el administrador.");
                window.location.href = "mantenimiento.html";
            }
        }
    });
}

export const sanitizar = (data) => {
    if (typeof data !== 'string') return data;
    return data.replace(/[&<>"']/g, function(m) {
        return {
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
        }[m];
    });
};

export async function verificarAcceso(rolesPermitidos, unidadRequerida = null) {
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
                const unidad = userData.unidad || "global";
                const nombreReal = userData.nombre || user.email.split('@')[0];
                const esSuper = rol === 'superusuario';

                // --- INICIO DEL VIGILANTE ---
                activarVigilanteMantenimiento(esSuper);

                const configSnap = await getDoc(doc(db, "configuracion", "global"));
                if (configSnap.exists() && configSnap.data().modoMantenimiento && !esSuper) {
                    if (!esPaginaMantenimiento) {
                        window.location.href = "mantenimiento.html";
                        return;
                    }
                }

                // Validación de Jerarquía
                const tieneRol = rolesPermitidos.includes(rol);
                let unidadValida = true;
                if (unidadRequerida && !esSuper) {
                    if (unidad !== unidadRequerida) unidadValida = false;
                }

                if (!esSuper && (!tieneRol || !unidadValida)) {
                    alert("🚫 Acceso restringido.");
                    if (!window.location.href.includes("inicio.html")) {
                        window.location.href = "inicio.html";
                    }
                    return;
                }

                const idProfesional = `${nombreReal} | ${rol.toUpperCase()} ${unidad !== 'global' ? '[' + unidad.toUpperCase() + ']' : ''}`;

                document.documentElement.style.display = 'block';
                document.body.style.display = 'block';
                
                resolve({ user, rol, unidad, nombreReal, idProfesional, userData });

            } catch (error) {
                manejarErrorCritico(error, esLocal);
            }
        });
    });
}

export function renderSeguro(elemento, texto) {
    if (elemento) elemento.textContent = texto || "";
}

function manejarErrorCritico(error, local) {
    console.error("🚨 Error Crítico:", error.code);
    if (!local) window.location.href = "index.html";
}