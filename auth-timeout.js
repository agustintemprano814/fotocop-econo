/**
 * @file auth-timeout.js
 * @description Cierre de sesión inteligente: Solo para roles jerárquicos.
 */

import { auth, db } from './firebase-config.js';
import { signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const TIEMPO_EXPIRACION = 15 * 60 * 1000; 
let timeout;

function reiniciarTemporizador() {
    clearTimeout(timeout);
    timeout = setTimeout(cerrarSesionInactiva, TIEMPO_EXPIRACION);
}

function cerrarSesionInactiva() {
    console.log("🛡️ Seguridad: Sesión administrativa expirada por inactividad.");
    signOut(auth).then(() => {
        window.location.href = "index.html?reason=timeout";
    });
}


onAuthStateChanged(auth, async (user) => {
    if (user) {
        try {
            const userSnap = await getDoc(doc(db, "usuarios", user.email));
            
            if (userSnap.exists()) {
                const rol = userSnap.data().rol;
                

                const rolesProtegidos = [
                    'supervisor-apuntes', 
                    'supervisor-fotocop', 
                    'adm-eco', 
                    'superusuario'
                ];

                if (rolesProtegidos.includes(rol)) {
                    console.log(`🔒 Protección activada para ${rol}. Expira en ${TIEMPO_EXPIRACION/60000} min.`);
                    

                    window.onmousemove = reiniciarTemporizador;
                    window.onmousedown = reiniciarTemporizador;
                    window.ontouchstart = reiniciarTemporizador;
                    window.onclick = reiniciarTemporizador;
                    window.onkeydown = reiniciarTemporizador;
                    

                    reiniciarTemporizador();
                } else {
                    console.log("⚡ Modo operativo (Vendedor): Sesión persistente activada.");

                    clearTimeout(timeout);
                    window.onmousemove = null;
                    window.onmousedown = null;
                    window.onclick = null;
                }
            }
        } catch (error) {
            console.error("Error en el control de inactividad:", error);
        }
    }
});