import React, { useState, useEffect } from "react";
import Formulary from "./components/Formulary";
import AdminPanel from "./components/AdminPanel";
import { seedDefaultOptionsIfEmpty, db } from "./firebase";
import { doc, onSnapshot } from "firebase/firestore";
import { GraduationCap, Lock } from "lucide-react";

export default function App() {
  const [view, setView] = useState<"student" | "admin">("student");
  const [logoUrl, setLogoUrl] = useState<string>("");

  // Al montar la aplicación, inicializamos las opciones por defecto si están vacías y cargamos configuración de logo
  useEffect(() => {
    seedDefaultOptionsIfEmpty();

    const unsubscribe = onSnapshot(doc(db, "settings", "general"), (snapshot) => {
      if (snapshot.exists()) {
        setLogoUrl(snapshot.data().logoUrl || "");
      }
    }, (err) => {
      console.error("Error al escuchar configuraciones:", err);
    });

    return () => unsubscribe();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col font-sans selection:bg-emerald-100 selection:text-emerald-900">
      {/* Barra de Navegación Superior (Se oculta al Imprimir) */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-40 shadow-xs no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo y Nombre del Colegio */}
            <div className="flex items-center gap-3">
              {logoUrl ? (
                <img src={logoUrl} className="h-10 w-auto object-contain rounded-lg" alt="Logo" referrerPolicy="no-referrer" />
              ) : (
                <div className="h-10 w-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white shadow-md shadow-emerald-500/10">
                  <GraduationCap className="h-5.5 w-5.5" />
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Área de Contenido Principal */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {view === "student" ? (
          <Formulary logoUrl={logoUrl} />
        ) : (
          <AdminPanel onLogout={() => setView("student")} logoUrl={logoUrl} />
        )}
      </main>

      {/* Pie de Página Sencillo (Se oculta al Imprimir) */}
      <footer className="bg-white border-t border-gray-100 py-6 text-center text-xs text-gray-400 font-medium no-print mt-auto">
        <div className="max-w-7xl mx-auto px-4 flex flex-col items-center justify-center gap-3">
          <div>
            <p>© {new Date().getFullYear()} Colegio México - Cristobal R. Buenrostro</p>
          </div>
          <button
            onClick={() => setView(view === "student" ? "admin" : "student")}
            className="text-gray-300 hover:text-emerald-600 hover:bg-emerald-50 p-1.5 rounded-lg transition-all cursor-pointer duration-200"
            title="Acceso Administrativo"
          >
            <Lock className="h-4 w-4" />
          </button>
        </div>
      </footer>
    </div>
  );
}
