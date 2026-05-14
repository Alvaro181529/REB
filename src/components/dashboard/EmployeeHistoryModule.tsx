import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Search, 
  History, 
  User, 
  Calendar, 
  ChevronRight,
  FileText
} from "lucide-react";

interface EmployeeHistoryModuleProps {
  allEmployeesData: any[];
}

export function EmployeeHistoryModule({ allEmployeesData }: EmployeeHistoryModuleProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedCI, setSelectedCI] = useState<string | null>(null);
  const [employeeHistory, setEmployeeHistory] = useState<any[]>([]);

  // Helpers (similares a los de Disabilities)
  const getEmployeeName = (emp: any) => {
    if (!emp) return "";
    if (emp["APELLIDOS Y NOMBRES"]) return String(emp["APELLIDOS Y NOMBRES"]).trim();
    const parts = [emp["Pat"], emp["Mat"], emp["ApEs"], emp["Nom"], emp["Nom2"]].filter(p => p && String(p).trim() !== "");
    return parts.length > 0 ? parts.join(" ") : "Sin Nombre";
  };

  const getEmployeeCI = (emp: any) => {
    if (!emp) return "N/A";
    return String(emp["CI"] || emp["C.I."] || emp["CARNET"] || "N/A").trim();
  };

  const handleSearch = (term: string) => {
    setSearchQuery(term);
    if (term.length > 2) {
      // Usamos un Set para mostrar nombres únicos en las sugerencias
      const seen = new Set();
      const results = allEmployeesData.filter(emp => {
        const name = getEmployeeName(emp).toLowerCase();
        const ci = getEmployeeCI(emp).toLowerCase();
        const matches = name.includes(term.toLowerCase()) || ci.includes(term.toLowerCase());
        if (matches && !seen.has(ci)) {
          seen.add(ci);
          return true;
        }
        return false;
      }).slice(0, 5);
      setSearchResults(results);
    } else {
      setSearchResults([]);
    }
  };

  const selectEmployee = (emp: any) => {
    const ci = getEmployeeCI(emp);
    setSelectedCI(ci);
    setSearchQuery(getEmployeeName(emp));
    setSearchResults([]);

    // Buscar TODA la historia de este CI
    const history = allEmployeesData
      .filter(e => getEmployeeCI(e) === ci)
      .sort((a, b) => {
        const yearA = Number(a["Año"] || a["A_o"] || a["AÑO"] || 0);
        const monthA = Number(a["Mes"] || a["MES"] || 0);
        const yearB = Number(b["Año"] || b["A_o"] || b["AÑO"] || 0);
        const monthB = Number(b["Mes"] || b["MES"] || 0);
        return (yearB * 12 + monthB) - (yearA * 12 + monthA); // Orden descendente por fecha
      });
    
    setEmployeeHistory(history);
  };

  return (
    <div className="glass-card h-full flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold flex items-center gap-2">
          <History size={20} className="text-indigo-400" />
          Historial por Empleado
        </h3>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
        <input 
          type="text" 
          placeholder="Buscar historial por nombre o CI..." 
          className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-4 focus:border-indigo-500/50 focus:outline-none transition-all text-sm"
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
        />
        
        {/* Sugerencias */}
        <AnimatePresence>
          {searchResults.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              className="absolute top-full left-0 right-0 mt-2 bg-slate-800 border border-white/10 rounded-2xl overflow-hidden z-50 shadow-2xl"
            >
              {searchResults.map((emp, idx) => (
                <button
                  key={idx}
                  onClick={() => selectEmployee(emp)}
                  className="w-full px-4 py-3 text-left hover:bg-white/5 border-b border-white/5 last:border-0 flex justify-between items-center group"
                >
                  <div>
                    <p className="font-bold text-sm text-white group-hover:text-indigo-400 transition-colors">{getEmployeeName(emp)}</p>
                    <p className="text-[10px] text-slate-500 uppercase">CI: {getEmployeeCI(emp)}</p>
                  </div>
                  <ChevronRight size={14} className="text-slate-600" />
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar min-h-[300px]">
        {employeeHistory.length > 0 ? (
          <div className="space-y-3">
            {employeeHistory.map((rec, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                className="p-4 bg-white/5 border border-white/5 rounded-2xl hover:border-indigo-500/30 transition-all group"
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-indigo-500/10 rounded-lg">
                      <Calendar size={14} className="text-indigo-400" />
                    </div>
                    <span className="font-black text-xs text-white uppercase tracking-wider">
                      {rec["Mes"] || rec["MES"]}/{rec["Año"] || rec["A_o"] || rec["AÑO"]}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-lg">
                    {Number(rec["Total Gan Cotiz."] || rec["TOTAL GANADO"] || 0).toLocaleString()} Bs.
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-slate-500">
                  <FileText size={12} />
                  <span className="truncate">{rec._source}</span>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-40">
            <User size={48} className="mb-4 text-slate-600" />
            <p className="text-sm font-bold uppercase tracking-widest text-slate-500">
              {selectedCI ? "No se encontraron más registros" : "Busca un empleado para ver su historial"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
