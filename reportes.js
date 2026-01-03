/**
 * @file reportes.js
 * @description Lógica de exportación a Excel con optimización de caché de parámetros para ahorro de cuota.
 */
import { db } from './firebase-config.js';
import { collection, query, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { cargarSidebar } from './sidebar.js';
import { verificarAcceso } from './security.js';


let cacheReportes = {
    btn_export_cierres: "",
    btn_export_tecnico: "",
    btn_export_ventas: "",
    btn_export_stock: ""
};

verificarAcceso(['adm-eco', 'superusuario']).then(() => {
    cargarSidebar('reportes');
    inicializarFiltros();
    vincularEventos();
}).catch(err => {
    console.error("Acceso denegado:", err);
    window.location.href = "index.html";
});

function inicializarFiltros() {
    const hoy = new Date();
    document.getElementById('selectMes').value = hoy.getMonth();
    document.getElementById('selectAnio').value = hoy.getFullYear();
}

function vincularEventos() {
    document.getElementById('btn-export-cierres').addEventListener('click', (e) => {
        exportar('cierres_diarios', 'Auditoria_Cajas', e.currentTarget);
    });
    
    document.getElementById('btn-export-tecnico').addEventListener('click', (e) => {
        exportar('cierres_diarios', 'Consumo_Tecnico_Maquinas', e.currentTarget);
    });

    document.getElementById('btn-export-ventas').addEventListener('click', (e) => {
        exportar('ventas', 'Historico_Ventas', e.currentTarget);
    });

    document.getElementById('btn-export-stock').addEventListener('click', (e) => {
        exportar('movimientos_stock', 'Auditoria_Stock', e.currentTarget);
    });
}
function aplanarObjeto(obj, prefijo = '') {
    let res = {};
    for (let k in obj) {
        let prop = prefijo ? `${prefijo}_${k}` : k;
        if (typeof obj[k] === 'object' && obj[k] !== null && !Array.isArray(obj[k]) && !(obj[k].seconds)) {
            Object.assign(res, aplanarObjeto(obj[k], prop));
        } else {
            if (obj[k] && obj[k].seconds) {
                res[prop] = new Date(obj[k].seconds * 1000).toLocaleString();
            } else {
                res[prop] = obj[k];
            }
        }
    }
    return res;
}

async function exportar(nombreColeccion, nombreArchivo, boton) {
    const mes = parseInt(document.getElementById('selectMes').value);
    const anio = parseInt(document.getElementById('selectAnio').value);
    const sectorFiltro = document.getElementById('selectSector').value;
    const botonId = boton.id;
    const periodoBuscado = `${anio}-${(mes + 1).toString().padStart(2, '0')}`; 
    const fingerprintActual = `${periodoBuscado}_${sectorFiltro}_${nombreColeccion}`;

    if (cacheReportes[botonId] === fingerprintActual) {
        if (!confirm("Ya generó este reporte recientemente con los mismos filtros. ¿Desea descargarlo nuevamente de Firebase?")) {
            return;
        }
    }

    boton.disabled = true;
    const textoOriginal = boton.innerText;
    boton.innerText = "⏳ Procesando...";

    try {

        const q = query(collection(db, nombreColeccion));
        const snap = await getDocs(q);
        const datosFinales = [];

        snap.forEach(docSnap => {
            const raw = docSnap.data();
            const fString = raw.fechaString || (raw.fecha && typeof raw.fecha === 'string' ? raw.fecha : "");
            const coincideFecha = fString.startsWith(periodoBuscado);
            const coincideSector = sectorFiltro === "Todos" || raw.sector === sectorFiltro;

            if (coincideFecha && coincideSector) {
                const plano = aplanarObjeto(raw);
                datosFinales.push({ ID_SISTEMA: docSnap.id, ...plano });
            }
        });

        if (datosFinales.length === 0) {
            alert(`No hay registros para ${periodoBuscado} en el sector ${sectorFiltro}.`);
        } else {
            const ws = XLSX.utils.json_to_sheet(datosFinales);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Reporte Auditoria");
            XLSX.writeFile(wb, `${nombreArchivo}_${periodoBuscado}.xlsx`);
            
            cacheReportes[botonId] = fingerprintActual;
        }
    } catch (e) {
        console.error("Error en exportación:", e);
        alert("Ocurrió un error al generar el reporte.");
    } finally {
        boton.disabled = false;
        boton.innerText = textoOriginal;
    }
}