import { motion } from "framer-motion";
import { 
  Users, 
  Database, 
  DollarSign, 
  TrendingUp, 
  FileSpreadsheet, 
  ArrowRight 
} from "lucide-react";
import { LoadedFile } from "../../types";

import { EmployeeHistoryModule } from "./EmployeeHistoryModule";

interface DashboardPageProps {
  loadedFiles: LoadedFile[];
  allEmployeesData: any[];
  totalRows: number;
  totalFiles: number;
  setActiveTab: (tab: any) => void;
}

export function DashboardPage({ loadedFiles, allEmployeesData, totalRows, totalFiles, setActiveTab }: DashboardPageProps) {
  return (
    <motion.div 
      key="dashboard" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
      className="space-y-8"
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <DashboardCard 
          icon={<Users className="text-blue-400" />} 
          title="Total Empleados" 
          value={totalRows.toLocaleString()} 
          trend="+12% este mes"
        />
        <DashboardCard 
          icon={<Database className="text-purple-400" />} 
          title="Bases de Datos" 
          value={totalFiles.toString()} 
          trend="Archivos guardados"
        />
        <DashboardCard 
          icon={<DollarSign className="text-emerald-400" />} 
          title="Nómina Total" 
          value="Calculando..." 
          trend="Basado en archivos"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card flex flex-col">
          <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
            <TrendingUp size={20} className="text-indigo-400" />
            Actividad Reciente
          </h3>
          <div className="space-y-4 flex-1">
            {loadedFiles.slice(0, 5).map(f => (
              <div key={f.id} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-500/10 rounded-lg">
                    <FileSpreadsheet size={16} className="text-indigo-400" />
                  </div>
                  <span className="font-bold text-sm truncate max-w-[200px]">{f.name}</span>
                </div>
                <span className="text-[10px] uppercase font-black text-slate-500">{f.isFromDb ? 'Guardado' : 'Pendiente'}</span>
              </div>
            ))}
          </div>
          <button 
            onClick={() => setActiveTab('database')}
            className="w-full mt-6 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-slate-400 font-bold transition-all flex items-center justify-center gap-2"
          >
            Ver Bases de Datos <ArrowRight size={18} />
          </button>
        </div>

        <EmployeeHistoryModule allEmployeesData={allEmployeesData} />
      </div>
    </motion.div>
  );
}

function DashboardCard({ icon, title, value, trend }: { icon: any, title: string, value: string, trend: string }) {
  return (
    <div className="glass-card flex flex-col gap-4">
      <div className="flex justify-between items-start">
        <div className="p-3 bg-white/5 rounded-2xl border border-white/10">
          {icon}
        </div>
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{trend}</span>
      </div>
      <div>
        <p className="text-slate-500 text-sm font-medium">{title}</p>
        <p className="text-3xl font-black text-white">{value}</p>
      </div>
    </div>
  );
}
