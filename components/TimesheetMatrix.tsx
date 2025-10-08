'use client';

import { useState, useEffect } from 'react';
import { TimeEntry, DayData, WeekData, Project } from '@/lib/schema';
import { toast } from 'sonner';

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

interface TaskRow {
  id: string;
  project: string;
  description: string;
  hours: { [date: string]: number };
  totalHours: number;
}

// Skeleton Components
function SkeletonBox({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-pulse bg-muted rounded ${className}`}></div>
  );
}

function TimesheetSkeleton() {
  return (
    <div className="space-y-6">
      {/* Week Navigation Skeleton */}
      <div className="flex items-center justify-between">
        <SkeletonBox className="h-10 w-32" />
        <SkeletonBox className="h-8 w-48" />
        <SkeletonBox className="h-10 w-32" />
      </div>

      {/* Timesheet Matrix Skeleton */}
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <div className="grid grid-cols-8 gap-0">
          {/* Header Row */}
          <div className="bg-muted p-4 border-r border-border">
            <div className="flex items-center justify-between">
              <SkeletonBox className="h-4 w-12" />
              <SkeletonBox className="h-6 w-20" />
            </div>
          </div>
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="bg-muted p-4 border-r border-border last:border-r-0">
              <SkeletonBox className="h-4 w-16 mx-auto mb-1" />
              <SkeletonBox className="h-3 w-12 mx-auto" />
            </div>
          ))}
          
          {/* Task Rows Skeleton */}
          {Array.from({ length: 3 }).map((_, taskIndex) => (
            <div key={taskIndex} className="contents">
              {/* Task Info Skeleton */}
              <div className="bg-background p-4 border-r border-border border-t border-border">
                <div className="flex items-center gap-2 mb-1">
                  <SkeletonBox className="w-3 h-3 rounded-full" />
                  <SkeletonBox className="h-4 w-20" />
                </div>
                <SkeletonBox className="h-3 w-32 mb-2" />
                <SkeletonBox className="h-3 w-16" />
              </div>
              
              {/* Hours Inputs Skeleton for each day */}
              {Array.from({ length: 7 }).map((_, dayIndex) => (
                <div key={`${taskIndex}-${dayIndex}`} className="bg-background p-2 border-r border-border border-t border-border last:border-r-0">
                  <SkeletonBox className="h-8 w-full" />
                </div>
              ))}
            </div>
          ))}
        </div>
        
        {/* Week Total Skeleton */}
        <div className="bg-primary/10 p-4 border-t border-border">
          <div className="flex justify-between items-center">
            <SkeletonBox className="h-6 w-20" />
            <SkeletonBox className="h-8 w-24" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TimesheetMatrix() {
  const [currentWeek, setCurrentWeek] = useState<WeekData | null>(null);
  const [taskRows, setTaskRows] = useState<TaskRow[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [recentDescriptions, setRecentDescriptions] = useState<string[]>([]);
  const [showAddTask, setShowAddTask] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingWeek, setIsLoadingWeek] = useState(false);

  // Initialize current week and load projects
  useEffect(() => {
    const initializeData = async () => {
      setIsLoading(true);
      const today = new Date();
      const dayOfWeek = today.getDay();
      const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Monday is day 1
      
      // Calculate start of week without using setDate to avoid timezone issues
      const startOfWeek = new Date(today.getFullYear(), today.getMonth(), today.getDate() + daysToMonday);
      
      const weekData = generateWeekData(startOfWeek);
      setCurrentWeek(weekData);
      
      // Load all data in parallel
      await Promise.all([
        loadWeekData(weekData),
        loadProjects(),
        loadRecentDescriptions()
      ]);
      
      setIsLoading(false);
    };
    
    initializeData();
  }, []);

  const loadProjects = async () => {
    try {
      const response = await fetch('/api/projects?activeOnly=true');
      const data = await response.json();
      setProjects(data);
    } catch (error) {
      console.error('Error loading projects:', error);
    }
  };

  const loadRecentDescriptions = async () => {
    try {
      // Get descriptions from the last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const startDate = `${thirtyDaysAgo.getFullYear()}-${(thirtyDaysAgo.getMonth() + 1).toString().padStart(2, '0')}-${thirtyDaysAgo.getDate().toString().padStart(2, '0')}`;
      const today = new Date();
      const endDate = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;
      
      const response = await fetch(`/api/entries?startDate=${startDate}&endDate=${endDate}`);
      const entries = await response.json();
      
      // Extract unique descriptions, most recent first
      const descriptions = [...new Set(entries.map((entry: TimeEntry) => entry.description))]
        .filter((desc): desc is string => typeof desc === 'string' && desc.trim().length > 0)
        .slice(0, 10); // Keep only the 10 most recent unique descriptions
      
      setRecentDescriptions(descriptions);
    } catch (error) {
      console.error('Error loading recent descriptions:', error);
    }
  };

  const loadWeekData = async (weekData: WeekData) => {
    try {
      const startDate = weekData.weekStart;
      const startDateObj = new Date(startDate);
      const endDateObj = new Date(startDateObj);
      endDateObj.setDate(startDateObj.getDate() + 6);
      const endDate = `${endDateObj.getFullYear()}-${(endDateObj.getMonth() + 1).toString().padStart(2, '0')}-${endDateObj.getDate().toString().padStart(2, '0')}`;
      
      const response = await fetch(`/api/entries?startDate=${startDate}&endDate=${endDate}`);
      const entries: TimeEntry[] = await response.json();
      
      // Group entries by task (project + description combination)
      const taskMap = new Map<string, TaskRow>();
      
      entries.forEach(entry => {
        const taskKey = `${entry.project}|${entry.description}`;
        
        if (!taskMap.has(taskKey)) {
          taskMap.set(taskKey, {
            id: taskKey,
            project: entry.project,
            description: entry.description,
            hours: {},
            totalHours: 0
          });
        }
        
        const task = taskMap.get(taskKey)!;
        task.hours[entry.date] = (task.hours[entry.date] || 0) + entry.hours;
        task.totalHours += entry.hours;
      });
      
      // Convert to array and sort by project, then description
      const tasks = Array.from(taskMap.values()).sort((a, b) => {
        if (a.project !== b.project) {
          return a.project.localeCompare(b.project);
        }
        return a.description.localeCompare(b.description);
      });
      
      setTaskRows(tasks);
      setCurrentWeek(weekData);
    } catch (error) {
      console.error('Error loading week data:', error);
    }
  };

  const generateWeekData = (startDate: Date): WeekData => {
    const days: DayData[] = [];
    const weekTotal = 0;

    for (let i = 0; i < 7; i++) {
      // Create the actual date for this day of the week using constructor to avoid timezone issues
      const actualDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + i);
      
      // Use the actual date components
      const year = actualDate.getFullYear();
      const month = actualDate.getMonth() + 1; // getMonth() returns 0-11, we need 1-12
      const day = actualDate.getDate();
      
      const dateString = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
      
      
      const dayData: DayData = {
        date: dateString,
        entries: [],
        totalHours: 0
      };
      
      days.push(dayData);
    }

    return {
      weekStart: `${startDate.getFullYear()}-${(startDate.getMonth() + 1).toString().padStart(2, '0')}-${startDate.getDate().toString().padStart(2, '0')}`,
      days,
      weekTotal
    };
  };

  const addTask = async (project: string, description: string) => {
    try {
      const taskKey = `${project}|${description}`;
      
      // Check if task already exists
      if (taskRows.some(task => task.id === taskKey)) {
        toast.error('This task already exists for this week');
        return;
      }

      const newTask: TaskRow = {
        id: taskKey,
        project,
        description,
        hours: {},
        totalHours: 0
      };

      setTaskRows([...taskRows, newTask].sort((a, b) => {
        if (a.project !== b.project) {
          return a.project.localeCompare(b.project);
        }
        return a.description.localeCompare(b.description);
      }));

      setShowAddTask(false);
      loadRecentDescriptions();
      toast.success('Task added successfully');
    } catch (error) {
      console.error('Error adding task:', error);
      toast.error('Failed to add task. Please try again.');
    }
  };

  const updateTaskHours = async (taskId: string, date: string, hours: number) => {
    try {
      const task = taskRows.find(t => t.id === taskId);
      if (!task) return;

      const oldHours = task.hours[date] || 0;
      const difference = hours - oldHours;

      if (difference === 0) return; // No change

      // Update local state first
      const updatedTaskRows = taskRows.map(t => {
        if (t.id === taskId) {
          const newHours = { ...t.hours };
          if (hours === 0) {
            delete newHours[date];
          } else {
            newHours[date] = hours;
          }
          const newTotalHours = Object.values(newHours).reduce((sum, h) => sum + h, 0);
          return { ...t, hours: newHours, totalHours: newTotalHours };
        }
        return t;
      });
      setTaskRows(updatedTaskRows);

      // Update database
      if (hours === 0) {
        // Delete existing entry if hours is 0
        const response = await fetch(`/api/entries?startDate=${date}&endDate=${date}`);
        const entries = await response.json();
        const existingEntry = entries.find((e: TimeEntry) => 
          e.project === task.project && e.description === task.description && e.date === date
        );
        
        if (existingEntry) {
          await fetch(`/api/entries/${existingEntry.id}`, { method: 'DELETE' });
        }
      } else {
        // Create or update entry
        const response = await fetch(`/api/entries?startDate=${date}&endDate=${date}`);
        const entries = await response.json();
        const existingEntry = entries.find((e: TimeEntry) => 
          e.project === task.project && e.description === task.description && e.date === date
        );
        
        if (existingEntry) {
          // Update existing entry
          await fetch(`/api/entries/${existingEntry.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              project: task.project,
              description: task.description,
              hours 
            })
          });
        } else {
          // Create new entry
          await fetch('/api/entries', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              project: task.project,
              description: task.description,
              hours,
              date
            })
          });
        }
      }
      
      // Show success feedback for hour updates
      if (hours > 0) {
        toast.success('Hours updated', {
          description: `${hours}h logged for ${task.description}`,
          duration: 2000
        });
      }
    } catch (error) {
      console.error('Error updating task hours:', error);
      toast.error('Failed to update hours. Please try again.');
      // Reload data on error to sync with database
      if (currentWeek) {
        loadWeekData(currentWeek);
      }
    }
  };

  const deleteTask = async (taskId: string) => {
    try {
      const task = taskRows.find(t => t.id === taskId);
      if (!task) return;

      // Show confirmation toast
      toast.loading('Deleting task...', {
        id: 'delete-task',
        description: `Removing "${task.description}" and all its time entries`
      });

      // Get all entries for this task in the current week
      if (!currentWeek) return;
      
      const startDate = currentWeek.weekStart;
      const startDateObj = new Date(startDate);
      const endDateObj = new Date(startDateObj);
      endDateObj.setDate(startDateObj.getDate() + 6);
      const endDate = `${endDateObj.getFullYear()}-${(endDateObj.getMonth() + 1).toString().padStart(2, '0')}-${endDateObj.getDate().toString().padStart(2, '0')}`;
      
      const response = await fetch(`/api/entries?startDate=${startDate}&endDate=${endDate}`);
      const entries = await response.json();
      
      // Find all entries for this task
      const taskEntries = entries.filter((e: TimeEntry) => 
        e.project === task.project && e.description === task.description
      );

      // Delete all entries for this task
      for (const entry of taskEntries) {
        await fetch(`/api/entries/${entry.id}`, { method: 'DELETE' });
      }

      // Remove task from local state
      setTaskRows(taskRows.filter(t => t.id !== taskId));
      
      toast.success('Task deleted successfully', {
        id: 'delete-task',
        description: `"${task.description}" and all its time entries have been removed`
      });
    } catch (error) {
      console.error('Error deleting task:', error);
      toast.error('Failed to delete task. Please try again.', {
        id: 'delete-task'
      });
      // Reload data on error to sync with database
      if (currentWeek) {
        loadWeekData(currentWeek);
      }
    }
  };

  const copyFromLastWeek = async () => {
    if (!currentWeek) return;

    try {
      // Calculate previous week dates
      const currentStart = new Date(currentWeek.weekStart);
      const lastWeekStart = new Date(currentStart);
      lastWeekStart.setDate(currentStart.getDate() - 7);
      
      const lastWeekEnd = new Date(lastWeekStart);
      lastWeekEnd.setDate(lastWeekStart.getDate() + 6);
      
      // Get entries from last week
      const lastWeekStartStr = `${lastWeekStart.getFullYear()}-${(lastWeekStart.getMonth() + 1).toString().padStart(2, '0')}-${lastWeekStart.getDate().toString().padStart(2, '0')}`;
      const lastWeekEndStr = `${lastWeekEnd.getFullYear()}-${(lastWeekEnd.getMonth() + 1).toString().padStart(2, '0')}-${lastWeekEnd.getDate().toString().padStart(2, '0')}`;
      const response = await fetch(`/api/entries?startDate=${lastWeekStartStr}&endDate=${lastWeekEndStr}`);
      const lastWeekEntries: TimeEntry[] = await response.json();
      
      if (lastWeekEntries.length === 0) {
        toast.info('No tasks found in the previous week to copy');
        return;
      }

      // Show loading toast
      toast.loading('Copying tasks from last week...', {
        id: 'copy-tasks',
        description: `Found ${lastWeekEntries.length} entries, extracting unique tasks`
      });

      // Group entries by task (project + description combination) to get unique tasks
      const taskMap = new Map<string, { project: string; description: string }>();
      
      lastWeekEntries.forEach(entry => {
        const taskKey = `${entry.project}|${entry.description}`;
        
        if (!taskMap.has(taskKey)) {
          taskMap.set(taskKey, {
            project: entry.project,
            description: entry.description
          });
        }
      });

      // Create new task rows (without hours) for current week
      const newTaskRows: TaskRow[] = [];
      
      for (const [taskKey, taskData] of taskMap) {
        // Check if task already exists in current week
        const existingTask = taskRows.find(t => t.id === taskKey);
        if (existingTask) {
          continue; // Skip if task already exists
        }

        // Create new task row without hours
        newTaskRows.push({
          id: taskKey,
          project: taskData.project,
          description: taskData.description,
          hours: {},
          totalHours: 0
        });
      }

      // Add new tasks to the current task rows
      if (newTaskRows.length > 0) {
        const updatedTaskRows = [...taskRows, ...newTaskRows].sort((a, b) => {
          if (a.project !== b.project) {
            return a.project.localeCompare(b.project);
          }
          return a.description.localeCompare(b.description);
        });
        
        setTaskRows(updatedTaskRows);
        
        toast.success('Tasks copied successfully!', {
          id: 'copy-tasks',
          description: `Added ${newTaskRows.length} tasks from last week (without hours)`
        });
      } else {
        toast.info('No new tasks to copy', {
          id: 'copy-tasks',
          description: 'All tasks from last week already exist in this week'
        });
      }
    } catch (error) {
      console.error('Error copying from last week:', error);
      toast.error('Failed to copy tasks from last week. Please try again.', {
        id: 'copy-tasks'
      });
    }
  };

  const navigateWeek = async (direction: 'prev' | 'next') => {
    if (!currentWeek || isLoadingWeek) return;

    setIsLoadingWeek(true);
    const currentStart = new Date(currentWeek.weekStart);
    const newStart = new Date(currentStart);
    newStart.setDate(currentStart.getDate() + (direction === 'next' ? 7 : -7));
    
    const newWeekData = generateWeekData(newStart);
    setCurrentWeek(newWeekData);
    await loadWeekData(newWeekData);
    setIsLoadingWeek(false);
    
    toast.success(`Switched to ${direction === 'next' ? 'next' : 'previous'} week`);
  };

  const formatDate = (dateString: string) => {
    // Parse the date string directly to avoid timezone conversion
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day); // month is 0-based in Date constructor
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const getDayName = (dateString: string) => {
    // Parse the date string directly to avoid timezone conversion
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day); // month is 0-based in Date constructor
    return DAYS_OF_WEEK[date.getDay() === 0 ? 6 : date.getDay() - 1];
  };

  const getProjectColor = (projectName: string) => {
    const project = projects.find(p => p.name === projectName);
    return project?.color || '#3b82f6';
  };

  if (isLoading) {
    return <TimesheetSkeleton />;
  }

  if (!currentWeek) {
    return <div className="flex justify-center items-center h-64">Loading...</div>;
  }

  const weekTotal = taskRows.reduce((sum, task) => sum + task.totalHours, 0);
  
  // Calculate daily totals
  const dailyTotals: { [date: string]: number } = {};
  currentWeek.days.forEach(day => {
    dailyTotals[day.date] = taskRows.reduce((sum, task) => {
      return sum + (task.hours[day.date] || 0);
    }, 0);
  });

  return (
    <div className="space-y-6">
      {/* Week Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigateWeek('prev')}
          disabled={isLoadingWeek}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoadingWeek ? (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin"></div>
              Loading...
            </div>
          ) : (
            '← Previous Week'
          )}
        </button>
        
        <h2 className="text-xl font-semibold">
          Week of {formatDate(currentWeek.weekStart)}
        </h2>
        
        <button
          onClick={() => navigateWeek('next')}
          disabled={isLoadingWeek}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoadingWeek ? (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin"></div>
              Loading...
            </div>
          ) : (
            'Next Week →'
          )}
        </button>
      </div>

      {/* Task-based Timesheet Matrix */}
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <div className="grid grid-cols-8 gap-0">
          {/* Header Row */}
          <div className="bg-muted p-4 font-semibold border-r border-border">
            <div className="flex items-center justify-between">
              <span>Tasks</span>
              <div className="flex gap-2">
                <button
                  onClick={copyFromLastWeek}
                  className="text-xs px-2 py-1 border border-border rounded hover:bg-muted transition-colors flex items-center gap-1"
                  title="Copy tasks from last week"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                  </svg>
                  Copy
                </button>
                <button
                  onClick={() => setShowAddTask(true)}
                  className="text-xs px-2 py-1 bg-primary text-primary-foreground rounded hover:bg-primary/90"
                >
                  + Add Task
                </button>
              </div>
            </div>
          </div>
          {currentWeek.days.map((day) => (
            <div key={day.date} className="bg-muted p-4 font-semibold text-center border-r border-border last:border-r-0">
              <div className="text-sm">{getDayName(day.date)}</div>
              <div className="text-xs text-muted-foreground">{formatDate(day.date)}</div>
            </div>
          ))}
          
          {/* Task Rows */}
          {taskRows.map((task) => (
            <div key={task.id} className="contents">
              {/* Task Info */}
              <div className="bg-background p-4 border-r border-border border-t border-border">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: getProjectColor(task.project) }}
                    ></div>
                    <span className="font-medium text-sm">{task.project}</span>
                  </div>
                  <button
                    onClick={() => deleteTask(task.id)}
                    className="text-muted-foreground hover:text-destructive transition-colors p-1 rounded-sm hover:bg-muted"
                    title="Delete task"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 6L6 18M6 6l12 12"/>
                    </svg>
                  </button>
                </div>
                <div className="text-xs text-muted-foreground mb-2">{task.description}</div>
                <div className="text-xs font-medium text-primary">Total: {task.totalHours.toFixed(1)}h</div>
              </div>
              
              {/* Hours Inputs for each day */}
              {currentWeek.days.map((day) => (
                <div key={`${task.id}-${day.date}`} className="bg-background p-2 border-r border-border border-t border-border last:border-r-0">
                  <input
                    type="number"
                    step="0.25"
                    min="0"
                    max="24"
                    value={task.hours[day.date] || ''}
                    onChange={(e) => {
                      const hours = parseFloat(e.target.value) || 0;
                      updateTaskHours(task.id, day.date, hours);
                    }}
                    className="w-full p-1 text-center text-sm border border-border rounded bg-background focus:border-primary focus:outline-none"
                    placeholder="0"
                  />
                </div>
              ))}
            </div>
          ))}
          
          {/* Empty state */}
          {taskRows.length === 0 && (
            <div className="col-span-8 bg-background p-8 text-center border-t border-border">
              <p className="text-muted-foreground mb-4">No tasks added for this week</p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => setShowAddTask(true)}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                >
                  Add Your First Task
                </button>
                <button
                  onClick={copyFromLastWeek}
                  className="px-4 py-2 border border-border rounded-md hover:bg-muted transition-colors flex items-center gap-2"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                  </svg>
                  Copy from Last Week
                </button>
              </div>
            </div>
          )}
          
          {/* Daily Totals Row */}
          {taskRows.length > 0 && (
            <div className="contents">
              <div className="bg-primary/5 p-4 border-r border-border border-t-2 border-t-border font-semibold">
                Daily Totals
              </div>
              {currentWeek.days.map((day) => (
                <div key={`total-${day.date}`} className="bg-primary/5 p-4 text-center border-r border-border border-t-2 border-t-border last:border-r-0">
                  <span className="text-sm font-bold text-primary">
                    {dailyTotals[day.date] > 0 ? `${dailyTotals[day.date].toFixed(1)}h` : '-'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Week Total */}
        <div className="bg-primary/10 p-4 border-t border-border">
          <div className="flex justify-between items-center">
            <span className="font-semibold">Week Total</span>
            <span className="text-2xl font-bold text-primary">{weekTotal.toFixed(1)} hours</span>
          </div>
        </div>
      </div>

      {/* Add Task Modal */}
      {showAddTask && (
        <AddTaskForm
          projects={projects}
          recentDescriptions={recentDescriptions}
          onSave={(project, description) => addTask(project, description)}
          onCancel={() => setShowAddTask(false)}
        />
      )}
    </div>
  );
}

interface AddTaskFormProps {
  projects: Project[];
  recentDescriptions: string[];
  onSave: (project: string, description: string) => void;
  onCancel: () => void;
}

function AddTaskForm({ projects, recentDescriptions, onSave, onCancel }: AddTaskFormProps) {
  const [formData, setFormData] = useState({
    project: projects.length > 0 ? projects[0].name : '',
    description: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.project && formData.description.trim()) {
      onSave(formData.project, formData.description.trim());
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50">
      <div className="bg-card rounded-lg p-6 w-full max-w-md mx-4">
        <h3 className="text-lg font-semibold mb-4">Add New Task</h3>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Project</label>
            <select
              value={formData.project}
              onChange={(e) => setFormData({ ...formData, project: e.target.value })}
              className="w-full p-2 border border-border rounded-md bg-background"
              required
            >
              {projects.map(project => (
                <option key={project.id} value={project.name}>{project.name}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Task Description</label>
            <div className="space-y-2">
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full p-2 border border-border rounded-md bg-background h-20 resize-none"
                placeholder="What task will you be working on?"
                required
              />
              {recentDescriptions.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Recent descriptions:</p>
                  <div className="flex flex-wrap gap-1">
                    {recentDescriptions.map((desc, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => setFormData({ ...formData, description: desc })}
                        className="text-xs px-2 py-1 bg-secondary text-secondary-foreground rounded hover:bg-secondary/80 transition-colors"
                      >
                        {desc.length > 30 ? `${desc.substring(0, 30)}...` : desc}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 border border-border rounded-md hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              Add Task
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
