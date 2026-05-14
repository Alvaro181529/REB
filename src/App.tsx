import React, { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { 
  Search, 
  Menu, 
  RefreshCw,
  Bell
} from "lucide-react";

// Components
import { Sidebar } from "./components/layout/Sidebar";
import { DashboardPage } from "./components/dashboard/DashboardPage";
import { EmployeesPage } from "./components/employees/EmployeesPage";
import { DatabasePage } from "./components/database/DatabasePage";
import { DisabilitiesPage } from "./components/disabilities/DisabilitiesPage";

// Hooks & Types
import { useAppData } from "./hooks/useAppData";
import { Tab } from "./types";

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isGlobalLoading, setIsGlobalLoading] = useState(false);

  const {
    loadedFiles,
    disabilities,
    isLoading,
    allEmployeesData,
    fetchFilesFromDb,
    fetchDisabilities,
    handleFilesUpdated,
    deleteFile,
    deleteDisability
  } = useAppData();

  const totalRows = loadedFiles.reduce((acc, f) => acc + (f.rowCount || 0), 0);
  const totalFiles = loadedFiles.length;

  return (
    <div className="flex h-screen w-screen bg-brand-dark text-slate-200 overflow-hidden relative">
      
      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setIsMobileMenuOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab}
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
      />

      <main className="flex-1 overflow-y-auto relative custom-scrollbar">
        <div className="max-w-[1600px] mx-auto p-4 md:p-8 lg:p-12">
          
          <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
            <div className="space-y-1">
              <h1 className="text-4xl font-black tracking-tighter text-white">
                {activeTab === 'dashboard' && "Bienvenido, Administrador"}
                {activeTab === 'employees' && "Gestión de Personal"}
                {activeTab === 'database' && "Centro de Datos"}
                {activeTab === 'disabilities' && "Planillas IT"}
              </h1>
              <p className="text-slate-500 font-medium text-sm">
                {activeTab === 'dashboard' && "Aquí tienes un resumen de tus operaciones actuales."}
                {activeTab === 'employees' && `Visualizando ${totalRows} registros de empleados.`}
                {activeTab === 'database' && "Gestiona y sube tus archivos de nómina Excel."}
                {activeTab === 'disabilities' && "Control de incapacidades temporales y subsidios."}
              </p>
            </div>

            <div className="flex items-center gap-4 w-full md:w-auto">
              <div className="relative hidden md:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" size={16} />
                <input 
                  type="text" 
                  placeholder="Búsqueda global..." 
                  className="bg-white/5 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-sm focus:border-indigo-500/50 focus:outline-none transition-all w-64"
                />
              </div>
              <button className="p-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all text-slate-400 relative">
                <Bell size={20} />
                <span className="absolute top-2 right-2 w-2 h-2 bg-indigo-500 rounded-full border-2 border-brand-dark"></span>
              </button>
              <button 
                onClick={fetchFilesFromDb}
                className="flex items-center gap-2 px-4 py-3 bg-white/5 border border-white/10 rounded-2xl hover:bg-indigo-500/10 hover:border-indigo-500/30 transition-all text-slate-400 hover:text-indigo-400 text-sm font-bold"
              >
                <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
                <span className="hidden md:inline">Actualizar</span>
              </button>
              <button onClick={() => setIsMobileMenuOpen(true)} className="lg:hidden p-3 bg-indigo-500 rounded-xl text-white">
                <Menu size={20} />
              </button>
            </div>
          </header>

          <AnimatePresence mode="wait">
            {activeTab === 'dashboard' && (
              <DashboardPage 
                loadedFiles={loadedFiles} 
                allEmployeesData={allEmployeesData}
                totalRows={totalRows} 
                totalFiles={totalFiles} 
                setActiveTab={setActiveTab} 
              />
            )}

            {activeTab === 'employees' && (
              <EmployeesPage 
                loadedFiles={loadedFiles}
                allEmployeesData={allEmployeesData}
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                selectedFileId={selectedFileId}
                setSelectedFileId={setSelectedFileId}
              />
            )}

            {activeTab === 'disabilities' && (
              <DisabilitiesPage 
                disabilities={disabilities}
                allEmployeesData={allEmployeesData}
                fetchDisabilities={fetchDisabilities}
                deleteDisability={deleteDisability}
                isLoading={isGlobalLoading}
                setIsLoading={setIsGlobalLoading}
              />
            )}

            {activeTab === 'database' && (
              <DatabasePage 
                loadedFiles={loadedFiles}
                selectedFileId={selectedFileId}
                setSelectedFileId={setSelectedFileId}
                handleFilesUpdated={handleFilesUpdated}
                deleteFile={deleteFile}
              />
            )}
          </AnimatePresence>

        </div>
      </main>

      {/* Global Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 bg-brand-dark/50 backdrop-blur-sm z-[100] flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <RefreshCw size={40} className="text-indigo-500 animate-spin" />
            <p className="text-white font-black uppercase tracking-widest text-xs">Sincronizando Datos...</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
