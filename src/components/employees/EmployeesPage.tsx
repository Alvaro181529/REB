import React, { useState } from "react";
import { motion } from "framer-motion";
import { 
  Search, 
  Layers, 
  FileSpreadsheet 
} from "lucide-react";
import { LoadedFile } from "../../types";

interface EmployeesPageProps {
  loadedFiles: LoadedFile[];
  allEmployeesData: any[];
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  selectedFileId: string | null;
  setSelectedFileId: (id: string | null) => void;
}

export function EmployeesPage({ 
  loadedFiles, 
  allEmployeesData, 
  searchTerm, 
  setSearchTerm, 
  selectedFileId, 
  setSelectedFileId 
}: EmployeesPageProps) {
  
  const selectedFile = loadedFiles.find(f => f.id === selectedFileId);

  const filteredEmployees = allEmployeesData.filter(emp => 
    Object.values(emp).some(val => 
      String(val).toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  return (
    <motion.div 
      key="employees" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      {/* Source Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
        <button
          onClick={() => setSelectedFileId(null)}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${
            selectedFileId === null 
              ? "bg-indigo-500/20 border-indigo-500/50 text-indigo-400 shadow-lg shadow-indigo-500/10" 
              : "bg-white/5 border-white/5 text-slate-500 hover:text-slate-300 hover:bg-white/10"
          }`}
        >
          <Layers size={14} />
          Todos los Registros
        </button>
        {loadedFiles.map((file) => (
          <button
            key={file.id}
            onClick={() => setSelectedFileId(file.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${
              selectedFileId === file.id 
                ? "bg-indigo-500/20 border-indigo-500/50 text-indigo-400 shadow-lg shadow-indigo-500/10" 
                : "bg-white/5 border-white/5 text-slate-500 hover:text-slate-300 hover:bg-white/10"
            }`}
          >
            <FileSpreadsheet size={14} className={file.isFromDb ? "text-indigo-400" : "text-emerald-400"} />
            {file.name}
          </button>
        ))}
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="relative w-full md:max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
          <input 
            type="text" 
            placeholder="Buscar en esta base de datos..." 
            className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-4 focus:border-indigo-500/50 focus:outline-none transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="text-sm text-slate-500 font-bold">
          Encontrados: <span className="text-indigo-400">
            {selectedFileId 
              ? (selectedFile?.rows?.filter(r => Object.values(r).some(v => String(v).toLowerCase().includes(searchTerm.toLowerCase()))).length || 0)
              : filteredEmployees.length
            }
          </span>
        </div>
      </div>

      <div className="glass-card !p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-white/5 border-b border-white/5">
                <th className="py-4 px-8 text-xs font-black uppercase tracking-widest text-slate-500 whitespace-nowrap">Origen</th>
                {(selectedFileId ? selectedFile?.columns : (loadedFiles[0]?.columns))?.map((col: string, i: number) => (
                  <th key={i} className="py-4 px-8 text-xs font-black uppercase tracking-widest text-slate-500 whitespace-nowrap">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {(selectedFileId 
                ? (selectedFile?.rows || []).filter((r: any) => Object.values(r).some(v => String(v).toLowerCase().includes(searchTerm.toLowerCase())))
                : filteredEmployees
              ).slice(0, 50).map((emp: any, i: number) => (
                <tr key={i} className="hover:bg-white/[0.02] transition-colors group">
                  <td className="py-4 px-8">
                    <span className="text-[10px] bg-indigo-500/10 text-indigo-400 px-2 py-1 rounded-lg font-bold border border-indigo-500/20 whitespace-nowrap">
                      {selectedFileId ? selectedFile?.name : emp._source}
                    </span>
                  </td>
                  {(selectedFileId ? selectedFile?.columns : (loadedFiles[0]?.columns))?.map((col: string, j: number) => (
                    <td key={j} className="py-4 px-8 text-sm text-slate-400 whitespace-nowrap">
                      {emp[col] || emp[j]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}
