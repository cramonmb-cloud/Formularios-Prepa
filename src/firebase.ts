import { initializeApp } from "firebase/app";
import { 
  getFirestore, 
  collection, 
  getDocs, 
  doc, 
  setDoc,
  writeBatch
} from "firebase/firestore";

// Configuración de Firebase proporcionada por el usuario
const firebaseConfig = {
  apiKey: "AIzaSyBJFFqW2piQC9UG3XG-WDbyC9lHyndYfBI",
  authDomain: "formulario-tae.firebaseapp.com",
  projectId: "formulario-tae",
  storageBucket: "formulario-tae.firebasestorage.app",
  messagingSenderId: "703756176560",
  appId: "1:703756176560:web:18846f082eced622dc7f75",
  measurementId: "G-H1WXK06XZW"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Inicializar Firestore
export const db = getFirestore(app);

// Enumeración de tipos de operaciones para el manejo de errores
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

/**
 * Manejador estándar de errores para Firestore requerido por las guías del sistema.
 */
export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: null, // No usamos autenticación de Firebase Auth explícitamente ya que el admin usa código simple
      email: null,
      emailVerified: null,
      isAnonymous: null,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Inicializa opciones predeterminadas si la base de datos está vacía.
 */
export async function seedDefaultOptionsIfEmpty() {
  const optionsPath = "options";
  try {
    const querySnapshot = await getDocs(collection(db, optionsPath));
    if (querySnapshot.empty) {
      console.log("Inicializando opciones de TAE predeterminadas...");
      const batch = writeBatch(db);

      const defaultOptions = [
        {
          id: "option_a",
          name: "Opción A",
          taes: ["Electrónica y programación", "Pensamiento matemático"],
          quota: 20,
          filled: 0
        },
        {
          id: "option_b",
          name: "Opción B",
          taes: ["Promoción de la salud", "Gestión contable"],
          quota: 20,
          filled: 0
        },
        {
          id: "option_c",
          name: "Opción C",
          taes: ["Emprendedores", "Procesos alimentarios"],
          quota: 20,
          filled: 0
        }
      ];

      for (const opt of defaultOptions) {
        const docRef = doc(db, optionsPath, opt.id);
        batch.set(docRef, opt);
      }

      await batch.commit();
      console.log("Opciones de TAE predeterminadas inicializadas correctamente.");
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, optionsPath);
  }
}
