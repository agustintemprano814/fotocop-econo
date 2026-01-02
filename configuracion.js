/**
 * @file configuracion.js
 * @description Gestión de parámetros globales del local con cumplimiento CSP y auditoría.
 */
import { db, auth } from './firebase-config.js';
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { verificarAcceso } from './security.js';
import { cargarSidebar } from './sidebar.js';

// Lista de IDs de inputs que coinciden con los campos en Firestore
const camposConfig = ['precioSimple', 'precioDoble', 'precioAnillado', 'costo_pasada', 'limite_mantenimiento'];

// --- SEGURIDAD Y ACCESO ---
verificarAcceso(['adm-eco', 'superusuario']).then(() => {
    cargarSidebar('config');
    inicializarPagina();
}).catch(err => {
    console.error("Acceso denegado a configuración:", err);
    window.location.href = "inicio.html";
});

function inicializarPagina() {
    cargarConfiguracionActual();
    
    // Vinculación segura de evento
    const btnGuardar = document.getElementById('btnGuardarConfig');
    if (btnGuardar) {
        btnGuardar.addEventListener('click', guardarConfiguracion);
    }
}

// --- LÓGICA DE CARGA ---
async function cargarConfiguracionActual() {
    try {
        const snap = await getDoc(doc(db, "configuracion", "global"));
        if (snap.exists()) {
            const data = snap.data();
            camposConfig.forEach(id => {
                const input = document.getElementById(id);
                if (input && data[id] !== undefined) {
                    input.value = data[id];
                }
            });
        }
    } catch (error) {
        console.error("Error al cargar configuración:", error);
    }
}

// --- LÓGICA DE GUARDADO ---
async function guardarConfiguracion() {
    const btn = document.getElementById('btnGuardarConfig');
    const msj = document.getElementById('mensajeGuardado');
    
    btn.disabled = true;
    const textoOriginal = btn.innerText;
    btn.innerText = "⏳ Guardando...";

    // Objeto base con auditoría
    const data = {
        ultimaModificacion: new Date().toISOString(),
        usuarioModifico: auth.currentUser ? auth.currentUser.email : "desconocido"
    };
    
    // Recolectar valores de los inputs de forma dinámica
    camposConfig.forEach(id => {
        const val = document.getElementById(id).value;
        // Forzamos conversión a número para evitar errores en dashboards
        data[id] = parseFloat(val) || 0;
    });
    
    try {
        // Guardado con merge:true para no borrar otros campos (como modoMantenimiento)
        await setDoc(doc(db, "configuracion", "global"), data, { merge: true });
        
        msj.style.color = "var(--success)";
        msj.innerText = "✅ Configuración actualizada globalmente.";
        
        // Limpiar mensaje después de 3 segundos
        setTimeout(() => { 
            msj.innerText = ""; 
        }, 3000);

    } catch (error) {
        console.error("Error al guardar configuración:", error);
        alert("Error de permisos: No se pudo actualizar la base de datos.");
    } finally {
        btn.disabled = false;
        btn.innerText = textoOriginal;
    }
}