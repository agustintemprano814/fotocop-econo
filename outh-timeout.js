
import { auth } from './firebase-config.js';
import { signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const TIEMPO_INACTIVIDAD = 15 * 60 * 1000; 
let timeout;

function reiniciarTemporizador() {
    clearTimeout(timeout);
    timeout = setTimeout(cerrarSesionInactiva, TIEMPO_INACTIVIDAD);
}

function cerrarSesionInactiva() {
    console.log("Cerrando sesión por inactividad...");
    signOut(auth).then(() => {
        window.location.href = "index.html?reason=timeout";
    });
}


window.onload = reiniciarTemporizador;
window.onmousemove = reiniciarTemporizador;
window.onmousedown = reiniciarTemporizador; 
window.ontouchstart = reiniciarTemporizador; 
window.onclick = reiniciarTemporizador;     
window.onkeydown = reiniciarTemporizador;   
window.addEventListener('scroll', reiniciarTemporizador, true);

console.log("Cronómetro de inactividad activado (15 min)");