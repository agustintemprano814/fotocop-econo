/**
 * @file importador.js
 * @description Lógica de procesamiento masivo de Excel con seguridad CSP y auditoría.
 */
import { db, auth } from './firebase-config.js';
import { collection, doc, writeBatch, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { verificarAcceso } from './security.js';
import { cargarSidebar } from './sidebar.js';

// Referencias al DOM
const fileInput = document.getElementById('fileInput');
const dropZone = document.getElementById('dropZone');
const logArea = document.getElementById('logArea');
const btnLimpiar = document.getElementById('btnLimpiarBD');
const statusCard = document.getElementById('statusCard');
const progressBar = document.getElementById('progressBar');
const statusText = document.getElementById('statusText');

// --- SEGURIDAD Y ACCESO ---
verificarAcceso(['superusuario']).then(() => {
    cargarSidebar('admin');
    inicializarManejadores();
}).catch(err => {
    console.error("Acceso denegado:", err);
    window.location.href = "inicio.html";
});

function inicializarManejadores() {
    // 1. Manejo de Drag & Drop
    dropZone.addEventListener('click', () => fileInput.click());
    
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file) procesarExcel(file);
    });

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) procesarExcel(file);
    });

    // 2. Botón de Limpieza
    btnLimpiar.addEventListener('click', limpiarBaseDeDatos);
}

// --- LÓGICA DE PROCESAMIENTO ---
async function procesarExcel(file) {
    statusCard.style.display = 'block';
    logArea.innerHTML = "<div>🚀 Iniciando lectura de archivo...</div>";
    
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            // Uso de librería XLSX global (autorizada en head)
            const workbook = XLSX.read(data, { type: 'array' });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

            const datos = rows.slice(1); // Omitimos encabezados
            let procesados = 0;

            for (const fila of datos) {
                if (!fila[0]) continue; // Salta filas vacías

                const fechaStr = formatFecha(fila[0]);
                const batch = writeBatch(db);

                // Importar Lecturas de 7 máquinas (columnas 1-14)
                for (let i = 1; i <= 7; i++) {
                    const colIni = (i * 2) - 1;
                    const colCie = (i * 2);
                    const valIni = Number(fila[colIni]) || 0;
                    const valCie = Number(fila[colCie]) || 0;

                    const docRef = doc(db, "lecturas_maquinas", `${fechaStr}_M${i}`);
                    batch.set(docRef, {
                        fecha: fechaStr,
                        maquina: `M${i}`,
                        contador_inicio: valIni,
                        contador_cierre: valCie,
                        consumo: valCie - valIni,
                        importadoPor: auth.currentUser.email
                    });
                }

                // Importar No Cobrados (columnas 15-21)
                const docNoCobrados = doc(db, "no_cobradas", fechaStr);
                batch.set(docNoCobrados, {
                    fecha: fechaStr,
                    cece: Number(fila[15]) || 0,
                    stock_apuntes: Number(fila[16]) || 0,
                    beca_apuntes: Number(fila[17]) || 0,
                    copias_internas_becados: Number(fila[18]) || 0,
                    copias_originales: Number(fila[19]) || 0,
                    descartes: Number(fila[20]) || 0,
                    descartes_tecnicos: Number(fila[21]) || 0,
                    importadoPor: auth.currentUser.email
                });

                await batch.commit();
                procesados++;
                actualizarProgreso(procesados, datos.length, fechaStr);
            }
            alert("✅ Importación completada con éxito.");
        } catch (err) {
            console.error("Error procesando Excel:", err);
            logArea.innerHTML += `<div style="color:red">❌ ERROR: ${err.message}</div>`;
        }
    };
    reader.readAsArrayBuffer(file);
}

function formatFecha(excelDate) {
    // Si Excel envía la fecha como número de serie
    if (!isNaN(excelDate) && excelDate > 40000) {
        const date = new Date((excelDate - 25569) * 86400 * 1000);
        return date.toISOString().split('T')[0];
    }
    return String(excelDate); 
}

function actualizarProgreso(actual, total, fecha) {
    const porcentaje = Math.round((actual / total) * 100);
    progressBar.style.width = porcentaje + '%';
    statusText.innerText = `Procesando: ${porcentaje}% (${actual}/${total})`;
    
    const entry = document.createElement('div');
    entry.textContent = `[${fecha}] Registro procesado correctamente.`;
    logArea.appendChild(entry);
    logArea.scrollTop = logArea.scrollHeight;
}

// --- LIMPIEZA DE DATOS ---
async function limpiarBaseDeDatos() {
    const confirmacion = confirm("⚠️ ¿ESTÁS SEGURO?\n\nSe borrarán TODAS las lecturas e importaciones anteriores. Esta acción NO se puede deshacer.");
    if (!confirmacion) return;

    btnLimpiar.innerText = "⏳ Borrando...";
    btnLimpiar.disabled = true;

    try {
        const colecciones = ["lecturas_maquinas", "no_cobradas"];
        for (const colName of colecciones) {
            const querySnapshot = await getDocs(collection(db, colName));
            const batch = writeBatch(db);
            querySnapshot.forEach((docSnap) => batch.delete(docSnap.ref));
            await batch.commit();
        }
        alert("🗑️ Base de datos purgada correctamente.");
        location.reload();
    } catch (error) {
        console.error(error);
        alert("Error de permisos: No se pudo limpiar la base de datos.");
        btnLimpiar.innerText = "🗑️ Borrar todos los datos importados";
        btnLimpiar.disabled = false;
    }
}