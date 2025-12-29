import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- CONFIGURACIÓN DE MANTENIMIENTO ---
const MODO_MANTENIMIENTO = true; // true = Activo, false = Operativo

// Ocultamos el documento de entrada
document.documentElement.style.display = 'none';

/**
 * Función para verificar si estamos en entorno local de desarrollo
 */
const esEntornoDesarrollo = () => {
    return window.location.hostname === "localhost" || 
           window.location.hostname === "127.0.0.1" || 
           window.location.protocol === "file:";
};

// Redirección inmediata si hay mantenimiento (pero permite trabajar localmente)
if (MODO_MANTENIMIENTO && !esEntornoDesarrollo() && !window.location.href.includes('mantenimiento.html')) {
    window.location.href = "mantenimiento.html";
}

export async function verificarAcceso(rolesPermitidos) {
    return new Promise((resolve) => {
        onAuthStateChanged(auth, async (user) => {

            if (!user) {
                console.warn("Seguridad: Usuario no autenticado. Redirigiendo...");
                window.location.href = "index.html";
                return;
            }

            try {
                const docSnap = await getDoc(doc(db, "usuarios", user.email));
                
                if (!docSnap.exists()) {
                    console.error("Seguridad: El usuario no existe en la base de datos.");
                    alert("Su cuenta no tiene permisos asignados. Contacte al administrador.");
                    window.location.href = "index.html";
                    return;
                }

                const rol = docSnap.data().rol;

                if (!rolesPermitidos.includes(rol)) {
                    console.error(`Seguridad: Acceso denegado para el rol: ${rol}`);
                    alert("🚫 Acceso restringido para su nivel de usuario.");
                    
                    if (!window.location.href.includes("inicio.html")) {
                        window.location.href = "inicio.html";
                    }
                    return;
                }

                // SI EL ACCESO ES CONCEDIDO:
                console.log("🛡️ Escudo de Seguridad: Acceso concedido para", rol);
                
                document.documentElement.style.display = 'block';
                document.body.style.display = 'block'; 
                
                resolve(rol);

            } catch (error) {
                console.error("Error crítico en el escudo de seguridad:", error);
                if (error.code === 'resource-exhausted') {
                    alert("Se ha agotado el límite de uso diario del servidor. Por favor, intente mañana.");
                }
                // Si falla la carga de datos por cuota o red, enviamos al login
                window.location.href = "index.html";
            }
        });
    });
}