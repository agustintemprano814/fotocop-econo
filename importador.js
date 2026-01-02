/**
 * @file importador.js
 * @description Lógica de procesamiento masivo de Excel con seguridad CSP, auditoría y descarga de plantillas.
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
const btnDescargarPlantilla = document.getElementById('btnDescargarPlantilla');
const btnDescargarManual = document.getElementById('btnDescargarManual');

// --- SEGURIDAD Y ACCESO ---
verificarAcceso(['superusuario']).then(() => {
    cargarSidebar('admin');
    inicializarManejadores();
}).catch(err => {
    console.error("Acceso denegado:", err);
    window.location.href = "inicio.html";
});

function inicializarManejadores() {
    // 1. Manejo de Drag & Drop y Carga de Archivos
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

    // 2. Botón de Limpieza de Base de Datos
    btnLimpiar.addEventListener('click', limpiarBaseDeDatos);

    // 3. Botones de Recursos para Administradores (NUEVOS)
    btnDescargarPlantilla.addEventListener('click', generarPlantillaExcel);
    btnDescargarManual.addEventListener('click', mostrarManual);
}

// --- RECURSOS PARA ADMINISTRADORES ---

/**
 * Genera una plantilla Excel dinámica basada en la estructura requerida por el sistema.
 */
function generarPlantillaExcel() {
    const encabezados = [
        ["Fecha", "M1 Inicio", "M1 Cierre", "M2 Inicio", "M2 Cierre", "M3 Inicio", "M3 Cierre", "M4 Inicio", "M4 Cierre", "M5 Inicio", "M5 Cierre", "M6 Inicio", "M6 Cierre", "M7 Inicio", "M7 Cierre", "CECE", "Stock Apuntes", "Beca Apuntes", "Internas", "Originales", "Descartes", "Descartes Tec."]
    ];
    
    // Fila de ejemplo con datos ficticios para guiar al usuario
    const ejemplo = [
        ["2026-01-01", 1000, 1150, 500, 620, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 50, 10, 5, 2, 1, 3, 0]
    ];

    const dataFinal = encabezados.concat(ejemplo);
    const ws = XLSX.utils.aoa_to_sheet(dataFinal);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Plantilla_Estandar");

    // Descargar el archivo XLSX
    XLSX.writeFile(wb, "Plantilla_Importacion_Fotocop_Econo.xlsx");
}

function mostrarManual() {
    alert(
        "📚 MANUAL DE COLUMNAS (IMPORTACIÓN):\n\n" +
        "• Col 0 (Fecha): Formato AAAA-MM-DD o Fecha de Excel.\n" +
        "• Cols 1-14: Lecturas pares (Inicio/Cierre) para Máquinas 1 a 7.\n" +
        "• Cols 15-21: Cantidad de hojas no cobradas según su categoría.\n\n" +
        "IMPORTANTE: No cambie el orden de las columnas ni los nombres de los encabezados."
    );
}

// --- LÓGICA DE PROCESAMIENTO ---

async function procesarExcel(file) {
    statusCard.style.display = 'block';
    logArea.innerHTML = "<div>🚀 Iniciando lectura de archivo...</div>";
    
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

            const datos = rows.slice(1); // Omitimos la fila de encabezados
            let procesados = 0;

            for (const fila of datos) {
                if (!fila[0]) continue; // Saltar filas sin fecha

                const fechaStr = formatFecha(fila[0]);
                const batch = writeBatch(db);

                // Importar Lecturas de las 7 máquinas
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
                        importadoPor: auth.currentUser.email,
                        timestamp: new Date()
                    });
                }

                // Importar No Cobrados
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
                    importadoPor: auth.currentUser.email,
                    timestamp: new Date()
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
    entry.textContent = `[${fecha}] Procesado OK`;
    logArea.appendChild(entry);
    logArea.scrollTop = logArea.scrollHeight;
}

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
        alert("Error de permisos.");
        btnLimpiar.innerText = "🗑️ Borrar todos los datos importados";
        btnLimpiar.disabled = false;
    }
}