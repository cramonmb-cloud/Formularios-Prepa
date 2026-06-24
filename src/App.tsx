import React, { useState, useEffect } from "react";
import Formulary from "./components/Formulary";
import AdminPanel from "./components/AdminPanel";
import { seedDefaultOptionsIfEmpty } from "./firebase";
import { GraduationCap, Settings, ClipboardList } from "lucide-react";

export default function App() {
  const [view, setView] = useState<"student" | "admin">("student");

  // Al montar la aplicación, inicializamos las opciones por defecto si están vacías
  useEffect(() => {
    seedDefaultOptionsIfEmpty();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col font-sans selection:bg-emerald-100 selection:text-emerald-900">
      {/* Barra de Navegación Superior (Se oculta al Imprimir) */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-40 shadow-xs no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo y Nombre del Colegio */}
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white shadow-md shadow-emerald-500/10">
                <GraduationCap className="h-5.5 w-5.5" />
              </div>
              <div>
                <span className="font-display font-bold text-gray-900 text-lg block tracking-tight">
                  Servicio de Registro Escolar
                </span>
                <span className="text-[10px] font-semibold text-emerald-700 tracking-wider uppercase font-mono block">
                  Trayectorias de Aprendizaje Especializante
                </span>
              </div>
            </div>

            {/* Selector de Vistas (Alumno / Administrador) */}
            <div className="flex items-center gap-1.5 bg-gray-100 p-1.5 rounded-xl border border-gray-200">
              <button
                onClick={() => setView("student")}
                className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  view === "student"
                    ? "bg-white text-emerald-800 shadow-xs"
                    : "text-gray-500 hover:text-gray-800"
                }`}
                id="tab-student"
              >
                <ClipboardList className="h-3.5 w-3.5" />
                <span>Formulario Alumnos</span>
              </button>
              
              <button
                onClick={() => setView("admin")}
                className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  view === "admin"
                    ? "bg-slate-800 text-white shadow-xs"
                    : "text-gray-500 hover:text-gray-800"
                }`}
                id="tab-admin"
              >
                <Settings className="h-3.5 w-3.5" />
                <span>Panel Administrativo</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Área de Contenido Principal */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {view === "student" ? (
          <Formulary />
        ) : (
          <AdminPanel />
        )}
      </main>

      {/* Pie de Página Sencillo (Se oculta al Imprimir) */}
      <footer className="bg-white border-t border-gray-100 py-6 text-center text-xs text-gray-400 font-medium no-print mt-auto">
        <div className="max-w-7xl mx-auto px-4">
          <p>© {new Date().getFullYear()} Escuela Preparatoria Oficial. Todos los derechos reservados.</p>
          <p className="mt-1 font-mono text-[10px] text-gray-300">Registro en base de datos en tiempo real mediante Firebase</p>
        </div>
      </footer>
    </div>
  );
}
