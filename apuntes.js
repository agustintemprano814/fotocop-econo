/**
 * @file apuntes.js
 * @description Lógica del Sector Apuntes con soporte para lector de barras y CSP.
 */
import { db } from './firebase-config.js';
import { collection, addDoc, getDocs, getDoc, doc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { cargarSidebar } from './sidebar.js';
import { verificarAcceso, sanitizar, renderSeguro } from './security.js';

// Estado de la aplicación
let nombreOperador = "";
let metodoPagoActivo = "Efectivo";
let carrito = [];
let stockPrecios = {};
let acumuladoTurno = 0;

// Referencias al DOM
const scanInput = document.getElementById('scanInput');
const busquedaMaterial = document.getElementById('busquedaMaterial');
const montoInput = document.getElementById('monto');
const cantidadInput = document.getElementById('cantidad');
const btnAgregar = document.getElementById('btnAgregar');
const btnVender = document.getElementById('btnVender');
const itemsCarrito = document.getElementById('itemsCarrito');
const totalVentaLabel = document.getElementById('totalVenta');
const totalTurnoLabel = document.getElementById('totalTurno');

// --- INICIO Y SEGURIDAD ---
verificarAcceso(['operario-apuntes', 'supervisor-apuntes', 'adm-eco', 'superusuario']).then(info => {
    cargarSidebar('apuntes');
    nombreOperador = info.nombreReal || info.userData?.nombre || info.user.email.split('@')[0];
    renderSeguro(document.getElementById('displayOperador'), nombreOperador);
    
    cargarDatalist();
    configurarEventos();
});

// --- LÓGICA DE DATOS ---
async function cargarDatalist() {
    try {
        const snap = await getDocs(collection(db, "stock"));
        const dl = document.getElementById('listaMateriales');
        dl.innerHTML = ""; 
        
        snap.forEach(d => {
            const data = d.data();
            // Guardamos el precio asociado al nombre para búsqueda manual rápida
            stockPrecios[data.nombre] = data.precio;
            const opt = document.createElement('option');
            opt.value = data.nombre;
            dl.appendChild(opt);
        });
    } catch (e) {
        console.error("Error cargando materiales:", e);
    }
}

// --- CONFIGURACIÓN DE EVENTOS ---
function configurarEventos() {
    // 1. Lector de Barras
    scanInput.addEventListener('change', async () => {
        const codigo = scanInput.value.trim();
        if(!codigo) return;
        
        try {
            const docSnap = await getDoc(doc(db, "stock", codigo));
            if (docSnap.exists()) {
                const data = docSnap.data();
                agregarAlCarrito(data.nombre, 1, data.precio);
                scanInput.value = "";
            } else {
                alert("Código no encontrado");
                scanInput.value = "";
            }
        } catch (e) { 
            console.error("Error en escaneo:", e);
        }
    });

    // 2. Búsqueda Manual (Actualiza precio al seleccionar)
    busquedaMaterial.addEventListener('input', (e) => {
        const precio = stockPrecios[e.target.value];
        montoInput.value = precio ? precio : "";
    });

    // 3. Botón Añadir Manual
    btnAgregar.addEventListener('click', () => {
        const material = busquedaMaterial.value;
        const cant = parseInt(cantidadInput.value);
        const precio = parseFloat(montoInput.value);
        
        if (!material || !precio) return alert("Seleccione un material válido de la lista");
        
        agregarAlCarrito(material, cant, precio);
        
        // Limpiar campos manuales
        busquedaMaterial.value = "";
        montoInput.value = "";
        cantidadInput.value = "1";
    });

    // 4. Selección de Pago
    document.querySelectorAll('.pay-card').forEach(card => {
        card.addEventListener('click', () => {
            metodoPagoActivo = card.getAttribute('data-metodo');
            document.querySelectorAll('.pay-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
        });
    });

    // 5. Confirmar Venta
    btnVender.addEventListener('click', ejecutarVenta);
}

// --- GESTIÓN DEL CARRITO ---
function agregarAlCarrito(material, cant, precioUni) {
    carrito.push({ 
        material: sanitizar(material), 
        cant, 
        subtotal: cant * precioUni 
    });
    renderizarCarrito();
}

function renderizarCarrito() {
    itemsCarrito.innerHTML = "";
    let total = 0;

    if(carrito.length === 0) {
        itemsCarrito.innerHTML = `<p style="color: var(--gray); font-style: italic; font-size: 0.8rem;">El carrito está vacío</p>`;
    } else {
        carrito.forEach((item, index) => {
            total += item.subtotal;
            const div = document.createElement('div');
            div.className = 'item-carrito';
            div.innerHTML = `
                <button class="btn-borrar" data-index="${index}" title="Eliminar">🗑</button>
                <div class="item-info">
                    <strong>${item.cant}x</strong> ${item.material}
                </div>
                <div style="font-weight: 600; font-size: 0.85rem;">$ ${item.subtotal.toFixed(2)}</div>
            `;
            
            // Evento borrar item
            div.querySelector('.btn-borrar').addEventListener('click', (e) => {
                const idx = e.target.getAttribute('data-index');
                carrito.splice(idx, 1);
                renderizarCarrito();
            });
            
            itemsCarrito.appendChild(div);
        });
    }

    totalVentaLabel.innerText = `$ ${total.toFixed(2)}`;
    btnVender.disabled = carrito.length === 0;
}

// --- FINALIZAR PROCESO ---
async function ejecutarVenta() {
    btnVender.disabled = true;
    const originalText = btnVender.innerText;
    btnVender.innerText = "PROCESANDO...";

    const totalVenta = carrito.reduce((acc, i) => acc + i.subtotal, 0);

    const ventaFinal = {
        items: carrito,
        total: totalVenta,
        metodoPago: metodoPagoActivo,
        operador: nombreOperador,
        sector: "Apuntes",
        fecha: new Date().toISOString().split('T')[0],
        timestamp: serverTimestamp()
    };

    try {
        await addDoc(collection(db, "ventas"), ventaFinal);
        acumuladoTurno += totalVenta;
        totalTurnoLabel.innerText = `$ ${acumuladoTurno.toFixed(2)}`;
        
        alert("✅ Venta registrada");
        
        carrito = [];
        renderizarCarrito();
        btnVender.innerText = originalText;
        scanInput.focus();
    } catch (error) {
        console.error("Error en venta:", error);
        alert("❌ Error al registrar en la base de datos");
        btnVender.disabled = false;
        btnVender.innerText = originalText;
    }
}