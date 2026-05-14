export interface LoadedFile {
  id: string;
  name: string;
  columns: string[];
  rows?: any[];
  rowCount?: number;
  isFromDb?: boolean;
}

export type Tab = 'dashboard' | 'employees' | 'database' | 'disabilities';

export interface DisabilityRecord {
  id: string;
  employee: any;
  employeeName: string;
  ci?: string;
  city?: string;
  type: 'enfermedad' | 'maternidad' | 'accidente';
  dates: {
    baja: string;
    alta: string;
  };
  calculations: {
    basicSalary: number;
    dailyRate: number;
    percentage: number;
    percentageAmount: number;
    totalDays: number;
    totalToPay: number;
    insuredNumber: string;
  };
  createdAt: string;
}
