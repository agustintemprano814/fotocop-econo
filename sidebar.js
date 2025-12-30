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
                // Si el documento no existe, por defecto es un rol sin permisos
                const rol = docSnap.exists() ? docSnap.data().rol : "restringido";

                // Definimos los grupos de roles para facilitar la lectura
                const todos = ['operario-apuntes', 'operario-fotocop', 'supervisor-apuntes', 'supervisor-fotocop', 'adm-eco', 'superusuario'];
                const mandosMedios = ['supervisor-apuntes', 'supervisor-fotocop', 'adm-eco', 'superusuario'];
                const admins = ['adm-eco', 'superusuario'];

                const menuItems = [
                    { id: 'inicio', icon: '🏠', label: 'Inicio', url: 'inicio.html', roles: todos },
                    
                    // --- SECTOR VENTAS ---
                    { id: 'apuntes', icon: '📚', label: 'Apuntes', url: 'apuntes.html', roles: ['operario-apuntes', 'supervisor-apuntes', 'adm-eco', 'superusuario'] },
                    { id: 'ventas', icon: '🖨️', label: 'Fotocopiadora', url: 'ventas.html', roles: ['operario-fotocop', 'supervisor-fotocop', 'adm-eco', 'superusuario'] },
                    
                    // --- SECTOR GESTIÓN ---
                    { id: 'stock', icon: '📦', label: 'Gestión Stock', url: 'stock.html', roles: ['supervisor-apuntes', 'adm-eco', 'superusuario'] },
                    { id: 'insumos', icon: '🛠️', label: 'Insumos', url: 'insumos.html', roles: ['supervisor-fotocop', 'adm-eco', 'superusuario'] },
                    
                    // --- SECTOR ADMINISTRATIVO ---
                    { id: 'cierre', icon: '📑', label: 'Cierres Caja', url: 'cierres.html', roles: mandosMedios },
                    { id: 'rep', icon: '📂', label: 'Reportes', url: 'reportes.html', roles: admins },
                    
                    // --- SECTOR SEGURIDAD CRÍTICA ---
                    { id: 'usuarios', icon: '🛡️', label: 'Usuarios / Seguridad', url: 'usuarios.html', roles: ['superusuario'] },
                    { id: 'config', icon: '⚙️', label: 'Configuración', url: 'configuracion.html', roles: ['superusuario'] }
                ];

                let htmlItems = '';
                menuItems.forEach(item => {
                    if (item.roles.includes(rol)) {
                        const activeClass = item.id === paginaActiva ? 'active' : '';
                        htmlItems += `
                            <div class="sidebar-item ${activeClass}" onclick="window.location.href='${item.url}'">
                                <span class="item-icon">${item.icon}</span> 
                                <span class="item-label">${item.label}</span>
                            </div>`;
                    }
                });

                sidebarContainer.innerHTML = `
                    <div class="sidebar-logo-container">
                        <div class="logo-circle-wrapper">
                            <img src="https://linktr.ee/og/image/franjaeconounlp.jpg" alt="Logo">
                        </div>
                        <span class="logo-text">FOTOCOP-ECONO</span>
                    </div>
                    
                    <div class="menu-scroll-container">
                        ${htmlItems}
                    </div>

                    <div class="sidebar-footer">
                        <div class="sidebar-item" id="btnSalir" style="color: #ff6b6b; border-top: 1px solid rgba(255,255,255,0.1);">
                            <span class="item-icon">🚪</span> 
                            <span class="item-label">Cerrar Sesión</span>
                        </div>
                    </div>
                `;

                const btnSalir = document.getElementById('btnSalir');
                if (btnSalir) {
                    btnSalir.onclick = () => {
                        signOut(auth).then(() => { window.location.href = "index.html"; });
                    };
                }
            })
            .catch((error) => {
                console.error("Error cargando el menú:", error);
                sidebarContainer.innerHTML = '<div style="color:red; padding:20px; font-size:10px;">Error de autenticación de menú</div>';
            });
    });
}