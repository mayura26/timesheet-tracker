'use client';

import { useState, useEffect, useCallback } from 'react';
import { MonthlyReport, Project, MonthlyStatement, TaskEntry } from '@/lib/schema';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import TaskDetailsDialog from '@/components/TaskDetailsDialog';

interface WeeklySummary {
  weekStart: string;
  weekEnd: string;
  totalHours: number;
  projectBreakdown: { [projectName: string]: number };
  dailyBreakdown: { [date: string]: number };
}

export default function ReportsPage() {
  const [report, setReport] = useState<MonthlyReport | null>(null);
  const [weeklySummary, setWeeklySummary] = useState<WeeklySummary | null>(null);
  const [monthlyStatement, setMonthlyStatement] = useState<MonthlyStatement | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [activeTab, setActiveTab] = useState('statement');
  const [isSummaryView, setIsSummaryView] = useState(true);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [selectedTask, setSelectedTask] = useState<{ id: string; project: string; description: string } | null>(null);

  const loadProjects = async () => {
    try {
      const response = await fetch('/api/projects?activeOnly=true');
      const data = await response.json();
      setProjects(data);
    } catch (error) {
      console.error('Error loading projects:', error);
    }
  };

  const loadMonthlyReport = useCallback(async () => {
    setLoading(true);
    try {
      const startDate = `${selectedYear}-${selectedMonth.toString().padStart(2, '0')}-01`;
      const lastDayOfMonth = getDaysInMonth(selectedYear, selectedMonth);
      const endDate = `${selectedYear}-${selectedMonth.toString().padStart(2, '0')}-${lastDayOfMonth.toString().padStart(2, '0')}`;
      
      const response = await fetch(`/api/entries?startDate=${startDate}&endDate=${endDate}`);
      const entries = await response.json();

      // Process entries into monthly report
      const projectBreakdown: { [projectName: string]: number } = {};
      const dailyBreakdown: { [date: string]: number } = {};
      let totalHours = 0;

      entries.forEach((entry: any) => {
        // Project breakdown
        if (!projectBreakdown[entry.project]) {
          projectBreakdown[entry.project] = 0;
        }
        projectBreakdown[entry.project] += entry.hours;

        // Daily breakdown
        if (!dailyBreakdown[entry.date]) {
          dailyBreakdown[entry.date] = 0;
        }
        dailyBreakdown[entry.date] += entry.hours;

        totalHours += entry.hours;
      });



      const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];

      setReport({
        month: monthNames[selectedMonth - 1],
        year: selectedYear,
        totalHours,
        projectBreakdown,
        dailyBreakdown
      });
    } catch (error) {
      console.error('Error loading monthly report:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedYear, selectedMonth]);

  const loadWeeklySummary = useCallback(async () => {
    try {
      // Get current week
      const today = new Date();
      const day = today.getDay();
      const daysToMonday = day === 0 ? -6 : 1 - day; // Monday is day 1
      
      // Calculate start of week using date constructor to avoid timezone issues
      const startOfWeek = new Date(today.getFullYear(), today.getMonth(), today.getDate() + daysToMonday);
      const endOfWeek = new Date(today.getFullYear(), today.getMonth(), today.getDate() + daysToMonday + 6);
      
      // Format dates using local date components to avoid timezone shifts
      const startDate = `${startOfWeek.getFullYear()}-${(startOfWeek.getMonth() + 1).toString().padStart(2, '0')}-${startOfWeek.getDate().toString().padStart(2, '0')}`;
      const endDate = `${endOfWeek.getFullYear()}-${(endOfWeek.getMonth() + 1).toString().padStart(2, '0')}-${endOfWeek.getDate().toString().padStart(2, '0')}`;
      
      const response = await fetch(`/api/entries?startDate=${startDate}&endDate=${endDate}`);
      const entries = await response.json();

      // Process entries into weekly summary
      const projectBreakdown: { [projectName: string]: number } = {};
      const dailyBreakdown: { [date: string]: number } = {};
      let totalHours = 0;

      entries.forEach((entry: any) => {
        // Project breakdown
        if (!projectBreakdown[entry.project]) {
          projectBreakdown[entry.project] = 0;
        }
        projectBreakdown[entry.project] += entry.hours;

        // Daily breakdown
        if (!dailyBreakdown[entry.date]) {
          dailyBreakdown[entry.date] = 0;
        }
        dailyBreakdown[entry.date] += entry.hours;

        totalHours += entry.hours;
      });

      setWeeklySummary({
        weekStart: startDate,
        weekEnd: endDate,
        totalHours,
        projectBreakdown,
        dailyBreakdown
      });
    } catch (error) {
      console.error('Error loading weekly summary:', error);
    }
  }, []);

  const loadMonthlyStatement = useCallback(async () => {
    setLoading(true);
    try {
      const startDate = `${selectedYear}-${selectedMonth.toString().padStart(2, '0')}-01`;
      const lastDayOfMonth = getDaysInMonth(selectedYear, selectedMonth);
      const endDate = `${selectedYear}-${selectedMonth.toString().padStart(2, '0')}-${lastDayOfMonth.toString().padStart(2, '0')}`;
      
      const response = await fetch(`/api/entries?startDate=${startDate}&endDate=${endDate}`);
      const entries = await response.json();

      // Process entries into monthly statement
      const tasks: TaskEntry[] = entries.map((entry: any) => ({
        id: entry.id,
        date: entry.date,
        project: entry.project,
        description: entry.description,
        hours: entry.hours
      }));

      // Sort tasks by date, then by project
      tasks.sort((a, b) => {
        if (a.date !== b.date) {
          return new Date(a.date).getTime() - new Date(b.date).getTime();
        }
        return a.project.localeCompare(b.project);
      });

      // Calculate project summary
      const projectSummary: { [projectName: string]: { hours: number; earnings: number } } = {};
      let totalHours = 0;
      const hourlyRate = 115;

      tasks.forEach(task => {
        if (!projectSummary[task.project]) {
          projectSummary[task.project] = { hours: 0, earnings: 0 };
        }
        projectSummary[task.project].hours += task.hours;
        projectSummary[task.project].earnings += task.hours * hourlyRate;
        totalHours += task.hours;
      });

      const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];

      setMonthlyStatement({
        month: monthNames[selectedMonth - 1],
        year: selectedYear,
        totalHours,
        totalEarnings: totalHours * hourlyRate,
        tasks,
        projectSummary
      });
    } catch (error) {
      console.error('Error loading monthly statement:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedYear, selectedMonth]);

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    if (projects.length > 0) {
      if (activeTab === 'monthly') {
        loadMonthlyReport();
      } else if (activeTab === 'weekly') {
        loadWeeklySummary();
      } else if (activeTab === 'statement') {
        loadMonthlyStatement();
      }
    }
  }, [selectedMonth, selectedYear, projects, activeTab, loadMonthlyReport, loadWeeklySummary, loadMonthlyStatement]);

  const getProjectColor = (projectName: string) => {
    const project = projects.find(p => p.name === projectName);
    return project?.color || '#3b82f6';
  };

  const getProjectColorForDarkMode = (projectName: string) => {
    const project = projects.find(p => p.name === projectName);
    const baseColor = project?.color || '#3b82f6';
    
    // Convert bright colors to darker variants for better dark mode contrast
    const colorMap: { [key: string]: string } = {
      '#3b82f6': '#60a5fa', // blue-400
      '#10b981': '#34d399', // emerald-400
      '#f59e0b': '#fbbf24', // amber-400
      '#ef4444': '#f87171', // red-400
      '#8b5cf6': '#a78bfa', // violet-400
      '#06b6d4': '#22d3ee', // cyan-400
      '#84cc16': '#a3e635', // lime-400
      '#f97316': '#fb923c', // orange-400
      '#ec4899': '#f472b6', // pink-400
      '#6366f1': '#818cf8'  // indigo-400
    };
    
    return colorMap[baseColor] || '#60a5fa';
  };

  const formatCurrency = (hours: number, rate: number = 115) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(hours * rate);
  };

  // Calculate predicted earnings for the rest of the month
  const calculatePredictedEarnings = (report: MonthlyReport | null) => {
    if (!report) return { 
      predictedHours: 0, 
      predictedEarnings: 0, 
      remainingWeekdays: 0, 
      avgWeekdayHours: 0,
      totalProjectedHours: 0,
      totalProjectedEarnings: 0,
      loggedHours: 0,
      loggedEarnings: 0
    };
    
    const hourlyRate = 115;
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;
    const currentDay = today.getDate();
    
    const loggedHours = report.totalHours;
    const loggedEarnings = loggedHours * hourlyRate;
    
    // Only calculate if viewing current month
    if (selectedYear !== currentYear || selectedMonth !== currentMonth) {
      return { 
        predictedHours: 0, 
        predictedEarnings: 0, 
        remainingWeekdays: 0, 
        avgWeekdayHours: 0,
        totalProjectedHours: loggedHours,
        totalProjectedEarnings: loggedEarnings,
        loggedHours,
        loggedEarnings
      };
    }
    
    // Calculate average hours per weekday (Mon-Fri only) from days with hours logged
    let weekdayHours = 0;
    let weekdayDays = 0;
    
    Object.entries(report.dailyBreakdown).forEach(([date, hours]) => {
      if (hours > 0) {
        const [year, month, day] = date.split('-').map(Number);
        const dateObj = new Date(year, month - 1, day);
        const dayOfWeek = dateObj.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
        
        // Only count weekdays (Monday = 1, Friday = 5)
        if (dayOfWeek >= 1 && dayOfWeek <= 5) {
          weekdayHours += hours;
          weekdayDays += 1;
        }
      }
    });
    
    const avgWeekdayHours = weekdayDays > 0 ? weekdayHours / weekdayDays : 0;
    
    // Count remaining weekdays (Mon-Fri) from today to end of month that don't have hours logged yet
    const lastDayOfMonth = getDaysInMonth(selectedYear, selectedMonth);
    let remainingWeekdays = 0;
    
    for (let day = currentDay; day <= lastDayOfMonth; day++) {
      const dateObj = new Date(selectedYear, selectedMonth - 1, day);
      const dayOfWeek = dateObj.getDay();
      
      // Only count weekdays (Monday = 1, Friday = 5) that don't have hours logged
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        // Format date string to check if hours are already logged
        const dateString = `${selectedYear}-${selectedMonth.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
        const hoursLogged = report.dailyBreakdown[dateString] || 0;
        
        // Only count if no hours are logged for this day
        if (hoursLogged === 0) {
          remainingWeekdays += 1;
        }
      }
    }
    
    const predictedHours = avgWeekdayHours * remainingWeekdays;
    const predictedEarnings = predictedHours * hourlyRate;
    
    // Total projected for the month (logged + predicted)
    const totalProjectedHours = loggedHours + predictedHours;
    const totalProjectedEarnings = totalProjectedHours * hourlyRate;
    
    return { 
      predictedHours, 
      predictedEarnings, 
      remainingWeekdays, 
      avgWeekdayHours,
      totalProjectedHours,
      totalProjectedEarnings,
      loggedHours,
      loggedEarnings
    };
  };

  // Create summary view of tasks grouped by project + description
  const getSummaryTasks = () => {
    if (!monthlyStatement) return [];
    
    const taskMap = new Map<string, { 
      project: string; 
      description: string; 
      totalHours: number; 
      taskCount: number;
      entries: TaskEntry[];
    }>();
    
    monthlyStatement.tasks.forEach(task => {
      const key = `${task.project}|${task.description}`;
      if (taskMap.has(key)) {
        const existing = taskMap.get(key)!;
        existing.totalHours += task.hours;
        existing.taskCount += 1;
        existing.entries.push(task);
      } else {
        taskMap.set(key, {
          project: task.project,
          description: task.description,
          totalHours: task.hours,
          taskCount: 1,
          entries: [task]
        });
      }
    });
    
    return Array.from(taskMap.values()).sort((a, b) => b.totalHours - a.totalHours);
  };

  // Toggle expanded state for a task
  const toggleTaskExpansion = (taskKey: string) => {
    setExpandedTasks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(taskKey)) {
        newSet.delete(taskKey);
      } else {
        newSet.add(taskKey);
      }
      return newSet;
    });
  };

  // Open task details dialog
  const openTaskDialog = (project: string, description: string, event: React.MouseEvent) => {
    event.stopPropagation();
    const taskId = `${project}|${description}`;
    setSelectedTask({ id: taskId, project, description });
  };

  // Close task details dialog and reload data
  const handleTaskDialogClose = () => {
    setSelectedTask(null);
    // Reload the current view to reflect any changes
    if (activeTab === 'statement') {
      loadMonthlyStatement();
    }
  };

  // Get number of days in a month (month is 1-based)
  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month, 0).getDate();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading report...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Reports</h1>
              <p className="text-muted-foreground mt-2">Track your productivity and earnings</p>
            </div>
            
            <div className="flex items-center gap-4">
              {activeTab !== 'weekly' && (
                <>
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                    className="px-3 py-2 border border-border rounded-md bg-background"
                  >
                    {Array.from({ length: 12 }, (_, i) => (
                      <option key={i + 1} value={i + 1}>
                        {new Date(0, i).toLocaleString('default', { month: 'long' })}
                      </option>
                    ))}
                  </select>
                  
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                    className="px-3 py-2 border border-border rounded-md bg-background"
                  >
                    {Array.from({ length: 5 }, (_, i) => {
                      const year = new Date().getFullYear() - 2 + i;
                      return (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      );
                    })}
                  </select>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="statement">Monthly Statement</TabsTrigger>
            <TabsTrigger value="weekly">Weekly Report</TabsTrigger>
            <TabsTrigger value="monthly">Monthly Report</TabsTrigger>
          </TabsList>

          <TabsContent value="monthly" className="space-y-8">
            {report && (() => {
              const prediction = calculatePredictedEarnings(report);
              return (
                <>
                  {/* Summary Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="bg-card rounded-lg border border-border p-6">
                      <h3 className="text-sm font-medium text-muted-foreground">Total Hours</h3>
                      <p className="text-3xl font-bold text-foreground mt-2">
                        {report.totalHours.toFixed(1)}
                      </p>
                    </div>
                    
                    <div className="bg-card rounded-lg border border-border p-6">
                      <h3 className="text-sm font-medium text-muted-foreground">Estimated Earnings</h3>
                      <p className="text-3xl font-bold text-foreground mt-2">
                        {formatCurrency(report.totalHours)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">@ $115/hour</p>
                    </div>
                    
                    <div className="bg-card rounded-lg border border-border p-6">
                      <h3 className="text-sm font-medium text-muted-foreground">Average Daily</h3>
                      <p className="text-3xl font-bold text-foreground mt-2">
                        {(() => {
                          const daysWithHours = Object.values(report.dailyBreakdown).filter(hours => hours > 0).length;
                          return daysWithHours > 0 
                            ? (report.totalHours / daysWithHours).toFixed(1)
                            : '0.0';
                        })()}h
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {Object.values(report.dailyBreakdown).filter(hours => hours > 0).length} days with hours logged
                      </p>
                    </div>
                    
                    <div className="bg-card rounded-lg border border-border p-6">
                      <h3 className="text-sm font-medium text-muted-foreground">Projected Monthly Total</h3>
                      <p className="text-3xl font-bold text-foreground mt-2">
                        {formatCurrency(prediction.totalProjectedHours)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {prediction.remainingWeekdays === 0 ? (
                          'Month complete'
                        ) : (
                          <>
                            {prediction.loggedHours.toFixed(1)}h logged + {prediction.predictedHours.toFixed(1)}h predicted
                            <br />
                            ({prediction.avgWeekdayHours.toFixed(1)}h/day × {prediction.remainingWeekdays} weekdays)
                          </>
                        )}
                      </p>
                    </div>
                  </div>

                {/* Project Breakdown */}
                <div className="bg-card rounded-lg border border-border p-6">
                  <h3 className="text-lg font-semibold text-foreground mb-4">Project Breakdown</h3>
                  {Object.keys(report.projectBreakdown).length > 0 ? (
                    <div className="space-y-4">
                      {Object.entries(report.projectBreakdown)
                        .sort(([,a], [,b]) => b - a)
                        .map(([projectName, hours]) => {
                          const percentage = (hours / report.totalHours) * 100;
                          
                          return (
                            <div key={projectName} className="space-y-2">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div
                                    className="w-4 h-4 rounded-full"
                                    style={{ backgroundColor: getProjectColor(projectName) }}
                                  ></div>
                                  <span className="font-medium text-foreground">{projectName}</span>
                                </div>
                                <div className="text-right">
                                  <span className="font-semibold text-foreground">{hours.toFixed(1)}h</span>
                                  <span className="text-sm text-muted-foreground ml-2">
                                    ({percentage.toFixed(1)}%)
                                  </span>
                                </div>
                              </div>
                              <div className="w-full bg-muted rounded-full h-2">
                                <div
                                  className="h-2 rounded-full"
                                  style={{
                                    width: `${percentage}%`,
                                    backgroundColor: getProjectColorForDarkMode(projectName)
                                  }}
                                ></div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-8">
                      No time entries found for {report.month} {report.year}
                    </p>
                  )}
                </div>

                {/* Daily Breakdown */}
                <div className="bg-card rounded-lg border border-border p-6">
                  <h3 className="text-lg font-semibold text-foreground mb-4">Daily Breakdown</h3>
                  {Object.keys(report.dailyBreakdown).length > 0 || true ? (
                    <div className="space-y-3">
                      {/* Day of week headers */}
                      <div className="grid grid-cols-8 gap-2">
                        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                          <div key={day} className="text-center text-sm font-semibold text-muted-foreground py-2">
                            {day}
                          </div>
                        ))}
                        <div key="Week" className="text-center text-sm font-semibold py-2 bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 rounded-lg border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300">
                          Week
                        </div>
                      </div>
                      
                      {/* Calendar grid */}
                      <div className="space-y-2">
                        {(() => {
                          const firstDay = new Date(selectedYear, selectedMonth - 1, 1);
                          const lastDay = getDaysInMonth(selectedYear, selectedMonth);
                          // Get day of week (0 = Sunday, 1 = Monday, etc.)
                          let firstDayOfWeek = firstDay.getDay();
                          // Convert to Monday = 0, Sunday = 6
                          firstDayOfWeek = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
                          
                          const weeks = [];
                          let currentWeek = [];
                          let weekHours = 0;
                          
                          // Add empty cells for days before the first of the month
                          for (let i = 0; i < firstDayOfWeek; i++) {
                            currentWeek.push(
                              <div key={`empty-${i}`} className="p-3 rounded-lg border border-transparent"></div>
                            );
                          }
                          
                          // Add cells for each day of the month
                          for (let day = 1; day <= lastDay; day++) {
                            const date = `${selectedYear}-${selectedMonth.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
                            const hours = report.dailyBreakdown[date] || 0;
                            weekHours += hours;
                            
                            const today = new Date();
                            const todayString = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;
                            const isToday = todayString === date;
                            
                            // Get day of week for styling weekends
                            const currentDate = new Date(selectedYear, selectedMonth - 1, day);
                            const dayOfWeek = currentDate.getDay();
                            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                            
                            currentWeek.push(
                              <div
                                key={day}
                                className={`p-3 rounded-lg border text-center transition-all ${
                                  isToday
                                    ? 'bg-primary/10 border-primary text-primary ring-2 ring-primary/20'
                                    : hours > 0
                                    ? 'bg-green-50 border-green-200 text-green-800 dark:bg-green-950/20 dark:border-green-800 dark:text-green-300'
                                    : isWeekend
                                    ? 'bg-muted/50 border-border/50 text-muted-foreground/60'
                                    : 'bg-muted border-border text-muted-foreground'
                                }`}
                              >
                                <div className="text-sm font-medium">{day}</div>
                                <div className="text-xs mt-1 font-semibold">
                                  {hours > 0 ? `${hours.toFixed(1)}h` : '—'}
                                </div>
                              </div>
                            );
                            
                            // If it's Sunday (end of week) or the last day of the month
                            if (dayOfWeek === 0 || day === lastDay) {
                              // Fill remaining cells if needed (for the last week)
                              while (currentWeek.length < 7) {
                                currentWeek.push(
                                  <div key={`empty-end-${currentWeek.length}`} className="p-3 rounded-lg border border-transparent"></div>
                                );
                              }
                              
                              // Add weekly summary cell
                              currentWeek.push(
                                <div
                                  key={`week-summary-${weeks.length}`}
                                  className="p-3 rounded-lg border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 dark:border-blue-800 text-center shadow-sm"
                                >
                                  <div className="text-sm font-bold text-blue-700 dark:text-blue-300">
                                    {weekHours.toFixed(1)}h
                                  </div>
                                  <div className="text-xs mt-1 font-medium text-blue-600 dark:text-blue-400">
                                    {formatCurrency(weekHours)}
                                  </div>
                                </div>
                              );
                              
                              // Add the completed week to weeks array
                              weeks.push(
                                <div key={`week-${weeks.length}`} className="grid grid-cols-8 gap-2">
                                  {currentWeek}
                                </div>
                              );
                              
                              // Reset for next week
                              currentWeek = [];
                              weekHours = 0;
                            }
                          }
                          
                          return weeks;
                        })()}
                      </div>
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-8">
                      No time entries found for {report?.month} {report?.year}
                    </p>
                  )}
                </div>
                </>
              );
            })()}
          </TabsContent>

          <TabsContent value="weekly" className="space-y-8">
            {weeklySummary && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 rounded-lg border border-blue-200 dark:border-blue-800 p-6">
              <h2 className="text-2xl font-bold text-foreground mb-2">This Week's Summary</h2>
              <p className="text-muted-foreground mb-6">
                {new Date(weeklySummary.weekStart).toLocaleDateString('en-US', { 
                  month: 'short', 
                  day: 'numeric' 
                })} - {new Date(weeklySummary.weekEnd).toLocaleDateString('en-US', { 
                  month: 'short', 
                  day: 'numeric',
                  year: 'numeric'
                })}
              </p>
              
              {/* Weekly Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-background rounded-lg border border-border p-4">
                  <h3 className="text-sm font-medium text-muted-foreground">Total Hours</h3>
                  <p className="text-2xl font-bold text-foreground mt-1">
                    {weeklySummary.totalHours.toFixed(1)}
                  </p>
                </div>
                
                <div className="bg-background rounded-lg border border-border p-4">
                  <h3 className="text-sm font-medium text-muted-foreground">Weekly Earnings</h3>
                  <p className="text-2xl font-bold text-foreground mt-1">
                    {formatCurrency(weeklySummary.totalHours)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">@ $115/hour</p>
                </div>
                
                <div className="bg-background rounded-lg border border-border p-4">
                  <h3 className="text-sm font-medium text-muted-foreground">Average Daily</h3>
                  <p className="text-2xl font-bold text-foreground mt-1">
                    {(() => {
                      const daysWithHours = Object.values(weeklySummary.dailyBreakdown).filter(hours => hours > 0).length;
                      return daysWithHours > 0 
                        ? (weeklySummary.totalHours / daysWithHours).toFixed(1)
                        : '0.0';
                    })()}h
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {Object.values(weeklySummary.dailyBreakdown).filter(hours => hours > 0).length} days with hours logged
                  </p>
                </div>
              </div>

              {/* Weekly Project Breakdown */}
              <div className="bg-background rounded-lg border border-border p-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">Weekly Project Breakdown</h3>
                {Object.keys(weeklySummary.projectBreakdown).length > 0 ? (
                  <div className="space-y-4">
                    {Object.entries(weeklySummary.projectBreakdown)
                      .sort(([,a], [,b]) => b - a)
                      .map(([projectName, hours]) => {
                        const percentage = (hours / weeklySummary.totalHours) * 100;
                        
                        return (
                          <div key={projectName} className="space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div
                                  className="w-4 h-4 rounded-full"
                                  style={{ backgroundColor: getProjectColor(projectName) }}
                                ></div>
                                <span className="font-medium text-foreground">{projectName}</span>
                              </div>
                              <div className="text-right">
                                <span className="font-semibold text-foreground">{hours.toFixed(1)}h</span>
                                <span className="text-sm text-muted-foreground ml-2">
                                  ({percentage.toFixed(1)}%)
                                </span>
                              </div>
                            </div>
                            <div className="w-full bg-muted rounded-full h-2">
                              <div
                                className="h-2 rounded-full"
                                style={{
                                  width: `${percentage}%`,
                                  backgroundColor: getProjectColorForDarkMode(projectName)
                                }}
                              ></div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">
                    No time entries found for this week
                  </p>
                )}
              </div>

              {/* Weekly Daily Breakdown */}
              <div className="bg-background rounded-lg border border-border p-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">Daily Breakdown</h3>
                {Object.keys(weeklySummary.dailyBreakdown).length > 0 ? (
                  <div className="grid grid-cols-7 gap-2">
                      {Array.from({ length: 7 }, (_, i) => {
                        // Parse the week start date to avoid timezone issues
                        const [year, month, day] = weeklySummary.weekStart.split('-').map(Number);
                        const actualDate = new Date(year, month - 1, day + i);
                        const dateString = `${actualDate.getFullYear()}-${(actualDate.getMonth() + 1).toString().padStart(2, '0')}-${actualDate.getDate().toString().padStart(2, '0')}`;
                      const hours = weeklySummary.dailyBreakdown[dateString] || 0;
                      const today = new Date();
                      const todayString = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;
                      const isToday = todayString === dateString;
                      
                      return (
                        <div
                          key={i}
                          className={`p-3 rounded-lg border text-center ${
                            isToday
                              ? 'bg-primary/10 border-primary text-primary'
                              : hours > 0
                              ? 'bg-green-50 border-green-200 text-green-800 dark:bg-green-950/20 dark:border-green-800 dark:text-green-300'
                              : 'bg-muted border-border text-muted-foreground'
                          }`}
                        >
                            <div className="text-sm font-medium">
                              {actualDate.toLocaleDateString('en-US', { weekday: 'short' })}
                            </div>
                            <div className="text-xs mt-1">
                              {actualDate.getDate()}
                          </div>
                          <div className="text-xs mt-1 font-semibold">
                            {hours > 0 ? `${hours.toFixed(1)}h` : '—'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">
                    No time entries found for this week
                  </p>
                )}
            </div>
          </div>
        )}
          </TabsContent>

          <TabsContent value="statement" className="space-y-8">
            {monthlyStatement && (
              <>

                {/* Project Summary */}
            <div className="bg-card rounded-lg border border-border p-6">
                  <h3 className="text-lg font-semibold text-foreground mb-4">Project Summary</h3>
                  {Object.keys(monthlyStatement.projectSummary).length > 0 ? (
                <div className="space-y-4">
                      {Object.entries(monthlyStatement.projectSummary)
                        .sort(([,a], [,b]) => b.hours - a.hours)
                        .map(([projectName, summary]) => {
                          const percentage = (summary.hours / monthlyStatement.totalHours) * 100;
                      
                      return (
                        <div key={projectName} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div
                                className="w-4 h-4 rounded-full"
                                style={{ backgroundColor: getProjectColor(projectName) }}
                              ></div>
                              <span className="font-medium text-foreground">{projectName}</span>
                            </div>
                            <div className="text-right">
                                  <div className="font-semibold text-foreground">
                                    {summary.hours.toFixed(1)}h
                                  </div>
                                  <div className="text-sm text-muted-foreground">
                                    {formatCurrency(summary.hours)}
                                  </div>
                            </div>
                          </div>
                          <div className="w-full bg-muted rounded-full h-2">
                            <div
                              className="h-2 rounded-full"
                              style={{
                                width: `${percentage}%`,
                                backgroundColor: getProjectColorForDarkMode(projectName)
                              }}
                            ></div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">
                      No time entries found for {monthlyStatement.month} {monthlyStatement.year}
                </p>
              )}
            </div>

                {/* Task Line Items */}
            <div className="bg-card rounded-lg border border-border p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-foreground">Task Details</h3>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Detailed</span>
                      <button
                        onClick={() => setIsSummaryView(!isSummaryView)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          isSummaryView ? 'bg-primary' : 'bg-muted'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            isSummaryView ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                      <span className="text-sm text-muted-foreground">Summary</span>
                    </div>
                  </div>
                  {monthlyStatement.tasks.length > 0 ? (
                    <div className="space-y-2">
                      {isSummaryView ? (
                        // Summary View
                        <>
                          <div className="grid grid-cols-4 gap-4 py-2 px-4 bg-muted/50 rounded-md font-medium text-sm text-muted-foreground">
                            <div>Project</div>
                            <div>Description</div>
                            <div className="text-right">Hours</div>
                            <div className="text-right">Amount</div>
                          </div>
                          {getSummaryTasks().map((task) => {
                            const taskKey = `${task.project}|${task.description}`;
                            const isExpanded = expandedTasks.has(taskKey);
                            
                            return (
                              <div key={taskKey}>
                                <div 
                                  className="grid grid-cols-4 gap-4 py-3 px-4 border-b border-border last:border-b-0 cursor-pointer hover:bg-muted/30 transition-colors group"
                                  onClick={() => toggleTaskExpansion(taskKey)}
                                >
                                  <div className="flex items-center gap-2">
                                    <div
                                      className="w-3 h-3 rounded-full"
                                      style={{ backgroundColor: getProjectColor(task.project) }}
                                    ></div>
                                    <span className="text-sm text-foreground">{task.project}</span>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <div className="text-sm text-foreground truncate" title={task.description}>
                                      {task.description}
                                      {task.taskCount > 1 && (
                                        <span className="text-xs text-muted-foreground ml-2">
                                          ({task.taskCount} entries)
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <button 
                                        onClick={(e) => openTaskDialog(task.project, task.description, e)}
                                        className="p-1 hover:bg-primary/10 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                        title="View task budget"
                                      >
                                        <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                      </button>
                                      {task.taskCount > 1 && (
                                        <button className="ml-1 p-1 hover:bg-muted rounded">
                                          <svg
                                            className={`w-4 h-4 text-muted-foreground transition-transform ${
                                              isExpanded ? 'rotate-180' : ''
                                            }`}
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                          >
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                          </svg>
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                  <div className="text-sm text-foreground text-right">
                                    {task.totalHours.toFixed(1)}h
                                  </div>
                                  <div className="text-sm text-foreground text-right font-medium">
                                    {formatCurrency(task.totalHours)}
                                  </div>
                                </div>
                                
                                {/* Expanded individual entries */}
                                {isExpanded && task.entries.length > 1 && (
                                  <div className="bg-muted/20 border-l-2 border-border ml-4">
                                    <div className="grid grid-cols-4 gap-4 py-2 px-4 text-xs text-muted-foreground font-medium border-b border-border/50">
                                      <div>Date</div>
                                      <div>Description</div>
                                      <div className="text-right">Hours</div>
                                      <div className="text-right">Amount</div>
                                    </div>
                                    {task.entries
                                      .sort((a, b) => a.date.localeCompare(b.date))
                                      .map((entry) => (
                                        <div key={entry.id} className="grid grid-cols-4 gap-4 py-2 px-4 text-sm border-b border-border/30 last:border-b-0">
                                          <div className="text-muted-foreground">
                                            {(() => {
                                              const [year, month, day] = entry.date.split('-').map(Number);
                                              const date = new Date(year, month - 1, day);
                                              return date.toLocaleDateString('en-US', { 
                                                month: 'short', 
                                                day: 'numeric' 
                                              });
                                            })()}
                                          </div>
                                          <div className="text-muted-foreground truncate" title={entry.description}>
                                            {entry.description}
                                          </div>
                                          <div className="text-muted-foreground text-right">
                                            {entry.hours.toFixed(1)}h
                                          </div>
                                          <div className="text-muted-foreground text-right">
                                            {formatCurrency(entry.hours)}
                                          </div>
                                        </div>
                                      ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                          <div className="grid grid-cols-4 gap-4 py-3 px-4 bg-muted/50 rounded-md font-semibold text-sm text-foreground border-t-2 border-border">
                            <div></div>
                            <div>Total</div>
                            <div className="text-right">{monthlyStatement.totalHours.toFixed(1)}h</div>
                            <div className="text-right font-medium">{formatCurrency(monthlyStatement.totalHours)}</div>
                          </div>
                        </>
                      ) : (
                        // Detailed View
                        <>
                          <div className="grid grid-cols-5 gap-4 py-2 px-4 bg-muted/50 rounded-md font-medium text-sm text-muted-foreground">
                            <div>Date</div>
                            <div>Project</div>
                            <div>Description</div>
                            <div className="text-right">Hours</div>
                            <div className="text-right">Amount</div>
                          </div>
                          {monthlyStatement.tasks.map((task) => (
                            <div key={task.id} className="grid grid-cols-5 gap-4 py-3 px-4 border-b border-border last:border-b-0">
                              <div className="text-sm text-foreground">
                                {(() => {
                                  const [year, month, day] = task.date.split('-').map(Number);
                                  const date = new Date(year, month - 1, day);
                                  return date.toLocaleDateString('en-US', { 
                                    month: 'short', 
                                    day: 'numeric' 
                                  });
                                })()}
                              </div>
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-3 h-3 rounded-full"
                                  style={{ backgroundColor: getProjectColor(task.project) }}
                                ></div>
                                <span className="text-sm text-foreground">{task.project}</span>
                              </div>
                              <div className="text-sm text-foreground truncate" title={task.description}>
                                {task.description}
                              </div>
                              <div className="text-sm text-foreground text-right">
                                {task.hours.toFixed(1)}h
                              </div>
                              <div className="text-sm text-foreground text-right font-medium">
                                {formatCurrency(task.hours)}
                              </div>
                            </div>
                          ))}
                          <div className="grid grid-cols-5 gap-4 py-3 px-4 bg-muted/50 rounded-md font-semibold text-sm text-foreground border-t-2 border-border">
                            <div></div>
                            <div></div>
                            <div>Total</div>
                            <div className="text-right">{monthlyStatement.totalHours.toFixed(1)}h</div>
                            <div className="text-right font-medium">{formatCurrency(monthlyStatement.totalHours)}</div>
                          </div>
                        </>
                      )}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">
                      No time entries found for {monthlyStatement.month} {monthlyStatement.year}
                </p>
              )}
            </div>
              </>
        )}
          </TabsContent>
        </Tabs>
      </main>

      {/* Task Details Dialog */}
      {selectedTask && (
        <TaskDetailsDialog
          taskId={selectedTask.id}
          projectName={selectedTask.project}
          description={selectedTask.description}
          onClose={handleTaskDialogClose}
          onUpdate={handleTaskDialogClose}
        />
      )}
    </div>
  );
}
