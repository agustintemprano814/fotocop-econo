/**
 * @file auth-timeout.js
 * @description Cierre de sesión inteligente: Solo para roles jerárquicos.
 */

import { auth, db } from './firebase-config.js';
import { signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const TIEMPO_EXPIRACION = 15 * 60 * 1000; // 15 minutos (ajustable)
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

// Escuchamos el estado de la sesión para decidir si activar la protección
onAuthStateChanged(auth, async (user) => {
    if (user) {
        try {
            const userSnap = await getDoc(doc(db, "usuarios", user.email));
            
            if (userSnap.exists()) {
                const rol = userSnap.data().rol;
                
                // Definimos los roles que requieren protección (Jerárquicos)
                const rolesProtegidos = [
                    'supervisor-apuntes', 
                    'supervisor-fotocop', 
                    'adm-eco', 
                    'superusuario'
                ];

                if (rolesProtegidos.includes(rol)) {
                    console.log(`🔒 Protección activada para ${rol}. Expira en ${TIEMPO_EXPIRACION/60000} min.`);
                    
                    // Activar sensores de actividad
                    window.onmousemove = reiniciarTemporizador;
                    window.onmousedown = reiniciarTemporizador;
                    window.ontouchstart = reiniciarTemporizador;
                    window.onclick = reiniciarTemporizador;
                    window.onkeydown = reiniciarTemporizador;
                    
                    // Iniciar el primer conteo
                    reiniciarTemporizador();
                } else {
                    console.log("⚡ Modo operativo (Vendedor): Sesión persistente activada.");
                    // Si es un operario, nos aseguramos de que no haya temporizadores activos
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