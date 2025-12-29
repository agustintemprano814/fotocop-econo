/**
 * CONFIGURACIÓN DE MANTENIMIENTO TOTAL
 * true = BLOQUEADO para el público
 * false = OPERATIVO
 */
const MODO_MANTENIMIENTO = true;

// 1. BLOQUEO DE EMERGENCIA (Se ejecuta antes de cualquier importación)
const hostActual = window.location.hostname;
const esDesarrolloLocal = hostActual === "localhost" || hostActual === "127.0.0.1" || hostActual === "";

if (MODO_MANTENIMIENTO && !esDesarrolloLocal) {
    if (!window.location.href.includes('mantenimiento.html')) {
        window.location.href = "mantenimiento.html";
        throw new Error("SISTEMA EN MANTENIMIENTO: Redirigiendo...");
    }
}

// 2. IMPORTACIONES
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 3. ESTADO INICIAL
document.documentElement.style.display = 'none';

/**
 * FUNCIÓN DE SEGURIDAD PARA LAS PÁGINAS
 */
export async function verificarAcceso(rolesPermitidos) {
    return new Promise((resolve) => {
        onAuthStateChanged(auth, async (user) => {

            if (!user) {
                console.warn("Seguridad: Sin sesión activa.");
                window.location.href = "index.html";
                return;
            }

            try {
                const docSnap = await getDoc(doc(db, "usuarios", user.email));
                
                if (!docSnap.exists()) {
                    alert("Tu cuenta no tiene un rol asignado.");
                    window.location.href = "index.html";
                    return;
                }

                const rol = docSnap.data().rol;

                if (!rolesPermitidos.includes(rol)) {
                    alert("🚫 Acceso restringido para " + rol);
                    if (!window.location.href.includes("inicio.html")) {
                        window.location.href = "inicio.html";
                    }
                    return;
                }

                // SI TODO ES CORRECTO: Mostramos la web
                document.documentElement.style.display = 'block';
                document.body.style.display = 'block'; 
                resolve(rol);

            } catch (error) {
                console.error("Error en escudo de seguridad:", error);
                if (error.code === 'resource-exhausted') {
                    alert("Cuota de servidor excedida. Intenta mañana.");
                }
                window.location.href = "index.html";
            }
        });
    });
}

/**
 * FUNCIÓN DE SANITIZACIÓN (Punto 2: Blindaje Invisible)
 * Úsala en tus formularios antes de guardar en Firebase:
 * const notaLimpia = sanitizar(input.value);
 */
export function sanitizar(texto) {
    if (typeof texto !== 'string') return texto;
    const temp = document.createElement('div');
    temp.textContent = texto;
    return temp.innerHTML;
}