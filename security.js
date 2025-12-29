import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- CONFIGURACIÓN DE MANTENIMIENTO ---
const MODO_MANTENIMIENTO = true; 

/**
 * BLOQUEO INMEDIATO
 * Este bloque se ejecuta antes que cualquier otra cosa
 */
const host = window.location.hostname;
const esLocal = host === "localhost" || host === "127.0.0.1" || host === "";

if (MODO_MANTENIMIENTO && !esLocal) {
    // Si no es local y no estoy ya en mantenimiento.html, redirijo
    if (!window.location.href.includes('mantenimiento.html')) {
        window.location.href = "mantenimiento.html";
        // Forzamos la detención de cualquier script posterior
        throw new Error("Modo mantenimiento activo. Redirigiendo...");
    }
}

// Ocultamos el documento solo si pasó el filtro anterior
document.documentElement.style.display = 'none';

export async function verificarAcceso(rolesPermitidos) {
    return new Promise((resolve) => {
        onAuthStateChanged(auth, async (user) => {

            if (!user) {
                window.location.href = "index.html";
                return;
            }

            try {
                const docSnap = await getDoc(doc(db, "usuarios", user.email));
                
                if (!docSnap.exists()) {
                    alert("Cuenta sin permisos.");
                    window.location.href = "index.html";
                    return;
                }

                const rol = docSnap.data().rol;

                if (!rolesPermitidos.includes(rol)) {
                    alert("🚫 Acceso restringido.");
                    if (!window.location.href.includes("inicio.html")) {
                        window.location.href = "inicio.html";
                    }
                    return;
                }

                document.documentElement.style.display = 'block';
                document.body.style.display = 'block'; 
                resolve(rol);

            } catch (error) {
                console.error("Error:", error);
                window.location.href = "index.html";
            }
        });
    });
}