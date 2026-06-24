import React, { useState, useEffect } from "react";
import { 
  collection, 
  onSnapshot, 
  runTransaction, 
  doc, 
  query,
  orderBy
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { TAEOption } from "../types";
import { 
  User, 
  BookOpen, 
  CheckCircle2, 
  AlertTriangle, 
  Users, 
  Check, 
  RefreshCw, 
  ChevronRight
} from "lucide-react";
import { motion } from "motion/react";

interface FormularyProps {
  onRegisterSuccess?: (studentName: string, selectedOption: TAEOption) => void;
  logoUrl?: string;
  instructions?: string;
  instructionsTitle?: string;
}

export default function Formulary({ onRegisterSuccess, logoUrl, instructions, instructionsTitle }: FormularyProps) {
  const [options, setOptions] = useState<TAEOption[]>([]);
  const [studentName, setStudentName] = useState("");
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<{
    studentName: string;
    optionName: string;
    taes: string[];
  } | null>(null);

  // Escuchar las opciones de TAE en tiempo real
  useEffect(() => {
    const optionsRef = collection(db, "options");
    const q = query(optionsRef, orderBy("name", "asc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const opts: TAEOption[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        opts.push({
          id: doc.id,
          name: data.name || "",
          taes: data.taes || [],
          quota: typeof data.quota === "number" ? data.quota : 20,
          filled: typeof data.filled === "number" ? data.filled : 0,
        });
      });
      setOptions(opts);
      setLoadingOptions(false);
    }, (err) => {
      setLoadingOptions(false);
      handleFirestoreError(err, OperationType.GET, "options");
    });

    return () => unsubscribe();
  }, []);

  // Manejar el envío del formulario usando una transacción de Firestore
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validaciones básicas
    if (!studentName.trim()) {
      setError("Por favor, ingresa tu nombre completo.");
      return;
    }
    if (studentName.trim().length < 4) {
      setError("Por favor, ingresa un nombre más completo (mínimo 4 caracteres).");
      return;
    }
    if (!selectedOptionId) {
      setError("Por favor, selecciona una opción de TAE.");
      return;
    }

    const selectedOption = options.find(o => o.id === selectedOptionId);
    if (!selectedOption) {
      setError("La opción seleccionada no es válida.");
      return;
    }

    if (selectedOption.filled >= selectedOption.quota) {
      setError("Lo sentimos, esta opción ya no tiene cupos disponibles. Elige otra.");
      return;
    }

    setLoading(true);

    try {
      // Realizar la transacción para garantizar control de sobrecupo en tiempo real
      await runTransaction(db, async (transaction) => {
        const optionRef = doc(db, "options", selectedOption.id);
        const optionSnap = await transaction.get(optionRef);

        if (!optionSnap.exists()) {
          throw new Error("La opción seleccionada no existe en la base de datos.");
        }

        const optionData = optionSnap.data();
        const currentFilled = typeof optionData.filled === "number" ? optionData.filled : 0;
        const currentQuota = typeof optionData.quota === "number" ? optionData.quota : 20;

        if (currentFilled >= currentQuota) {
          throw new Error("¡Cupo agotado! Alguien acaba de ocupar el último lugar disponible de esta opción. Por favor selecciona otra.");
        }

        // 1. Incrementar el contador de cupo lleno en la opción
        transaction.update(optionRef, {
          filled: currentFilled + 1
        });

        // 2. Crear el documento de registro del alumno
        const submissionId = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        const submissionRef = doc(db, "submissions", submissionId);
        
        transaction.set(submissionRef, {
          id: submissionId,
          studentName: studentName.trim(),
          optionId: selectedOption.id,
          optionName: selectedOption.name,
          taes: selectedOption.taes,
          timestamp: new Date().toISOString()
        });
      });

      // Registro exitoso
      setSuccessData({
        studentName: studentName.trim(),
        optionName: selectedOption.name,
        taes: selectedOption.taes
      });

      if (onRegisterSuccess) {
        onRegisterSuccess(studentName.trim(), selectedOption);
      }

      // Limpiar campos del formulario
      setStudentName("");
      setSelectedOptionId(null);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Ocurrió un error al registrar tu formulario. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSuccessData(null);
    setError(null);
  };

  if (loadingOptions) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <RefreshCw className="h-10 w-10 text-emerald-600 animate-spin mb-4" />
        <p className="text-gray-500 font-medium">Cargando opciones de talleres en tiempo real...</p>
      </div>
    );
  }

  // Vista de Éxito
  if (successData) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="max-w-xl mx-auto bg-white rounded-3xl shadow-xl p-8 border border-emerald-100 text-center"
        id="success-card"
      >
        {logoUrl && (
          <img src={logoUrl} className="h-16 w-auto object-contain mx-auto mb-6" alt="Logo" referrerPolicy="no-referrer" />
        )}
        
        <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-emerald-50 mb-6 border-2 border-emerald-200">
          <CheckCircle2 className="h-12 w-12 text-emerald-600" />
        </div>
        
        <h2 className="text-3xl font-display font-bold text-gray-900 tracking-tight mb-6">
          ¡Registro Completado!
        </h2>

        <div className="bg-gray-50 rounded-2xl p-6 text-left border border-gray-100">
          <div className="mb-4">
            <span className="text-xs font-mono text-gray-400 block uppercase tracking-wider">Alumno</span>
            <span className="text-lg font-semibold text-gray-800 font-sans block">{successData.studentName}</span>
          </div>
          
          <div className="border-t border-gray-200 pt-4">
            <span className="text-xs font-mono text-gray-400 block uppercase tracking-wider mb-1">Selección de Talleres</span>
            <span className="text-base font-bold text-emerald-700 font-display block mb-2">{successData.optionName}</span>
            <div className="space-y-1.5 pl-2">
              {successData.taes.map((tae, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm text-gray-600">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-500"></div>
                  <span>{tae}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-1 sm:px-0">
      {/* Encabezado del Formulario */}
      <div className="text-center mb-6 flex flex-col items-center justify-center gap-2">
        {logoUrl && (
          <img src={logoUrl} className="h-12 sm:h-16 w-auto object-contain mx-auto" alt="Logo" referrerPolicy="no-referrer" />
        )}
        <h1 className="text-2xl sm:text-4xl font-display font-bold text-gray-900 tracking-tight">
          Selección de Talleres TAE
        </h1>
        <p className="max-w-2xl mx-auto text-xs sm:text-sm text-gray-500 leading-relaxed font-sans px-2">
          Estimado alumno, ingresa tu nombre completo y selecciona la opción de Trayectoria de Aprendizaje Especializante (TAE) de tu preferencia.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4" id="tae-form">
        {/* Sección: Datos del Alumno */}
        <div className="bg-white rounded-2xl shadow-xs border border-gray-100 p-4 sm:p-6">
          <div>
            <label htmlFor="student-name" className="block text-xs font-semibold text-gray-600 mb-1.5">
              Nombre Completo del Alumno <span className="text-red-500">*</span>
            </label>
            <div className="relative rounded-xl shadow-2xs">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <User className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="text"
                name="studentName"
                id="student-name"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                required
                className="block w-full pl-9 pr-3 py-2.5 text-base text-gray-800 placeholder-gray-400 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-sans"
                placeholder="Ej. Mariana del Toro"
              />
            </div>
          </div>
        </div>

        {/* Cuadro de Instrucciones */}
        {instructions && (
          <div className="bg-emerald-50/40 border border-emerald-100/70 rounded-2xl p-4 sm:p-5 text-gray-700 text-sm leading-relaxed font-sans">
            <div>
              <h4 className="font-semibold text-emerald-950 text-xs sm:text-sm mb-1 uppercase tracking-wider font-mono">
                {instructionsTitle || "Instrucciones de Registro"}
              </h4>
              <div className="whitespace-pre-wrap text-emerald-800 text-xs sm:text-sm leading-relaxed">{instructions}</div>
            </div>
          </div>
        )}

        {/* Sección: Opciones de TAE */}
        <div className="bg-white rounded-2xl shadow-xs border border-gray-100 p-4 sm:p-6">
          <div className="flex items-center gap-2.5 mb-4 border-b border-gray-100 pb-3">
            <div className="h-8 w-8 bg-emerald-50 rounded-lg flex items-center justify-center">
              <BookOpen className="h-4.5 w-4.5 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-base font-display font-semibold text-gray-900">Selección de Opción</h3>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {options.map((option) => {
              const isFull = option.filled >= option.quota;
              const isSelected = selectedOptionId === option.id;
              const percentFilled = Math.min(Math.round((option.filled / option.quota) * 100), 100);
              const spotsAvailable = Math.max(option.quota - option.filled, 0);

              return (
                <div
                  key={option.id}
                  onClick={() => !isFull && setSelectedOptionId(option.id)}
                  id={`option-card-${option.id}`}
                  className={`relative rounded-xl border-2 p-4 transition-all duration-200 cursor-pointer select-none flex flex-col justify-between ${
                    isFull
                      ? "border-gray-100 bg-gray-50/50 opacity-60 cursor-not-allowed"
                      : isSelected
                      ? "border-emerald-600 bg-emerald-50/10 shadow-xs ring-1 ring-emerald-500/10"
                      : "border-gray-200 bg-white hover:border-gray-300"
                  }`}
                >
                  <div>
                    {/* Encabezado Opcion */}
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="text-base font-display font-bold text-gray-900 leading-tight">{option.name}</h4>
                      </div>
                      
                      {/* Control Selector / Badge */}
                      {isFull ? (
                        <span className="px-2 py-0.5 text-[10px] font-bold text-red-600 bg-red-50 border border-red-100 rounded-full font-mono">
                          Lleno
                        </span>
                      ) : (
                        <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all ${
                          isSelected ? "border-emerald-600 bg-emerald-600" : "border-gray-300"
                        }`}>
                          {isSelected && <Check className="h-3 w-3 text-white stroke-[3px]" />}
                        </div>
                      )}
                    </div>

                    {/* Lista de Talleres */}
                    <div className="space-y-1.5 mb-4 pt-1">
                      {option.taes.map((tae, idx) => (
                        <div key={idx} className="flex items-start gap-1.5 text-xs text-gray-600 font-sans">
                          <CheckCircle2 className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${
                            isFull ? "text-gray-300" : isSelected ? "text-emerald-600" : "text-emerald-500"
                          }`} />
                          <span className="leading-tight">{tae}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Sección Inferior de Cupos */}
                  <div className="border-t border-gray-100 pt-3 mt-auto">
                    <div className="flex items-center justify-between text-[10px] font-mono text-gray-400 mb-1.5">
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        <span>Cupo:</span>
                      </span>
                      <span className="font-semibold text-gray-600">
                        {option.filled} / {option.quota}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden mb-1.5">
                      <div 
                        className={`h-full rounded-full transition-all duration-300 ${
                          isFull 
                            ? "bg-red-500" 
                            : percentFilled > 80 
                            ? "bg-amber-500" 
                            : "bg-emerald-500"
                        }`}
                        style={{ width: `${percentFilled}%` }}
                      ></div>
                    </div>

                    <div className="text-right">
                      {isFull ? (
                        <span className="text-[10px] font-medium text-red-500 font-sans">Sin lugares</span>
                      ) : (
                        <span className={`text-[10px] font-semibold font-sans ${
                          spotsAvailable <= 3 ? "text-amber-600" : "text-emerald-700"
                        }`}>
                          {spotsAvailable} {spotsAvailable === 1 ? "lugar" : "lugares"}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Alerta de Error */}
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-start gap-2.5 text-xs text-red-700"
            id="form-error-alert"
          >
            <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
            <div>
              <h5 className="font-semibold font-display">Error de Registro</h5>
              <p className="mt-0.5 leading-relaxed font-sans font-medium">{error}</p>
            </div>
          </motion.div>
        )}

        {/* Botón de Enviar */}
        <div className="pt-1">
          <button
            type="submit"
            disabled={loading}
            id="btn-submit-form"
            className={`w-full inline-flex items-center justify-center gap-1.5 px-6 py-3 border border-transparent text-sm font-semibold rounded-xl text-white shadow-xs transition-all cursor-pointer ${
              loading 
                ? "bg-emerald-400 cursor-not-allowed" 
                : "bg-emerald-600 hover:bg-emerald-700 focus:ring-4 focus:ring-emerald-500/20 active:scale-[0.99]"
            }`}
          >
            {loading ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Procesando registro...</span>
              </>
            ) : (
              <>
                <span>Confirmar Selección de TAE</span>
                <ChevronRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
