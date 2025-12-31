import { auth, db } from './firebase-config.js';
import './auth-timeout.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export function cargarSidebar(paginaActiva) {
    const sidebarContainer = document.getElementById('sidebar');
    if (!sidebarContainer) return;

    sidebarContainer.innerHTML = '<div style="color:white; padding:20px; font-size:12px; opacity:0.5;">Cargando menú...</div>';

    onAuthStateChanged(auth, (user) => {
        if (!user) {
            window.location.href = "index.html";
            return;
        }

        getDoc(doc(db, "usuarios", user.email))
            .then((docSnap) => {
                const rol = docSnap.exists() ? docSnap.data().rol : "restringido";

                // Estructura completa de bloques y páginas
                const secciones = [
                    {
                        titulo: "Principal",
                        items: [
                            { id: 'inicio', icon: '🏠', label: 'Inicio', url: 'inicio.html', roles: ['operario-apuntes', 'operario-fotocop', 'supervisor-apuntes', 'supervisor-fotocop', 'adm-eco', 'superusuario'] }
                        ]
                    },
                    {
                        titulo: "Punto de Venta",
                        items: [
                            { id: 'apuntes', icon: '📚', label: 'Venta Apuntes', url: 'apuntes.html', roles: ['operario-apuntes', 'supervisor-apuntes', 'adm-eco', 'superusuario'] },
                            { id: 'ventas', icon: '🖨️', label: 'Fotocopiadora', url: 'ventas.html', roles: ['operario-fotocop', 'supervisor-fotocop', 'adm-eco', 'superusuario'] }
                        ]
                    },
                    {
                        titulo: "Gestión de Almacén",
                        items: [
                            { id: 'stock', icon: '🛒', label: 'Stock Apuntes', url: 'stock.html', roles: ['supervisor-apuntes', 'adm-eco', 'superusuario'] },
                            { id: 'insumos', icon: '🛠️', label: 'Insumos', url: 'insumos.html', roles: ['supervisor-fotocop', 'adm-eco', 'superusuario'] },
                            { id: 'estado', icon: '⚙️', label: 'Estado Máquinas', url: 'estado.html', roles: ['supervisor-fotocop', 'adm-eco', 'superusuario'] },
                            { id: 'editor', icon: '✏️', label: 'Editor Registros', url: 'editor.html', roles: ['supervisor-fotocop', 'supervisor-apuntes', 'superusuario'] }
                        ]
                    },
                    {
                        titulo: "Administración",
                        items: [
                            { id: 'cierre-apuntes', icon: '📚', label: 'Cierre Apuntes', url: 'cierre_apuntes.html', roles: ['operario-apuntes', 'supervisor-apuntes', 'adm-eco', 'superusuario'] },
                            { id: 'cierre-foto', icon: '🖨️', label: 'Cierre Fotocopiadora', url: 'cierres.html', roles: ['supervisor-fotocop', 'adm-eco', 'superusuario'] },
                            { id: 'reportes', icon: '📂', label: 'Reportes Globales', url: 'reportes.html', roles: ['adm-eco', 'superusuario'] }
                        ]
                    },
                    {
                        titulo: "Panel de Control",
                        items: [
                            { id: 'dash', icon: '📈', label: 'Dashboard Fin.', url: 'dashboard-financiero.html', roles: ['adm-eco', 'superusuario'] },
                            { id: 'rendimiento', icon: '📉', label: 'Rendimiento Téc.', url: 'rendimiento.html', roles: ['adm-eco', 'superusuario'] }
                        ]
                    },
                    {
                        titulo: "Gestión de Sistemas",
                        items: [
                            { id: 'usuarios', icon: '👥', label: 'Usuarios', url: 'usuarios.html', roles: ['superusuario'] },
                            { id: 'config', icon: '🛠️', label: 'Configuración', url: 'configuracion.html', roles: ['superusuario'] },
                            { id: 'admin', icon: '📥', label: 'Importador', url: 'importador.html', roles: ['superusuario'] }
                        ]
                    }
                ];

                let htmlFinal = `
                    <div class="sidebar-logo-container">
                        <div class="logo-circle-wrapper">
                            <img src="https://linktr.ee/og/image/franjaeconounlp.jpg" alt="Logo">
                        </div>
                        <span class="logo-text">FOTOCOP-ECONO</span>
                    </div>
                    <div class="menu-scroll-container">`;

                secciones.forEach(seccion => {
                    const itemsVisibles = seccion.items.filter(item => item.roles.includes(rol));
                    
                    if (itemsVisibles.length > 0) {
                        // Título del Bloque (Actúa como separador visual en CSS)
                        htmlFinal += `<div class="sidebar-section-title">${seccion.titulo}</div>`;
                        
                        itemsVisibles.forEach(item => {
                            const activeClass = item.id === paginaActiva ? 'active' : '';
                            htmlFinal += `
                                <div class="sidebar-item ${activeClass}" onclick="window.location.href='${item.url}'">
                                    <span class="item-icon">${item.icon}</span> 
                                    <span class="item-label">${item.label}</span>
                                </div>`;
                        });
                    }
                });

                htmlFinal += `</div>
                    <div class="sidebar-footer">
                        <div class="sidebar-item" id="btnSalir" style="color: #ff6b6b; border-top: 1px solid rgba(255,255,255,0.1);">
                            <span class="item-icon">🚪</span> 
                            <span class="item-label">Cerrar Sesión</span>
                        </div>
                    </div>`;

                sidebarContainer.innerHTML = htmlFinal;

                const btnSalir = document.getElementById('btnSalir');
                if (btnSalir) {
                    btnSalir.onclick = () => {
                        signOut(auth).then(() => { window.location.href = "index.html"; });
                    };
                }
            })
            .catch((error) => {
                console.error("Error cargando el menú:", error);
                sidebarContainer.innerHTML = '<div style="color:red; padding:20px; font-size:10px;">Error de autenticación</div>';
            });
    });
}