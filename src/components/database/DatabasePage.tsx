import { motion } from "framer-motion";
import { 
  FileSpreadsheet, 
  Table as TableIcon, 
  Trash2 
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
  
  const selectedFile = loadedFiles.find(f => f.id === selectedFileId);

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
          <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
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
