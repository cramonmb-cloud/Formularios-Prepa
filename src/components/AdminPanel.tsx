import React, { useState, useEffect, useRef } from "react";
import { 
  collection, 
  onSnapshot, 
  doc, 
  updateDoc, 
  deleteDoc, 
  addDoc,
  writeBatch,
  runTransaction,
  query,
  orderBy,
  getDocs,
  setDoc
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { TAEOption, Submission } from "../types";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { 
  Lock, 
  Users, 
  Layers, 
  FileText, 
  Plus, 
  Trash2, 
  Edit3, 
  Save, 
  X, 
  Download, 
  Printer, 
  Search, 
  BarChart3, 
  RefreshCw,
  TrendingUp, 
  Sparkles,
  Info,
  CheckCircle2,
  AlertTriangle
} from "lucide-react";
import { motion } from "motion/react";

interface AdminPanelProps {
  onLogout?: () => void;
  logoUrl?: string;
}

export default function AdminPanel({ onLogout, logoUrl }: AdminPanelProps) {
  // Estado de Autenticación de Admin
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passcode, setPasscode] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);

  // Estados de Datos
  const [options, setOptions] = useState<TAEOption[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  // Estados de Navegación del Panel
  const [activeTab, setActiveTab] = useState<"stats" | "records" | "manage">("stats");

  // Estados de Búsqueda y Filtro
  const [searchTerm, setSearchTerm] = useState("");
  const [filterOptionId, setFilterOptionId] = useState<string>("all");

  // Identidad del logotipo
  const [newLogoUrl, setNewLogoUrl] = useState(logoUrl || "");

  // Sincronizar logotipo desde props
  useEffect(() => {
    if (logoUrl !== undefined) {
      setNewLogoUrl(logoUrl);
    }
  }, [logoUrl]);

  // Estados de Edición/Creación de Opciones
  const [editingOption, setEditingOption] = useState<TAEOption | null>(null);
  const [isCreatingOption, setIsCreatingOption] = useState(false);
  const [optionForm, setOptionForm] = useState<{
    name: string;
    quota: number;
    taes: string[];
  }>({
    name: "",
    quota: 20,
    taes: ["", ""]
  });

  // Estado de Diálogo de Confirmación de Borrado Completo
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetConfirmCode, setResetConfirmCode] = useState("");
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Auto-autorizar si ya se guardó en sessionStorage para mejor UX
  useEffect(() => {
    const savedAuth = sessionStorage.getItem("admin_auth");
    if (savedAuth === "true") {
      setIsAuthenticated(true);
    }
  }, []);

  // Escuchar Opciones en Tiempo Real
  useEffect(() => {
    if (!isAuthenticated) return;

    const unsubscribe = onSnapshot(
      query(collection(db, "options"), orderBy("name", "asc")), 
      (snapshot) => {
        const opts: TAEOption[] = [];
        snapshot.forEach((doc) => {
          opts.push({ id: doc.id, ...doc.data() } as TAEOption);
        });
        setOptions(opts);
        setLoading(false);
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, "options");
      }
    );

    return () => unsubscribe();
  }, [isAuthenticated]);

  // Escuchar Registros de Alumnos en Tiempo Real
  useEffect(() => {
    if (!isAuthenticated) return;

    const unsubscribe = onSnapshot(
      query(collection(db, "submissions"), orderBy("timestamp", "desc")), 
      (snapshot) => {
        const subs: Submission[] = [];
        snapshot.forEach((doc) => {
          subs.push({ id: doc.id, ...doc.data() } as Submission);
        });
        setSubmissions(subs);
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, "submissions");
      }
    );

    return () => unsubscribe();
  }, [isAuthenticated]);

  // Manejar Login del Administrador (Passcode: 012004)
  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    if (passcode === "012004") {
      setIsAuthenticated(true);
      sessionStorage.setItem("admin_auth", "true");
    } else {
      setLoginError("Código de autorización incorrecto. Intenta de nuevo.");
      setPasscode("");
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem("admin_auth");
    if (onLogout) onLogout();
  };

  // --- Operaciones CRUD Opciones de TAE ---

  // Abrir formulario para editar
  const startEditOption = (option: TAEOption) => {
    setEditingOption(option);
    setOptionForm({
      name: option.name,
      quota: option.quota,
      taes: option.taes && option.taes.length > 0 ? [...option.taes] : ["", ""]
    });
    setIsCreatingOption(false);
  };

  // Abrir formulario para crear nueva opción
  const startCreateOption = () => {
    setEditingOption(null);
    setOptionForm({
      name: `Opción ${String.fromCharCode(65 + options.length)}`, // Autogenera letra siguiente
      quota: 20,
      taes: ["", ""]
    });
    setIsCreatingOption(true);
  };

  // Guardar creación o edición
  const saveOption = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const cleanTaes = optionForm.taes.map(t => t.trim()).filter(t => t !== "");
    
    if (!optionForm.name.trim()) {
      alert("Por favor completa el nombre de la opción.");
      return;
    }

    if (cleanTaes.length === 0) {
      alert("Por favor registra al menos un taller (TAE) para esta opción.");
      return;
    }

    const quotaVal = Number(optionForm.quota);

    if (isNaN(quotaVal) || quotaVal <= 0) {
      alert("El cupo debe ser un número entero mayor a cero.");
      return;
    }

    try {
      if (isCreatingOption) {
        // Crear nueva opción usando setDoc
        const newId = `option_${Date.now()}`;
        await setDoc(doc(db, "options", newId), {
          id: newId,
          name: optionForm.name.trim(),
          taes: cleanTaes,
          quota: quotaVal,
          filled: 0
        });
        showNotification("Opción creada exitosamente");
      } else if (editingOption) {
        // Editar opción existente
        await updateDoc(doc(db, "options", editingOption.id), {
          name: optionForm.name.trim(),
          taes: cleanTaes,
          quota: quotaVal
        });
        showNotification("Opción actualizada exitosamente");
      }

      // Cerrar formulario
      setEditingOption(null);
      setIsCreatingOption(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, "options");
    }
  };

  // Eliminar una opción
  const deleteOption = async (optionId: string) => {
    const option = options.find(o => o.id === optionId);
    if (!option) return;

    if (option.filled > 0) {
      alert(`No se puede eliminar la "${option.name}" porque tiene ${option.filled} alumnos registrados. Primero debes gestionar esos registros.`);
      return;
    }

    if (confirm(`¿Estás seguro de que deseas eliminar la "${option.name}"? Esta acción no se puede deshacer.`)) {
      try {
        await deleteDoc(doc(db, "options", optionId));
        showNotification("Opción eliminada con éxito");
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `options/${optionId}`);
      }
    }
  };

  // --- Operaciones sobre Registros de Alumnos ---

  // Eliminar un registro individual de alumno (libera cupo con transacción)
  const deleteSubmission = async (sub: Submission) => {
    if (!confirm(`¿Estás seguro de que deseas eliminar el registro del alumno "${sub.studentName}"?\nSe liberará un cupo en la "${sub.optionName}".`)) {
      return;
    }

    try {
      await runTransaction(db, async (transaction) => {
        const optionRef = doc(db, "options", sub.optionId);
        const optionSnap = await transaction.get(optionRef);

        // Si la opción existe, decrementamos el cupo lleno
        if (optionSnap.exists()) {
          const optData = optionSnap.data();
          const currentFilled = optData.filled || 0;
          transaction.update(optionRef, {
            filled: Math.max(currentFilled - 1, 0)
          });
        }

        // Eliminar el documento de registro
        const subRef = doc(db, "submissions", sub.id);
        transaction.delete(subRef);
      });

      showNotification("Registro de alumno eliminado y cupo liberado");
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `submissions/${sub.id}`);
    }
  };

  // Reiniciar todo el sistema (borrar registros y vaciar cupos de opciones)
  const resetEntireSystem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (resetConfirmCode !== "REINICIAR") {
      alert("El código de confirmación es incorrecto.");
      return;
    }

    try {
      // 1. Obtener todos los registros de submissions
      const subsSnapshot = await getDocs(collection(db, "submissions"));
      const batch = writeBatch(db);

      // Borrar todas las submissions
      subsSnapshot.forEach((doc) => {
        batch.delete(doc.ref);
      });

      // 2. Reiniciar los cupos llenos de todas las opciones a 0
      options.forEach((opt) => {
        const optRef = doc(db, "options", opt.id);
        batch.update(optRef, { filled: 0 });
      });

      await batch.commit();
      setShowResetConfirm(false);
      setResetConfirmCode("");
      showNotification("El sistema ha sido completamente reiniciado");
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, "reset_all");
    }
  };

  // --- Utilidades de Exportación ---

  // Exportar a Excel (Formato CSV compatible con Excel de Microsoft con UTF-8 BOM)
  const exportToExcel = () => {
    if (filteredSubmissions.length === 0) {
      alert("No hay registros para exportar en este momento.");
      return;
    }

    // Cabeceras de las columnas
    const headers = ["ID Registro", "Nombre del Alumno", "Opción Seleccionada", "Talleres (TAE)", "Fecha de Registro"];
    
    // Contenido estructurado
    const rows = filteredSubmissions.map(sub => [
      sub.id,
      sub.studentName,
      sub.optionName,
      sub.taes.join(" - "),
      new Date(sub.timestamp).toLocaleString("es-MX")
    ]);

    // Combinar en formato CSV
    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(val => `"${val.replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    // Crear un elemento link de descarga, usando la marca UTF-8 BOM \uFEFF para que Excel reconozca acentos
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Alumnos_Registrados_TAE_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Abrir ventana para imprimir o descargar el reporte en formato PDF limpio
  const triggerPrintPDF = () => {
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4"
    });

    const runGeneration = (imgBase64?: string) => {
      let startY = 15;

      if (imgBase64) {
        try {
          // Draw logo at coordinates x=14, y=12, width=16, height=16
          doc.addImage(imgBase64, "PNG", 14, 12, 16, 16);
          
          // Header banner positioned next to logo
          doc.setFillColor(30, 41, 59);
          doc.rect(34, 12, 162, 16, "F");
          
          doc.setFontSize(10);
          doc.setTextColor(255, 255, 255);
          doc.setFont("helvetica", "bold");
          doc.text("REPORTE OFICIAL DE INSCRIPCIONES - TALLERES TAE", 115, 22, { align: "center" });

          // Subtitle below the banner and logo
          doc.setFontSize(8);
          doc.setTextColor(107, 114, 128);
          doc.setFont("helvetica", "normal");
          doc.text(
            `Generado el: ${new Date().toLocaleString("es-MX")} | Colegio México - Cristobal R. Buenrostro`,
            14,
            33
          );
          startY = 36;
        } catch (e) {
          console.warn("Error drawing logo inside PDF, falling back to clean text header", e);
          imgBase64 = undefined;
        }
      }

      if (!imgBase64) {
        // High-end clean background banner bar at the top
        doc.setFillColor(30, 41, 59);
        doc.rect(14, 12, 182, 14, "F");
        
        doc.setFontSize(11);
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.text("REPORTE OFICIAL DE INSCRIPCIONES - TALLERES TAE", 105, 21, { align: "center" });

        // Subtitle
        doc.setFontSize(8);
        doc.setTextColor(107, 114, 128);
        doc.setFont("helvetica", "normal");
        doc.text(
          `Generado el: ${new Date().toLocaleString("es-MX")} | Colegio México - Cristobal R. Buenrostro`,
          14,
          31
        );
        startY = 34;
      }

      // 1. Resumen General Table
      autoTable(doc, {
        startY: startY,
        theme: "plain",
        styles: { fontSize: 8.5, cellPadding: 2 },
        head: [["RESUMEN GENERAL DEL SISTEMA", "CANTIDAD / PORCENTAJE"]],
        body: [
          ["Total de Alumnos Registrados", `${submissions.length} alumnos`],
          ["Capacidad Máxima de Lugares", `${totalCapacity} lugares`],
          ["Porcentaje General de Ocupación", `${totalPercentage}%`]
        ],
        headStyles: { fillColor: [243, 244, 246], textColor: [17, 24, 39], fontStyle: "bold" },
        columnStyles: {
          0: { fontStyle: "bold", cellWidth: 90 },
          1: { cellWidth: 92 }
        }
      });

      // 2. Distribución de Talleres Table
      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 6,
        theme: "grid",
        styles: { fontSize: 8.5, cellPadding: 2 },
        head: [["OPCIÓN", "TALLERES (TAE) INCLUIDOS", "INSCRITOS / CUPO"]],
        body: options.map(opt => [
          opt.name,
          opt.taes.join(" - "),
          `${opt.filled} / ${opt.quota}`
        ]),
        headStyles: { fillColor: [16, 185, 129], textColor: [255, 255, 255], fontStyle: "bold" },
        columnStyles: {
          0: { fontStyle: "bold", cellWidth: 35 },
          1: { cellWidth: 112 },
          2: { halign: "center", fontStyle: "bold", cellWidth: 35 }
        }
      });

      // 3. Lista Nominal Table
      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 6,
        theme: "striped",
        styles: { fontSize: 8, cellPadding: 2 },
        head: [["ALUMNO", "OPCIÓN SELECCIONADA", "TALLERES (TAE) INCLUIDOS", "FECHA DE REGISTRO"]],
        body: filteredSubmissions.map(sub => [
          sub.studentName,
          sub.optionName,
          sub.taes.join(" - "),
          new Date(sub.timestamp).toLocaleString("es-MX")
        ]),
        headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: "bold" },
        columnStyles: {
          0: { fontStyle: "bold", cellWidth: 48 },
          1: { fontStyle: "bold", textColor: [16, 185, 129], cellWidth: 38 },
          2: { cellWidth: 58 },
          3: { halign: "right", cellWidth: 38 }
        }
      });

      // Save PDF file
      doc.save(`Reporte_Inscripciones_TAE_${new Date().toISOString().split('T')[0]}.pdf`);
      showNotification("Reporte PDF descargado exitosamente");
    };

    if (logoUrl) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        try {
          // Convert loaded image to base64 using canvas
          const canvas = document.createElement("canvas");
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            const dataURL = canvas.toDataURL("image/png");
            runGeneration(dataURL);
          } else {
            runGeneration();
          }
        } catch (e) {
          console.warn("Could not encode logo image as base64, printing clean layout", e);
          runGeneration();
        }
      };
      img.onerror = () => {
        console.warn("Could not load logo due to CORS or bad URL, printing clean layout");
        runGeneration();
      };
      img.src = logoUrl;
    } else {
      runGeneration();
    }
  };

  // Auxiliar para notificaciones toast temporales
  const showNotification = (msg: string) => {
    setActionSuccess(msg);
    setTimeout(() => {
      setActionSuccess(null);
    }, 4000);
  };

  // Filtrado y búsqueda en tiempo real de registros
  const filteredSubmissions = submissions.filter(sub => {
    const matchesSearch = sub.studentName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterOptionId === "all" || sub.optionId === filterOptionId;
    return matchesSearch && matchesFilter;
  });

  // Cálculos para Estadísticas
  const totalSubmissions = submissions.length;
  const totalCapacity = options.reduce((acc, opt) => acc + opt.quota, 0);
  const totalPercentage = totalCapacity > 0 ? Math.round((totalSubmissions / totalCapacity) * 100) : 0;
  
  const popularOption = [...options].sort((a, b) => b.filled - a.filled)[0];

  // --- Pantalla de Bloqueo de Admin ---
  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto py-12">
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8 text-center"
        >
          {logoUrl ? (
            <img src={logoUrl} className="h-16 w-auto object-contain mx-auto mb-6" alt="Logo" referrerPolicy="no-referrer" />
          ) : (
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-2xl bg-slate-50 border border-slate-100 mb-6 text-slate-700 shadow-sm">
              <Lock className="h-8 w-8 text-emerald-600" />
            </div>
          )}

          <h2 className="text-2xl font-display font-bold text-gray-900 tracking-tight mb-6">
            Panel de Administración
          </h2>

          <form onSubmit={handleLoginSubmit} className="space-y-4" id="admin-login-form">
            <div>
              <input
                type="password"
                maxLength={10}
                required
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                className="block w-full px-4 py-3 text-center text-lg font-mono font-bold tracking-[0.5em] text-gray-800 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all placeholder:tracking-normal placeholder:font-sans placeholder:text-sm placeholder:font-normal"
                placeholder="Código de Acceso"
                autoFocus
              />
            </div>

            {loginError && (
              <p className="text-xs font-semibold text-red-600 bg-red-50 p-2.5 rounded-lg border border-red-100">
                {loginError}
              </p>
            )}

            <button
              type="submit"
              className="w-full inline-flex items-center justify-center px-6 py-3 border border-transparent text-sm font-semibold rounded-xl text-white bg-slate-800 hover:bg-slate-900 transition-all cursor-pointer shadow-sm focus:ring-2 focus:ring-offset-2 focus:ring-slate-500"
            >
              Ingresar al Panel
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  // --- Vista Principal del Administrador ---
  return (
    <div className="space-y-8" id="admin-main-view">
      {/* Toast Notification */}
      {actionSuccess && (
        <div className="fixed bottom-5 right-5 z-50 p-4 bg-emerald-600 border border-emerald-500 rounded-xl shadow-xl text-white flex items-center gap-3 font-sans text-sm animate-bounce">
          <CheckCircle2 className="h-5 w-5 text-white shrink-0" />
          <span className="font-semibold">{actionSuccess}</span>
        </div>
      )}

      {/* Encabezado Administrativo */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-gray-100 pb-6 no-print">
        <div>
          <span className="px-3 py-1 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-full tracking-wider uppercase mb-2 inline-block font-mono">
            Administración Activa
          </span>
          <h1 className="text-3xl font-display font-bold text-gray-900 tracking-tight">
            Panel de Gestión TAE
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Supervisa inscripciones, ajusta cupos y descarga reportes oficiales del sistema.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowResetConfirm(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-red-200 text-xs font-semibold rounded-lg text-red-700 bg-red-50 hover:bg-red-100 transition-colors cursor-pointer"
          >
            Reiniciar Sistema
          </button>
          <button
            onClick={handleLogout}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-gray-200 text-xs font-semibold rounded-lg text-gray-600 bg-white hover:bg-gray-50 hover:border-gray-300 transition-all cursor-pointer shadow-xs"
          >
            Cerrar Sesión Admin
          </button>
        </div>
      </div>

      {/* Navegación por Tabs Administrativos (No se imprimen) */}
      <div className="flex border-b border-gray-200 no-print">
        <button
          onClick={() => setActiveTab("stats")}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 font-semibold text-sm transition-all cursor-pointer ${
            activeTab === "stats"
              ? "border-emerald-600 text-emerald-700"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <BarChart3 className="h-4 w-4" />
          <span>Estadísticas y Métricas</span>
        </button>
        <button
          onClick={() => setActiveTab("records")}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 font-semibold text-sm transition-all cursor-pointer ${
            activeTab === "records"
              ? "border-emerald-600 text-emerald-700"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <Users className="h-4 w-4" />
          <span>Registros de Alumnos ({submissions.length})</span>
        </button>
        <button
          onClick={() => setActiveTab("manage")}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 font-semibold text-sm transition-all cursor-pointer ${
            activeTab === "manage"
              ? "border-emerald-600 text-emerald-700"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <Layers className="h-4 w-4" />
          <span>Gestionar Opciones</span>
        </button>
      </div>

      {/* VISTA 1: ESTADÍSTICAS Y GRÁFICOS */}
      {activeTab === "stats" && (
        <div className="space-y-8 no-print animate-fadeIn">
          {/* Tarjetas de Métricas de Bento Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-xs flex items-center gap-4">
              <div className="h-12 w-12 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
                <Users className="h-6 w-6" />
              </div>
              <div>
                <span className="text-xs font-semibold text-gray-400 font-sans block uppercase tracking-wider">Total de Alumnos</span>
                <span className="text-2xl font-bold text-gray-900 font-mono block">{totalSubmissions}</span>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-xs flex items-center gap-4">
              <div className="h-12 w-12 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
                <Layers className="h-6 w-6" />
              </div>
              <div>
                <span className="text-xs font-semibold text-gray-400 font-sans block uppercase tracking-wider">Cupo Global Total</span>
                <span className="text-2xl font-bold text-gray-900 font-mono block">{totalCapacity}</span>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-xs flex items-center gap-4">
              <div className="h-12 w-12 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
                <TrendingUp className="h-6 w-6" />
              </div>
              <div>
                <span className="text-xs font-semibold text-gray-400 font-sans block uppercase tracking-wider">Ocupación General</span>
                <span className="text-2xl font-bold text-gray-900 font-mono block">{totalPercentage}%</span>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-xs flex items-center gap-4">
              <div className="h-12 w-12 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
                <Sparkles className="h-6 w-6" />
              </div>
              <div>
                <span className="text-xs font-semibold text-gray-400 font-sans block uppercase tracking-wider">Opción Más Popular</span>
                <span className="text-base font-bold text-gray-900 font-display block truncate">
                  {popularOption ? popularOption.name : "N/A"}
                </span>
              </div>
            </div>
          </div>

          {/* Estado de Distribución Gráfica Visual */}
          <div className="bg-white p-6 sm:p-8 rounded-2xl border border-gray-100 shadow-sm">
            <h3 className="text-lg font-display font-bold text-gray-900 mb-6 flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-emerald-600" />
              <span>Ocupación de Cupos por Opción de TAE</span>
            </h3>

            <div className="space-y-6">
              {options.map((option) => {
                const percent = option.quota > 0 ? Math.min(Math.round((option.filled / option.quota) * 100), 100) : 0;
                const isFull = option.filled >= option.quota;

                return (
                  <div key={option.id} className="space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                      <div>
                        <span className="text-sm font-bold text-gray-800 font-display">{option.name}</span>
                        <span className="text-xs text-gray-400 font-sans ml-2">({option.taes.join(" + ")})</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs font-mono text-gray-500">
                        <span className="font-semibold text-gray-700">{option.filled} / {option.quota} lugares</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          isFull ? "bg-red-50 text-red-600 border border-red-100" : "bg-emerald-50 text-emerald-700 border border-emerald-100"
                        }`}>
                          {isFull ? "Agotado" : `${option.quota - option.filled} Libres`}
                        </span>
                      </div>
                    </div>

                    <div className="relative w-full bg-gray-100 rounded-full h-4 overflow-hidden flex">
                      <div 
                        className={`h-full transition-all duration-500 rounded-full ${
                          isFull 
                            ? "bg-red-500" 
                            : percent > 85 
                            ? "bg-amber-500" 
                            : "bg-emerald-500"
                        }`}
                        style={{ width: `${percent}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Resumen Detallado de los Procesos */}
          <div className="bg-white p-6 sm:p-8 rounded-2xl border border-gray-100 shadow-sm">
            <h3 className="text-lg font-display font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Info className="h-5 w-5 text-emerald-600" />
              <span>Estado Analítico del Semestre</span>
            </h3>
            <p className="text-sm text-gray-500 mb-6">
              A continuación se muestra el porcentaje detallado de demanda por cada una de las Trayectorias de Aprendizaje Especializantes configuradas.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {options.map((option) => {
                const pct = option.quota > 0 ? Math.round((option.filled / option.quota) * 100) : 0;
                return (
                  <div key={option.id} className="bg-gray-50/50 rounded-xl p-5 border border-gray-100 text-center">
                    <span className="text-sm font-bold text-gray-800 font-display block mb-1">{option.name}</span>
                    <p className="text-xs text-gray-500 font-sans mb-4 min-h-[32px] line-clamp-2">{option.taes.join(" y ")}</p>
                    
                    <div className="inline-flex items-center justify-center relative h-20 w-20 mb-3">
                      <svg className="h-20 w-20 transform -rotate-90">
                        <circle cx="40" cy="40" r="34" stroke="#f3f4f6" strokeWidth="6" fill="transparent" />
                        <circle cx="40" cy="40" r="34" stroke={option.filled >= option.quota ? "#ef4444" : "#10b981"} strokeWidth="6" fill="transparent"
                          strokeDasharray={213.6}
                          strokeDashoffset={213.6 - (213.6 * Math.min(pct, 100)) / 100}
                        />
                      </svg>
                      <span className="absolute text-sm font-bold text-gray-700 font-mono">{pct}%</span>
                    </div>

                    <div className="text-xs font-mono text-gray-500">
                      <span>{option.filled} registrados</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* VISTA 2: LISTA DE REGISTROS DE ALUMNOS */}
      {activeTab === "records" && (
        <div className="space-y-6 no-print animate-fadeIn">
          {/* Controles de Búsqueda y Descarga */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-xl border border-gray-100 shadow-xs">
            <div className="flex flex-col sm:flex-row gap-3 grow max-w-2xl">
              {/* Buscador por Nombre */}
              <div className="relative grow">
                <Search className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 h-5 w-5 mt-2.5" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar por nombre de alumno..."
                  className="block w-full pl-9 pr-4 py-2 text-sm text-gray-800 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>

              {/* Filtro por Opción */}
              <select
                value={filterOptionId}
                onChange={(e) => setFilterOptionId(e.target.value)}
                className="block min-w-[160px] px-3 py-2 text-sm text-gray-700 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              >
                <option value="all">Todas las Opciones</option>
                {options.map(o => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </div>

            {/* Acciones de Exportación */}
            <div className="flex items-center gap-2">
              <button
                onClick={exportToExcel}
                className="inline-flex items-center gap-1.5 px-4 py-2 border border-emerald-200 text-xs font-semibold rounded-lg text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors cursor-pointer shadow-xs"
              >
                <Download className="h-4 w-4" />
                <span>Exportar Excel</span>
              </button>
              <button
                onClick={triggerPrintPDF}
                className="inline-flex items-center gap-1.5 px-4 py-2 border border-slate-200 text-xs font-semibold rounded-lg text-slate-700 bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer shadow-xs"
              >
                <Printer className="h-4 w-4" />
                <span>Exportar a PDF</span>
              </button>
            </div>
          </div>

          {/* Tabla de Resultados */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse font-sans">
                <thead>
                  <tr className="bg-gray-50/50 border-b border-gray-100 text-xs font-mono text-gray-400 uppercase tracking-wider">
                    <th className="py-4 px-6 font-semibold">Alumno</th>
                    <th className="py-4 px-6 font-semibold">Selección</th>
                    <th className="py-4 px-6 font-semibold">Talleres (TAE)</th>
                    <th className="py-4 px-6 font-semibold">Fecha de Registro</th>
                    <th className="py-4 px-6 font-semibold text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {filteredSubmissions.length > 0 ? (
                    filteredSubmissions.map((sub) => (
                      <tr key={sub.id} className="hover:bg-gray-50/20 transition-colors">
                        <td className="py-4 px-6 font-semibold text-gray-900">{sub.studentName}</td>
                        <td className="py-4 px-6">
                          <span className="px-2.5 py-1 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-md font-mono">
                            {sub.optionName}
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          <div className="space-y-1">
                            {sub.taes.map((tae, idx) => (
                              <div key={idx} className="flex items-center gap-1.5 text-xs text-gray-600">
                                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500"></div>
                                <span>{tae}</span>
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="py-4 px-6 font-mono text-xs text-gray-500">
                          {new Date(sub.timestamp).toLocaleString("es-MX", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit"
                          })}
                        </td>
                        <td className="py-4 px-6 text-center">
                          <button
                            onClick={() => deleteSubmission(sub)}
                            className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="Eliminar Registro (Libera Cupo)"
                          >
                            <Trash2 className="h-4.5 w-4.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-12 px-6 text-center text-gray-400 font-medium">
                        No se encontraron registros de alumnos para los criterios de búsqueda.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Contador de Registros */}
            <div className="bg-gray-50/30 border-t border-gray-100 px-6 py-4 flex items-center justify-between text-xs text-gray-500 font-mono">
              <span>Registros filtrados: {filteredSubmissions.length} de {submissions.length} totales</span>
            </div>
          </div>
        </div>
      )}

      {/* VISTA 3: GESTIÓN Y CONFIGURACIÓN DE TAE Y CUPOS */}
      {activeTab === "manage" && (
        <div className="space-y-6 no-print animate-fadeIn">
          {/* Configuración de Logotipo */}
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-display font-bold text-gray-950">Identidad del Sistema (Logotipo URL)</h3>
                <p className="text-xs text-gray-500 font-sans">Configura una URL de imagen para personalizar el encabezado, reportes y pantalla de éxito.</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 items-end">
              <div className="grow">
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">URL del Logotipo (Imagen PNG/JPG/SVG)</label>
                <input
                  type="url"
                  value={newLogoUrl}
                  onChange={(e) => setNewLogoUrl(e.target.value)}
                  className="block w-full px-3 py-2 text-sm text-gray-800 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-mono"
                  placeholder="https://ejemplo.com/logo.png"
                />
              </div>
              <div className="flex gap-2">
                {logoUrl && (
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await setDoc(doc(db, "settings", "general"), { logoUrl: "" }, { merge: true });
                        setNewLogoUrl("");
                        showNotification("Logotipo restablecido al predeterminado");
                      } catch (err) {
                        alert("Error al restablecer logotipo.");
                      }
                    }}
                    className="px-3 py-2 border border-gray-200 text-xs font-semibold rounded-lg text-gray-500 bg-white hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    Quitar
                  </button>
                )}
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await setDoc(doc(db, "settings", "general"), { logoUrl: newLogoUrl.trim() }, { merge: true });
                      showNotification("Logotipo del sistema actualizado");
                    } catch (err) {
                      alert("Error al guardar logotipo.");
                    }
                  }}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer shadow-sm"
                >
                  Guardar Logo
                </button>
              </div>
            </div>

            {logoUrl && (
              <div className="pt-2 flex items-center gap-3 text-xs text-gray-500 bg-gray-50 p-3 rounded-xl border border-gray-100">
                <span className="font-semibold">Vista previa del logotipo:</span>
                <img src={logoUrl} className="h-8 w-auto object-contain bg-white p-1 rounded border border-gray-200" alt="Logo Vista Previa" referrerPolicy="no-referrer" />
              </div>
            )}
          </div>

          {/* Botón de Agregar Nueva Opción */}
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-display font-bold text-gray-900">
              Configuración de Opciones del Formulario
            </h3>
            <button
              onClick={startCreateOption}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-all cursor-pointer shadow-sm"
            >
              <Plus className="h-4 w-4" />
              <span>Nueva Opción de TAE</span>
            </button>
          </div>

          {/* Formulario de Edición / Creación (Si está activo) */}
          {(editingOption || isCreatingOption) && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl p-6 border-2 border-emerald-500/30 shadow-md space-y-4"
            >
              <div className="flex justify-between items-center border-b border-gray-100 pb-3 mb-2">
                <h4 className="text-base font-display font-bold text-gray-800">
                  {isCreatingOption ? "Crear Nueva Opción de Talleres" : `Editar "${editingOption?.name}"`}
                </h4>
                <button
                  onClick={() => {
                    setEditingOption(null);
                    setIsCreatingOption(false);
                  }}
                  className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={saveOption} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                    Identificador de la Opción (Ej. Opción A)
                  </label>
                  <input
                    type="text"
                    required
                    value={optionForm.name}
                    onChange={(e) => setOptionForm({ ...optionForm, name: e.target.value })}
                    className="block w-full px-3 py-2 text-sm text-gray-800 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder="Opción A"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                    Cupo Máximo (Lugares Disponibles)
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={optionForm.quota}
                    onChange={(e) => setOptionForm({ ...optionForm, quota: Number(e.target.value) })}
                    className="block w-full px-3 py-2 text-sm text-gray-800 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>

                <div className="md:col-span-2 space-y-3">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                    Talleres Especializantes (TAE) Incluidos
                  </label>
                  <div className="space-y-3">
                    {optionForm.taes.map((tae, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <input
                          type="text"
                          required
                          value={tae}
                          onChange={(e) => {
                            const newTaes = [...optionForm.taes];
                            newTaes[index] = e.target.value;
                            setOptionForm({ ...optionForm, taes: newTaes });
                          }}
                          className="block w-full px-3 py-2 text-sm text-gray-800 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                          placeholder={`Taller Especializante ${index + 1}`}
                        />
                        {optionForm.taes.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              const newTaes = optionForm.taes.filter((_, idx) => idx !== index);
                              setOptionForm({ ...optionForm, taes: newTaes });
                            }}
                            className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="Quitar Taller"
                          >
                            <Trash2 className="h-4.5 w-4.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  
                  <button
                    type="button"
                    onClick={() => {
                      setOptionForm({ ...optionForm, taes: [...optionForm.taes, ""] });
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 border border-emerald-600/30 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Agregar Taller (TAE)</span>
                  </button>
                </div>

                <div className="md:col-span-2 flex justify-end gap-2 pt-2 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingOption(null);
                      setIsCreatingOption(false);
                    }}
                    className="px-4 py-2 border border-gray-200 text-xs font-semibold rounded-lg text-gray-600 bg-white hover:bg-gray-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-all"
                  >
                    <Save className="h-4 w-4" />
                    <span>Guardar Cambios</span>
                  </button>
                </div>
              </form>
            </motion.div>
          )}

          {/* Listado de Opciones para Modificar */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {options.map((option) => (
              <div
                key={option.id}
                className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm flex flex-col justify-between space-y-4"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-lg font-display font-bold text-gray-900">{option.name}</h4>
                      <span className="text-xs text-gray-400 font-sans block mt-0.5 uppercase tracking-wide">
                        Cupo Máximo: {option.quota} alumnos
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => startEditOption(option)}
                        className="p-1.5 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                        title="Editar Opción"
                      >
                        <Edit3 className="h-4.5 w-4.5" />
                      </button>
                      <button
                        onClick={() => deleteOption(option.id)}
                        className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                        title="Eliminar Opción"
                      >
                        <Trash2 className="h-4.5 w-4.5" />
                      </button>
                    </div>
                  </div>

                  {/* Detalle de TAEs */}
                  <div className="space-y-2 mt-4">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest font-mono">Talleres Incluidos</span>
                    {option.taes.map((tae, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm text-gray-700 font-sans font-medium bg-gray-50 p-2 rounded-lg border border-gray-100">
                        <div className="h-2 w-2 rounded-full bg-emerald-500 shrink-0"></div>
                        <span className="truncate">{tae}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Cupos */}
                <div className="border-t border-gray-100 pt-4 flex items-center justify-between text-xs font-mono text-gray-500">
                  <span>Lugares ocupados:</span>
                  <span className="font-bold text-gray-800">{option.filled} / {option.quota}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL / SECCIÓN DE CONFIRMACIÓN DE REINICIO DE SISTEMA (MÁXIMA SEGURIDAD) */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 no-print">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-red-100 space-y-4 text-center"
          >
            <div className="mx-auto flex items-center justify-center h-14 w-14 rounded-full bg-red-50 border border-red-100 text-red-600">
              <AlertTriangle className="h-7 w-7" />
            </div>

            <h4 className="text-lg font-display font-bold text-gray-950">
              ¿Reiniciar Todo el Sistema de TAE?
            </h4>
            
            <p className="text-sm text-gray-500 font-sans leading-relaxed">
              Esta es una acción altamente destructiva y de seguridad. Se <strong>eliminarán permanentemente</strong> todos los registros de encuestas de los alumnos y todos los cupos ocupados volverán a cero para el próximo ciclo escolar.
            </p>

            <form onSubmit={resetEntireSystem} className="space-y-4 text-left">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 text-center">
                  Escribe la palabra <strong className="text-red-600 font-mono">REINICIAR</strong> para confirmar
                </label>
                <input
                  type="text"
                  required
                  value={resetConfirmCode}
                  onChange={(e) => setResetConfirmCode(e.target.value)}
                  placeholder="REINICIAR"
                  className="block w-full px-4 py-2.5 text-center text-sm font-mono font-bold text-red-600 border-2 border-red-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 uppercase"
                />
              </div>

              <div className="flex gap-2 justify-end pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowResetConfirm(false);
                    setResetConfirmCode("");
                  }}
                  className="px-4 py-2 border border-gray-200 text-xs font-semibold rounded-lg text-gray-600 bg-white hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={resetConfirmCode !== "REINICIAR"}
                  className={`px-4 py-2 text-xs font-semibold rounded-lg text-white transition-all cursor-pointer ${
                    resetConfirmCode === "REINICIAR"
                      ? "bg-red-600 hover:bg-red-700"
                      : "bg-red-300 cursor-not-allowed"
                  }`}
                >
                  Borrar Todo Permanentemente
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* COMPONENTE EXCLUSIVO DE IMPRESIÓN / EXPORTACIÓN PDF (Solo visible al imprimir) */}
      <div className="hidden print:block print-only space-y-8 p-6 font-sans">
        <div className="border-b-2 border-gray-300 pb-4 flex flex-col items-center justify-center text-center gap-3">
          {logoUrl && (
            <img src={logoUrl} className="h-14 w-auto object-contain" alt="Logo" referrerPolicy="no-referrer" />
          )}
          <div>
            <h1 className="text-2xl font-bold text-gray-900 font-display">REPORTE OFICIAL DE INSCRIPCIONES - TALLERES TAE</h1>
            <p className="text-xs text-gray-500 font-mono uppercase mt-1">
              Generado el: {new Date().toLocaleString("es-MX")} | Sistema de Registro Electrónico
            </p>
          </div>
        </div>

        {/* Resumen General para Impresión */}
        <div className="grid grid-cols-3 gap-4 border border-gray-200 p-4 rounded-xl">
          <div className="text-center border-r border-gray-100">
            <span className="text-xs text-gray-400 uppercase tracking-wider block font-mono">Total Inscritos</span>
            <span className="text-xl font-bold text-gray-800">{submissions.length}</span>
          </div>
          <div className="text-center border-r border-gray-100">
            <span className="text-xs text-gray-400 uppercase tracking-wider block font-mono">Capacidad Máxima</span>
            <span className="text-xl font-bold text-gray-800">{totalCapacity}</span>
          </div>
          <div className="text-center">
            <span className="text-xs text-gray-400 uppercase tracking-wider block font-mono">Ocupación General</span>
            <span className="text-xl font-bold text-gray-800">{totalPercentage}%</span>
          </div>
        </div>

        {/* Opciones y su demanda para Impresión */}
        <div className="space-y-2">
          <h2 className="text-sm font-bold uppercase tracking-wider text-gray-700 border-b border-gray-200 pb-1">Distribución de Talleres</h2>
          <div className="grid grid-cols-2 gap-4">
            {options.map(opt => (
              <div key={opt.id} className="border border-gray-100 p-3 rounded-lg flex justify-between items-center">
                <div>
                  <span className="text-sm font-bold text-gray-800 block">{opt.name}</span>
                  <span className="text-[10px] text-gray-500">{opt.taes.join(" - ")}</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-mono font-bold text-gray-700">{opt.filled} / {opt.quota}</span>
                  <span className="text-[9px] text-gray-400 block uppercase">lugares</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Lista completa de alumnos inscritos */}
        <div className="space-y-2 pt-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-gray-700 border-b border-gray-200 pb-1">Lista Nominal de Alumnos</h2>
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-gray-300 text-gray-600">
                <th className="py-2 font-bold uppercase">Alumno</th>
                <th className="py-2 font-bold uppercase">Opción</th>
                <th className="py-2 font-bold uppercase">Talleres (TAE)</th>
                <th className="py-2 font-bold uppercase text-right">Fecha de Registro</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredSubmissions.map((sub, idx) => (
                <tr key={sub.id} className="py-2">
                  <td className="py-2 font-semibold text-gray-900">{sub.studentName}</td>
                  <td className="py-2 font-mono font-bold text-emerald-800">{sub.optionName}</td>
                  <td className="py-2 text-gray-600">{sub.taes.join(" - ")}</td>
                  <td className="py-2 text-right font-mono text-[10px] text-gray-500">
                    {new Date(sub.timestamp).toLocaleString("es-MX")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Firma del Reporte */}
        <div className="pt-16 grid grid-cols-2 gap-8 text-center print-break-inside-avoid">
          <div className="mx-auto w-48 border-t border-gray-400 pt-2 text-xs text-gray-500">
            Firma Coordinador Académico
          </div>
          <div className="mx-auto w-48 border-t border-gray-400 pt-2 text-xs text-gray-500">
            Sello del Plantel Escolar
          </div>
        </div>
      </div>
    </div>
  );
}
