/**
 * @file cierres.js
 * @description Lógica interactiva para el cierre de jornada de Fotocopiadora (CSP Compliance).
 */
import { auth, db } from './firebase-config.js';
import { collection, addDoc, serverTimestamp, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { verificarAcceso, sanitizar, renderSeguro } from './security.js';
import { cargarSidebar } from './sidebar.js';

let sistemaEfectivo = 0;
let sistemaTransf = 0;
let nombreSupervisorActual = "";

// --- INICIO Y SEGURIDAD ---
verificarAcceso(['supervisor-fotocop', 'superusuario', 'adm-eco']).then(info => {
    cargarSidebar('cierre-foto');
    nombreSupervisorActual = info.nombreReal || info.userData?.nombre || "Supervisor";
    renderSeguro(document.getElementById('displayUser'), nombreSupervisorActual);
    document.getElementById('user-initial').innerText = nombreSupervisorActual.charAt(0).toUpperCase();
    
    document.getElementById('fechaActual').innerText = new Date().toLocaleDateString('es-AR', { 
        weekday:'long', day:'numeric', month:'long', year:'numeric'
    });

    generarContadores();
    cargarVentasSistema();
    configurarManejadores();
}).catch(err => {
    console.error("Acceso denegado:", err);
    window.location.href = "index.html";
});

// --- RENDERIZADO DINÁMICO ---
function generarContadores() {
    const cont = document.getElementById('contenedorMaquinas');
    cont.innerHTML = "";
    for(let i=1; i<=7; i++) {
        const maquinaDiv = document.createElement('div');
        maquinaDiv.className = 'maquina-card';
        maquinaDiv.innerHTML = `
            <h4>Máquina ${i}</h4>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:5px">
                <div class="input-group-cierre"><label style="font-size:0.6rem">Inicio</label><input type="number" class="m-input count-input" id="m${i}_i" value=""></div>
                <div class="input-group-cierre"><label style="font-size:0.6rem">Cierre</label><input type="number" class="m-input count-input" id="m${i}_c" value=""></div>
            </div>
            <div id="neto_m${i}" class="neto-badge">Neto: 0</div>
        `;
        cont.appendChild(maquinaDiv);
    }
}

// --- MANEJADORES DE EVENTOS ---
function configurarManejadores() {
    // 1. Acordeones de secciones
    document.querySelectorAll('.section-header-cierre').forEach(header => {
        header.addEventListener('click', () => {
            const targetId = header.getAttribute('data-target');
            const el = document.getElementById(targetId);
            el.classList.toggle('active');
        });
    });

    // 2. Botones "Siguiente"
    document.querySelectorAll('.btn-next').forEach(btn => {
        btn.addEventListener('click', () => {
            const nextId = btn.getAttribute('data-next');
            document.querySelectorAll('.section-content').forEach(s => s.classList.remove('active'));
            document.getElementById(nextId).classList.add('active');
            window.scrollTo({ top: document.getElementById(nextId).offsetTop - 100, behavior: 'smooth' });
        });
    });

    // 3. Cálculos automáticos en tiempo real
    document.getElementById('formCierreCompleto').addEventListener('input', realizarCalculos);

    // 4. Procesar el Cierre (Apertura de PIN)
    document.getElementById('formCierreCompleto').addEventListener('submit', (e) => {
        e.preventDefault();
        document.getElementById('pinOverlay').style.display = 'flex';
    });

    // 5. Botones del PIN
    document.getElementById('btnCancelarPin').addEventListener('click', () => {
        document.getElementById('pinOverlay').style.display = 'none';
        document.getElementById('pinInput').value = "";
    });

    document.getElementById('btnConfirmarFinal').addEventListener('click', finalizarCierreConPin);

    // 6. Imprimir
    document.getElementById('btnImprimir').addEventListener('click', () => window.print());
}

// --- LÓGICA DE CÁLCULO ---
function realizarCalculos() {
    let totalNetoMaquinas = 0;
    
    // Calcular Netos de Máquinas
    for(let i=1; i<=7; i++){
        const ini = Number(document.getElementById(`m${i}_i`).value) || 0;
        const fin = Number(document.getElementById(`m${i}_c`).value) || 0;
        const neto = (fin > 0 && fin >= ini) ? (fin - ini) : 0;
        document.getElementById(`neto_m${i}`).innerText = `Neto: ${neto}`;
        totalNetoMaquinas += neto;
    }
    document.getElementById('kpi-hojas-total').innerText = Math.floor(totalNetoMaquinas / 2);

    // Calcular Caja
    const e = Number(document.getElementById('ingEfectivo').value) || 0;
    const t = Number(document.getElementById('ingTransf').value) || 0;
    const g = Number(document.getElementById('gastosDia').value) || 0;
    const s = Number(document.getElementById('vtaStock').value) || 0;
    const r = Number(document.getElementById('vtaRapida').value) || 0;
    
    document.getElementById('subtotalVentasDirectas').innerText = `$ ${s + r}`;
    document.getElementById('totalCajaNeto').innerText = `$ ${(e + t - g).toFixed(2)}`;

    // Conciliación contra Sistema
    const diferencia = (e + t) - (sistemaEfectivo + sistemaTransf + s + r);
    const kpiConciliacion = document.getElementById('kpi-conciliacion-final');
    kpiConciliacion.innerText = `$ ${diferencia.toFixed(2)}`;
    kpiConciliacion.style.color = Math.abs(diferencia) < 1 ? "var(--success)" : (diferencia > 0 ? "var(--primary)" : "var(--danger)");

    // Copias No Cobradas
    let tNC = 0;
    document.querySelectorAll('.nc').forEach(i => tNC += (Number(i.value) || 0));
    document.getElementById('totalNC').innerText = tNC;
}

// --- CONEXIÓN CON FIREBASE ---
async function cargarVentasSistema() {
    const hoy = new Date().toISOString().split('T')[0];
    try {
        const q = query(collection(db, "ventas"), where("fecha", "==", hoy), where("sector", "==", "Fotocopiadora"));
        const snap = await getDocs(q);
        sistemaEfectivo = 0; 
        sistemaTransf = 0;
        snap.forEach(d => {
            const data = d.data();
            const metodo = (data.metodoPago || '').toLowerCase();
            if(metodo === 'efectivo') sistemaEfectivo += (Number(data.total) || 0);
            else sistemaTransf += (Number(data.total) || 0);
        });
        document.getElementById('kpi-sistema-efectivo').innerText = `$ ${sistemaEfectivo.toFixed(2)}`;
        document.getElementById('kpi-sistema-transf').innerText = `$ ${sistemaTransf.toFixed(2)}`;
    } catch (err) {
        console.error("Error cargando ventas sistema:", err);
    }
}

async function finalizarCierreConPin() {
    const pin = document.getElementById('pinInput').value;
    // PIN de prueba (deberías validarlo contra Firestore en el futuro)
    if(pin !== "1234") { 
        alert("PIN de Supervisor Incorrecto"); 
        return; 
    }
    
    document.getElementById('pinOverlay').style.display = 'none';
    const btn = document.getElementById('btnFinalizarCierre');
    btn.disabled = true; 
    btn.innerText = "⏳ Guardando Cierre Maestro...";

    try {
        const maquinas = {};
        for(let i=1; i<=7; i++) {
            const iniVal = Number(document.getElementById(`m${i}_i`).value) || 0;
            const finVal = Number(document.getElementById(`m${i}_c`).value) || 0;
            maquinas[`m${i}`] = { 
                inicio: iniVal, 
                cierre: finVal,
                neto: finVal - iniVal
            };
        }

        const difCaja = Number(document.getElementById('kpi-conciliacion-final').innerText.replace('$ ','')) || 0;

        await addDoc(collection(db, "cierres_diarios"), {
            sector: 'Fotocopiadora',
            supervisor: auth.currentUser.email,
            nombreSupervisor: nombreSupervisorActual,
            fecha: serverTimestamp(),
            fechaString: new Date().toISOString().split('T')[0],
            maquinas,
            caja: { 
                efectivoRendido: Number(document.getElementById('ingEfectivo').value) || 0, 
                transferenciaRendida: Number(document.getElementById('ingTransf').value) || 0, 
                gastos: Number(document.getElementById('gastosDia').value) || 0,
                diferencia: difCaja
            },
            totalNoCobradas: Number(document.getElementById('totalNC').innerText) || 0,
            estado: 'Finalizado'
        });

        alert("✅ Cierre guardado con éxito y conciliado.");
        window.location.href = "inicio.html";
    } catch (err) { 
        alert("Error crítico: " + err.message); 
        btn.disabled = false; 
        btn.innerText = "💾 FINALIZAR Y GUARDAR TODO";
    }
}