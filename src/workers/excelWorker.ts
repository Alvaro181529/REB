import * as XLSX from 'xlsx';

console.log("Excel Worker initialized");

self.onmessage = (e: MessageEvent) => {
  const { fileData, fileName } = e.data;
  console.log("Worker received file:", fileName);

  try {
    const workbook = XLSX.read(fileData, { type: 'array', cellDates: true });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];

    // Convertir a JSON con formato de texto para que las fechas se vean bien
    const jsonData = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      raw: false,
      dateNF: 'mm/dd/yyyy'
    });

    if (jsonData.length > 0) {
      const headers = (jsonData[0] as any[]).map(h => String(h || "").trim());
      const rows = jsonData.slice(1);

      console.log("Worker successfully parsed:", fileName);
      self.postMessage({
        success: true,
        fileName,
        columns: headers,
        rows: rows,
        rowCount: rows.length
      });
    } else {
      self.postMessage({ success: false, fileName, error: 'Archivo vacío' });
    }
  } catch (err) {
    console.error("Worker error parsing file:", err);
    self.postMessage({ success: false, fileName, error: (err as Error).message });
  }
};
