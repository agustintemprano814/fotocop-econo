/**
 * @file stock.js
 * @description Gestión de inventario con soporte para lector de barras y exportación.
 */
import { db } from './firebase-config.js';
import { 
    collection, doc, getDoc, getDocs, setDoc, addDoc, 
    query, orderBy, limit, onSnapshot, serverTimestamp, writeBatch 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { cargarSidebar } from './sidebar.js';
import { verificarAcceso, sanitizar } from './security.js';

let userMail = "";

// --- INICIO Y SEGURIDAD ---
verificarAcceso(['supervisor-apuntes', 'adm-eco', 'superusuario']).then(info => {
    userMail = info.user.email;
    cargarSidebar('stock');
    escucharCambios();
    
    // Mostrar herramientas administrativas si es superusuario
    if(info.rol === 'superusuario') {
        const zonaSuper = document.getElementById('zonaSuper');
        if (zonaSuper) zonaSuper.style.display = 'flex';
        vincularEventosAdmin();
    }
    
    configurarFormulario();
});

// --- LÓGICA DEL FORMULARIO ---
function configurarFormulario() {
    const form = document.getElementById('formStock');
    const inputCodigo = document.getElementById('codigoBarras');

    // Búsqueda automática al escanear
    inputCodigo.addEventListener('change', async () => {
        const code = inputCodigo.value.trim();
        if (!code) return;
        
        try {
            const docSnap = await getDoc(doc(db, "stock", code));
            if (docSnap.exists()) {
                const data = docSnap.data();
                document.getElementById('nombreMaterial').value = data.nombre;
                document.getElementById('precio').value = data.precio;
                document.getElementById('cantidadStock').value = data.cantidad;
            } else {
                // Limpiar campos para nuevo registro
                document.getElementById('nombreMaterial').value = "";
                document.getElementById('precio').value = "";
                document.getElementById('cantidadStock').value = 0;
            }
        } catch (e) {
            console.error("Error al buscar código:", e);
        }
    });

    // Guardar o Actualizar Stock
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const code = sanitizar(inputCodigo.value.trim());
        const nombre = sanitizar(document.getElementById('nombreMaterial').value);
        const precio = parseFloat(document.getElementById('precio').value);
        const ajuste = parseInt(document.getElementById('ajusteStock').value);
        const stockActual = parseInt(document.getElementById('cantidadStock').value);

        if (!code) return alert("Escanee o ingrese un código");

        try {
            const nuevoStock = stockActual + ajuste;
            
            // 1. Actualizar el material en 'stock'
            await setDoc(doc(db, "stock", code), {
                nombre, 
                precio, 
                cantidad: nuevoStock, 
                ultimaMod: serverTimestamp()
            }, { merge: true });

            // 2. Registrar el movimiento en el historial
            await addDoc(collection(db, "movimientos_stock"), {
                codigo: code, 
                nombre, 
                ajuste, 
                operador: userMail, 
                fecha: serverTimestamp()
            });

            alert("✅ Stock actualizado correctamente");
            form.reset();
            inputCodigo.focus();
        } catch (err) { 
            console.error("Error al guardar stock:", err);
            alert("Error al guardar los cambios"); 
        }
    });
}

// --- ESCUCHA DE CAMBIOS (Tiempo Real) ---
function escucharCambios() {
    // Contador total de artículos
    onSnapshot(collection(db, "stock"), (snap) => {
        document.getElementById('totalArticulos').innerText = snap.size;
    });

    // Historial de movimientos (últimos 50)
    const q = query(collection(db, "movimientos_stock"), orderBy("fecha", "desc"), limit(50));
    onSnapshot(q, (snapshot) => {
        const tbody = document.getElementById('tablaHistorial');
        tbody.innerHTML = "";
        
        snapshot.forEach(docSnap => {
            const mov = docSnap.data();
            const fechaTxt = mov.fecha ? mov.fecha.toDate().toLocaleString('es-AR') : "...";
            const row = document.createElement('tr');
            
            row.innerHTML = `
                <td><small>${fechaTxt}</small></td>
                <td><small>${mov.codigo}</small></td>
                <td>${mov.nombre}</td>
                <td style="color: ${mov.ajuste >= 0 ? 'green' : 'red'}">
                    <b>${mov.ajuste >= 0 ? '+' : ''}${mov.ajuste}</b>
                </td>
                <td>${mov.operador.split('@')[0]}</td>
            `;
            tbody.appendChild(row);
        });

        // Actualizar KPI de último movimiento
        if (!snapshot.empty) {
            const last = snapshot.docs[0].data();
            document.getElementById('lastMove').innerText = last.nombre;
        }
    });
}

// --- HERRAMIENTAS DE ADMINISTRADOR ---
function vincularEventosAdmin() {
    // Exportación a CSV
    document.getElementById('btnExportar').addEventListener('click', async () => {
        try {
            const snap = await getDocs(collection(db, "stock"));
            let csv = "Codigo,Materia,Precio,Stock Disponible\n";
            snap.forEach(d => {
                const i = d.data();
                csv += `${d.id},${i.nombre},${i.precio},${i.cantidad}\n`;
            });
            
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.setAttribute("download", `Inventario_${new Date().toLocaleDateString()}.csv`);
            link.click();
        } catch (e) {
            alert("Error al exportar");
        }
    });

    // Reset de Base de Datos
    document.getElementById('btnBorrarTodo').addEventListener('click', async () => {
        if (!confirm("🚨 ATENCIÓN: ¿Está seguro de borrar TODO el inventario? Esta acción no se puede deshacer.")) return;
        if (prompt("Escriba 'BORRAR TODO' para confirmar:") !== "BORRAR TODO") return;

        try {
            const snap = await getDocs(collection(db, "stock"));
            const batch = writeBatch(db);
            snap.forEach(d => batch.delete(d.ref));
            await batch.commit();
            alert("✨ Inventario reseteado con éxito.");
        } catch (e) { 
            alert("Error de permisos: No se pudo completar la operación."); 
        }
    });
}