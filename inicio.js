/**
 * @file inicio.js
 * @description Lógica del panel principal con monitoreo de stock, máquinas y tickets de auditoría impresos.
 */
import { db } from './firebase-config.js';
import { collection, query, where, onSnapshot, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { cargarSidebar } from './sidebar.js';
import { verificarAcceso, renderSeguro } from './security.js';

// --- ESTADO GLOBAL ---
const STOCK_SEGURIDAD = 5; 
let listaGlobalFaltantes = [];
let listaEstadosMaquinas = [];
let cajaApuntes = { total: 0, efectivo: 0, transferencia: 0 };
let cajaFoto = { total: 0, efectivo: 0, transferencia: 0, stock: 0, rapida: 0 };
let usuarioActual = "";

// --- INICIALIZACIÓN Y SEGURIDAD ---
verificarAcceso(['superusuario', 'adm-eco', 'supervisor-apuntes', 'supervisor-fotocop', 'operario-apuntes', 'operario-fotocop']).then(info => {
    cargarSidebar('inicio');
    usuarioActual = info.nombreReal;
    renderSeguro(document.getElementById('saludo'), `¡Hola, ${usuarioActual}!`);
    document.getElementById('fechaHoy').innerText = new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });

    const rol = info.rol;

    if (['superusuario', 'adm-eco'].includes(rol)) {
        document.getElementById('mod-admin').style.display = 'block';
        document.getElementById('mod-control').style.display = 'block';
        document.getElementById('kpi-apuntes-caja').style.display = 'block';
        document.getElementById('kpi-foto-caja').style.display = 'block';
    }
    
    if (rol === 'superusuario') {
        document.getElementById('mod-sistema').style.display = 'block';
        document.getElementById('panicZone').style.display = 'flex';
    }

    document.getElementById('kpi-apuntes-stock').style.display = 'block';
    document.getElementById('kpi-foto-maquinas').style.display = 'block';

    configurarEventos();
    actualizarKPIs();
}).catch(err => console.error("Error:", err));

// --- MANEJADORES DE EVENTOS ---
function configurarEventos() {
    // 1. Acordeón de Módulos
    const cards = document.querySelectorAll('.module-card');
    cards.forEach(card => {
        card.addEventListener('click', () => {
            const isExpanded = card.classList.contains('expanded');
            cards.forEach(c => c.classList.remove('expanded'));
            if (!isExpanded) card.classList.add('expanded');
        });
    });

    // 2. Botón de Pánico
    const btnPanic = document.getElementById('btn-panic-action');
    if (btnPanic) {
        btnPanic.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (confirm("⚠️ ¿Desea apagar el sistema por seguridad?")) {
                try {
                    await updateDoc(doc(db, "configuracion", "global"), { modoMantenimiento: true });
                    location.reload();
                } catch (e) { alert("Error de permisos."); }
            }
        });
    }

    // 3. Navegación
    const rutas = {
        'btn-nav-apuntes': 'apuntes.html', 'btn-nav-ventas': 'ventas.html',
        'btn-nav-stock': 'stock.html', 'btn-nav-insumos': 'insumos.html',
        'btn-nav-estado': 'estado.html', 'btn-nav-editor': 'editor.html',
        'btn-nav-cierre-ap': 'cierre_apuntes.html', 'btn-nav-cierre-fo': 'cierres.html',
        'btn-nav-reportes': 'reportes.html', 'btn-nav-dash-fin': 'dashboard-financiero.html',
        'btn-nav-dash-tec': 'rendimiento.html', 'btn-nav-usuarios': 'usuarios.html',
        'btn-nav-config': 'configuracion.html', 'btn-nav-import': 'importador.html'
    };

    Object.entries(rutas).forEach(([id, url]) => {
        const btn = document.getElementById(id);
        if (btn) btn.addEventListener('click', (e) => { e.stopPropagation(); window.location.href = url; });
    });

    vincularModales();
}

function vincularModales() {
    const setupModal = (idKpi, idModal, idCerrar, renderFunc) => {
        const kpi = document.getElementById(idKpi);
        const mod = document.getElementById(idModal);
        const btn = document.getElementById(idCerrar);
        
        kpi.addEventListener('click', (e) => {
            e.stopPropagation();
            renderFunc();
            mod.style.display = 'flex';
        });
        btn.addEventListener('click', () => mod.style.display = 'none');
        window.addEventListener('click', (e) => { if (e.target === mod) mod.style.display = 'none'; });
    };

    setupModal('kpi-apuntes-stock', 'modalStock', 'btnCerrarModal', renderizarListaFaltantes);
    setupModal('kpi-foto-maquinas', 'modalMaquinas', 'btnCerrarModalMaq', renderizarListaMaquinas);
    setupModal('kpi-apuntes-caja', 'modalDetalleApuntes', 'btnCerrarApuntes', renderizarDetalleApuntes);
    setupModal('kpi-foto-caja', 'modalDetalleFoto', 'btnCerrarFoto', renderizarDetalleFoto);

    // Eventos de Impresión
    document.getElementById('btnImprimirApuntes').addEventListener('click', () => {
        imprimirTicket("REPORTE CAJA - APUNTES", "cuerpoDetalleApuntes");
    });
    document.getElementById('btnImprimirFoto').addEventListener('click', () => {
        imprimirTicket("REPORTE CAJA - FOTOCOPIADORA", "cuerpoDetalleFoto");
    });
}

// --- ESCUCHA DE DATOS ---
function actualizarKPIs() {
    const hoy = new Date().toISOString().split('T')[0];

    onSnapshot(query(collection(db, "ventas"), where("fecha", "==", hoy), where("sector", "==", "Apuntes")), (snap) => {
        cajaApuntes = { total: 0, efectivo: 0, transferencia: 0 };
        snap.forEach(d => {
            const v = d.data();
            const val = Number(v.total) || 0;
            cajaApuntes.total += val;
            if (v.metodoPago === 'Transferencia') cajaApuntes.transferencia += val;
            else cajaApuntes.efectivo += val;
        });
        document.getElementById('val-apuntes-caja').innerText = `$ ${cajaApuntes.total.toLocaleString('es-AR')}`;
    });

    onSnapshot(query(collection(db, "ventas"), where("fecha", "==", hoy), where("sector", "==", "Fotocopiadora")), (snap) => {
        cajaFoto = { total: 0, efectivo: 0, transferencia: 0, stock: 0, rapida: 0 };
        snap.forEach(d => {
            const v = d.data();
            const val = Number(v.total) || 0;
            cajaFoto.total += val;
            if (v.metodoPago === 'Transferencia') cajaFoto.transferencia += val;
            else cajaFoto.efectivo += val;
            if (v.tipoVenta === 'Stock') cajaFoto.stock += val;
            else cajaFoto.rapida += val;
        });
        document.getElementById('val-foto-caja').innerText = `$ ${cajaFoto.total.toLocaleString('es-AR')}`;
    });

    onSnapshot(collection(db, "estado_maquinas"), (snap) => {
        let activas = 0; listaEstadosMaquinas = [];
        for (let i = 1; i <= 7; i++) {
            const idMaq = `M${i}`;
            const docM = snap.docs.find(d => d.id === idMaq);
            const data = docM ? docM.data() : { activa: true, nota: "Operativa" };
            if (data.activa !== false) activas++;
            listaEstadosMaquinas.push({ nombre: `Unidad 0${i}`, activa: data.activa !== false, nota: data.nota || "Operativa" });
        }
        document.getElementById('val-foto-maquinas').innerText = `${activas}/7 Online`;
    });

    onSnapshot(collection(db, "stock"), (snap) => {
        listaGlobalFaltantes = [];
        snap.forEach(doc => {
            const item = doc.data();
            if (Number(item.cantidad) <= STOCK_SEGURIDAD) {
                listaGlobalFaltantes.push({ nombre: item.nombre, cantidad: item.cantidad, esNegativo: item.cantidad < 0 });
            }
        });
        document.getElementById('val-apuntes-stock').innerText = listaGlobalFaltantes.length;
    });
}

// --- RENDERIZADO ---
function renderizarDetalleApuntes() {
    const contenedor = document.getElementById('cuerpoDetalleApuntes');
    contenedor.innerHTML = `
        <div class="detalle-item"><span>💵 Efectivo</span> <strong>$ ${cajaApuntes.efectivo.toLocaleString()}</strong></div>
        <div class="detalle-item"><span>💳 Transferencia</span> <strong>$ ${cajaApuntes.transferencia.toLocaleString()}</strong></div>
        <div class="detalle-item" style="border:none; font-size:1.2rem; color:var(--primary);"><span>TOTAL</span> <strong>$ ${cajaApuntes.total.toLocaleString()}</strong></div>
    `;
}

function renderizarDetalleFoto() {
    const contenedor = document.getElementById('cuerpoDetalleFoto');
    contenedor.innerHTML = `
        <small>DESGLOSE PAGOS</small>
        <div class="detalle-item"><span>Efectivo</span> <strong>$ ${cajaFoto.efectivo.toLocaleString()}</strong></div>
        <div class="detalle-item"><span>Transf.</span> <strong>$ ${cajaFoto.transferencia.toLocaleString()}</strong></div>
        <hr>
        <small>DESGLOSE PRODUCTOS</small>
        <div class="detalle-item"><span>Venta Stock</span> <strong>$ ${cajaFoto.stock.toLocaleString()}</strong></div>
        <div class="detalle-item"><span>Copia Rápida</span> <strong>$ ${cajaFoto.rapida.toLocaleString()}</strong></div>
        <div class="detalle-item" style="border:none; font-size:1.2rem; color:var(--primary);"><span>TOTAL</span> <strong>$ ${cajaFoto.total.toLocaleString()}</strong></div>
    `;
}

// --- FUNCIÓN DE IMPRESIÓN ---
function imprimirTicket(titulo, idContenedor) {
    const contenido = document.getElementById(idContenedor).innerHTML;
    const fechaHora = new Date().toLocaleString('es-AR');
    const ventana = window.open('', '', 'height=600,width=400');
    
    ventana.document.write(`
        <html>
            <head>
                <style>
                    body { font-family: 'Courier New', monospace; padding: 20px; font-size: 14px; }
                    .detalle-item { display: flex; justify-content: space-between; margin-bottom: 8px; border-bottom: 1px dashed #ccc; }
                    .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 10px; }
                    .footer { margin-top: 30px; text-align: center; font-size: 12px; border-top: 1px solid #000; padding-top: 10px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <strong>FOTOCOP-ECONO</strong><br>${titulo}<br><small>${fechaHora}</small>
                </div>
                ${contenido}
                <div class="footer">
                    <p>Operador: ${usuarioActual}</p>
                    <p>__________________________<br>Firma Responsable</p>
                </div>
            </body>
        </html>
    `);
    ventana.document.close();
    setTimeout(() => { ventana.print(); ventana.close(); }, 500);
}

function renderizarListaFaltantes() {
    const listaUI = document.getElementById('listaFaltantes');
    listaUI.innerHTML = "";
    listaGlobalFaltantes.sort((a, b) => a.cantidad - b.cantidad).forEach(item => {
        const li = document.createElement('li');
        li.className = "detalle-item";
        li.style.background = item.esNegativo ? "#fff5f5" : "#fffbeb";
        li.innerHTML = `<span>${item.nombre}</span> <strong style="color:${item.esNegativo ? 'red' : 'orange'}">${item.cantidad} u.</strong>`;
        listaUI.appendChild(li);
    });
}

function renderizarListaMaquinas() {
    const contenedor = document.getElementById('listaMaquinasEstado');
    contenedor.innerHTML = "";
    listaEstadosMaquinas.forEach(maq => {
        const item = document.createElement('div');
        item.className = "detalle-item";
        item.style.background = maq.activa ? "#f0fff4" : "#fff5f5";
        item.innerHTML = `<div><strong>${maq.nombre}</strong><br><small>${maq.nota}</small></div><span style="color:${maq.activa ? 'green' : 'red'}">${maq.activa ? 'OK' : 'ERROR'}</span>`;
        contenedor.appendChild(item);
    });
}