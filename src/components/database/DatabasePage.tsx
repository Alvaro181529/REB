import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { 
  FileSpreadsheet, 
  Table as TableIcon, 
  Trash2,
  Database,
  Search,
  CheckCircle2,
  Layers,
  ChevronRight,
} from "lucide-react";
import ExcelUploader from "../ExcelUploader";
import { LoadedFile } from "../../types";

interface DatabasePageProps {
  loadedFiles: LoadedFile[];
  selectedFileId: string | null;
  setSelectedFileId: (id: string | null) => void;
  handleFilesUpdated: (files: LoadedFile[]) => void;
  deleteFile: (id: string) => Promise<boolean>;
}

export function DatabasePage({ 
  loadedFiles, 
  selectedFileId, 
  setSelectedFileId, 
  handleFilesUpdated, 
  deleteFile 
}: DatabasePageProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'jjooss' | 'ss' | 'otros'>('all');
  
  const selectedFile = loadedFiles.find(f => f.id === selectedFileId);

  // Helper para clasificar el tipo de archivo (JJOOSS, SS, u otros)
  const getFileCategory = (file: LoadedFile): { type: 'jjooss' | 'ss' | 'otros'; label: string; badgeColor: string } => {
    const nameUpper = file.name.toUpperCase();
    const colsUpper = (file.columns || []).map(c => String(c).toUpperCase());

    const isSS = colsUpper.includes('PAT') || colsUpper.includes('NOM') || colsUpper.includes('APES') || nameUpper.includes(' SS ');
    if (isSS) {
      return { type: 'ss', label: 'SS (Sargentos)', badgeColor: 'bg-teal-500/10 text-teal-400 border-teal-500/20' };
    }

    const isJJOOSS = colsUpper.includes('APELLIDOS Y NOMBRES') || colsUpper.includes('GRADO') || nameUpper.includes('JJOOSS');
    if (isJJOOSS) {
      return { type: 'jjooss', label: 'JJOOSS (Oficiales)', badgeColor: 'bg-blue-500/10 text-blue-400 border-blue-500/20' };
    }

    return { type: 'otros', label: 'General', badgeColor: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' };
  };

  // Filtrado y búsqueda de archivos
  const filteredFiles = useMemo(() => {
    return loadedFiles.filter(file => {
      const matchesSearch = file.name.toLowerCase().includes(searchTerm.toLowerCase().trim());
      if (!matchesSearch) return false;

      if (categoryFilter === 'all') return true;
      const cat = getFileCategory(file);
      return cat.type === categoryFilter;
    });
  }, [loadedFiles, searchTerm, categoryFilter]);

  // Contadores de categorías
  const counts = useMemo(() => {
    let jjooss = 0;
    let ss = 0;
    let otros = 0;
    loadedFiles.forEach(f => {
      const cat = getFileCategory(f);
      if (cat.type === 'jjooss') jjooss++;
      else if (cat.type === 'ss') ss++;
      else otros++;
    });
    return { all: loadedFiles.length, jjooss, ss, otros };
  }, [loadedFiles]);

  return (
    <motion.div 
      key="database" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
      className="space-y-8"
    >
      <div className="glass-card">
        <ExcelUploader onFilesUpdated={handleFilesUpdated} />
      </div>

      {loadedFiles.length > 0 && (
        <div className="space-y-6">
          {/* Header de Archivos Cargados con Búsqueda y Filtros */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white/[0.02] border border-white/5 p-4 rounded-2xl">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-500/10 rounded-xl text-indigo-400">
                <Database size={20} />
              </div>
              <div>
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  Archivos en Base de Datos
                  <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-bold border border-indigo-500/30">
                    {loadedFiles.length}
                  </span>
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Selecciona una planilla para visualizar sus columnas y registros
                </p>
              </div>
            </div>

            {/* Filtros de Categoría y Barra de Búsqueda */}
            <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
              <div className="flex items-center bg-white/5 rounded-xl p-1 border border-white/5 text-xs font-bold">
                <button
                  onClick={() => setCategoryFilter('all')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${categoryFilter === 'all' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                >
                  Todos ({counts.all})
                </button>
                <button
                  onClick={() => setCategoryFilter('jjooss')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${categoryFilter === 'jjooss' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-blue-300'}`}
                >
                  JJOOSS ({counts.jjooss})
                </button>
                <button
                  onClick={() => setCategoryFilter('ss')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${categoryFilter === 'ss' ? 'bg-teal-600 text-white shadow' : 'text-slate-400 hover:text-teal-300'}`}
                >
                  SS ({counts.ss})
                </button>
              </div>

              <div className="relative flex-1 md:w-56">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar archivo..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 transition-all"
                />
              </div>
            </div>
          </div>

          {/* Grid de Tarjetas de Archivos */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {filteredFiles.map((file) => {
              const isSelected = selectedFileId === file.id;
              const cat = getFileCategory(file);

              return (
                <motion.div
                  key={file.id}
                  layout
                  onClick={() => setSelectedFileId(isSelected ? null : file.id)}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.99 }}
                  className={`p-4 rounded-2xl cursor-pointer transition-all border relative flex flex-col justify-between gap-3 group ${
                    isSelected
                      ? "bg-indigo-600/15 border-indigo-500/60 shadow-lg shadow-indigo-500/10 ring-1 ring-indigo-500/30"
                      : "bg-white/[0.03] border-white/5 hover:border-white/15 hover:bg-white/[0.06]"
                  }`}
                >
                  {/* Top: Icon + Category Badge + Indicator */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`p-2.5 rounded-xl shrink-0 transition-colors ${
                        isSelected 
                          ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/30' 
                          : file.isFromDb 
                            ? 'bg-indigo-500/10 text-indigo-400 group-hover:bg-indigo-500/20' 
                            : 'bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500/20'
                      }`}>
                        <FileSpreadsheet size={18} />
                      </div>
                      <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg border shrink-0 ${cat.badgeColor}`}>
                        {cat.label}
                      </span>
                    </div>

                    {isSelected ? (
                      <div className="flex items-center gap-1 text-[10px] font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20 shrink-0">
                        <CheckCircle2 size={12} />
                        <span>Activo</span>
                      </div>
                    ) : (
                      <ChevronRight size={14} className="text-slate-600 group-hover:text-slate-300 transition-colors shrink-0 mt-1" />
                    )}
                  </div>

                  {/* Middle: File Name */}
                  <div className="space-y-1">
                    <p className={`text-sm font-bold truncate transition-colors ${isSelected ? "text-white" : "text-slate-200 group-hover:text-white"}`} title={file.name}>
                      {file.name}
                    </p>
                    <div className="flex items-center gap-3 text-[11px] text-slate-500 font-medium">
                      <span className="flex items-center gap-1">
                        <Layers size={11} className="text-slate-500" />
                        <strong className="text-slate-400 font-semibold">{file.rowCount?.toLocaleString() ?? file.rows?.length?.toLocaleString() ?? 0}</strong> filas
                      </span>
                      <span>•</span>
                      <span>
                        <strong className="text-slate-400 font-semibold">{file.columns?.length || 0}</strong> col.
                      </span>
                    </div>
                  </div>

                  {/* Bottom: Origin status */}
                  <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[10px] text-slate-500">
                    <span className="flex items-center gap-1">
                      <span className={`w-1.5 h-1.5 rounded-full ${file.isFromDb ? 'bg-indigo-400' : 'bg-emerald-400'}`} />
                      {file.isFromDb ? 'Base de datos' : 'Nuevo archivo'}
                    </span>
                    <span className="text-indigo-400/80 group-hover:text-indigo-300 font-bold transition-colors">
                      {isSelected ? 'Cerrar vista' : 'Ver tabla →'}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {filteredFiles.length === 0 && (
            <div className="text-center py-12 bg-white/[0.02] border border-white/5 rounded-2xl">
              <p className="text-slate-400 text-sm font-medium">No se encontraron archivos con ese criterio.</p>
              <button 
                onClick={() => { setSearchTerm(''); setCategoryFilter('all'); }}
                className="mt-2 text-xs text-indigo-400 font-bold hover:underline"
              >
                Limpiar filtros
              </button>
            </div>
          )}

          {selectedFile && (
            <div className="glass-card !p-0 overflow-hidden">
              <div className="p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/5">
                <div className="flex items-center gap-3">
                  <TableIcon size={24} className="text-indigo-400" />
                  <h3 className="text-xl font-bold">{selectedFile.name}</h3>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                  <button 
                    onClick={() => deleteFile(selectedFile.id).then(success => success && setSelectedFileId(null))}
                    className="flex-1 md:flex-none p-2 bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white rounded-xl transition-all flex justify-center items-center"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-white/5 border-b border-white/5">
                      {selectedFile.columns.map((col, i) => (
                        <th key={i} className="py-4 px-8 text-[10px] font-black uppercase tracking-widest text-slate-500 whitespace-nowrap">{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {selectedFile.rows?.slice(0, 20).map((row, i) => (
                      <tr key={i} className="hover:bg-white/[0.01] transition-colors">
                        {selectedFile.columns.map((col, j) => (
                          <td key={j} className="py-4 px-8 text-sm text-slate-400 whitespace-nowrap">
                            {Array.isArray(row) ? row[j] : row[col]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
