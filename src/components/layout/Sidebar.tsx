import React from "react";
import { 
  FileSpreadsheet, 
  LayoutDashboard, 
  Users, 
  Database, 
  Clock, 
  Settings, 
  X as XIcon 
} from "lucide-react";
import { Tab } from "../../types";

interface SidebarProps {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (open: boolean) => void;
}

export function Sidebar({ activeTab, setActiveTab, isMobileMenuOpen, setIsMobileMenuOpen }: SidebarProps) {
  return (
    <aside className={`
      fixed inset-y-0 left-0 z-50 w-72 bg-brand-dark border-r border-white/5 flex flex-col p-6 transition-transform duration-300 lg:relative lg:translate-x-0
      ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
    `}>
      <div className="flex items-center justify-between mb-10 px-2">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-500 rounded-xl shadow-lg shadow-indigo-500/20">
            <FileSpreadsheet className="text-white" size={24} />
          </div>
          <span className="text-xl font-black tracking-tighter text-white">REB System</span>
        </div>
        <button onClick={() => setIsMobileMenuOpen(false)} className="lg:hidden p-2 text-slate-500">
          <XIcon size={20} />
        </button>
      </div>

      <nav className="flex-1 space-y-2">
        <SidebarItem 
          icon={<LayoutDashboard size={20} />} 
          label="Dashboard" 
          active={activeTab === 'dashboard'} 
          onClick={() => { setActiveTab('dashboard'); setIsMobileMenuOpen(false); }} 
        />
        <SidebarItem 
          icon={<Users size={20} />} 
          label="Empleados" 
          active={activeTab === 'employees'} 
          onClick={() => { setActiveTab('employees'); setIsMobileMenuOpen(false); }} 
        />
        <SidebarItem 
          icon={<Database size={20} />} 
          label="Base de Datos" 
          active={activeTab === 'database'} 
          onClick={() => { setActiveTab('database'); setIsMobileMenuOpen(false); }} 
        />
        <SidebarItem 
          icon={<Clock size={20} />} 
          label="Planillas (IT)" 
          active={activeTab === 'disabilities'} 
          onClick={() => { setActiveTab('disabilities'); setIsMobileMenuOpen(false); }} 
        />
      </nav>

      <div className="mt-auto pt-6 border-t border-white/5">
        <SidebarItem 
          icon={<Settings size={20} />} 
          label="Configuración" 
          active={false} 
          onClick={() => {}} 
        />
      </div>
    </aside>
  );
}

function SidebarItem({ icon, label, active, onClick }: { icon: any, label: string, active: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-4 px-4 py-3 rounded-2xl transition-all font-bold text-sm ${
        active 
          ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shadow-lg shadow-indigo-500/5" 
          : "text-slate-500 hover:text-slate-300 hover:bg-white/5"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
