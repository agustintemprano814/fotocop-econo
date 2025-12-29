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
                const rol = docSnap.exists() ? docSnap.data().rol : "operario";

                const menuItems = [
                    { id: 'inicio', icon: '🏠', label: 'Inicio', url: 'inicio.html', roles: ['operario', 'supervisor', 'administrador', 'superusuario'] },
                    { id: 'ventas', icon: '🛒', label: 'Ventas', url: 'ventas.html', roles: ['operario', 'supervisor', 'administrador', 'superusuario'] },
                    { id: 'estado', icon: '🖨️', label: 'Estado', url: 'estado.html', roles: ['operario', 'supervisor', 'administrador', 'superusuario'] },
                    { id: 'cierre', icon: '📑', label: 'Cierre', url: 'cierres.html', roles: ['supervisor', 'superusuario'] },
                    { id: 'insumos', icon: '📦', label: 'Insumos', url: 'insumos.html', roles: ['supervisor', 'administrador', 'superusuario'] },
                    { id: 'editor', icon: '🛠️', label: 'Edición', url: 'editor.html', roles: ['supervisor', 'superusuario'] },
                    { id: 'dash', icon: '📊', label: 'Dashboard', url: 'dashboard-financiero.html', roles: ['administrador', 'superusuario'] },
                    { id: 'rendimiento', icon: '📈', label: 'Rendimiento', url: 'rendimiento.html', roles: ['administrador', 'superusuario'] },
                    { id: 'rep', icon: '📂', label: 'Reportes', url: 'reportes.html', roles: ['superusuario'] },
                    { id: 'admin', icon: '📥', label: 'Importar', url: 'importador.html', roles: ['superusuario'] },
                    { id: 'config', icon: '⚙️', label: 'Configuración', url: 'configuracion.html', roles: ['administrador', 'superusuario'] }
                ];

                let htmlItems = '';
                menuItems.forEach(item => {
                    if (item.roles.includes(rol)) {
                        const activeClass = item.id === paginaActiva ? 'active' : '';
                        htmlItems += `
                            <div class="sidebar-item ${activeClass}" onclick="window.location.href='${item.url}'">
                                <span class="item-icon">${item.icon}</span> <span class="item-label">${item.label}</span>
                            </div>`;
                    }
                });

                sidebarContainer.innerHTML = `
                    <div class="sidebar-logo-container">
                        <div class="logo-circle-wrapper">
                            <img src="https://linktr.ee/og/image/franjaeconounlp.jpg" alt="Logo">
                        </div>
                        <span class="logo-text">Fotocopiadora</span>
                    </div>
                    
                    <div class="menu-scroll-container">
                        ${htmlItems}
                    </div>

                    <div class="sidebar-footer">
                        <div class="sidebar-item" id="btnSalir" style="color: #ff6b6b;">
                            <span class="item-icon">🚪</span> <span class="item-label">Salir</span>
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
                sidebarContainer.innerHTML = '<div style="color:red; padding:20px;">Error de permisos</div>';
            });
    });
}