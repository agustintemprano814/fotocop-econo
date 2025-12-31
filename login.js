/**
 * @file login.js
 * @description Lógica de autenticación externa para cumplir con CSP.
 */
import { auth, db } from './firebase-config.js';
import { 
    browserSessionPersistence, 
    browserLocalPersistence, 
    signInWithEmailAndPassword 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { sanitizar } from './security.js';

const loginForm = document.getElementById('loginForm');
const mensaje = document.getElementById('mensaje');
const btnEntrar = document.getElementById('btnEntrar');

// Manejo de mensajes por URL (ej: timeout de sesión)
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('reason') === 'timeout') {
    mensaje.style.color = "var(--accent)";
    mensaje.innerText = "⏳ Sesión cerrada por inactividad.";
}

// Evento de Submit centralizado
loginForm.addEventListener('submit', async (e) => {
    // IMPORTANTE: Previene la recarga del formulario POST y permite que JS tome el control
    e.preventDefault();
    
    btnEntrar.disabled = true;
    btnEntrar.innerText = "⏳ Verificando...";
    mensaje.style.color = "var(--primary)";
    mensaje.innerText = "Procesando ingreso...";

    const email = sanitizar(document.getElementById('usuario').value.trim().toLowerCase());
    const pass = document.getElementById('password').value;

    try {
        // 1. Intentar autenticación en Firebase
        const userCredential = await signInWithEmailAndPassword(auth, email, pass);
        
        // 2. Verificar existencia y rol en la colección 'usuarios'
        const docSnap = await getDoc(doc(db, "usuarios", email));

        if (docSnap.exists()) {
            const rol = docSnap.data().rol;
            
            // Lógica de persistencia según jerarquía
            const jerarquicos = ['supervisor-apuntes', 'supervisor-fotocop', 'adm-eco', 'superusuario'];
            const persistencia = jerarquicos.includes(rol) ? browserSessionPersistence : browserLocalPersistence;

            await auth.setPersistence(persistencia);

            mensaje.style.color = "var(--success)";
            mensaje.innerText = "✅ ¡Acceso concedido!";
            setTimeout(() => { window.location.href = "inicio.html"; }, 800);
        } else {
            // Si el usuario existe en Auth pero no en nuestra base de datos, lo expulsamos
            await auth.signOut();
            mensaje.style.color = "var(--danger)";
            mensaje.innerText = "⚠️ Usuario no autorizado en la base de datos.";
            btnEntrar.disabled = false;
            btnEntrar.innerText = "Entrar al Sistema";
        }

    } catch (error) {
        console.error("Login Error:", error.code);
        btnEntrar.disabled = false;
        btnEntrar.innerText = "Entrar al Sistema";
        mensaje.style.color = "var(--danger)";
        
        if (error.code === 'auth/invalid-credential') {
            mensaje.innerText = "❌ Correo o contraseña incorrectos.";
        } else if (error.code === 'auth/too-many-requests') {
            mensaje.innerText = "🚫 Demasiados intentos. Intente más tarde.";
        } else {
            mensaje.innerText = "❌ Error al conectar con el servidor.";
        }
    }
});