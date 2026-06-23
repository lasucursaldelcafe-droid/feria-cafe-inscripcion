/**
 * Configuración de Firebase para el módulo de Fidelización.
 * Reemplaza los valores TU_* con los de tu app web en Firebase Console:
 * Proyecto "la-sucursal-del-cafe" → Configuración → Tus apps → SDK de Firebase (web).
 *
 * IMPORTANTE: antes de usar este módulo en producción debes:
 * 1. Activar Firestore Database en Firebase Console (modo producción).
 * 2. Desplegar las reglas de firestore.rules (sección fidelizacion_*).
 * 3. Llenar los valores reales abajo y hacer commit (la API key web de Firebase
 *    no es secreta — es normal que viva en el cliente — pero las REGLAS de
 *    Firestore son las que de verdad protegen los datos).
 */
window.FIREBASE_FIDELIZACION_CONFIG = {
  apiKey: 'TU_API_KEY',
  authDomain: 'la-sucursal-del-cafe.firebaseapp.com',
  projectId: 'la-sucursal-del-cafe',
  storageBucket: 'la-sucursal-del-cafe.firebasestorage.app',
  messagingSenderId: 'TU_SENDER_ID',
  appId: 'TU_APP_ID'
};
