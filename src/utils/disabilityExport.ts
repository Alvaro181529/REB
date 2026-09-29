import * as XLSX from "xlsx-js-style";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import { DisabilityRecord } from "../types";

/**
 * Limpia caracteres basura de Excel como _x000d_
 */
const cleanStr = (val: any): any => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') {
    const cleaned = val.replace(/_x000d_/g, '').replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
    const lower = cleaned.toLowerCase();
    if (lower === 'null' || lower === 'undefined') return '';
    return cleaned;
  }
  const str = String(val).replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
  const lowerStr = str.toLowerCase();
  if (lowerStr === 'null' || lowerStr === 'undefined') return '';
  return val;
};

/**
 * Obtiene el nombre del mes
 */
const getMonthName = (m: number): string => {
  const months = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];
  return months[m - 1] || "DESCONOCIDO";
};

/**
 * Convierte números a formato literal (Castellano - Boliviano)
 */
export const numeroALetras = (num: number): string => {
  const unidades = ["", "UN", "DOS", "TRES", "CUATRO", "CINCO", "SEIS", "SIETE", "OCHO", "NUEVE"];
  const decenas = ["DIEZ", "VEINTE", "TREINTA", "CUARENTA", "CINCUENTA", "SESENTA", "SETENTA", "OCHENTA", "NOVENTA"];
  const especiales = ["ONCE", "DOCE", "TRECE", "CATORCE", "QUINCE", "DIECISEIS", "DIECISIETE", "DIECIOCHO", "DIECINUEVE"];
  const centenas = ["", "CIENTO", "DOSCIENTOS", "TRESCIENTOS", "CUATROCIENTOS", "QUINIENTOS", "SEISCIENTOS", "SETECIENTOS", "OCHOCIENTOS", "NOVECIENTOS"];

  const convertir = (n: number): string => {
    if (n === 0) return "";
    if (n < 10) return unidades[n];
    if (n < 20) return n === 10 ? "DIEZ" : especiales[n - 11];
    if (n < 100) {
      const d = Math.floor(n / 10);
      const u = n % 10;
      return d === 2 && u > 0 ? "VEINTI" + unidades[u] : decenas[d - 1] + (u > 0 ? " Y " + unidades[u] : "");
    }
    if (n < 1000) {
      if (n === 100) return "CIEN";
      const c = Math.floor(n / 100);
      const r = n % 100;
      return centenas[c] + (r > 0 ? " " + convertir(r) : "");
    }
    if (n < 1000000) {
      const m = Math.floor(n / 1000);
      const r = n % 1000;
      return (m === 1 ? "MIL" : convertir(m) + " MIL") + (r > 0 ? " " + convertir(r) : "");
    }
    return "NÚMERO DEMASIADO GRANDE";
  };

  const entero = Math.floor(num);
  const decimales = Math.round((num - entero) * 100);
  const literal = entero === 0 ? "CERO" : convertir(entero);
  return `${literal} CON ${decimales.toString().padStart(2, "0")}/100 BOLIVIANOS`;
};

/**
 * Genera el reporte Excel formal de incapacidades usando el diálogo nativo de Tauri
 */
export const exportDisabilitiesToExcel = async (
  disabilities: DisabilityRecord[],
  filter: 'all' | 'enfermedad' | 'maternidad' | 'accidente',
  monthFilter?: string,
  cityFilter?: string
) => {
  const filtered = disabilities.filter(d => filter === 'all' || d.type === filter);
  if (filtered.length === 0) {
    alert("No hay datos para exportar con el filtro actual");
    return;
  }

  const typeLabel = filter === 'enfermedad' ? 'ENFERMEDAD COMÚN (75%)' :
    filter === 'maternidad' ? 'MATERNIDAD (90%)' :
      filter === 'accidente' ? 'ACCIDENTE DE TRABAJO (90%)' : 'INCAPACIDADES';

  const startFrom = filter === 'enfermedad' ? '4TO DIA' : '1ER DIA';
  const title = `PLANILLA DE INCAPACIDAD TEMPORAL`;
  let title2 = `${typeLabel} A PARTIR DEL ${startFrom}`;
  if (monthFilter && monthFilter !== 'all' && monthFilter !== 'Desconocido') {
    const parts = monthFilter.split('-');
    const mName = getMonthName(parseInt(parts[1], 10));
    title2 += ` - MES DE ${mName} ${parts[0]}`;
  }
  if (cityFilter && cityFilter !== 'all') {
    title2 += ` - ${cityFilter.toUpperCase()}`;
  }

  // DEFINICIÓN DE ESTILOS
  const sHeader = {
    font: { bold: true, color: { rgb: "000000" }, sz: 10 },
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
    border: {
      top: { style: "thin" }, bottom: { style: "thin" },
      left: { style: "thin" }, right: { style: "thin" }
    },
    fill: { fgColor: { rgb: "EEEEEE" } }
  };

  const sData = {
    font: { sz: 9 },
    alignment: { horizontal: "center", vertical: "center" },
    border: {
      top: { style: "thin" }, bottom: { style: "thin" },
      left: { style: "thin" }, right: { style: "thin" }
    }
  };

  const sTitle = {
    font: { bold: true, sz: 14 },
    alignment: { horizontal: "center", vertical: "center", wrapText: true }
  };

  const sBold = {
    font: { bold: true, sz: 10 }
  };

  const sSignature = {
    font: { bold: true, sz: 10 },
    alignment: { horizontal: "center" }
  };

  const sTotalLabel = {
    font: { bold: true, sz: 10 },
    alignment: { horizontal: "left" }
  };

  // 1. TÍTULO (Fila 0 y 1)
  const wsData: any[][] = [
    [{ v: title, s: sTitle }],
    [{ v: title2, s: sTitle }],
    [],
  ];

  // 2. CABECERAS (Fila 3)
  const headLabels = [
    'N°', 'NOMBRES Y APELLIDOS', 'FECHA BAJA', 'FECHA ALTA',
    'SALARIO BASE (Bs.)', 'SALARIO POR DÍA (Bs.)',
    `MONTO POR DÍA (${filtered[0]?.calculations.percentage ?? ''}%)`,
    'DÍAS DE BAJA', 'REEMBOLSO', 'NRO ASEGURADO', 'CARNET DE IDENTIDAD'
  ];
  wsData.push(headLabels.map(l => ({ v: l, s: sHeader })));

  // 3. DATOS (Fila 4+)
  const parseExcelDate = (dateValue: string) => {
    if (!dateValue) return null;
    const raw = String(dateValue).trim();

    let year = '', month = '', day = '';
    if (raw.includes('-')) {
      // ISO format: YYYY-MM-DD  (also handles YYYY-MM-DDTHH:mm:ssZ)
      const isoMatch = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
      if (isoMatch) {
        [, year, month, day] = isoMatch;
      } else {
        [year, month, day] = raw.split('-');
      }
    } else if (raw.includes('/')) {
      const parts = raw.split('/');
      if (parts[0]?.length === 4) {
        [year, month, day] = parts;
      } else {
        [day, month, year] = parts;
      }
    }

    if (!year || !month || !day) {
      // Último recurso: intentar extraer componentes numéricos del string
      // para evitar que new Date(string) use UTC y cause desfase de día.
      const numericMatch = raw.match(/(\d{4})[^\d](\d{1,2})[^\d](\d{1,2})/);
      if (numericMatch) {
        const [, y, m, d] = numericMatch;
        const fallback = new Date(Number(y), Number(m) - 1, Number(d));
        return isNaN(fallback.getTime()) ? null : fallback;
      }
      return null; // No se pudo parsear de forma segura
    }

    // Siempre construir con hora local (evita el bug UTC-vs-local)
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    return isNaN(date.getTime()) ? null : date;
  };

  const excelDateCell = (dateValue: string) => {
    const date = parseExcelDate(dateValue);
    if (!date) return { v: dateValue, s: sData };
    // Construir el Date al mediodía hora local: así cuando SheetJS lo serializa
    // a UTC (medianoche UTC = día anterior en UTC-N), sigue siendo el mismo
    // día calendario porque 12:00 local - 4h = 16:00 UTC (mismo día).
    const localNoon = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      12, 0, 0
    );
    return { v: localNoon, t: 'd', z: 'dd/mm/yyyy', s: sData };
  };

  filtered.forEach((d, i) => {
    const dailyRate = d.calculations.dailyRate ?? (d.calculations.basicSalary / 30);
    const row = [
      { v: i + 1, s: sData },
      { v: d.employeeName, s: { ...sData, alignment: { horizontal: "left" } } },
      excelDateCell(d.dates.baja),
      excelDateCell(d.dates.alta),
      { v: Number(d.calculations.basicSalary.toFixed(2)), s: sData, t: 'n' },
      { v: Number(dailyRate.toFixed(2)), s: sData, t: 'n' },
      { v: Number((d.calculations.percentageAmount ?? 0).toFixed(2)), s: sData, t: 'n' },
      { v: d.calculations.totalDays, s: sData, t: 'n' },
      { v: Number((d.calculations.totalToPay ?? 0).toFixed(2)), s: sData, t: 'n' },
      { v: d.calculations.insuredNumber, s: sData },
      { v: d.ci || '', s: sData }
    ];
    wsData.push(row);
  });

  const totalSubsidio = filtered.reduce((acc, curr) => acc + (curr.calculations.totalToPay || 0), 0);

  // 4. TOTAL Y LITERAL

  wsData.push([
    '', '', '', '', '', '', '',
    { v: 'TOTAL:', s: sTotalLabel },
    { v: Number(totalSubsidio.toFixed(2)), s: { ...sData, font: { bold: true } }, t: 'n' },
    '', ''
  ]);

  const literalRowIdx = wsData.length;
  wsData.push([{ v: numeroALetras(totalSubsidio), s: sBold }]);

  // 5. FIRMAS
  wsData.push([], []);
  const firstSigRow = wsData.length;
  wsData.push([{ v: 'Sgto Lic. Petronila Arminda Perez', s: sSignature }]);
  wsData.push([{ v: 'ENC. SUBCIDIO DE INCAPACIDAD TEMPORAL (SIT)', s: sSignature }]);
  wsData.push([{ v: 'POLICIA BOLIVIANA', s: sSignature }]);

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // COMBINAR CELDAS (Merges)
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 10 } }, // Título 1 centrado
    { s: { r: 1, c: 0 }, e: { r: 1, c: 10 } }, // Título 2 centrado
    { s: { r: literalRowIdx, c: 0 }, e: { r: literalRowIdx, c: 10 } }, // Literal centrado
    { s: { r: firstSigRow, c: 0 }, e: { r: firstSigRow, c: 10 } }, // Firma 1 centrada
    { s: { r: firstSigRow + 1, c: 0 }, e: { r: firstSigRow + 1, c: 10 } }, // Firma 2 centrada
    { s: { r: firstSigRow + 2, c: 0 }, e: { r: firstSigRow + 2, c: 10 } }  // Firma 3 centrada
  ];

  // ANCHOS DE COLUMNA
  ws['!cols'] = [
    { wch: 5 }, { wch: 38 }, { wch: 12 }, { wch: 12 }, { wch: 16 },
    { wch: 18 }, { wch: 18 }, { wch: 10 }, { wch: 16 }, { wch: 16 }, { wch: 18 }
  ];

  // CONFIGURACIÓN DE IMPRESIÓN (Página Legal/Oficio y Horizontal)
  ws['!pageSetup'] = {
    orientation: 'landscape',
    paperSize: 5,     // 5 = Legal (8.5" x 14")
    fitToWidth: 1,    // Ajustar todas las columnas a una página
    fitToHeight: 0    // Altura automática según cantidad de registros
  };

  ws['!printOptions'] = {
    horizontalCentered: true
  };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Planilla");

  let defaultName = `Planilla_${filter}`;
  if (monthFilter && monthFilter !== 'all' && monthFilter !== 'Desconocido') {
    const parts = monthFilter.split('-');
    const mName = getMonthName(parseInt(parts[1], 10));
    defaultName += `_${mName}_${parts[0]}`;
  } else {
    defaultName += `_${new Date().toLocaleDateString().replace(/\//g, '-')}`;
  }
  if (cityFilter && cityFilter !== 'all') {
    defaultName += `_${cityFilter.replace(/\s+/g, '_').toUpperCase()}`;
  }
  defaultName += '.xlsx';
  const filePath = await save({
    defaultPath: defaultName,
    filters: [{ name: 'Excel', extensions: ['xlsx'] }]
  });

  if (!filePath) return;

  const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  await writeFile(filePath, new Uint8Array(buffer));
};

/**
 * Exporta los registros originales filtrados por el rango de meses de la incapacidad
 */
export const exportEmployeeSourceData = async (
  allData: any[],
  ci: string,
  name: string,
  startDateStr: string,
  endDateStr: string
) => {
  const startMonth = parseInt(startDateStr.split('-')[1]);
  const endMonth = parseInt(endDateStr.split('-')[1]);

  const filtered = allData.filter(emp => {
    const empCI = String(emp.CI || emp.ci || emp["Carnet de Identidad"] || "");
    const isCI = empCI.includes(ci) || ci.includes(empCI);
    if (!isCI) return false;

    const rawMes = emp["Mes"] || emp["MES"];
    const empMonth = parseInt(String(rawMes || "0"));
    return empMonth >= startMonth && empMonth <= endMonth;
  });

  if (filtered.length === 0) {
    alert(`No se encontraron registros fuente para el periodo ${getMonthName(startMonth)} al ${getMonthName(endMonth)}`);
    return;
  }

  // ESTILOS COMPARTIDOS
  const sHeader = {
    font: { bold: true, sz: 10 },
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
    border: {
      top: { style: "thin" }, bottom: { style: "thin" },
      left: { style: "thin" }, right: { style: "thin" }
    },
    fill: { fgColor: { rgb: "EEEEEE" } }
  };

  const sData = {
    font: { sz: 9 },
    alignment: { horizontal: "center", vertical: "center" },
    border: {
      top: { style: "thin" }, bottom: { style: "thin" },
      left: { style: "thin" }, right: { style: "thin" }
    }
  };

  const sTitle = {
    font: { bold: true, sz: 14 },
    alignment: { horizontal: "center" }
  };


  const sSignature = { font: { bold: true, sz: 10 }, alignment: { horizontal: "center" } };

  // Limpiar llaves y obtener cabeceras (excluyendo columnas _source o _sources)
  const rawKeys = Object.keys(filtered[0]).filter(k => k !== '_source' && k !== '_sources');
  const keys = rawKeys.map(k => cleanStr(k));

  const wsData: any[][] = [
    [{ v: `PLANILLA SALARIAL - ${name}`, s: sTitle }],
    [{ v: `PERIODO: ${getMonthName(startMonth)} A ${getMonthName(endMonth)}`, s: sTitle }],
    [],
    keys.map(k => ({ v: k, s: sHeader }))
  ];

  filtered.forEach(row => {
    wsData.push(rawKeys.map(k => ({ v: cleanStr(row[k]), s: sData })));
  });

  // Agregar firmas al final
  wsData.push([], []);
  const firstSigRow = wsData.length;
  wsData.push([{ v: 'Sgto Lic. Petronila Arminda Perez', s: sSignature }]);
  wsData.push([{ v: 'ENC. SUBCIDIO DE INCAPACIDAD TEMPORAL (SIT)', s: sSignature }]);
  wsData.push([{ v: 'POLICIA BOLIVIANA', s: sSignature }]);

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Merges
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: keys.length - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: keys.length - 1 } },
    { s: { r: firstSigRow, c: 0 }, e: { r: firstSigRow, c: keys.length - 1 } },
    { s: { r: firstSigRow + 1, c: 0 }, e: { r: firstSigRow + 1, c: keys.length - 1 } },
    { s: { r: firstSigRow + 2, c: 0 }, e: { r: firstSigRow + 2, c: keys.length - 1 } }
  ];

  // Configuración de página
  ws['!pageSetup'] = {
    orientation: 'landscape',
    paperSize: 5,
    fitToWidth: 1,
    fitToHeight: 0
  };

  ws['!cols'] = keys.map(k => ({ wch: Math.max(k.length + 5, 12) }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Fuentes Filtradas");

  const defaultName = `Fuentes_${name.replace(/ /g, '_')}_${getMonthName(startMonth)}.xlsx`;
  const filePath = await save({
    defaultPath: defaultName,
    filters: [{ name: 'Excel', extensions: ['xlsx'] }]
  });

  if (!filePath) return;

  const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  await writeFile(filePath, new Uint8Array(buffer));
};

/**
 * Exporta la planilla salarial general (registros fuente) de los empleados con incapacidades según la selección actual
 */

export type SalaryPayrollSchemaType = 'jjooss' | 'ss';

/**
 * Genera y descarga una planilla salarial para un tipo de esquema ('jjooss' | 'ss')
 * Retorna true si se guardó, false si fue cancelado o no hubo filas.
 */
async function generateAndSaveSalarySheet(
  schemaType: SalaryPayrollSchemaType,
  allData: any[],
  disabilities: DisabilityRecord[],
  filter: "all" | "enfermedad" | "maternidad" | "accidente",
  monthFilter: string,
  cityFilter: string | undefined
): Promise<'saved' | 'no_data' | 'cancelled'> {
  const isJJOOSS = schemaType === 'jjooss';
  const schemaLabel = isJJOOSS ? 'JJOOSS' : 'SS';

  const parts = monthFilter.split("-");
  const selectedYear = parseInt(parts[0], 10);
  const selectedMonth = parseInt(parts[1], 10);
  const mName = getMonthName(selectedMonth);

  const cleanCI = (val: any) => String(val || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "").replace(/^0+/, "");
  const normalizeStr = (val: any) => String(val || "").trim().toLowerCase().replace(/\s+/g, " ");

  const parseMonth = (val: any): number => {
    if (!val) return 0;
    const num = parseInt(String(val), 10);
    if (!isNaN(num) && num >= 1 && num <= 12) return num;
    const str = String(val).trim().toUpperCase();
    const months = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];
    const idx = months.indexOf(str);
    return idx >= 0 ? idx + 1 : 0;
  };

  const normalizeYear = (y: number) => y < 100 ? 2000 + y : y;

  const typeLabel = filter === "enfermedad" ? "ENFERMEDAD COMÚN (75%)" :
    filter === "maternidad" ? "MATERNIDAD (90%)" :
      filter === "accidente" ? "ACCIDENTE DE TRABAJO (90%)" : "INCAPACIDADES";

  const title = `PLANILLA SALARIAL (${schemaLabel}) - ${typeLabel}`;
  let title2 = `PERIODO: MES DE ${mName} ${selectedYear}`;
  if (cityFilter && cityFilter !== "all") {
    title2 += ` - ${cityFilter.toUpperCase()}`;
  }

  // Determina el tipo de planilla EXCLUSIVAMENTE por sus columnas/encabezados (100% independiente del nombre del archivo)
  const isRowOfSchema = (row: any): boolean => {
    const keysUpper = Object.keys(row).map(k => cleanStr(k).toUpperCase());
    
    // Si contiene la columna 'PAT' o 'NOM' o 'APES', pertenece al esquema SS (Suboficiales y Sargentos)
    const isSS = keysUpper.includes('PAT') || keysUpper.includes('NOM') || keysUpper.includes('APES');
    
    // Si contiene 'APELLIDOS Y NOMBRES' o 'GRADO' (sin tener columnas de apellidos separadas), es JJOOSS
    const isJJOOSS_schema = !isSS && (keysUpper.includes('APELLIDOS Y NOMBRES') || keysUpper.includes('GRADO') || keysUpper.includes('UNIDAD'));

    if (isJJOOSS) {
      return isJJOOSS_schema || !isSS;
    } else {
      return isSS;
    }
  };

  const seenRowKeys = new Set<string>();
  const filteredRows: any[] = [];

  disabilities.forEach(d => {
    const targetCI = cleanCI(d.ci);
    const targetName = normalizeStr(d.employeeName);
    const startMonth = d.dates.baja ? parseMonth(d.dates.baja.split("-")[1]) : selectedMonth;
    const endMonth = d.dates.alta ? parseMonth(d.dates.alta.split("-")[1]) : selectedMonth;
    const minM = Math.min(startMonth || selectedMonth, selectedMonth);
    const maxM = Math.max(endMonth || selectedMonth, selectedMonth);

    let empMatches = allData.filter(emp => {
      if (!isRowOfSchema(emp)) return false;

      const empCI = cleanCI(emp.CI || emp.ci || emp["Carnet de Identidad"] || emp["C.I."] || emp["CARNET"] || "");
      const empName = normalizeStr(emp["APELLIDOS Y NOMBRES"] || `${emp["Pat"] || ""} ${emp["Mat"] || ""} ${emp["Nom"] || ""}`);

      const isSameCI = targetCI && empCI && (
        targetCI === empCI ||
        (targetCI.length >= 5 && empCI.includes(targetCI)) ||
        (empCI.length >= 5 && targetCI.includes(empCI))
      );
      const isSameName = !targetCI && targetName && empName && (
        targetName === empName ||
        (targetName.length > 8 && (empName.includes(targetName) || targetName.includes(empName)))
      );

      if (!isSameCI && !isSameName) return false;

      const rawMes = emp["Mes"] || emp["MES"];
      const empMonth = parseMonth(rawMes);
      const monthMatches = empMonth === 0 || (empMonth >= minM && empMonth <= maxM) || empMonth === selectedMonth;
      if (!monthMatches) return false;

      const rawYear = String(emp["Año"] || emp["A_o"] || emp["AÑO"] || emp["A_O"] || "").trim();
      if (rawYear && !isNaN(parseInt(rawYear, 10)) && selectedYear) {
        const empYear = normalizeYear(parseInt(rawYear, 10));
        if (empYear !== selectedYear) return false;
      }

      return true;
    });

    if (empMatches.length === 0) {
      empMatches = allData.filter(emp => {
        if (!isRowOfSchema(emp)) return false;

        const empCI = cleanCI(emp.CI || emp.ci || emp["Carnet de Identidad"] || emp["C.I."] || emp["CARNET"] || "");
        const empName = normalizeStr(emp["APELLIDOS Y NOMBRES"] || `${emp["Pat"] || ""} ${emp["Mat"] || ""} ${emp["Nom"] || ""}`);

        const isSameCI = targetCI && empCI && (
          targetCI === empCI ||
          (targetCI.length >= 5 && empCI.includes(targetCI)) ||
          (empCI.length >= 5 && targetCI.includes(empCI))
        );
        const isSameName = !targetCI && targetName && empName && (
          targetName === empName ||
          (targetName.length > 8 && (empName.includes(targetName) || targetName.includes(empName)))
        );

        return isSameCI || isSameName;
      });
    }

    empMatches.forEach((row, rowIdx) => {
      const rowKey = `${targetCI || targetName}_${row["Mes"] || row["MES"]}_${row["Año"] || row["A_o"] || row["AÑO"]}_${row._source || ""}_${row["Item"] || row["ITEM"] || rowIdx}`;
      if (!seenRowKeys.has(rowKey)) {
        seenRowKeys.add(rowKey);
        const normRow: Record<string, any> = {};
        Object.keys(row).forEach(k => {
          if (k !== "_source" && k !== "_sources") {
            const cleanKey = cleanStr(k);
            normRow[cleanKey] = row[k];
          }
        });
        filteredRows.push(normRow);
      }
    });
  });

  if (filteredRows.length === 0) {
    return 'no_data';
  }

  const sHeader = {
    font: { bold: true, sz: 10 },
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
    border: {
      top: { style: "thin" }, bottom: { style: "thin" },
      left: { style: "thin" }, right: { style: "thin" }
    },
    fill: { fgColor: { rgb: "EEEEEE" } }
  };

  const sData = {
    font: { sz: 9 },
    alignment: { horizontal: "center", vertical: "center" },
    border: {
      top: { style: "thin" }, bottom: { style: "thin" },
      left: { style: "thin" }, right: { style: "thin" }
    }
  };

  const sTitle = {
    font: { bold: true, sz: 14 },
    alignment: { horizontal: "center" }
  };

  const sSignature = { font: { bold: true, sz: 10 }, alignment: { horizontal: "center" } };

  const canonicalOrder = isJJOOSS
    ? ['SS', 'UNIDAD', 'Desglose', 'Mes', 'A_o', 'CI', 'APELLIDOS Y NOMBRES', 'GRADO', 'Total Gan Cotiz.', 'Dtr.', 'C31', 'Cod. Entidad', 'Dir. Administrativa', 'Unidad Ejecutora', 'Fuente Financ.', 'Org. Financ.', 'NAC.']
    : ['Cod. Unidad', 'Desglose', 'Mes', 'A_o', 'CI', 'Pat', 'Mat', 'ApEs', 'Nom', 'Nom2', 'Sex', 'Niv', 'Gra', 'Total Gan Cotiz.', 'Dtr.', 'C31', 'Cod. Entidad', 'Dir. Administrativa', 'Unidad Ejecutora', 'Fuente Financ.', 'Org. Financ.', 'NAC.'];

  const presentCols = new Set<string>();
  filteredRows.forEach(row => {
    Object.keys(row).forEach(k => presentCols.add(k));
  });

  const keys: string[] = [];
  canonicalOrder.forEach(col => {
    if (presentCols.has(col)) {
      keys.push(col);
      presentCols.delete(col);
    }
  });
  presentCols.forEach(col => keys.push(col));

  const wsData: any[][] = [
    [{ v: title, s: sTitle }],
    [{ v: title2, s: sTitle }],
    [],
    keys.map(k => ({ v: k, s: sHeader }))
  ];

  filteredRows.forEach(row => {
    wsData.push(keys.map(k => ({ v: cleanStr(row[k]), s: sData })));
  });

  wsData.push([], []);
  const firstSigRow = wsData.length;
  wsData.push([{ v: "Sgto Lic. Petronila Arminda Perez", s: sSignature }]);
  wsData.push([{ v: "ENC. SUBCIDIO DE INCAPACIDAD TEMPORAL (SIT)", s: sSignature }]);
  wsData.push([{ v: "POLICIA BOLIVIANA", s: sSignature }]);

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  const lastCol = Math.max(keys.length - 1, 0);
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: lastCol } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: lastCol } },
    { s: { r: firstSigRow, c: 0 }, e: { r: firstSigRow, c: lastCol } },
    { s: { r: firstSigRow + 1, c: 0 }, e: { r: firstSigRow + 1, c: lastCol } },
    { s: { r: firstSigRow + 2, c: 0 }, e: { r: firstSigRow + 2, c: lastCol } }
  ];

  ws["!pageSetup"] = {
    orientation: "landscape",
    paperSize: 5,
    fitToWidth: 1,
    fitToHeight: 0
  };

  ws["!cols"] = keys.map(k => ({ wch: Math.max(k.length + 5, 12) }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `Planilla ${schemaLabel}`);

  let defaultName = `Planilla_Salarial_${schemaLabel}_${filter}`;
  if (monthFilter && monthFilter !== "all" && monthFilter !== "Desconocido") {
    defaultName += `_${mName}_${selectedYear}`;
  } else {
    defaultName += `_${new Date().toLocaleDateString().replace(/\//g, "-")}`;
  }
  if (cityFilter && cityFilter !== "all") {
    defaultName += `_${cityFilter.replace(/\s+/g, "_").toUpperCase()}`;
  }
  defaultName += ".xlsx";

  const filePath = await save({
    defaultPath: defaultName,
    filters: [{ name: `Excel - Planilla ${schemaLabel}`, extensions: ["xlsx"] }]
  });

  if (!filePath) return 'cancelled';

  const buffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  await writeFile(filePath, new Uint8Array(buffer));
  return 'saved';
}

/**
 * Exporta la planilla salarial general generando consecutivamente los 2 archivos Excel descargables
 * de acuerdo a sus encabezados (1. JJOOSS con 'APELLIDOS Y NOMBRES' y 2. SS con 'Pat'/'Nom'/'ApEs').
 * Si alguno de los esquemas no tiene registros en el periodo, se descarga solo el que tenga datos.
 */
export const exportGeneralSalarySourceData = async (
  allData: any[],
  disabilities: DisabilityRecord[],
  filter: "all" | "enfermedad" | "maternidad" | "accidente",
  monthFilter: string,
  cityFilter?: string
) => {
  if (!allData || allData.length === 0) {
    alert("No hay datos de planillas cargados en el sistema.");
    return;
  }

  if (disabilities.length === 0) {
    alert("No hay registros de incapacidades en la selección actual.");
    return;
  }

  // 1. Guardar primero Planilla JJOOSS (Jefes y Oficiales)
  const resJJOOSS = await generateAndSaveSalarySheet('jjooss', allData, disabilities, filter, monthFilter, cityFilter);

  // 2. Guardar a continuación Planilla SS (Suboficiales y Sargentos)
  const resSS = await generateAndSaveSalarySheet('ss', allData, disabilities, filter, monthFilter, cityFilter);

  if (resJJOOSS === 'no_data' && resSS === 'no_data') {
    alert("No se encontraron registros en las planillas salariales para los empleados de la selección actual.");
  }
};

