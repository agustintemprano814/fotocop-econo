/**
 * @file dashboard-financiero.js
 * @description Analítica financiera con caché de parámetros para optimización de costos.
 */
import { db } from './firebase-config.js';
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { verificarAcceso } from './security.js';
import { cargarSidebar } from './sidebar.js';

let chartEvolucion, chartPagos;

let ultimaBusqueda = {
    desde: "",
    hasta: "",
    sector: ""
};

verificarAcceso(['adm-eco', 'superusuario']).then(() => {
    cargarSidebar('reportes'); 
    inicializarFechas();
    vincularEventos();
    cargarDashboard(); 
}).catch(err => {
    console.error("Acceso denegado:", err);
    window.location.href = "index.html";
});

function inicializarFechas() {
    const hoy = new Date();
    document.getElementById('fechaHasta').value = hoy.toISOString().split('T')[0];
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    document.getElementById('fechaDesde').value = inicioMes.toISOString().split('T')[0];
}

function vincularEventos() {
    document.getElementById('btnFiltrar').addEventListener('click', cargarDashboard);
}

async function cargarDashboard() {
    const desde = document.getElementById('fechaDesde').value;
    const hasta = document.getElementById('fechaHasta').value;
    const sector = document.getElementById('filtroSector').value;
    const btn = document.getElementById('btnFiltrar');

    if (!desde || !hasta) return;

    if (desde === ultimaBusqueda.desde && 
        hasta === ultimaBusqueda.hasta && 
        sector === ultimaBusqueda.sector) {
        console.log("⚡ Optimización: Parámetros idénticos. No se requiere nueva consulta a Firebase.");

        btn.innerText = "✅ DATOS AL DÍA";
        setTimeout(() => btn.innerText = "🔍 ACTUALIZAR", 2000);
        return; 
    }

    try {
        btn.disabled = true;
        btn.innerText = "⏳ PROCESANDO...";

        const qVentas = query(
            collection(db, "ventas"), 
            where("fecha", ">=", desde), 
            where("fecha", "<=", hasta)
        );
        const snapVentas = await getDocs(qVentas);

        const qCierres = query(
            collection(db, "cierres_diarios"), 
            where("fechaString", ">=", desde), 
            where("fechaString", "<=", hasta)
        );
        const snapCierres = await getDocs(qCierres);

        ultimaBusqueda = { desde, hasta, sector };

        procesarDatos(snapVentas, snapCierres, sector);
        
    } catch (err) {
        console.error("Error en Dashboard:", err);
        alert("Error al conectar con la base de datos.");
    } finally {
        btn.disabled = false;
        btn.innerText = "🔍 ACTUALIZAR";
    }
}

function procesarDatos(snapVentas, snapCierres, sectorFiltro) {
    let recaudacion = 0;
    let gastos = 0;
    let diferencia = 0;
    let efectivo = 0;
    let transferencia = 0;
    const ventasPorDia = {};

    snapVentas.forEach(doc => {
        const data = doc.data();
        if (sectorFiltro !== 'todos' && data.sector !== sectorFiltro) return;

        const total = Number(data.total) || 0;
        recaudacion += total;

        const metodo = (data.metodoPago || '').toLowerCase();
        if (metodo === 'efectivo') efectivo += total;
        else transferencia += total;

        ventasPorDia[data.fecha] = (ventasPorDia[data.fecha] || 0) + total;
    });

    snapCierres.forEach(doc => {
        const data = doc.data();
        if (sectorFiltro !== 'todos' && data.sector !== sectorFiltro) return;

        const g = data.caja?.gastos || data.gastos || 0;
        gastos += Number(g);

        const d = data.caja?.diferencia || data.diferencia || 0;
        diferencia += Number(d);
    });

    document.getElementById('kpiRecaudacion').innerText = `$ ${recaudacion.toLocaleString('es-AR', {minimumFractionDigits: 2})}`;
    document.getElementById('kpiGastos').innerText = `$ ${gastos.toLocaleString('es-AR', {minimumFractionDigits: 2})}`;
    document.getElementById('kpiNeto').innerText = `$ ${(recaudacion - gastos).toLocaleString('es-AR', {minimumFractionDigits: 2})}`;
    
    const elDif = document.getElementById('kpiDiferencia');
    elDif.innerText = `$ ${diferencia.toLocaleString('es-AR', {minimumFractionDigits: 2})}`;
    elDif.style.color = diferencia < 0 ? "var(--danger)" : "var(--success)";

    renderizarGraficos(ventasPorDia, efectivo, transferencia);
}

function renderizarGraficos(ventasPorDia, efectivo, transferencia) {
    if (chartEvolucion) chartEvolucion.destroy();
    if (chartPagos) chartPagos.destroy();

    const labels = Object.keys(ventasPorDia).sort();
    const values = labels.map(l => ventasPorDia[l]);

    chartEvolucion = new Chart(document.getElementById('chartEvolucion'), {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Ventas ($)',
                data: values,
                borderColor: '#a4155b',
                backgroundColor: 'rgba(164, 21, 91, 0.1)',
                fill: true,
                tension: 0.4
            }]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true } }
        }
    });

    chartPagos = new Chart(document.getElementById('chartPagos'), {
        type: 'doughnut',
        data: {
            labels: ['Efectivo', 'Transferencia'],
            datasets: [{
                data: [efectivo, transferencia],
                backgroundColor: ['#28a745', '#3b82f6'],
                hoverOffset: 4
            }]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom' } }
        }
    });
}