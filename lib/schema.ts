export interface TimeEntry {
  id: string;
  date: string;
  project: string;
  description: string;
  hours: number;
  created_at?: string;
  updated_at?: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  is_active: boolean;
  color: string;
  created_at?: string;
  updated_at?: string;
}

export interface DayData {
  date: string;
  entries: TimeEntry[];
  totalHours: number;
}

export interface WeekData {
  weekStart: string;
  days: DayData[];
  weekTotal: number;
}

export interface MonthlyReport {
  month: string;
  year: number;
  totalHours: number;
  projectBreakdown: { [projectName: string]: number };
  dailyBreakdown: { [date: string]: number };
}

export interface TaskEntry {
  id: string;
  date: string;
  project: string;
  description: string;
  hours: number;
}

export interface MonthlyStatement {
  month: string;
  year: number;
  totalHours: number;
  totalEarnings: number;
  tasks: TaskEntry[];
  projectSummary: { [projectName: string]: { hours: number; earnings: number } };
}