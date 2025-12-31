/**
 * @file inicio.js
 * @description Lógica del panel principal con vinculación de eventos segura (CSP Compliance).
 */
import { db } from './firebase-config.js';
import { collection, query, where, onSnapshot, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { cargarSidebar } from './sidebar.js';
import { verificarAcceso, renderSeguro } from './security.js';

// --- INICIALIZACIÓN Y SEGURIDAD ---
verificarAcceso().then(info => {
    cargarSidebar('inicio');
    
    // Renderizado seguro de bienvenida
    renderSeguro(document.getElementById('saludo'), `¡Hola, ${info.idProfesional}!`);
    document.getElementById('fechaHoy').innerText = new Date().toLocaleDateString('es-AR', { 
        weekday: 'long', day: 'numeric', month: 'long' 
    });

    const rol = info.rol;

    // Control de visibilidad de módulos según Rol [cite: 33, 40]
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

    // KPIs visibles para todos los operarios
    document.getElementById('kpi-apuntes-stock').style.display = 'block';
    document.getElementById('kpi-foto-maquinas').style.display = 'block';

    // Vincular eventos de navegación y UI
    configurarEventos();
    // Iniciar escucha de datos en tiempo real
    actualizarKPIs();

}).catch(err => {
    console.error("Error de acceso inicial:", err);
});

// --- MANEJADORES DE EVENTOS (Reemplazo de onclick) ---
function configurarEventos() {
    // 1. Acordeón de Módulos (Expandir/Colapsar)
    const cards = document.querySelectorAll('.module-card');
    cards.forEach(card => {
        card.addEventListener('click', () => {
            const isExpanded = card.classList.contains('expanded');
            cards.forEach(c => c.classList.remove('expanded'));
            if (!isExpanded) card.classList.add('expanded');
        });
    });

    // 2. Botón de Pánico (Modo Mantenimiento)
    const btnPanic = document.getElementById('btn-panic-action');
    if (btnPanic) {
        btnPanic.addEventListener('click', async (e) => {
            e.stopPropagation(); // Evita expandir la card
            if (confirm("⚠️ ¿Desea apagar el sistema por seguridad?")) {
                try {
                    await updateDoc(doc(db, "configuracion", "global"), { modoMantenimiento: true });
                    alert("Sistema fuera de línea.");
                    location.reload();
                } catch (e) { alert("Error de permisos."); }
            }
        });
    }

    // 3. Vinculación de navegación (Botones internos)
    const rutas = {
        'btn-nav-apuntes': 'apuntes.html',
        'btn-nav-ventas': 'ventas.html',
        'btn-nav-stock': 'stock.html',
        'btn-nav-insumos': 'insumos.html',
        'btn-nav-estado': 'estado.html',
        'btn-nav-editor': 'editor.html',
        'btn-nav-cierre-ap': 'cierre_apuntes.html',
        'btn-nav-cierre-fo': 'cierres.html',
        'btn-nav-reportes': 'reportes.html',
        'btn-nav-dash-fin': 'dashboard-financiero.html',
        'btn-nav-dash-tec': 'rendimiento.html',
        'btn-nav-usuarios': 'usuarios.html',
        'btn-nav-config': 'configuracio.html',
        'btn-nav-import': 'importador.html'
    };

    Object.entries(rutas).forEach(([id, url]) => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                window.location.href = url;
            });
        }
    });
}

// --- ESCUCHA DE DATOS EN TIEMPO REAL ---
function actualizarKPIs() {
    const hoy = new Date().toISOString().split('T')[0];

    // Caja Apuntes Hoy
    onSnapshot(query(collection(db, "ventas"), where("fecha", "==", hoy), where("sector", "==", "Apuntes")), (snap) => {
        let t = 0; 
        snap.forEach(d => t += (Number(d.data().total) || 0));
        document.getElementById('val-apuntes-caja').innerText = `$ ${t.toFixed(2)}`;
    });

    // Estado de Máquinas (Online/Offline)
    onSnapshot(collection(db, "estado_maquinas"), (snap) => {
        let activas = 0;
        snap.forEach(d => { 
            const data = d.data();
            const estado = (data.estado || '').toLowerCase();
            if (estado === 'online' || data.activa === true) activas++;
        });
        const elMaquinas = document.getElementById('val-foto-maquinas');
        if (elMaquinas) {
            elMaquinas.innerText = `${activas}/${snap.size} Online`;
            elMaquinas.style.color = (activas < snap.size) ? "var(--danger)" : "var(--dark)";
        }
    });

    // Alertas de Stock Crítico
    onSnapshot(query(collection(db, "stock"), where("cantidad", "<=", 5)), (snap) => {
        const elStock = document.getElementById('val-apuntes-stock');
        if (elStock) elStock.innerText = snap.size > 0 ? `${snap.size} CRÍTICOS` : "OK";
    });
}