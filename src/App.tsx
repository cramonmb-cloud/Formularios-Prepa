import React, { useState, useEffect } from "react";
import Formulary from "./components/Formulary";
import AdminPanel from "./components/AdminPanel";
import { seedDefaultOptionsIfEmpty, db } from "./firebase";
import { doc, onSnapshot } from "firebase/firestore";
import { Lock } from "lucide-react";

export default function App() {
  const [view, setView] = useState<"student" | "admin">("student");
  const [logoUrl, setLogoUrl] = useState<string>("");
  const [instructions, setInstructions] = useState<string>("");
  const [instructionsTitle, setInstructionsTitle] = useState<string>("");

  // Al montar la aplicación, inicializamos las opciones por defecto si están vacías y cargamos configuración de logo e instrucciones
  useEffect(() => {
    seedDefaultOptionsIfEmpty();

    const unsubscribe = onSnapshot(doc(db, "settings", "general"), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setLogoUrl(data.logoUrl || "");
        setInstructions(data.instructions || "");
        setInstructionsTitle(data.instructionsTitle || "");
      }
    }, (err) => {
      console.error("Error al escuchar configuraciones:", err);
    });

    return () => unsubscribe();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col font-sans selection:bg-emerald-100 selection:text-emerald-900">
      {/* Área de Contenido Principal */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {view === "student" ? (
          <Formulary logoUrl={logoUrl} instructions={instructions} instructionsTitle={instructionsTitle} />
        ) : (
          <AdminPanel onLogout={() => setView("student")} logoUrl={logoUrl} instructions={instructions} instructionsTitle={instructionsTitle} />
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
