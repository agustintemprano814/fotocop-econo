/**
 * @file security.js
 * @description Capa de seguridad centralizada v3.1 con Identidad Humanizada y Soporte Multi-Sede.
 */

import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- 1. CONFIGURACIÓN DE EMERGENCIA ---
const MODO_MANTENIMIENTO = true; 

const host = window.location.hostname;
const esLocal = host === "localhost" || host === "127.0.0.1" || host === "";
const esPaginaLogin = window.location.pathname.endsWith('index.html') || 
                     window.location.pathname === '/' || 
                     window.location.pathname.includes('index');

// Gestión visual inmediata para evitar "flickering" de datos sensibles
if (!esPaginaLogin && !esLocal) {
    document.documentElement.style.display = 'none';
}

// Bloqueo por mantenimiento
if (MODO_MANTENIMIENTO && !esLocal && !esPaginaLogin && !window.location.href.includes('mantenimiento.html')) {
    window.location.href = "mantenimiento.html";
}

/**
 * Sanitización XSS de Entrada
 * Previene la ejecución de scripts maliciosos en campos de texto.
 */
export const sanitizar = (data) => {
    if (typeof data !== 'string') return data;
    return data.replace(/[&<>"']/g, function(m) {
        return {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        }[m];
    });
};

/**
 * VERIFICAR ACCESO (Triple Blindaje: Sesión + Rol + Unidad Académica)
 * @param {Array} rolesPermitidos - Roles autorizados para la página.
 * @param {String} unidadRequerida - Facultad específica (ej: 'eco').
 */
export async function verificarAcceso(rolesPermitidos, unidadRequerida = null) {
    return new Promise((resolve) => {
        onAuthStateChanged(auth, async (user) => {
            
            // 1. Verificación de Sesión Activa
            if (!user) {
                console.warn("🔐 Seguridad: Sesión no encontrada.");
                window.location.href = "index.html";
                return;
            }

            try {
                // 2. Consulta a Firestore (Fuente Única de Verdad)
                const userRef = doc(db, "usuarios", user.email);
                const docSnap = await getDoc(userRef);

                if (!docSnap.exists()) {
                    console.error("🔐 Seguridad: El usuario no existe en la base de datos.");
                    await signOut(auth);
                    window.location.href = "index.html?error=unauthorized";
                    return;
                }

                const userData = docSnap.data();
                const rol = userData.rol;
                const unidad = userData.unidad || "global";
                
                // --- NUEVO: Captura de Nombre Humanizado ---
                const nombreReal = userData.nombre || user.email.split('@')[0];

                // 3. Validación de Jerarquía y Permisos
                const esSuper = rol === 'superusuario';
                const tieneRol = rolesPermitidos.includes(rol);
                
                // 4. Validación de Unidad Académica (Multitenant)
                let unidadValida = true;
                if (unidadRequerida && !esSuper) {
                    if (unidad !== unidadRequerida) unidadValida = false;
                }

                if (!esSuper && (!tieneRol || !unidadValida)) {
                    console.error(`🔐 Seguridad: Acceso denegado para [${rol}] en [${unidad}]`);
                    alert("🚫 Acceso restringido: No posee los permisos necesarios.");
                    if (!window.location.href.includes("inicio.html")) {
                        window.location.href = "inicio.html";
                    }
                    return;
                }

                // 5. Generación de Identidad Profesional Humanizada (Punto solicitado)
                // Formato: Juan Perez | SUPERUSUARIO [GLOBAL]
                const idProfesional = `${nombreReal} | ${rol.toUpperCase()} ${unidad !== 'global' ? '[' + unidad.toUpperCase() + ']' : ''}`;

                // 6. Liberación de Interfaz
                document.documentElement.style.display = 'block';
                document.body.style.display = 'block';
                
                resolve({ 
                    user, 
                    rol, 
                    unidad, 
                    nombreReal, 
                    idProfesional, 
                    userData 
                });

            } catch (error) {
                manejarErrorCritico(error, esLocal);
            }
        });
    });
}

/**
 * Renderizado Seguro contra inyección (Blindaje de Lectura - Punto 3)
 */
export function renderSeguro(elemento, texto) {
    if (elemento) {
        elemento.textContent = texto || "";
    }
}

/**
 * Manejador de Errores de Red o Cuota
 */
function manejarErrorCritico(error, local) {
    console.error("🚨 Error Crítico de Seguridad:", error.code);
    if (error.code === 'resource-exhausted') {
        alert("⚠️ Cuota diaria del servidor agotada. Los datos podrían no cargar correctamente.");
    }
    if (!local) window.location.href = "index.html";
}