/**
 * @file firebase-config.js
 * @description Configuración central de Firebase con Caché Persistente para optimización de costos.
 */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
    initializeFirestore, 
    persistentLocalCache, 
    persistentMultipleTabManager 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
const firebaseConfig = {
    apiKey: "AIzaSyAZ2NbI-p06Dsn8pBvy9z-WU_olI1Zd4Nk",
    authDomain: "fotocop-econo.firebaseapp.com",
    projectId: "fotocop-econo",
    storageBucket: "fotocop-econo.firebasestorage.app",
    messagingSenderId: "387876361170",
    appId: "1:387876361170:web:98d5b594a4a27581d1ee0b"
};
const app = initializeApp(firebaseConfig);


export const auth = getAuth(app);


export const db = initializeFirestore(app, {
    localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
    })
});