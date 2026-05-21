import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Search,
  Users,
  Calendar,
  Table as TableIcon,
  Filter,
  ArrowRight,
  Trash2,
  AlertCircle,
  Download,
  FileSpreadsheet,
  Pencil,
  X,
  Check
} from "lucide-react";
import { DisabilityRecord } from "../../types";
import { invoke } from "@tauri-apps/api/core";
import { exportDisabilitiesToExcel, exportEmployeeSourceData } from "../../utils/disabilityExport";

interface DisabilitiesPageProps {
  disabilities: DisabilityRecord[];
  allEmployeesData: any[];
  fetchDisabilities: () => Promise<void>;
  deleteDisability: (id: string) => Promise<boolean>;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

export function DisabilitiesPage({
  disabilities,
  allEmployeesData,
  fetchDisabilities,
  deleteDisability,
  isLoading,
  setIsLoading
}: DisabilitiesPageProps) {

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [disabilityType, setDisabilityType] = useState<'enfermedad' | 'maternidad' | 'accidente'>('enfermedad');
  const [dates, setDates] = useState({ baja: '', alta: '' });
  const [disabilityFilter, setDisabilityFilter] = useState<'all' | 'enfermedad' | 'maternidad' | 'accidente'>('all');
  const [selectedMonthGroup, setSelectedMonthGroup] = useState<string>('all');
  const [selectedCityFilter, setSelectedCityFilter] = useState<string>('La Paz');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [city, setCity] = useState<string>("La Paz");
  const [tableSearchQuery, setTableSearchQuery] = useState("");
  const [editingRecord, setEditingRecord] = useState<DisabilityRecord | null>(null);
  const [editDraft, setEditDraft] = useState<{
    baja: string; alta: string; type: 'enfermedad' | 'maternidad' | 'accidente';
    basicSalary: number; city: string; insuredNumber: string;
  } | null>(null);
  const ITEMS_PER_PAGE = 10;

  const BOLIVIAN_CITIES = [
    "La Paz", "Cochabamba", "Santa Cruz", "Oruro",
    "Potosí", "Tarija", "Chuquisaca", "Beni", "Pando"
  ];

  // Helpers robustos para los formatos de Excel del usuario
  const getEmployeeName = (emp: any) => {
    if (!emp) return "";
    if (emp["APELLIDOS Y NOMBRES"]) return String(emp["APELLIDOS Y NOMBRES"]).trim();
    // Formato dividido
    const parts = [
      emp["Pat"],
      emp["Mat"],
      emp["ApEs"],
      emp["Nom"],
      emp["Nom2"]
    ].filter(p => p && String(p).trim() !== "");
    return parts.length > 0 ? parts.join(" ") : "Sin Nombre";
  };

  const getEmployeeCI = (emp: any) => {
    if (!emp) return "N/A";
    const raw = String(emp["CI"] || emp["C.I."] || emp["CARNET"] || "N/A").trim();
    // Eliminar ceros a la izquierda (ej: 0000123 -> 123)
    return raw === "N/A" ? raw : raw.replace(/^0+/, '');
  };

  const getEmployeeSalary = (emp: any) => {
    if (!emp) return 0;
    const raw = emp["Total Gan Cotiz."] || emp["TOTAL GANADO"] || emp["HABER BÁSICO"] || emp["SALARIO"] || 0;
    if (typeof raw === 'string') {
      // Limpiar formatos como "2,500.00" o "Bs. 2.500"
      return Number(raw.replace(/[^0-9.]/g, '')) || 0;
    }
    return Number(raw) || 0;
  };

  const getEmployeeBirthDate = (emp: any) => {
    if (!emp) return "";
    const raw = emp["NAC."] || emp["NAC"] || emp["FECHA NACIMIENTO"] || "";

    // Si el worker ya lo normalizó o es un string limpio
    const strRaw = String(raw).trim();

    // Si por alguna razón sigue siendo un número serial de Excel (compatibilidad archivos viejos)
    if (typeof raw === 'number' && raw > 10000 && raw < 100000) {
      const date = new Date((raw - 25569) * 86400 * 1000);
      return date.toISOString().split('T')[0];
    }

    return strRaw;
  };

  const calculateDays = (start: string, end: string) => {
    if (!start || !end) return 0;
    const s = new Date(start);
    const e = new Date(end);
    const diff = Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
    return diff >= 0 ? diff + 1 : 0;
  };

  const [gender, setGender] = useState<'M' | 'F'>('M');
  const [insuredNumber, setInsuredNumber] = useState("");

  React.useEffect(() => {
    if (selectedEmployee) {
      const birthDate = getEmployeeBirthDate(selectedEmployee);
      const name = getEmployeeName(selectedEmployee);
      setInsuredNumber(generateInsuredNumber(birthDate, name, gender));
    } else {
      setInsuredNumber("");
    }
  }, [selectedEmployee, gender]);

  const generateInsuredNumber = (birthDate: string, fullName: string, currentGender: 'M' | 'F') => {
    if (!birthDate) return "N/A";

    let year = "", month = "", day = "";

    // El worker ahora estandariza a MM/DD/YYYY
    if (birthDate.includes('/')) {
      const parts = birthDate.split('/');
      if (parts[2]?.length === 4) { // MM/DD/YYYY
        [month, day, year] = parts;
      } else if (parts[0]?.length === 4) { // YYYY/MM/DD
        [year, month, day] = parts;
      }
    }
    // Compatibilidad con YYYY-MM-DD
    else if (birthDate.includes('-')) {
      [year, month, day] = birthDate.split('-');
    }

    if (!year || !month || !day) return "N/A";

    // Estandarizar: si el mes es >12, asumir que es DD/MM/YYYY y swap
    let mmVal = parseInt(month);
    if (mmVal > 12) {
      [month, day] = [day, month];
      mmVal = parseInt(month);
    }

    const yy = year.substring(2, 4);
    const mm = (currentGender === 'F' ? mmVal + 50 : mmVal).toString().padStart(2, '0');
    const dd = day.padStart(2, '0');

    const datePart = yy + mm + dd;

    const nameParts = (fullName || "").trim().split(/\s+/);
    const initials = nameParts.map(p => p[0]?.toUpperCase()).join("");
    return datePart + initials;
  };

  const getPercentage = (type: string) => type === 'enfermedad' ? 0.75 : 0.90;

  const [foundMonthlyRecord, setFoundMonthlyRecord] = useState<any>(null);
  const [monthError, setMonthError] = useState<string | null>(null);

  // ... (otros helpers)

  const handleDateBajaChange = (date: string) => {
    setDates({ ...dates, baja: date });
    if (!selectedEmployee || !date) return;
    // Usar split para evitar problemas de zona horaria con new Date()
    const [y, m, _d] = date.split('-').map(Number);
    const month = m;
    const year = y;

    // Buscar el registro del empleado para ese mes y año específicos
    const ci = getEmployeeCI(selectedEmployee).trim();

    // Normalizar año de 2 dígitos a 4 (ej: 26 → 2026)
    const normalizeYear = (y: number) => y < 100 ? 2000 + y : y;

    let monthlyRecord = allEmployeesData.find(emp => {
      const empCi = getEmployeeCI(emp).trim();
      const rawMonth = String(emp["Mes"] || emp["MES"] || "0").trim();
      const rawYear = String(emp["Año"] || emp["A_o"] || emp["AÑO"] || emp["A_O"] || "0").trim();
      const empMonth = parseInt(rawMonth, 10);
      const empYear = normalizeYear(parseInt(rawYear, 10));
      return empCi === ci && empMonth === month && empYear === year;
    });

    // Búsqueda flexible si falló la exacta (ignorar puntos, guiones, etc en el CI)
    if (!monthlyRecord) {
      const cleanCI = ci.replace(/[^a-zA-Z0-9]/g, "");
      monthlyRecord = allEmployeesData.find(emp => {
        const empCi = getEmployeeCI(emp).trim().replace(/[^a-zA-Z0-9]/g, "");
        const rawMonth = String(emp["Mes"] || emp["MES"] || "0").trim();
        const rawYear = String(emp["Año"] || emp["A_o"] || emp["AÑO"] || emp["A_O"] || "0").trim();
        const empMonth = parseInt(rawMonth, 10);
        const empYear = normalizeYear(parseInt(rawYear, 10));
        return empCi === cleanCI && empMonth === month && empYear === year;
      });
    }

    if (monthlyRecord) {
      setFoundMonthlyRecord(monthlyRecord);
      setMonthError(null);
    } else {
      setFoundMonthlyRecord(null);
      setMonthError(`No se encontró registro para el mes ${month}/${year}. Se usará el último dato disponible.`);
    }
  };

  const basicSalary = foundMonthlyRecord
    ? getEmployeeSalary(foundMonthlyRecord)
    : (selectedEmployee ? getEmployeeSalary(selectedEmployee) : 0);

  const dailyRate = basicSalary / 30;
  const percentageAmount = dailyRate * getPercentage(disabilityType);
  const rawDays = calculateDays(dates.baja, dates.alta);
  // Para Enfermedad Común, se restan 3 días de carencia (período no cubierto)
  const totalDays = disabilityType === 'enfermedad' ? Math.max(0, rawDays - 3) : rawDays;
  const totalToPay = percentageAmount * totalDays;

  const handleSearch = (term: string) => {
    setSearchQuery(term);
    if (term.length > 2) {
      // Agrupar por CI para no mostrar duplicados
      const grouped = new Map<string, any>();
      allEmployeesData.forEach(emp => {
        const name = getEmployeeName(emp).toLowerCase();
        const ci = getEmployeeCI(emp).toLowerCase();
        if (name.includes(term.toLowerCase()) || ci.includes(term.toLowerCase())) {
          const key = getEmployeeCI(emp);
          if (grouped.has(key)) {
            // Ya existe: agregar el archivo a las fuentes
            const existing = grouped.get(key);
            const src = emp._source || "Desconocido";
            if (!existing._sources.includes(src)) existing._sources.push(src);
          } else {
            grouped.set(key, { ...emp, _sources: [emp._source || "Desconocido"] });
          }
        }
      });
      setSearchResults(Array.from(grouped.values()).slice(0, 5));
    } else {
      setSearchResults([]);
    }
  };

  const selectEmployee = (emp: any) => {
    setSelectedEmployee(emp);
    setSearchQuery(getEmployeeName(emp));
    setSearchResults([]);
    setFoundMonthlyRecord(null);
    setMonthError(null);

    // Auto-detectar género si existe en el excel
    const rawSex = String(emp["Sex"] || emp["SEXO"] || emp["GENERO"] || "").toUpperCase().trim();
    if (rawSex.startsWith('F') || rawSex.includes('MUJER')) {
      setGender('F');
    } else {
      setGender('M');
    }
  };

  // ... (handleSaveDisability permanece similar)

  const handleSaveDisability = async () => {
    if (!selectedEmployee || !dates.baja || !dates.alta) {
      alert("Por favor completa los datos básicos");
      return;
    }

    const employeeName = getEmployeeName(selectedEmployee);
    const newRecord = {
      employee: selectedEmployee,
      employeeName,
      ci: getEmployeeCI(selectedEmployee),
      city,
      type: disabilityType,
      dates,
      calculations: {
        basicSalary,
        dailyRate,
        percentage: getPercentage(disabilityType) * 100,
        percentageAmount,
        totalDays,
        totalToPay,
        insuredNumber: insuredNumber
      },
      createdAt: new Date().toISOString()
    };

    try {
      setIsLoading(true);
      await invoke("save_disability", { data: newRecord });
      await fetchDisabilities();
      setIsFormOpen(false);
      setSelectedEmployee(null);
      setSearchQuery("");
      setDates({ baja: '', alta: '' });
    } catch (err) {
      alert("Error al guardar la planilla");
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = async () => {
    if (disabilityFilter === 'all') return;

    // Requiere un mes específico seleccionado
    if (selectedMonthGroup === 'all') {
      alert('Por favor selecciona un mes específico en el filtro "Periodo" antes de generar el reporte.');
      return;
    }

    // Filtrar por tipo + mes (FECHA FIN) + ciudad
    let recordsToExport = disabilities.filter(d => {
      if (d.type !== disabilityFilter) return false;
      const parts = d.dates.alta.split('-');
      const yearMonth = parts.length >= 2 ? `${parts[0]}-${parts[1]}` : 'Desconocido';
      if (yearMonth !== selectedMonthGroup) return false;
      if (selectedCityFilter !== 'all' && d.city !== selectedCityFilter) return false;
      return true;
    });

    if (recordsToExport.length === 0) {
      alert(`No hay registros de ${disabilityFilter} para el periodo ${selectedMonthGroup}.`);
      return;
    }

    // Ordenar alfabéticamente por nombre de empleado
    recordsToExport = recordsToExport.sort((a, b) => a.employeeName.localeCompare(b.employeeName));

    await exportDisabilitiesToExcel(
      recordsToExport,
      disabilityFilter,
      selectedMonthGroup,
      selectedCityFilter !== 'all' ? selectedCityFilter : undefined
    );
  };

  const getMonthName = (monthStr: string) => {
    const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    const monthIndex = parseInt(monthStr, 10) - 1;
    return months[monthIndex] || monthStr;
  };

  // --- Edit handlers ---
  const handleStartEdit = (record: DisabilityRecord) => {
    setEditingRecord(record);
    setEditDraft({
      baja: record.dates.baja,
      alta: record.dates.alta,
      type: record.type,
      basicSalary: record.calculations.basicSalary,
      city: record.city || 'La Paz',
      insuredNumber: record.calculations.insuredNumber || '',
    });
  };

  const handleCancelEdit = () => { setEditingRecord(null); setEditDraft(null); };

  const handleSaveEdit = async () => {
    if (!editingRecord || !editDraft) return;
    const rawDays = calculateDays(editDraft.baja, editDraft.alta);
    const effectiveDays = editDraft.type === 'enfermedad' ? Math.max(0, rawDays - 3) : rawDays;
    const pct = getPercentage(editDraft.type);
    const dailyR = editDraft.basicSalary / 30;
    const pctAmt = dailyR * pct;
    const totalPay = pctAmt * effectiveDays;
    const updated: DisabilityRecord = {
      ...editingRecord,
      type: editDraft.type,
      city: editDraft.city,
      dates: { baja: editDraft.baja, alta: editDraft.alta },
      calculations: {
        ...editingRecord.calculations,
        basicSalary: editDraft.basicSalary,
        dailyRate: dailyR,
        percentage: pct * 100,
        percentageAmount: pctAmt,
        totalDays: effectiveDays,
        totalToPay: totalPay,
        insuredNumber: editDraft.insuredNumber,
      }
    };
    try {
      setIsLoading(true);
      await invoke("update_disability", { id: editingRecord.id, data: updated });
      await fetchDisabilities();
      handleCancelEdit();
    } catch (err) {
      alert("Error al actualizar la planilla");
    } finally {
      setIsLoading(false);
    }
  };

  // --- Filtered + searched records ---
  const filteredDisabilities = disabilities.filter(d =>
    (disabilityFilter === 'all' || d.type === disabilityFilter) &&
    (selectedCityFilter === 'all' || d.city === selectedCityFilter)
  );

  const groupedDisabilities = filteredDisabilities.reduce((acc, curr) => {
    const parts = curr.dates.alta.split('-');
    const yearMonth = parts.length >= 2 ? `${parts[0]}-${parts[1]}` : 'Desconocido';
    if (!acc[yearMonth]) acc[yearMonth] = [];
    acc[yearMonth].push(curr);
    return acc;
  }, {} as Record<string, DisabilityRecord[]>);

  const sortedMonths = Object.keys(groupedDisabilities).sort((a, b) => b.localeCompare(a));

  let baseRecords: DisabilityRecord[] = [];
  if (selectedMonthGroup === 'all') {
    baseRecords = filteredDisabilities.slice().sort((a, b) => b.dates.alta.localeCompare(a.dates.alta));
  } else {
    baseRecords = (groupedDisabilities[selectedMonthGroup] || []).slice();
  }

  // Apply table search
  const tq = tableSearchQuery.toLowerCase().trim();
  let recordsToPaginate: DisabilityRecord[] = tq
    ? baseRecords.filter(d =>
      d.employeeName.toLowerCase().includes(tq) ||
      (d.ci || '').toLowerCase().includes(tq) ||
      (d.city || '').toLowerCase().includes(tq) ||
      d.type.toLowerCase().includes(tq) ||
      d.dates.baja.includes(tq) ||
      d.dates.alta.includes(tq)
    )
    : baseRecords;

  const totalPages = Math.ceil(recordsToPaginate.length / ITEMS_PER_PAGE) || 1;
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedRecords = recordsToPaginate.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const paginatedGroups = paginatedRecords.reduce((acc, curr) => {
    const parts = curr.dates.alta.split('-');
    const yearMonth = parts.length >= 2 ? `${parts[0]}-${parts[1]}` : 'Desconocido';
    if (!acc[yearMonth]) acc[yearMonth] = [];
    acc[yearMonth].push(curr);
    return acc;
  }, {} as Record<string, DisabilityRecord[]>);

  const sortedPaginatedMonths = Object.keys(paginatedGroups).sort((a, b) => b.localeCompare(a));


  return (
    <motion.div
      key="disabilities" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
      className="space-y-8 pb-20"
    >
      <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4 bg-white/[0.02] p-3 rounded-[2rem] border border-white/5 shadow-2xl overflow-hidden">
        <div className="flex flex-col items-stretch gap-4 flex-1 min-w-0">
          {/* Group 1: Type Filters - Scrollable on small screens */}
          <div className="flex justify-between flex bg-white/5 p-1 rounded-2xl border border-white/5 overflow-x-auto no-scrollbar shrink-0">
            {['all', 'enfermedad', 'maternidad', 'accidente'].map(type => (
              <button
                key={type}
                onClick={() => { setDisabilityFilter(type as any); setCurrentPage(1); }}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${disabilityFilter === type
                  ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/30"
                  : "text-slate-500 hover:text-slate-300 hover:bg-white/5"
                  }`}
              >
                {type === 'all' ? 'Todas' : type === 'accidente' ? 'Accidente' : type}
              </button>
            ))}

            <AnimatePresence mode="popLayout">
              {disabilityFilter !== 'all' && (
                <motion.button
                  layout
                  initial={{ opacity: 0, x: -10, scale: 0.9 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: -10, scale: 0.9 }}
                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                  onClick={handleExport}
                  title={selectedMonthGroup === 'all' ? 'Selecciona un periodo para exportar' : `Exportar ${disabilityFilter} - ${selectedMonthGroup !== 'all' ? getMonthName(selectedMonthGroup.split('-')[1]) + ' ' + selectedMonthGroup.split('-')[0] : ''}`}
                  className={`flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shrink-0 ml-1 ${
                    selectedMonthGroup !== 'all'
                      ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/30'
                      : 'bg-white/5 text-slate-500 cursor-not-allowed border border-white/5'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <Download size={13} />
                    <span>Reporte</span>
                  </div>
                  {selectedMonthGroup !== 'all' && (
                    <span className="text-[8px] font-bold normal-case tracking-normal opacity-80">
                      {getMonthName(selectedMonthGroup.split('-')[1])} {selectedMonthGroup.split('-')[0]}
                    </span>
                  )}
                  {selectedMonthGroup === 'all' && (
                    <span className="text-[8px] font-medium normal-case tracking-normal opacity-60">Elige periodo</span>
                  )}
                </motion.button>
              )}
            </AnimatePresence>
          </div>

          {/* Group 2: Context Filters (Month & City) - Flexible wrap */}
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <div className="flex-1 min-w-[140px] flex items-center gap-3 bg-white/5 border border-white/5 hover:border-indigo-500/30 rounded-2xl px-4 py-2 transition-all group">
              <Calendar size={14} className="text-indigo-400 shrink-0" />
              <div className="flex flex-col min-w-0 w-full">
                <span className="text-[8px] font-black uppercase tracking-tighter text-slate-500 leading-none mb-1">Periodo</span>
                <select
                  value={selectedMonthGroup}
                  onChange={(e) => { setSelectedMonthGroup(e.target.value); setCurrentPage(1); }}
                  className="bg-transparent text-[11px] font-bold text-white focus:outline-none cursor-pointer truncate w-full"
                >
                  <option value="all" className="bg-slate-900">Todos</option>
                  {sortedMonths.map(month => (
                    <option key={month} value={month} className="bg-slate-900">
                      {month !== 'Desconocido' ? `${getMonthName(month.split('-')[1])} ${month.split('-')[0]}` : month}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex-1 min-w-[140px] flex items-center gap-3 bg-white/5 border border-white/5 hover:border-indigo-500/30 rounded-2xl px-4 py-2 transition-all group">
              <Users size={14} className="text-emerald-400 shrink-0" />
              <div className="flex flex-col min-w-0 w-full">
                <span className="text-[8px] font-black uppercase tracking-tighter text-slate-500 leading-none mb-1">Ubicación</span>
                <select
                  value={selectedCityFilter}
                  onChange={(e) => { setSelectedCityFilter(e.target.value); setCurrentPage(1); }}
                  className="bg-transparent text-[11px] font-bold text-white focus:outline-none cursor-pointer truncate w-full"
                >
                  <option value="all" className="bg-slate-900">Todas</option>
                  {BOLIVIAN_CITIES.map(c => (
                    <option key={c} value={c} className="bg-slate-900">{c}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={() => setIsFormOpen(!isFormOpen)}
          className={`flex items-center justify-center gap-3 px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all shadow-xl shrink-0 ${isFormOpen
            ? 'bg-rose-500/20 border border-rose-500/30 text-rose-400'
            : 'bg-indigo-500 text-white hover:bg-indigo-600 shadow-indigo-500/30'
            }`}
        >
          {isFormOpen ? <Plus size={16} className="rotate-45" /> : <Plus size={16} />}
          {isFormOpen ? 'Cerrar' : 'Nueva Planilla'}
        </button>
      </div>

      <AnimatePresence>
        {isFormOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
            className="glass-card !p-8 border-indigo-500/20"
          >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
              <div className="space-y-6">
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  <span className="h-6 w-1 bg-indigo-500 rounded-full"></span>
                  1. Selección de Personal
                </h3>
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
                  <input
                    type="text"
                    placeholder="Escribe nombre o carnet para buscar..."
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 focus:border-indigo-500/50 focus:outline-none transition-all"
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                  />

                  {/* Sugerencias de búsqueda */}
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
                            className="w-full px-6 py-4 text-left hover:bg-white/5 border-b border-white/5 last:border-0 flex justify-between items-center group"
                          >
                            <div className="space-y-1">
                              <p className="font-bold text-white group-hover:text-indigo-400 transition-colors">{getEmployeeName(emp)}</p>
                              <p className="text-[10px] text-slate-500 uppercase tracking-tighter">CI: {getEmployeeCI(emp)}</p>
                              {emp._sources && emp._sources.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {emp._sources.map((src: string, si: number) => (
                                    <span key={si} className="text-[8px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-1.5 py-0.5 rounded truncate max-w-[140px]">
                                      {src}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                            <ArrowRight size={14} className="text-slate-600 group-hover:text-indigo-400 transition-all group-hover:translate-x-1 shrink-0 ml-2" />
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {selectedEmployee ? (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-6 bg-indigo-500/5 rounded-3xl border border-indigo-500/10 space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Nombre Completo</span>
                      <span className="text-sm font-bold text-white">{getEmployeeName(selectedEmployee)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Documento ID</span>
                      <span className="text-sm font-bold text-indigo-400">{getEmployeeCI(selectedEmployee)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Fecha Nacimiento (NAC)</span>
                      <span className="text-sm font-bold text-white">{getEmployeeBirthDate(selectedEmployee) || "N/A"}</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-white/5">
                      <span className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Salario Cotizable (ULT)</span>
                      <div className="text-right">
                        <span className="text-sm font-bold text-emerald-400 font-mono">{basicSalary.toLocaleString()} Bs.</span>
                        <p className="text-[9px] text-slate-500 font-bold uppercase tracking-tighter">
                          Periodo: {(foundMonthlyRecord || selectedEmployee)["Mes"] || (foundMonthlyRecord || selectedEmployee)["MES"]}/{(foundMonthlyRecord || selectedEmployee)["Año"] || (foundMonthlyRecord || selectedEmployee)["A_o"] || (foundMonthlyRecord || selectedEmployee)["AÑO"]}
                        </p>
                      </div>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-white/5">
                      <span className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Género</span>
                      <div className="flex bg-white/5 p-1 rounded-xl gap-1">
                        <button
                          onClick={() => setGender('M')}
                          className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${gender === 'M' ? 'bg-indigo-500 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'
                            }`}
                        >
                          Hombre
                        </button>
                        <button
                          onClick={() => setGender('F')}
                          className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${gender === 'F' ? 'bg-pink-500 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'
                            }`}
                        >
                          Mujer
                        </button>
                      </div>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-white/5">
                      <span className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Nro Asegurado</span>
                      <input
                        type="text"
                        value={insuredNumber}
                        onChange={(e) => setInsuredNumber(e.target.value)}
                        className="text-[15px] font-bold font-mono bg-indigo-500/10 px-4 py-1 rounded-lg text-indigo-300 border border-indigo-500/20 focus:border-indigo-500/50 focus:outline-none w-48 text-right"
                      />
                    </div>
                  </motion.div>
                ) : (
                  <div className="p-12 border-2 border-dashed border-white/5 rounded-3xl flex flex-col items-center justify-center text-slate-600">
                    <Users size={32} className="mb-2 opacity-20" />
                    <p className="text-xs font-bold uppercase tracking-tighter">Esperando búsqueda...</p>
                  </div>
                )}
              </div>

              <div className="space-y-6">
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  <span className="h-6 w-1 bg-emerald-500 rounded-full"></span>
                  2. Datos de la Baja
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-[10px] uppercase font-black text-slate-500 ml-2">Motivo de Incapacidad</label>
                    <select
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 focus:border-indigo-500/50 appearance-none"
                      value={disabilityType}
                      onChange={(e) => setDisabilityType(e.target.value as any)}
                    >
                      <option value="enfermedad" className="bg-slate-800">Enfermedad Común (75%)</option>
                      <option value="maternidad" className="bg-slate-800">Maternidad (90%)</option>
                      <option value="accidente" className="bg-slate-800">Accidente de Trabajo (90%)</option>
                    </select>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-[10px] uppercase font-black text-slate-500 ml-2">Ciudad / Departamento</label>
                    <select
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 focus:border-indigo-500/50 appearance-none"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                    >
                      {BOLIVIAN_CITIES.map(c => (
                        <option key={c} value={c} className="bg-slate-800">{c}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-black text-slate-500 ml-2 flex items-center gap-1">
                      <Calendar size={10} /> Fecha Inicio
                    </label>
                    <input
                      type="date"
                      className={`w-full bg-white/5 border rounded-2xl py-3 px-4 focus:border-indigo-500/50 text-white transition-all ${monthError ? 'border-amber-500/50' : 'border-white/10'
                        }`}
                      value={dates.baja}
                      onChange={(e) => handleDateBajaChange(e.target.value)}
                      onBlur={(e) => e.target.blur()}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-black text-slate-500 ml-2 flex items-center gap-1">
                      <Calendar size={10} /> Fecha Fin
                    </label>
                    <input
                      type="date"
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 focus:border-indigo-500/50 text-white"
                      value={dates.alta}
                      onChange={(e) => setDates({ ...dates, alta: e.target.value })}
                      onBlur={(e) => e.target.blur()}
                    />
                  </div>
                </div>

                {monthError && (
                  <motion.div
                    initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                    className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-3 mt-4"
                  >
                    <AlertCircle size={16} className="text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-[10px] text-amber-200/70 font-medium leading-relaxed">
                      {monthError}
                    </p>
                  </motion.div>
                )}

                {selectedEmployee && (
                  <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="p-6 bg-emerald-500/5 rounded-3xl border border-emerald-500/10 grid grid-cols-2 gap-y-6 gap-x-4 mt-6">
                    <CalculationItem
                      label="Salario Base"
                      value={basicSalary.toLocaleString() + " Bs."}
                      subtitle={(() => {
                        if (!foundMonthlyRecord) return "Último dato disponible";
                        const m = foundMonthlyRecord["Mes"] || foundMonthlyRecord["MES"] || "?";
                        const rawY = String(foundMonthlyRecord["Año"] || foundMonthlyRecord["A_o"] || foundMonthlyRecord["AÑO"] || foundMonthlyRecord["A_O"] || "?");
                        const y = parseInt(rawY) < 100 ? 2000 + parseInt(rawY) : rawY;
                        return `Mes: ${m}/${y}`;
                      })()}
                    />
                    <CalculationItem
                      label="Sueldo Diario (Salario/30)"
                      value={dailyRate.toFixed(2) + " Bs."}
                    />

                    <div className="col-span-2 border-t border-emerald-500/10 pt-4 grid grid-cols-2 gap-4">
                      <CalculationItem
                        label={`Monto x Día (${getPercentage(disabilityType) * 100}%)`}
                        value={percentageAmount.toFixed(2) + " Bs."}
                        highlight
                      />
                      <CalculationItem
                        label="Días de Baja"
                        value={totalDays > 0 ? totalDays + " días" : rawDays > 0 ? "0 días" : "Pendiente de fechas"}
                        subtitle={disabilityType === 'enfermedad' && rawDays > 0 ? `${rawDays} - 3 días carencia` : undefined}
                      />
                    </div>

                    {totalDays > 0 && (
                      <div className="col-span-2 border-t-2 border-emerald-500/20 pt-4 flex justify-between items-end bg-emerald-500/5 -mx-6 -mb-6 p-6 rounded-b-3xl">
                        <CalculationItem
                          label="Subsidio Total a Pagar"
                          value={totalToPay.toFixed(2) + " Bs."}
                          highlight
                        />
                        <div className="text-right">
                          <p className="text-[9px] text-emerald-500/50 font-black uppercase italic">Cálculo Final</p>
                          <p className="text-[10px] text-slate-500 font-bold">{percentageAmount.toFixed(2)} x {totalDays} días</p>
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}

                <div className="flex gap-4 pt-4">
                  <button
                    onClick={handleSaveDisability}
                    disabled={!selectedEmployee || totalDays <= 0 || isLoading}
                    className={`flex-1 py-4 rounded-2xl font-black uppercase tracking-widest text-sm transition-all ${!selectedEmployee || totalDays <= 0 || isLoading
                      ? 'bg-white/5 text-slate-600 cursor-not-allowed'
                      : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20'
                      }`}
                  >
                    {isLoading ? 'Guardando...' : 'Guardar Planilla'}
                  </button>
                  <button
                    onClick={() => { setIsFormOpen(false); setSelectedEmployee(null); }}
                    className="px-8 py-4 bg-white/5 hover:bg-white/10 rounded-2xl text-slate-400 font-bold transition-all"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="glass-card !p-0 overflow-hidden border-white/5">
        <div className="p-4 border-b border-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white/[0.01]">
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 flex items-center gap-2 shrink-0">
            <TableIcon size={16} className="text-indigo-500" />
            Planillas Generadas
            <span className="text-[10px] font-bold text-slate-600 normal-case tracking-normal">
              ({recordsToPaginate.length})
            </span>
          </h3>
          {/* Barra de búsqueda de la tabla */}
          <div className="relative w-full sm:max-w-xs">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            <input
              type="text"
              placeholder={`Buscar en ${disabilityFilter === 'all' ? 'todas' : disabilityFilter}...`}
              value={tableSearchQuery}
              onChange={e => { setTableSearchQuery(e.target.value); setCurrentPage(1); }}
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-8 pr-8 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 transition-all"
            />
            {tableSearchQuery && (
              <button
                onClick={() => { setTableSearchQuery(''); setCurrentPage(1); }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5">
                <th className="py-5 px-6 text-[10px] font-black uppercase tracking-widest text-slate-500">Empleado</th>
                <th className="py-5 px-6 text-[10px] font-black uppercase tracking-widest text-slate-500">Motivo</th>
                <th className="py-5 px-6 text-[10px] font-black uppercase tracking-widest text-slate-500">Periodo</th>
                <th className="py-5 px-6 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Cálculo Base</th>
                <th className="py-5 px-6 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Total Subsidio</th>
                <th className="py-5 px-6 text-[10px] font-black uppercase tracking-widest text-slate-500 text-center w-20">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03]">
              {sortedPaginatedMonths.map(month => (
                <React.Fragment key={month}>
                  <tr className="bg-white/[0.02]">
                    <td colSpan={6} className="py-2 px-6 text-[10px] font-black uppercase tracking-widest text-indigo-400 border-y border-white/5 bg-indigo-500/5">
                      Mes: {month !== 'Desconocido' ? `${getMonthName(month.split('-')[1])} ${month.split('-')[0]}` : month}
                    </td>
                  </tr>
                  {paginatedGroups[month].map((d, i) =>
                    editingRecord?.id === d.id && editDraft ? (
                      // ─── FILA DE EDICIÓN EXPANDIDA ────────────────────────
                      <tr key={d.id || i}>
                        <td colSpan={6} className="p-0">
                          <div className="mx-2 my-2 rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-indigo-950/60 to-slate-900/80 shadow-2xl shadow-indigo-500/10 overflow-hidden">
                            {/* Header de edición */}
                            <div className="flex items-center justify-between px-5 py-3 border-b border-indigo-500/20 bg-indigo-500/10">
                              <div className="flex items-center gap-2">
                                <Pencil size={13} className="text-indigo-400" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-300">Editando</span>
                                <span className="text-xs font-bold text-white ml-1">{editingRecord.employeeName}</span>
                              </div>
                              <button onClick={handleCancelEdit} className="text-slate-500 hover:text-white transition-colors">
                                <X size={14} />
                              </button>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 divide-y lg:divide-y-0 lg:divide-x divide-white/5">
                              {/* Columna izquierda: Campos de edición */}
                              <div className="p-5 space-y-4">
                                <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-3">Datos a modificar</p>
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="flex flex-col gap-1">
                                    <label className="text-[9px] font-black uppercase tracking-widest text-slate-500">Fecha Baja</label>
                                    <input type="date" value={editDraft.baja}
                                      onChange={e => setEditDraft({ ...editDraft, baja: e.target.value })}
                                      className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500/60 transition-all"
                                    />
                                  </div>
                                  <div className="flex flex-col gap-1">
                                    <label className="text-[9px] font-black uppercase tracking-widest text-slate-500">Fecha Alta</label>
                                    <input type="date" value={editDraft.alta}
                                      onChange={e => setEditDraft({ ...editDraft, alta: e.target.value })}
                                      className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500/60 transition-all"
                                    />
                                  </div>
                                  <div className="flex flex-col gap-1">
                                    <label className="text-[9px] font-black uppercase tracking-widest text-slate-500">Tipo</label>
                                    <select value={editDraft.type}
                                      onChange={e => setEditDraft({ ...editDraft, type: e.target.value as any })}
                                      className="bg-slate-800/80 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500/60 transition-all"
                                    >
                                      <option value="enfermedad">Enfermedad (75%)</option>
                                      <option value="maternidad">Maternidad (90%)</option>
                                      <option value="accidente">Accidente (90%)</option>
                                    </select>
                                  </div>
                                  <div className="flex flex-col gap-1">
                                    <label className="text-[9px] font-black uppercase tracking-widest text-slate-500">Ciudad</label>
                                    <select value={editDraft.city}
                                      onChange={e => setEditDraft({ ...editDraft, city: e.target.value })}
                                      className="bg-slate-800/80 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500/60 transition-all"
                                    >
                                      {BOLIVIAN_CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                  </div>
                                  <div className="flex flex-col gap-1">
                                    <label className="text-[9px] font-black uppercase tracking-widest text-slate-500">Salario Base (Bs.)</label>
                                    <input type="number" step="0.01" value={editDraft.basicSalary}
                                      onChange={e => setEditDraft({ ...editDraft, basicSalary: parseFloat(e.target.value) || 0 })}
                                      className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500/60 transition-all"
                                    />
                                  </div>
                                  <div className="flex flex-col gap-1">
                                    <label className="text-[9px] font-black uppercase tracking-widest text-slate-500">Nro. Asegurado</label>
                                    <input type="text" value={editDraft.insuredNumber}
                                      onChange={e => setEditDraft({ ...editDraft, insuredNumber: e.target.value })}
                                      className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl px-3 py-2 text-md font-bold font-mono text-indigo-300 focus:outline-none focus:border-indigo-500/60 transition-all"
                                    />
                                  </div>
                                </div>
                              </div>

                              {/* Columna derecha: Resumen de cálculo en tiempo real */}
                              {(() => {
                                const ed = editDraft;
                                const edRawDays = calculateDays(ed.baja, ed.alta);
                                const edEffDays = ed.type === 'enfermedad' ? Math.max(0, edRawDays - 3) : edRawDays;
                                const edPct = getPercentage(ed.type);
                                const edDaily = ed.basicSalary / 30;
                                const edPctAmt = edDaily * edPct;
                                const edTotal = edPctAmt * edEffDays;
                                return (
                                  <div className="p-5">
                                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-3">Resumen del cálculo</p>
                                    <div className="space-y-2">
                                      {/* Salario Base */}
                                      <div className="flex justify-between items-center py-2 border-b border-white/5">
                                        <span className="text-[9px] uppercase font-black text-slate-500 tracking-widest">Salario Base</span>
                                        <div className="text-right">
                                          <span className="text-sm font-bold font-mono text-white">{ed.basicSalary.toLocaleString('es-BO', { minimumFractionDigits: 2 })} Bs.</span>
                                        </div>
                                      </div>
                                      {/* Sueldo diario */}
                                      <div className="flex justify-between items-center py-2 border-b border-white/5">
                                        <span className="text-[9px] uppercase font-black text-slate-500 tracking-widest">Sueldo Diario (÷30)</span>
                                        <span className="text-sm font-bold font-mono text-slate-300">{edDaily.toFixed(2)} Bs.</span>
                                      </div>
                                      {/* Monto x día */}
                                      <div className="flex justify-between items-center py-2 border-b border-white/5">
                                        <span className="text-[9px] uppercase font-black text-slate-500 tracking-widest">Monto x Día ({edPct * 100}%)</span>
                                        <span className="text-sm font-bold font-mono text-indigo-300">{edPctAmt.toFixed(2)} Bs.</span>
                                      </div>
                                      {/* Días de baja */}
                                      <div className="flex justify-between items-center py-2 border-b border-white/5">
                                        <div>
                                          <span className="text-[9px] uppercase font-black text-slate-500 tracking-widest">Días de Baja</span>
                                          {ed.type === 'enfermedad' && edRawDays > 0 && (
                                            <p className="text-[9px] text-amber-400/70 font-medium mt-0.5">{edRawDays} − 3 días carencia</p>
                                          )}
                                        </div>
                                        <span className={`text-sm font-bold font-mono ${edEffDays > 0 ? 'text-white' : 'text-slate-600'}`}>
                                          {edEffDays > 0 ? `${edEffDays} días` : '—'}
                                        </span>
                                      </div>
                                      {/* Nro Asegurado */}
                                      <div className="flex justify-between items-center py-2 border-b border-white/5">
                                        <span className="text-[9px] uppercase font-black text-slate-500 tracking-widest">Nro. Asegurado</span>
                                        <span className="text-xs font-bold text-indigo-300 text-[11px]">{editDraft.insuredNumber || '—'}</span>
                                      </div>
                                    </div>

                                    {/* Total a pagar */}
                                    <div className="mt-4 p-4 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                                      <div className="flex justify-between items-end">
                                        <div>
                                          <p className="text-[9px] font-black uppercase tracking-widest text-emerald-400/70">Subsidio Total a Pagar</p>
                                          <p className="text-[9px] text-slate-500 font-medium mt-1">{edPctAmt.toFixed(2)} × {edEffDays} días</p>
                                        </div>
                                        <span className="text-xl font-black font-mono text-emerald-400">
                                          {edTotal.toFixed(2)} <span className="text-sm">Bs.</span>
                                        </span>
                                      </div>
                                    </div>

                                    {/* Botones */}
                                    <div className="flex gap-2 mt-4">
                                      <button onClick={handleSaveEdit} disabled={isLoading}
                                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-emerald-500/20"
                                      >
                                        <Check size={13} /> {isLoading ? 'Guardando...' : 'Guardar Cambios'}
                                      </button>
                                      <button onClick={handleCancelEdit}
                                        className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-slate-400 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                                      >
                                        <X size={13} />
                                      </button>
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      // ─── FILA NORMAL ───────────────────────────────────
                      <tr key={d.id || i} className="hover:bg-white/[0.02] transition-all group">
                        <td className="py-5 px-6">
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-white group-hover:text-indigo-400 transition-colors">{d.employeeName}</span>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[10px] text-slate-500 font-medium">CI: {d.ci || "—"}</span>
                              <span className="h-1 w-1 rounded-full bg-slate-700"></span>
                              <span className="text-[10px] text-slate-500 font-medium">{d.city || "—"}</span>
                              <span className="h-1 w-1 rounded-full bg-slate-700"></span>
                              <span className="text-[10px] font-mono text-indigo-400/70">{d.calculations.insuredNumber}</span>
                            </div>
                          </div>
                        </td>
                        <td className="py-5 px-6">
                          <div className="flex items-center gap-2">
                            <div className={`h-1.5 w-1.5 rounded-full ${d.type === 'enfermedad' ? 'bg-blue-500' :
                              d.type === 'maternidad' ? 'bg-purple-500' : 'bg-orange-500'
                              }`} />
                            <span className="text-[10px] font-bold uppercase tracking-tight text-slate-400">
                              {d.type === 'accidente' ? 'Accidente' : d.type}
                            </span>
                          </div>
                        </td>
                        <td className="py-5 px-6">
                          <div className="flex flex-col">
                            <div className="flex items-center gap-1.5 text-xs text-slate-300 font-medium">
                              <span>{d.dates.baja}</span>
                              <ArrowRight size={10} className="text-slate-600" />
                              <span>{d.dates.alta}</span>
                            </div>
                            <span className="text-[10px] font-bold text-slate-500 mt-0.5 uppercase tracking-tighter">{d.calculations.totalDays} días efectivos</span>
                          </div>
                        </td>
                        <td className="py-5 px-6 text-right">
                          <div className="flex flex-col items-end">
                            <span className="text-xs font-bold text-slate-300 font-mono">{(d.calculations.percentageAmount || 0).toFixed(2)} Bs/día</span>
                            <span className="text-[9px] text-slate-500 uppercase font-medium mt-0.5">{d.calculations.percentage}% de {d.calculations.basicSalary} Bs.</span>
                          </div>
                        </td>
                        <td className="py-5 px-6 text-right">
                          <span className="text-sm font-black text-emerald-400 font-mono tracking-tight">
                            {d.calculations.totalToPay.toFixed(2)} <span className="text-[10px] ml-0.5">Bs.</span>
                          </span>
                        </td>
                        <td className="py-5 px-6 text-center">
                          <div className="flex justify-center gap-1">
                            <button
                              onClick={() => exportEmployeeSourceData(allEmployeesData, d?.ci ?? '', d.employeeName, d.dates.baja, d.dates.alta)}
                              title="Exportar registros fuente (Excel)"
                              className="p-2.5 text-slate-600 hover:text-emerald-500 hover:bg-emerald-500/10 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                            >
                              <FileSpreadsheet size={16} />
                            </button>
                            <button
                              onClick={() => handleStartEdit(d)}
                              title="Editar registro"
                              className="p-2.5 text-slate-600 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              onClick={() => deleteDisability(d.id)}
                              title="Eliminar registro"
                              className="p-2.5 text-slate-600 hover:text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )  // cierre ternario (fila normal)
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
          {disabilities.length === 0 && (
            <div className="p-20 text-center space-y-4">
              <div className="inline-block p-4 bg-white/5 rounded-full mb-4">
                <Filter size={32} className="text-slate-600" />
              </div>
              <h3 className="text-xl font-bold text-white">No hay planillas registradas</h3>
              <p className="text-slate-400">Genera una nueva planilla o ajusta los filtros.</p>
            </div>
          )}

          {totalPages > 1 && (
            <div className="p-4 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4 bg-white/[0.01]">
              <span className="text-xs text-slate-500 font-medium">
                Mostrando {startIndex + 1} a {Math.min(startIndex + ITEMS_PER_PAGE, recordsToPaginate.length)} de {recordsToPaginate.length} registros
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white disabled:opacity-50 transition-all"
                >
                  Anterior
                </button>
                <div className="flex gap-1 items-center px-2 overflow-x-auto no-scrollbar max-w-[200px] md:max-w-none">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`min-w-[32px] h-8 rounded-lg flex items-center justify-center text-xs font-bold transition-all ${currentPage === page ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:bg-white/10'
                        }`}
                    >
                      {page}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white disabled:opacity-50 transition-all"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function CalculationItem({ label, value, subtitle, highlight = false }: { label: string, value: string, subtitle?: string, highlight?: boolean }) {
  return (
    <div className="space-y-1">
      <p className="text-[9px] uppercase font-black text-slate-500 tracking-tighter">{label}</p>
      <p className={`text-sm font-bold font-mono ${highlight ? 'text-emerald-400' : 'text-white'}`}>{value}</p>
      {subtitle && <p className="text-[9px] text-slate-500 font-medium italic">{subtitle}</p>}
    </div>
  );
}
