import * as XLSX from "xlsx-js-style";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import { DisabilityRecord } from "../types";

/**
 * Limpia caracteres basura de Excel como _x000d_
 */
const cleanStr = (val: any): any => {
  if (typeof val !== 'string') return val;
  return val.replace(/_x000d_/g, '').replace(/\r/g, '').trim();
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
      [year, month, day] = raw.split('-');
    } else if (raw.includes('/')) {
      const parts = raw.split('/');
      if (parts[0]?.length === 4) {
        [year, month, day] = parts;
      } else {
        [day, month, year] = parts;
      }
    }

    if (!year || !month || !day) {
      const parsed = new Date(raw);
      return isNaN(parsed.getTime()) ? null : parsed;
    }

    const date = new Date(Number(year), Number(month) - 1, Number(day));
    return isNaN(date.getTime()) ? null : date;
  };

  const excelDateCell = (dateValue: string) => {
    const date = parseExcelDate(dateValue);
    if (!date) return { v: dateValue, s: sData };
    return { v: date, t: 'd', z: 'dd/mm/yyyy', s: sData };
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
  wsData.push([{ v: 'Enc. Subcidio de incapacidad temporal (nit)', s: sSignature }]);
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

  // Limpiar llaves y obtener cabeceras
  const keys = Object.keys(filtered[0]).map(k => cleanStr(k));
  const rawKeys = Object.keys(filtered[0]);

  const wsData: any[][] = [
    [{ v: `REGISTROS FUENTE - ${name}`, s: sTitle }],
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
  wsData.push([{ v: 'Enc. Subcidio de incapacidad temporal (nit)', s: sSignature }]);
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
