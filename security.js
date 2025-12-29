/**
 * @file security.js
 * @description Capa de seguridad centralizada para Fotocop-Econo.
 * Implementa: Blindaje XSS, Control de Sesión, Protección de Cuota y Sanitización.
 */

import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- 1. CONFIGURACIÓN DE EMERGENCIA ---
const MODO_MANTENIMIENTO = true; // Activar para cerrar la web al público

// --- 2. GESTIÓN VISUAL INMEDIATA ---
// Evita el "Flickering" (que se vea la web un segundo antes de validar)
document.documentElement.style.display = 'none';

/**
 * Función de Sanitización Universal (Blindaje Punto 1)
 * Limpia cualquier string para evitar ejecución de scripts maliciosos.
 */
export const sanitizar = (data) => {
    if (typeof data !== 'string') return data;
    const placeholder = document.createElement('div');
    placeholder.textContent = data;
    return placeholder.innerHTML;
};

/**
 * Validador de Entorno local para pruebas
 */
const esDesarrollo = () => {
    const host = window.location.hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "";
};

// Ejecución del bloqueo de mantenimiento
if (MODO_MANTENIMIENTO && !esDesarrollo() && !window.location.href.includes('mantenimiento.html')) {
    window.location.href = "mantenimiento.html";
}

/**
 * VERIFICAR ACCESO (Función Principal)
 * @param {Array} rolesPermitidos - Lista de roles que pueden ver la página
 */
export async function verificarAcceso(rolesPermitidos) {
    return new Promise((resolve) => {
        onAuthStateChanged(auth, async (user) => {
            
            // A. Verificación de Autenticación
            if (!user) {
                console.warn("🔐 Seguridad: Sesión no encontrada.");
                window.location.href = "index.html";
                return;
            }

            try {
                // B. Verificación de Identidad y Rol (Single Source of Truth)
                const userRef = doc(db, "usuarios", user.email);
                const docSnap = await getDoc(userRef);

                if (!docSnap.exists()) {
                    console.error("🔐 Seguridad: Usuario no registrado en DB.");
                    await signOut(auth); // Forzamos cierre de sesión si no existe en DB
                    window.location.href = "index.html?error=unauthorized";
                    return;
                }

                const userData = docSnap.data();
                const rol = userData.rol;

                // C. Validación de Autorización
                if (!rolesPermitidos.includes(rol)) {
                    console.error(`🔐 Seguridad: Intento de acceso denegado. Usuario: ${user.email} | Rol: ${rol}`);
                    alert("🚫 Acceso restringido. Su nivel de usuario no permite esta acción.");
                    
                    if (!window.location.href.includes("inicio.html")) {
                        window.location.href = "inicio.html";
                    }
                    return;
                }

                // D. Liberación de Interfaz
                // Si llegamos aquí, el usuario es legítimo
                document.documentElement.style.display = 'block';
                document.body.style.display = 'block';
                
                console.log(`🛡️ Escudo Activo: Acceso concedido [${rol}]`);
                resolve({ user, rol, userData });

            } catch (error) {
                manejarErrorSeguridad(error);
            }
        });
    });
}

/**
 * Manejador de Errores Críticos
 */
function manejarErrorSeguridad(error) {
    console.error("🚨 Error Crítico de Seguridad:", error.code);
    
    if (error.code === 'resource-exhausted') {
        alert("⚠️ El servidor ha alcanzado su límite diario (Cuota Firebase). Intente mañana.");
    } else if (error.code === 'permission-denied') {
        alert("❌ Error de permisos: No tienes acceso a la base de datos.");
    }
    
    // En cualquier error crítico, protegemos la info volviendo al inicio
    window.location.href = "index.html";
}

/**
 * Blindaje de Lectura (Doble Seguridad - Punto 3)
 * Función para renderizar texto de forma segura sin innerHTML
 */
export function renderSeguro(elemento, texto) {
    if (elemento) {
        elemento.textContent = texto || "";
    }
}