import { auth } from './firebase-config.js';
import { signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const TIEMPO_EXPIRACION = 3 * 60 * 1000; 
let timeout;

function reiniciarTemporizador() {
    clearTimeout(timeout);
    timeout = setTimeout(cerrarSesionInactiva, TIEMPO_EXPIRACION);
}

function cerrarSesionInactiva() {
    console.log("Sesión expirada por inactividad.");
    signOut(auth).then(() => {
        window.location.href = "index.html?reason=timeout";
    });
}

window.onload = reiniciarTemporizador;
window.onmousemove = reiniciarTemporizador;
window.onmousedown = reiniciarTemporizador; 
window.ontouchstart = reiniciarTemporizador;
window.onclick = reiniciarTemporizador;
window.onkeypress = reiniciarTemporizador;

console.log("Protección de inactividad activa (3 min)");