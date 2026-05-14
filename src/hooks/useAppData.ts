import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { LoadedFile, DisabilityRecord } from "../types";

export function useAppData() {
  const [loadedFiles, setLoadedFiles] = useState<LoadedFile[]>([]);
  const [disabilities, setDisabilities] = useState<DisabilityRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchFilesFromDb = async () => {
    setIsLoading(true);
    try {
      const files = await invoke("get_all_files") as any[];
      const formattedFiles = await Promise.all(files.map(async f => {
        const rows = await invoke("get_file_rows", { fileId: f.id }) as any[];
        return {
          ...f,
          rows,
          rowCount: rows.length,
          isFromDb: true
        };
      }));

      setLoadedFiles(prev => {
        const localFiles = prev.filter(p => !p.isFromDb);
        return [...localFiles, ...formattedFiles];
      });
    } catch (err) {
      console.error("Error loading files:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDisabilities = async () => {
    try {
      const data = await invoke("get_all_disabilities") as DisabilityRecord[];
      setDisabilities(data);
    } catch (err) {
      console.error("Error fetching disabilities:", err);
    }
  };

  useEffect(() => {
    fetchFilesFromDb();
    fetchDisabilities();
  }, []);

  const handleFilesUpdated = (newFiles: LoadedFile[]) => {
    setLoadedFiles(prev => {
      const dbFiles = prev.filter(p => p.isFromDb);
      return [...dbFiles, ...newFiles];
    });
  };

  const deleteFile = async (id: string) => {
    if (confirm(`¿Eliminar permanentemente este archivo?`)) {
      await invoke("delete_file", { fileId: id });
      setLoadedFiles(prev => prev.filter(f => f.id !== id));
      return true;
    }
    return false;
  };

  const deleteDisability = async (id: string) => {
    if (confirm("¿Eliminar planilla?")) {
      await invoke("delete_disability", { id });
      await fetchDisabilities();
      return true;
    }
    return false;
  };

  const allEmployeesData = loadedFiles
    .filter(f => f.rows && f.columns)
    .flatMap(f => (f.rows || []).map(r => {
      // Si la fila es un array (viniendo de excelWorker {header: 1})
      if (Array.isArray(r)) {
        const obj: any = {};
        f.columns.forEach((col, idx) => {
          obj[col] = r[idx];
        });
        return { ...obj, _source: f.name };
      }
      // Si ya es un objeto (viniendo de la DB si se guardó así, aunque lib.rs guarda lo que recibe)
      return { ...r, _source: f.name };
    }));

  return {
    loadedFiles,
    disabilities,
    isLoading,
    allEmployeesData,
    fetchFilesFromDb,
    fetchDisabilities,
    handleFilesUpdated,
    deleteFile,
    deleteDisability
  };
}
