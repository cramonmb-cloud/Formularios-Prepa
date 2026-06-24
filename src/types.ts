export interface TAEOption {
  id: string;
  name: string;      // e.g., "Opción A"
  taes: string[];    // e.g., ["Electrónica y programación", "Pensamiento matemático"]
  quota: number;     // e.g., 20
  filled: number;    // e.g., 15 (current registrations)
}

export interface Submission {
  id: string;
  studentName: string;
  optionId: string;
  optionName: string; // Snapshotted option name
  taes: string[];     // Snapshotted list of TAEs
  timestamp: Date | { seconds: number; nanoseconds: number } | string | any;
}

export interface AdminStats {
  totalSubmissions: number;
  optionsStats: {
    optionId: string;
    name: string;
    quota: number;
    filled: number;
    percentage: number;
  }[];
}
