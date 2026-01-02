/**
 * @file cierre_apuntes.js
 * @description Lógica de cierre de caja para el Sector Apuntes con validación en tiempo real.
 */
import { db, auth } from './firebase-config.js';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { cargarSidebar } from './sidebar.js';
import { verificarAcceso, sanitizar, renderSeguro } from './security.js';

let totalEfectivoEsperado = 0;
let nombreOperadorActual = "";

// --- INICIO Y SEGURIDAD ---
verificarAcceso(['superusuario', 'adm-eco', 'supervisor-apuntes', 'operario-apuntes']).then(info => {
    cargarSidebar('cierre-apuntes'); 
    
    // Configuración visual del operador
    nombreOperadorActual = info.nombreReal || info.userData?.nombre || "Usuario";
    document.getElementById('operator-name').innerText = nombreOperadorActual;
    document.getElementById('operator-id').innerText = info.user.email;
    document.getElementById('user-initial').innerText = nombreOperadorActual.charAt(0).toUpperCase();
    
    inicializarEventos();
    cargarVentasDelDia();
}).catch(err => {
    console.error("Acceso denegado:", err);
    window.location.href = "index.html";
});

function inicializarEventos() {
    // 1. Cálculo de diferencia en tiempo real
    document.getElementById('contado-efectivo').addEventListener('input', calcularDiferencia);

    // 2. Envío de formulario
    document.getElementById('formCierre').addEventListener('submit', procesarCierre);
}

// --- LÓGICA DE NEGOCIO ---
async function cargarVentasDelDia() {
    const hoy = new Date().toISOString().split('T')[0];
    const kpiEfectivo = document.getElementById('kpi-efectivo');
    const kpiTransf = document.getElementById('kpi-transferencia');
    const kpiTotal = document.getElementById('kpi-total');

    try {
        const q = query(
            collection(db, "ventas"), 
            where("fecha", "==", hoy), 
            where("sector", "==", "Apuntes")
        );
        
        const querySnapshot = await getDocs(q);
        let efectivo = 0;
        let transferencia = 0;

        querySnapshot.forEach((doc) => {
            const venta = doc.data();
            // Aseguramos compatibilidad con minúsculas/mayúsculas
            const metodo = (venta.metodoPago || '').toLowerCase();
            if (metodo === 'efectivo') efectivo += (Number(venta.total) || 0);
            else transferencia += (Number(venta.total) || 0);
        });

        totalEfectivoEsperado = efectivo;
        renderSeguro(kpiEfectivo, `$ ${efectivo.toFixed(2)}`);
        renderSeguro(kpiTransf, `$ ${transferencia.toFixed(2)}`);
        renderSeguro(kpiTotal, `$ ${(efectivo + transferencia).toFixed(2)}`);
        
    } catch (error) {
        console.error("Error cargando ventas:", error);
        alert("Error al recuperar las ventas del día.");
    }
}

function calcularDiferencia(e) {
    const contado = parseFloat(e.target.value) || 0;
    const dif = contado - totalEfectivoEsperado;
    const divMonto = document.getElementById('monto-diferencia');
    const pMensaje = document.getElementById('mensaje-diferencia');

    divMonto.innerText = `$ ${dif.toFixed(2)}`;

    // Umbral de 0.01 para evitar problemas de precisión decimal
    if (Math.abs(dif) < 0.01) {
        divMonto.style.color = "var(--success)";
        pMensaje.innerText = "✅ CAJA BALANCEADA";
    } else if (dif > 0) {
        divMonto.style.color = "var(--primary)";
        pMensaje.innerText = "⚠️ SOBRANTE";
    } else {
        divMonto.style.color = "var(--danger)";
        pMensaje.innerText = "❌ FALTANTE";
    }
}

async function procesarCierre(e) {
    e.preventDefault();
    const contado = parseFloat(document.getElementById('contado-efectivo').value) || 0;
    const diferencia = contado - totalEfectivoEsperado;
    
    const confirmacion = confirm(`¿Confirmas el cierre con una diferencia de $ ${diferencia.toFixed(2)}?`);
    if(!confirmacion) return;

    const btn = e.target.querySelector('button');
    btn.disabled = true;
    btn.innerText = "⏳ Enviando Cierre...";

    try {
        await addDoc(collection(db, "cierres_diarios"), {
            fecha: serverTimestamp(),
            fechaString: new Date().toISOString().split('T')[0],
            sector: 'Apuntes',
            operador: auth.currentUser.email,
            nombreOperador: nombreOperadorActual,
            esperadoEfectivo: totalEfectivoEsperado,
            rendidoEfectivo: contado,
            diferencia: diferencia,
            observaciones: sanitizar(document.getElementById('observaciones').value),
            estado: 'Pendiente'
        });

        alert("✅ Cierre de caja enviado satisfactoriamente.");
        window.location.href = "inicio.html";
    } catch (error) {
        alert("Error crítico al guardar el cierre. Verifique su conexión.");
        console.error(error);
        btn.disabled = false;
        btn.innerText = "Finalizar y Cerrar Caja";
    }
}