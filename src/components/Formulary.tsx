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
  Sparkles,
  ChevronRight
} from "lucide-react";
import { motion } from "motion/react";

interface FormularyProps {
  onRegisterSuccess?: (studentName: string, selectedOption: TAEOption) => void;
}

export default function Formulary({ onRegisterSuccess }: FormularyProps) {
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
        <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-emerald-50 mb-6 border-2 border-emerald-200">
          <CheckCircle2 className="h-12 w-12 text-emerald-600" />
        </div>
        
        <h2 className="text-3xl font-display font-bold text-gray-900 tracking-tight mb-2">
          ¡Registro Completado!
        </h2>
        
        <p className="text-emerald-700 font-medium text-sm flex items-center justify-center gap-1.5 mb-6">
          <Sparkles className="h-4 w-4" /> Cupo reservado exitosamente en tiempo real
        </p>

        <div className="bg-gray-50 rounded-2xl p-6 mb-8 text-left border border-gray-100">
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

        <p className="text-sm text-gray-500 mb-8 leading-relaxed">
          Gracias por completar tu encuesta. Tu selección ha sido almacenada para el próximo semestre. Puedes cerrar esta pestaña o registrar a otro estudiante si es necesario.
        </p>

        <button
          onClick={resetForm}
          className="w-full inline-flex items-center justify-center px-6 py-3.5 border border-transparent text-sm font-medium rounded-xl text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 cursor-pointer"
          id="btn-register-another"
        >
          Registrar otra respuesta
        </button>
      </motion.div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Encabezado del Formulario */}
      <div className="text-center mb-10">
        <span className="px-3 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-full tracking-wider uppercase mb-3 inline-block font-mono">
          Semestre Próximo
        </span>
        <h1 className="text-4xl font-display font-bold text-gray-900 tracking-tight sm:text-5xl mb-4">
          Selección de Talleres TAE
        </h1>
        <p className="max-w-2xl mx-auto text-base text-gray-600 leading-relaxed font-sans">
          Estimado alumno, por favor ingresa tu nombre completo y selecciona la opción de Trayectoria de Aprendizaje Especializante (TAE) de tu preferencia. Los cupos son limitados y se actualizan en tiempo real.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8" id="tae-form">
        {/* Sección: Datos del Alumno */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
          <div className="flex items-center gap-3 mb-6 border-b border-gray-100 pb-4">
            <div className="h-10 w-10 bg-emerald-50 rounded-xl flex items-center justify-center">
              <User className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-lg font-display font-semibold text-gray-900">Datos Personales</h3>
              <p className="text-xs text-gray-400 font-sans">Introduce tu información de registro</p>
            </div>
          </div>

          <div>
            <label htmlFor="student-name" className="block text-sm font-medium text-gray-700 mb-2">
              Nombre Completo del Alumno <span className="text-red-500">*</span>
            </label>
            <div className="relative rounded-xl shadow-xs">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <User className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                name="studentName"
                id="student-name"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                required
                className="block w-full pl-11 pr-4 py-3.5 text-gray-800 placeholder-gray-400 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-sans text-base"
                placeholder="Ej. Juan Pérez García"
              />
            </div>
            <p className="mt-2.5 text-xs text-gray-400 flex items-center gap-1">
              <span>Por favor ingresa tu nombre completo tal como aparece en tus documentos escolares oficiales.</span>
            </p>
          </div>
        </div>

        {/* Sección: Opciones de TAE */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
          <div className="flex items-center gap-3 mb-6 border-b border-gray-100 pb-4">
            <div className="h-10 w-10 bg-emerald-50 rounded-xl flex items-center justify-center">
              <BookOpen className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-lg font-display font-semibold text-gray-900">Selección de Opción</h3>
              <p className="text-xs text-gray-400 font-sans">Elige uno de los paquetes de TAE disponibles</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                  className={`relative rounded-2xl border-2 p-6 transition-all duration-200 cursor-pointer select-none flex flex-col justify-between ${
                    isFull
                      ? "border-gray-100 bg-gray-50/50 opacity-60 cursor-not-allowed"
                      : isSelected
                      ? "border-emerald-600 bg-emerald-50/20 shadow-md ring-1 ring-emerald-500/20"
                      : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm"
                  }`}
                >
                  <div>
                    {/* Encabezado Opcion */}
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h4 className="text-lg font-display font-bold text-gray-900">{option.name}</h4>
                        <span className="text-xs text-gray-400 font-sans uppercase font-medium tracking-wide">Paquete TAE</span>
                      </div>
                      
                      {/* Control Selector / Badge */}
                      {isFull ? (
                        <span className="px-2.5 py-1 text-xs font-semibold text-red-600 bg-red-50 border border-red-100 rounded-full font-mono">
                          Lleno
                        </span>
                      ) : (
                        <div className={`h-6 w-6 rounded-full border-2 flex items-center justify-center transition-all ${
                          isSelected ? "border-emerald-600 bg-emerald-600" : "border-gray-300"
                        }`}>
                          {isSelected && <Check className="h-4 w-4 text-white stroke-[3px]" />}
                        </div>
                      )}
                    </div>

                    {/* Lista de Talleres */}
                    <div className="space-y-3 mb-6 pt-1">
                      {option.taes.map((tae, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-sm text-gray-700 font-sans font-medium">
                          <CheckCircle2 className={`h-4 w-4 shrink-0 mt-0.5 ${
                            isFull ? "text-gray-400" : isSelected ? "text-emerald-600" : "text-emerald-500"
                          }`} />
                          <span>{tae}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Sección Inferior de Cupos */}
                  <div className="border-t border-gray-100 pt-4 mt-auto">
                    <div className="flex items-center justify-between text-xs font-mono text-gray-500 mb-2">
                      <span className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        <span>Cupo:</span>
                      </span>
                      <span className="font-semibold text-gray-700">
                        {option.filled} / {option.quota}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden mb-2">
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
                        <span className="text-xs font-medium text-red-600 font-sans">Sin lugares</span>
                      ) : (
                        <span className={`text-xs font-semibold font-sans ${
                          spotsAvailable <= 3 ? "text-amber-600" : "text-emerald-700"
                        }`}>
                          {spotsAvailable} {spotsAvailable === 1 ? "lugar disponible" : "lugares disponibles"}
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
            className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-sm text-red-700"
            id="form-error-alert"
          >
            <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <h5 className="font-semibold font-display">Error de Registro</h5>
              <p className="mt-0.5 leading-relaxed font-sans font-medium">{error}</p>
            </div>
          </motion.div>
        )}

        {/* Botón de Enviar */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={loading}
            id="btn-submit-form"
            className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 border border-transparent text-base font-semibold rounded-xl text-white shadow-md transition-all cursor-pointer ${
              loading 
                ? "bg-emerald-400 cursor-not-allowed" 
                : "bg-emerald-600 hover:bg-emerald-700 hover:shadow-lg focus:ring-4 focus:ring-emerald-500/20 active:scale-[0.98]"
            }`}
          >
            {loading ? (
              <>
                <RefreshCw className="h-5 w-5 animate-spin" />
                <span>Procesando registro...</span>
              </>
            ) : (
              <>
                <span>Confirmar Selección de TAE</span>
                <ChevronRight className="h-5 w-5" />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
