import { db } from './firebase-config.js';
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { cargarSidebar } from './sidebar.js';
import { verificarAcceso, renderSeguro } from './security.js';

// Variables de estado local
let nombreOperador = "";
let catActiva = "Copia Rápida";
let pagoActivo = "Efectivo";
let carrito = [];
let acumuladoLocal = 0;

// Referencias al DOM
const btnAgregar = document.getElementById('btnAgregar');
const btnVender = document.getElementById('btnVender');
const inputMonto = document.getElementById('inputMonto');
const itemsCarrito = document.getElementById('itemsCarrito');
const totalVentaLabel = document.getElementById('totalVenta');
const totalTurnoLabel = document.getElementById('totalTurno');

// --- SEGURIDAD Y ACCESO ---
verificarAcceso(['operario-fotocop', 'supervisor-fotocop', 'adm-eco', 'superusuario']).then(info => {
    cargarSidebar('ventas');
    // Usamos el campo 'nombre' que verificamos en Firebase
    nombreOperador = info.nombreReal || info.userData?.nombre || info.user.email.split('@')[0];
    renderSeguro(document.getElementById('displayOperador'), nombreOperador);
    
    inicializarManejadores();
});

// --- MANEJADORES DE EVENTOS ---
function inicializarManejadores() {
    // Selección de Categoría
    document.querySelectorAll('.cat-card').forEach(card => {
        card.addEventListener('click', () => {
            catActiva = card.getAttribute('data-cat');
            document.querySelectorAll('.cat-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
        });
    });

    // Selección de Método de Pago
    document.querySelectorAll('.pay-card').forEach(card => {
        card.addEventListener('click', () => {
            pagoActivo = card.getAttribute('data-pago');
            document.querySelectorAll('.pay-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
        });
    });

    // Añadir al Carrito
    btnAgregar.addEventListener('click', () => {
        const monto = parseFloat(inputMonto.value);
        if (!monto || monto <= 0) return alert("Ingrese un monto válido");

        carrito.push({ servicio: catActiva, monto: monto });
        inputMonto.value = "";
        inputMonto.focus();
        renderizarCarrito();
    });

    // Confirmar Venta Final
    btnVender.addEventListener('click', confirmarVenta);
}

// --- RENDERIZADO DEL CARRITO ---
function renderizarCarrito() {
    itemsCarrito.innerHTML = "";
    let total = 0;

    if (carrito.length === 0) {
        itemsCarrito.innerHTML = `<p style="color: var(--gray); font-style: italic; font-size: 0.8rem;">Carrito vacío</p>`;
    } else {
        carrito.forEach((item, index) => {
            total += item.monto;
            const itemDiv = document.createElement('div');
            itemDiv.className = 'item-carrito';
            itemDiv.innerHTML = `
                <button class="btn-borrar" data-index="${index}" title="Eliminar">🗑</button>
                <div class="item-info">
                    <strong>${item.servicio}</strong>
                </div>
                <div style="font-weight: 600;">$ ${item.monto.toFixed(2)}</div>
            `;
            
            // Evento para borrar item individualmente (Seguro para CSP)
            itemDiv.querySelector('.btn-borrar').addEventListener('click', (e) => {
                const idx = e.target.getAttribute('data-index');
                carrito.splice(idx, 1);
                renderizarCarrito();
            });
            
            itemsCarrito.appendChild(itemDiv);
        });
    }

    totalVentaLabel.innerText = `$ ${total.toFixed(2)}`;
    btnVender.disabled = carrito.length === 0;
}

// --- LÓGICA DE FIREBASE ---
async function confirmarVenta() {
    btnVender.disabled = true;
    const originalText = btnVender.innerText;
    btnVender.innerText = "⏳ Guardando...";

    const totalVenta = carrito.reduce((acc, i) => acc + i.monto, 0);

    const ventaFinal = {
        items: carrito,
        total: totalVenta,
        metodoPago: pagoActivo,
        operador: nombreOperador, 
        sector: "Fotocopiadora",
        fecha: new Date().toISOString().split('T')[0],
        timestamp: serverTimestamp()
    };

    try {
        await addDoc(collection(db, "ventas"), ventaFinal);
        acumuladoLocal += totalVenta;
        totalTurnoLabel.innerText = `$ ${acumuladoLocal.toFixed(2)}`;
        
        alert("✅ Venta registrada con éxito");
        
        carrito = [];
        renderizarCarrito();
        btnVender.innerText = originalText;
    } catch (error) {
        console.error("Error al guardar venta:", error);
        alert("❌ Error de conexión al guardar la venta");
        btnVender.disabled = false;
        btnVender.innerText = originalText;
    }
}