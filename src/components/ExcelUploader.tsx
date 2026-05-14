import React, { useState, useCallback, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Upload, FileSpreadsheet, Database, Table, CheckCircle2, AlertCircle, X, Layers } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { invoke } from "@tauri-apps/api/core";

interface LoadedFile {
  id: string;
  name: string;
  columns: string[];
  rows: any[];
  rowCount: number;
  isFromDb?: boolean;
}

interface ExcelUploaderProps {
  onFilesUpdated: (files: LoadedFile[]) => void;
}

const ExcelUploader: React.FC<ExcelUploaderProps> = ({ onFilesUpdated }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [loadedFiles, setLoadedFiles] = useState<LoadedFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    // Inicializar el worker usando la sintaxis de Vite
    workerRef.current = new Worker(new URL('../workers/excelWorker.ts', import.meta.url), {
      type: 'module'
    });

    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  const processFileWithWorker = (file: File): Promise<LoadedFile | null> => {
    return new Promise((resolve) => {
      if (!workerRef.current) {
        console.error("Worker not initialized");
        resolve(null);
        return;
      }

      const timeout = setTimeout(() => {
        console.error("Worker timeout for file:", file.name);
        workerRef.current?.removeEventListener('message', onMessage);
        resolve(null);
      }, 10000); // 10 segundos de timeout

      const onMessage = (event: MessageEvent) => {
        const result = event.data;
        if (result.fileName === file.name) {
          clearTimeout(timeout);
          workerRef.current?.removeEventListener('message', onMessage);

          if (result.success) {
            resolve({
              id: Math.random().toString(36).substr(2, 9),
              name: result.fileName,
              columns: result.columns,
              rows: result.rows,
              rowCount: result.rowCount
            });
          } else {
            console.error("Worker failed to parse:", result.error);
            resolve(null);
          }
        }
      };

      workerRef.current.addEventListener('message', onMessage);

      const reader = new FileReader();
      reader.onerror = () => {
        clearTimeout(timeout);
        workerRef.current?.removeEventListener('message', onMessage);
        resolve(null);
      };

      reader.onload = (e) => {
        const fileData = e.target?.result;
        workerRef.current?.postMessage({
          fileData,
          fileName: file.name
        });
      };
      reader.readAsArrayBuffer(file);
    });
  };

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    setIsProcessing(true);
    const newLoadedFiles: LoadedFile[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (['xlsx', 'xls', 'csv'].includes(ext || '')) {
        const processed = await processFileWithWorker(file);
        if (processed) newLoadedFiles.push(processed);
      }
    }

    const updatedList = [...loadedFiles, ...newLoadedFiles];
    setLoadedFiles(updatedList);
    onFilesUpdated(updatedList);
    setIsProcessing(false);
  }, [loadedFiles, onFilesUpdated]);

  const removeFile = (id: string) => {
    const updatedList = loadedFiles.filter(f => f.id !== id);
    setLoadedFiles(updatedList);
    onFilesUpdated(updatedList);
  };

  const saveAllToDatabase = async () => {
    try {
      setIsProcessing(true);
      for (const file of loadedFiles) {
        if (!file.isFromDb) {
          await invoke("save_excel_data", {
            name: file.name,
            columns: file.columns,
            data: file.rows
          });
        }
      }
      alert(`¡Se han guardado los nuevos archivos exitosamente!`);
      window.location.reload();
    } catch (error) {
      console.error("Error saving data:", error);
      alert("Error al guardar los datos");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="w-full space-y-8">
      {/* Drop Zone */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{
          opacity: 1,
          y: 0,
          scale: isDragging ? 1.02 : 1,
          borderColor: isDragging ? "rgb(16 185 129)" : "rgba(255, 255, 255, 0.1)",
          backgroundColor: isDragging ? "rgba(16, 185, 129, 0.05)" : "rgba(255, 255, 255, 0.02)"
        }}
        className={`upload-area relative !p-12 overflow-hidden transition-colors`}
        onDragEnter={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFiles(e.dataTransfer.files);
          }
        }}
        onClick={() => document.getElementById('file-upload')?.click()}
      >
        <input
          id="file-upload"
          type="file"
          multiple
          hidden
          accept=".xlsx, .xls, .csv"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />

        <div className="flex flex-col items-center gap-4 relative z-10">
          <motion.div
            animate={{ rotate: isDragging ? [0, -10, 10, 0] : 0 }}
            transition={{ repeat: isDragging ? Infinity : 0, duration: 0.5 }}
            className={`p-4 rounded-3xl transition-colors ${isDragging ? 'bg-emerald-500/20 text-emerald-400' : 'bg-indigo-500/10 text-indigo-400'}`}
          >
            <Upload size={40} />
          </motion.div>
          <div className="text-center space-y-1">
            <p className="text-xl font-black text-white">
              {isDragging ? '¡Suéltalos ahora!' : 'Arrastra tus archivos Excel'}
            </p>
            <p className="text-sm text-slate-500 font-medium">
              O haz clic para explorar en tu equipo
            </p>
          </div>
        </div>

        {/* Glow effect when dragging */}
        {isDragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 bg-emerald-500/5 pointer-events-none"
          />
        )}

        {isProcessing && (
          <div className="absolute inset-0 bg-brand-dark/80 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center">
            <div className="h-10 w-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
            <p className="mt-4 text-sm font-bold text-indigo-400">Procesando archivos...</p>
          </div>
        )}
      </motion.div>

      {/* Loaded Files List */}
      <AnimatePresence>
        {loadedFiles.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between px-2">
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                <Layers size={16} />
                Archivos en Cola ({loadedFiles.length})
              </h3>
              {loadedFiles.length > 0 && (
                <button
                  onClick={saveAllToDatabase}
                  disabled={isProcessing}
                  className={`text-xs font-bold flex items-center gap-1 transition-all ${
                    isProcessing 
                    ? 'text-slate-500 cursor-not-allowed opacity-50' 
                    : 'text-indigo-400 hover:text-indigo-300'
                  }`}
                >
                  {isProcessing ? 'Guardando...' : 'Procesar todos'} 
                  {!isProcessing && <CheckCircle2 size={14} />}
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {loadedFiles.map((file) => (
                <motion.div
                  key={file.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="p-4 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-between group hover:border-indigo-500/30 transition-all"
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className={`p-2 rounded-lg shrink-0 ${file.isFromDb ? 'bg-indigo-500/10' : 'bg-emerald-500/10'}`}>
                      <FileSpreadsheet size={20} className={file.isFromDb ? 'text-indigo-400' : 'text-emerald-400'} />
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-sm font-bold text-slate-200 truncate">{file.name}</p>
                      <p className="text-[10px] text-slate-500 uppercase font-black tracking-tighter">
                        {file.rowCount} filas • {file.columns.length} columnas
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeFile(file.id); }}
                    className="p-2 hover:bg-rose-500/10 text-slate-500 hover:text-rose-400 rounded-xl transition-colors"
                  >
                    <X size={18} />
                  </button>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ExcelUploader;
