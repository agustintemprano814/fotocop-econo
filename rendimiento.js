/**
 * @file rendimiento.js
 * @description Dashboard de analítica técnica y alertas de mantenimiento (CSP Safe).
 */
import { db, auth } from './firebase-config.js';
import { collection, query, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { verificarAcceso } from './security.js';
import { cargarSidebar } from './sidebar.js';

// Variables globales de estado
let costoPasadaInsumo = 1;
let precioVentaDobleFaz = 1;
let limiteMantenimiento = 50000;
let chartUtil, chartDist;

// --- INICIO Y SEGURIDAD ---
verificarAcceso(['administrador', 'superusuario', 'adm-eco']).then(() => {
    cargarSidebar('rendimiento');
    inicializarFechas();
    vincularEventos();
    inicializarDatos();
}).catch(err => {
    console.error("Acceso denegado:", err);
    window.location.href = "index.html";
});

function inicializarFechas() {
    const hoyStr = new Date().toISOString().split('T')[0];
    document.getElementById('fechaHasta').value = hoyStr;
    document.getElementById('fechaDesde').value = hoyStr; 
}

function vincularEventos() {
    document.getElementById('btnFiltrar').addEventListener('click', ejecutarAnalisis);
}

// --- CARGA DE CONFIGURACIÓN ---
async function inicializarDatos() {
    try {
        const snapConf = await getDoc(doc(db, "configuracion", "global"));
        if (snapConf.exists()) {
            const data = snapConf.data();
            costoPasadaInsumo = Number(data.costo_pasada) || 1;
            precioVentaDobleFaz = Number(data.doble_faz) || 1;
            limiteMantenimiento = Number(data.limite_mantenimiento) || 50000;
        }
        ejecutarAnalisis();
    } catch (e) { 
        console.error("Error cargando configuración global:", e); 
        ejecutarAnalisis();
    }
}

// --- LÓGICA DE ANÁLISIS ---
async function ejecutarAnalisis() {
    const desdeStr = document.getElementById('fechaDesde').value;
    const hastaStr = document.getElementById('fechaHasta').value;
    if (!desdeStr || !hastaStr) return;

    const desde = new Date(desdeStr + "T00:00:00");
    const hasta = new Date(hastaStr + "T23:59:59");
    const maquinaFiltro = document.getElementById('filtroMaquina').value;

    try {
        // Carga paralela de colecciones para mejorar velocidad
        const [snapL, snapNC, snapI] = await Promise.all([
            getDocs(collection(db, "lecturas_maquinas")),
            getDocs(collection(db, "no_cobradas")),
            getDocs(collection(db, "insumos"))
        ]);

        let totalConsumoBruto = 0, totalNoCobradasPesos = 0, totalHojasCompradas = 0;
        let dataPorMaquina = {};
        let todasLasLecturas = []; 

        // 1. Procesar Lecturas (Contadores)
        snapL.forEach(docSnap => {
            const d = docSnap.data();
            const fechaDoc = d.fecha?.toDate ? d.fecha.toDate() : new Date(d.fecha);
            todasLasLecturas.push({ maquina: d.maquina, consumo: parseFloat(d.consumo) || 0, fecha: fechaDoc });

            if (fechaDoc >= desde && fechaDoc <= hasta) {
                if (maquinaFiltro === "todas" || d.maquina === maquinaFiltro) {
                    const cons = parseFloat(d.consumo) || 0;
                    totalConsumoBruto += cons;
                    dataPorMaquina[d.maquina] = (dataPorMaquina[d.maquina] || 0) + cons;
                }
            }
        });

        // 2. Procesar No Cobradas
        snapNC.forEach(docSnap => {
            const d = docSnap.data();
            const fechaNC = d.fecha?.toDate ? d.fecha.toDate() : new Date(d.fecha);
            if (fechaNC >= desde && fechaNC <= hasta) {
                totalNoCobradasPesos += (Number(d.cece) || 0) + (Number(d.descartes) || 0) + (Number(d.copias_originales) || 0);
            }
        });

        // 3. Procesar Eficiencia (Papel)
        snapI.forEach(docSnap => {
            const d = docSnap.data();
            const fechaI = d.fecha?.toDate ? d.fecha.toDate() : new Date(d.fecha);
            if (fechaI >= desde && fechaI <= hasta && d.categoria === "papel") {
                totalHojasCompradas += (Number(d.cantidad) || 0) * 500;
            }
        });

        // Cálculos Finales
        const cantNoCobradas = totalNoCobradasPesos / precioVentaDobleFaz;
        const prodNeta = totalConsumoBruto - cantNoCobradas;
        const prodHojas = prodNeta / 2;
        const eficiencia = totalHojasCompradas > 0 ? (prodHojas / totalHojasCompradas) * 100 : 0;

        // Actualizar Interfaz
        document.getElementById('kpiBruta').innerText = Math.round(totalConsumoBruto).toLocaleString();
        document.getElementById('kpiProdNeta').innerText = Math.round(prodNeta).toLocaleString();
        document.getElementById('kpiIngresoTeorico').innerText = `$ ${Math.round(prodNeta * precioVentaDobleFaz).toLocaleString()}`;
        document.getElementById('kpiEficiencia').innerText = `${eficiencia.toFixed(1)}%`;
        document.getElementById('kpiCostoReal').innerText = `$ ${Math.round(totalConsumoBruto * costoPasadaInsumo).toLocaleString()}`;
        document.getElementById('kpiHojas').innerText = Math.round(prodHojas).toLocaleString();

        renderizarGraficos(dataPorMaquina);
        generarAlertasMantenimiento(todasLasLecturas, snapI);

    } catch (err) {
        console.error("Error en análisis técnico:", err);
    }
}

// --- ALERTAS DE MANTENIMIENTO ---
function generarAlertasMantenimiento(todasLasLecturas, snapInsumos) {
    const container = document.getElementById('contenedorAlertas');
    const titulo = document.getElementById('tituloAlertas');
    container.innerHTML = "";
    let hayAlertas = false;

    // Obtener fecha del último service por máquina
    let ultimosServices = {};
    snapInsumos.forEach(docSnap => {
        const d = docSnap.data();
        if (d.categoria === "mantenimiento" && d.maquina) {
            const fecha = d.fecha?.toDate ? d.fecha.toDate() : new Date(d.fecha);
            if (!ultimosServices[d.maquina] || fecha > ultimosServices[d.maquina]) {
                ultimosServices[d.maquina] = fecha;
            }
        }
    });

    // Calcular desgaste acumulado desde el último service
    const listaMaquinas = ["M1", "M2", "M3", "M4", "M5", "M6", "M7"];
    listaMaquinas.forEach(maq => {
        const fechaCorte = ultimosServices[maq] || new Date(0);
        const acumulado = todasLasLecturas
            .filter(l => l.maquina === maq && l.fecha > fechaCorte)
            .reduce((acc, curr) => acc + curr.consumo, 0);

        if (acumulado >= (limiteMantenimiento * 0.85)) {
            hayAlertas = true;
            const resto = limiteMantenimiento - acumulado;
            const card = document.createElement('div');
            card.className = "alert-card";
            card.style.borderLeftColor = resto <= 0 ? '#e74c3c' : '#f39c12';
            card.innerHTML = `
                <div>
                    <strong>${maq}</strong>: Mantenimiento Preventivo Necesario<br>
                    <small>Ciclo: ${Math.round(acumulado).toLocaleString()} / ${limiteMantenimiento.toLocaleString()}</small>
                </div>
                <span style="font-weight:bold">${resto <= 0 ? 'VENCIDO' : 'Faltan ' + Math.round(resto).toLocaleString()}</span>
            `;
            container.appendChild(card);
        }
    });

    titulo.style.display = hayAlertas ? 'block' : 'none';
}

// --- GRÁFICOS ---
function renderizarGraficos(dict) {
    if (chartUtil) chartUtil.destroy();
    if (chartDist) chartDist.destroy();

    const labels = Object.keys(dict).sort();
    const values = labels.map(l => dict[l]);

    chartUtil = new Chart(document.getElementById('chartUtilizacion'), {
        type: 'bar',
        data: { labels, datasets: [{ label: 'Copias Brutas', data: values, backgroundColor: '#2c3e50' }] },
        options: { responsive: true, maintainAspectRatio: false }
    });

    chartDist = new Chart(document.getElementById('chartDistribucion'), {
        type: 'pie',
        data: { labels, datasets: [{ data: values, backgroundColor: ['#a4155b', '#2c3e50', '#7f8c8d', '#e74c3c', '#28a745', '#f1c40f', '#3498db'] }] },
        options: { responsive: true, maintainAspectRatio: false }
    });
}