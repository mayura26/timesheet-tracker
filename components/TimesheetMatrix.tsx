'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { TimeEntry, DayData, WeekData, Project, Task } from '@/lib/schema';
import { toast } from 'sonner';
import TaskDetailsDialog from './TaskDetailsDialog';

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

interface TaskRow {
  id: string;
  project: string;
  description: string;
  hours: { [date: string]: number };
  totalHours: number;
  budgeted_hours?: number;
  hours_billed?: number;
  hours_remaining?: number;
  completion_percentage?: number;
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
              <div className="bg-background p-4 border-r border-border border-t">
                <div className="flex items-center gap-2 mb-1">
                  <SkeletonBox className="w-3 h-3 rounded-full" />
                  <SkeletonBox className="h-4 w-20" />
                </div>
                <SkeletonBox className="h-3 w-32 mb-2" />
                <SkeletonBox className="h-3 w-16" />
              </div>
              
              {/* Hours Inputs Skeleton for each day */}
              {Array.from({ length: 7 }).map((_, dayIndex) => (
                <div key={`${taskIndex}-${dayIndex}`} className="bg-background p-2 border-r border-border border-t last:border-r-0">
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
  const [selectedTask, setSelectedTask] = useState<{ id: string; project: string; description: string } | null>(null);
  
  // Track pending updates to prevent race conditions
  const pendingUpdatesRef = useRef<{ [key: string]: NodeJS.Timeout }>({});
  // Track current task rows for use in async callbacks
  const taskRowsRef = useRef<TaskRow[]>([]);

  const loadTaskBudgets = useCallback(async (tasks: TaskRow[]) => {
    try {
      // Fetch all tasks from the database
      const response = await fetch('/api/tasks');
      if (!response.ok) return;
      
      const tasksData: Task[] = await response.json();
      
      // Map budget data to task rows
      const updatedTasks = tasks.map(task => {
        const taskData = tasksData.find(t => t.id === task.id);
        if (taskData) {
          return {
            ...task,
            budgeted_hours: taskData.budgeted_hours,
            hours_billed: taskData.hours_billed,
            hours_remaining: taskData.hours_remaining,
            completion_percentage: taskData.completion_percentage
          };
        }
        return task;
      });
      
      setTaskRows(updatedTasks);
      taskRowsRef.current = updatedTasks;
    } catch (error) {
      console.error('Error loading task budgets:', error);
      setTaskRows(tasks); // Set tasks without budget data if fetch fails
      taskRowsRef.current = tasks;
    }
  }, []);

  const loadWeekData = useCallback(async (weekData: WeekData) => {
    try {
      const startDate = weekData.weekStart;
      const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
      
      // Calculate end date safely by adding 6 days
      const endDateObj = new Date(startYear, startMonth - 1, startDay + 6);
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
      
      // Load budget data for all tasks
      await loadTaskBudgets(tasks);
    } catch (error) {
      console.error('Error loading week data:', error);
    }
  }, [loadTaskBudgets]);

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
    
    // Cleanup pending timeouts on unmount
    return () => {
      // We intentionally access .current here to get the latest ref value at cleanup time
      // eslint-disable-next-line react-hooks/exhaustive-deps
      Object.values(pendingUpdatesRef.current).forEach(timeout => {
        clearTimeout(timeout);
      });
    };
  }, [loadWeekData]);

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
      // Get descriptions from the last 2 weeks (14 days)
      const twoWeeksAgo = new Date();
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
      const startDate = `${twoWeeksAgo.getFullYear()}-${(twoWeeksAgo.getMonth() + 1).toString().padStart(2, '0')}-${twoWeeksAgo.getDate().toString().padStart(2, '0')}`;
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

  const addTask = async (project: string, description: string, budgetedHours?: number, notes?: string) => {
    try {
      const taskKey = `${project}|${description}`;
      
      // Check if task already exists
      if (taskRows.some(task => task.id === taskKey)) {
        toast.error('This task already exists for this week');
        return;
      }

      // Create task in database if budgeted hours or notes are provided
      if (budgetedHours || notes) {
        await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            project_name: project,
            description: description,
            budgeted_hours: budgetedHours || 0,
            notes: notes || ''
          })
        });
      }

      const newTask: TaskRow = {
        id: taskKey,
        project,
        description,
        hours: {},
        totalHours: 0,
        budgeted_hours: budgetedHours,
        hours_billed: 0,
        hours_remaining: budgetedHours || 0
      };

      const sortedTasks = [...taskRows, newTask].sort((a, b) => {
        if (a.project !== b.project) {
          return a.project.localeCompare(b.project);
        }
        return a.description.localeCompare(b.description);
      });
      setTaskRows(sortedTasks);
      taskRowsRef.current = sortedTasks;

      setShowAddTask(false);
      loadRecentDescriptions();
      toast.success('Task added successfully');
    } catch (error) {
      console.error('Error adding task:', error);
      toast.error('Failed to add task. Please try again.');
    }
  };

  const updateTaskHours = (taskId: string, date: string, hours: number) => {
    const task = taskRows.find(t => t.id === taskId);
    if (!task) return;

    const oldHours = task.hours[date] || 0;
    if (hours === oldHours) return; // No change

    // Update local state immediately for responsive UI
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
    taskRowsRef.current = updatedTaskRows;

    // Debounce the database update
    const updateKey = `${taskId}-${date}`;
    
    // Clear any pending update for this task-date combination
    if (pendingUpdatesRef.current[updateKey]) {
      clearTimeout(pendingUpdatesRef.current[updateKey]);
    }

    // Schedule the database update
    pendingUpdatesRef.current[updateKey] = setTimeout(async () => {
      try {
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
        
        // Clean up the pending update reference
        delete pendingUpdatesRef.current[updateKey];
        
        // Refresh task budgets to update metrics (hours_remaining, hours_billed, etc.)
        // Use ref to get the latest task rows state
        await loadTaskBudgets(taskRowsRef.current);
        
        // Show success feedback for hour updates
        if (hours > 0) {
          toast.success('Hours saved', {
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
    }, 500); // 500ms debounce delay
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
      const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
      
      // Calculate end date safely by adding 6 days
      const endDateObj = new Date(startYear, startMonth - 1, startDay + 6);
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
      const filteredTasks = taskRows.filter(t => t.id !== taskId);
      setTaskRows(filteredTasks);
      taskRowsRef.current = filteredTasks;
      
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
      // Calculate previous week dates safely
      const [currentYear, currentMonth, currentDay] = currentWeek.weekStart.split('-').map(Number);
      
      // Calculate last week start (7 days before current week start)
      const lastWeekStart = new Date(currentYear, currentMonth - 1, currentDay - 7);
      
      // Calculate last week end (6 days after last week start)
      const lastWeekEnd = new Date(currentYear, currentMonth - 1, currentDay - 1);
      
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
        taskRowsRef.current = updatedTaskRows;
        
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
    const [currentYear, currentMonth, currentDay] = currentWeek.weekStart.split('-').map(Number);
    
    // Calculate new week start safely by adding/subtracting 7 days
    const newStart = new Date(currentYear, currentMonth - 1, currentDay + (direction === 'next' ? 7 : -7));
    
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
    
    // Convert JavaScript day (0=Sunday, 1=Monday, etc.) to our array index (0=Monday, 1=Tuesday, etc.)
    const jsDay = date.getDay();
    const ourDayIndex = jsDay === 0 ? 6 : jsDay - 1; // Sunday (0) becomes 6, Monday (1) becomes 0, etc.
    
    return DAYS_OF_WEEK[ourDayIndex];
  };

  const getProjectColor = (projectName: string) => {
    const project = projects.find(p => p.name === projectName);
    return project?.color || '#3b82f6';
  };

  const getTodayDateString = () => {
    // Get today's date without timezone issues
    const today = new Date();
    const year = today.getFullYear();
    const month = (today.getMonth() + 1).toString().padStart(2, '0');
    const day = today.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const isToday = (dateString: string) => {
    return dateString === getTodayDateString();
  };

  const getRemainingHoursBadgeColor = (task: TaskRow) => {
    if (!task.budgeted_hours || task.budgeted_hours === 0) return '';
    
    const remaining = task.hours_remaining || 0;
    const percentage = (remaining / task.budgeted_hours) * 100;
    
    if (remaining <= 0) {
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
    }
    if (percentage <= 20) {
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
    }
    return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
  };

  const handleTaskDialogClose = async () => {
    setSelectedTask(null);
    // Reload week data and task budgets to reflect any changes
    if (currentWeek) {
      await loadWeekData(currentWeek);
    }
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
    <div className="space-y-4 md:space-y-6">
      {/* Week Navigation */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <button
          onClick={() => navigateWeek('prev')}
          disabled={isLoadingWeek}
          className="w-full sm:w-auto px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
        >
          {isLoadingWeek ? (
            <div className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin"></div>
              Loading...
            </div>
          ) : (
            '← Previous Week'
          )}
        </button>
        
        <h2 className="text-lg md:text-xl font-semibold text-center">
          Week of {formatDate(currentWeek.weekStart)}
        </h2>
        
        <button
          onClick={() => navigateWeek('next')}
          disabled={isLoadingWeek}
          className="w-full sm:w-auto px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
        >
          {isLoadingWeek ? (
            <div className="flex items-center justify-center gap-2">
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
        {/* Mobile Action Buttons Header */}
        <div className="block sm:hidden p-3 border-b border-border bg-muted/50">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-sm">Tasks</span>
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
                + Add
              </button>
            </div>
          </div>
        </div>

        {/* Responsive Grid Container with Horizontal Scroll */}
        <div className="overflow-x-auto">
          <div className="min-w-[640px] sm:min-w-0 grid grid-cols-8 gap-0">
            {/* Header Row */}
            <div className="bg-muted p-3 sm:p-4 font-semibold border-r border-border">
              <div className="hidden sm:flex items-center justify-between">
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
              <div className="block sm:hidden text-sm">
                Tasks
              </div>
            </div>
            
            {/* Day Headers */}
            {currentWeek.days.map((day) => {
              const isTodayDay = isToday(day.date);
              return (
                <div 
                  key={day.date} 
                  className={`p-3 sm:p-4 font-semibold text-center border-r border-border last:border-r-0 ${
                    isTodayDay 
                      ? 'bg-primary/20 border-2 border-primary ring-2 ring-primary/30' 
                      : 'bg-muted'
                  }`}
                >
                  <div className={`text-xs sm:text-sm ${isTodayDay ? 'text-primary font-bold' : ''}`}>
                    <span className="sm:hidden">{getDayName(day.date).substring(0, 3)}</span>
                    <span className="hidden sm:inline">{getDayName(day.date)}</span>
                    {isTodayDay && (
                      <>
                        <span className="sm:hidden"> (T)</span>
                        <span className="hidden sm:inline"> (Today)</span>
                      </>
                    )}
                  </div>
                  <div className={`text-xs ${isTodayDay ? 'text-primary font-semibold' : 'text-muted-foreground'}`}>
                    {formatDate(day.date)}
                  </div>
                </div>
              );
            })}
          
            {/* Task Rows */}
            {taskRows.map((task) => (
              <>
                {/* Task Info */}
                <div key={`${task.id}-info`} className="bg-background p-3 sm:p-4 border-r border-border border-t">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1 sm:gap-2">
                    <div
                      className="w-2 h-2 sm:w-3 sm:h-3 rounded-full"
                      style={{ backgroundColor: getProjectColor(task.project) }}
                    ></div>
                    <span className="font-medium text-xs sm:text-sm">{task.project}</span>
                    {task.completion_percentage !== undefined && (
                      <div className="text-xs font-medium px-1 sm:px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                        {task.completion_percentage.toFixed(0)}%
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => deleteTask(task.id)}
                    className="text-muted-foreground hover:text-destructive transition-colors p-0.5 sm:p-1 rounded-sm hover:bg-muted"
                    title="Delete task"
                  >
                    <svg width="12" height="12" className="sm:w-3.5 sm:h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 6L6 18M6 6l12 12"/>
                    </svg>
                  </button>
                </div>
                <button
                  onClick={() => setSelectedTask({ id: task.id, project: task.project, description: task.description })}
                  className="w-full text-left hover:bg-muted/50 -mx-1 sm:-mx-2 px-1 sm:px-2 py-0.5 sm:py-1 rounded transition-colors"
                  title="Click to view task details and budget"
                >
                  <div className="text-xs text-muted-foreground mb-1 sm:mb-2 line-clamp-2">{task.description}</div>
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-medium text-primary">Total: {task.totalHours.toFixed(1)}h</div>
                    {task.budgeted_hours !== undefined && task.budgeted_hours > 0 && (
                      <div className={`text-xs font-medium px-1 sm:px-2 py-0.5 rounded-full ${getRemainingHoursBadgeColor(task)}`}>
                        {task.hours_remaining! >= 0 ? `${task.hours_remaining!.toFixed(1)}h left` : `${Math.abs(task.hours_remaining!).toFixed(1)}h over`}
                      </div>
                    )}
                  </div>
                </button>
              </div>
              
              {/* Hours Inputs for each day */}
              {currentWeek.days.map((day) => {
                const isTodayDay = isToday(day.date);
                return (
                  <div 
                    key={`${task.id}-${day.date}`} 
                    className={`p-1 sm:p-2 border-r border-t border-border last:border-r-0 min-w-[80px] sm:min-w-0 ${
                      isTodayDay ? 'bg-primary/5' : 'bg-background'
                    }`}
                  >
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
                      className={`w-full p-1 text-center text-xs sm:text-sm border rounded focus:outline-none ${
                        isTodayDay 
                          ? 'border-primary/40 bg-background/95 focus:border-primary focus:ring-1 focus:ring-primary/20' 
                          : 'border-border bg-background focus:border-primary'
                      }`}
                      placeholder="0"
                    />
                  </div>
                );
              })}
              </>
            ))}
            
            {/* Empty state */}
            {taskRows.length === 0 && (
              <div className="col-span-8 bg-background p-6 sm:p-8 text-center border-t border-border">
                <p className="text-muted-foreground mb-4 text-sm sm:text-base">No tasks added for this week</p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <button
                    onClick={() => setShowAddTask(true)}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors text-sm sm:text-base"
                  >
                    Add Your First Task
                  </button>
                  <button
                    onClick={copyFromLastWeek}
                    className="px-4 py-2 border border-border rounded-md hover:bg-muted transition-colors flex items-center justify-center gap-2 text-sm sm:text-base"
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
              <>
                <div className="bg-primary/5 p-3 sm:p-4 border-r border-border border-t-2 border-t-border font-semibold">
                  <span className="text-xs sm:text-sm">Daily Totals</span>
                </div>
                {currentWeek.days.map((day) => {
                  const isTodayDay = isToday(day.date);
                  return (
                    <div 
                      key={`total-${day.date}`} 
                      className={`p-3 sm:p-4 text-center border-r border-border border-t-2 border-t-border last:border-r-0 ${
                        isTodayDay ? 'bg-primary/15' : 'bg-primary/5'
                      }`}
                    >
                      <span className="text-xs sm:text-sm font-bold text-primary">
                        {dailyTotals[day.date] > 0 ? `${dailyTotals[day.date].toFixed(1)}h` : '-'}
                      </span>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </div>
        
        {/* Week Total */}
        <div className="bg-primary/10 p-3 md:p-4 border-t border-border">
          <div className="flex justify-between items-center">
            <span className="font-semibold text-sm md:text-base">Week Total</span>
            <span className="text-lg md:text-2xl font-bold text-primary">{weekTotal.toFixed(1)} hours</span>
          </div>
        </div>
      </div>

      {/* Add Task Modal */}
      {showAddTask && (
        <AddTaskForm
          projects={projects}
          recentDescriptions={recentDescriptions}
          onSave={(project, description, budgetedHours, notes) => addTask(project, description, budgetedHours, notes)}
          onCancel={() => setShowAddTask(false)}
        />
      )}

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

interface AddTaskFormProps {
  projects: Project[];
  recentDescriptions: string[];
  onSave: (project: string, description: string, budgetedHours?: number, notes?: string) => void;
  onCancel: () => void;
}

function AddTaskForm({ projects, recentDescriptions, onSave, onCancel }: AddTaskFormProps) {
  const [taskType, setTaskType] = useState<'new' | 'recent'>('new');
  const [recentTasks, setRecentTasks] = useState<Task[]>([]);
  const [isLoadingRecentTasks, setIsLoadingRecentTasks] = useState(false);
  const [formData, setFormData] = useState({
    project: projects.length > 0 ? projects[0].name : '',
    description: '',
    budgetedHours: 0,
    notes: '',
    selectedTaskId: ''
  });

  // Fetch tasks with budget remaining
  useEffect(() => {
    const fetchRecentTasks = async () => {
      if (taskType === 'recent') {
        setIsLoadingRecentTasks(true);
        try {
          const response = await fetch('/api/tasks');
          if (response.ok) {
            const allTasks: Task[] = await response.json();
            // Filter tasks that have budget remaining (hours_remaining > 0) and are not closed
            const tasksWithBudget = allTasks.filter(
              task => (task.hours_remaining ?? 0) > 0 && !task.is_closed
            );
            // Sort by project name, then description
            tasksWithBudget.sort((a, b) => {
              if (a.project_name !== b.project_name) {
                return a.project_name.localeCompare(b.project_name);
              }
              return a.description.localeCompare(b.description);
            });
            setRecentTasks(tasksWithBudget);
          }
        } catch (error) {
          console.error('Error fetching recent tasks:', error);
        } finally {
          setIsLoadingRecentTasks(false);
        }
      }
    };

    fetchRecentTasks();
  }, [taskType]);

  // Handle recent task selection
  const handleRecentTaskSelect = (taskId: string) => {
    const selectedTask = recentTasks.find(task => task.id === taskId);
    if (selectedTask) {
      setFormData({
        project: selectedTask.project_name,
        description: selectedTask.description,
        budgetedHours: selectedTask.budgeted_hours || 0,
        notes: selectedTask.notes || '',
        selectedTaskId: taskId
      });
    }
  };

  // Reset form when switching task type
  useEffect(() => {
    if (taskType === 'new') {
      setFormData({
        project: projects.length > 0 ? projects[0].name : '',
        description: '',
        budgetedHours: 0,
        notes: '',
        selectedTaskId: ''
      });
    }
  }, [taskType, projects]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.project && formData.description.trim()) {
      onSave(formData.project, formData.description.trim(), formData.budgetedHours, formData.notes.trim());
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50">
      <div className="bg-card rounded-lg p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold mb-4">Add Task</h3>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Task Type Selection */}
          <div>
            <label className="block text-sm font-medium mb-2">Task Type</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="taskType"
                  value="new"
                  checked={taskType === 'new'}
                  onChange={(e) => setTaskType(e.target.value as 'new' | 'recent')}
                  className="w-4 h-4"
                />
                <span className="text-sm">New Task</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="taskType"
                  value="recent"
                  checked={taskType === 'recent'}
                  onChange={(e) => setTaskType(e.target.value as 'new' | 'recent')}
                  className="w-4 h-4"
                />
                <span className="text-sm">Recent Task</span>
              </label>
            </div>
          </div>

          {/* Recent Task Dropdown */}
          {taskType === 'recent' && (
            <div>
              <label className="block text-sm font-medium mb-1">Select Recent Task</label>
              {isLoadingRecentTasks ? (
                <div className="w-full p-2 border border-border rounded-md bg-background text-sm text-muted-foreground">
                  Loading tasks...
                </div>
              ) : recentTasks.length === 0 ? (
                <div className="w-full p-2 border border-border rounded-md bg-background text-sm text-muted-foreground">
                  No tasks with budget remaining found
                </div>
              ) : (
                <select
                  value={formData.selectedTaskId}
                  onChange={(e) => handleRecentTaskSelect(e.target.value)}
                  className="w-full p-2 border border-border rounded-md bg-background"
                  required={taskType === 'recent'}
                >
                  <option value="">-- Select a task --</option>
                  {recentTasks.map(task => (
                    <option key={task.id} value={task.id}>
                      {task.project_name} - {task.description} 
                      {task.hours_remaining !== undefined && ` (${task.hours_remaining.toFixed(1)}h remaining)`}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Project Selection (only for new tasks or when editing) */}
          {taskType === 'new' && (
            <div>
              <label className="block text-sm font-medium mb-1">Project</label>
              <select
                value={formData.project}
                onChange={(e) => setFormData({ ...formData, project: e.target.value })}
                className="w-full p-2 border border-border rounded-md bg-background"
                required={taskType === 'new'}
              >
                {projects.map(project => (
                  <option key={project.id} value={project.name}>{project.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Project Display (read-only for recent tasks) */}
          {taskType === 'recent' && formData.selectedTaskId && (
            <div>
              <label className="block text-sm font-medium mb-1">Project</label>
              <input
                type="text"
                value={formData.project}
                readOnly
                className="w-full p-2 border border-border rounded-md bg-muted text-muted-foreground cursor-not-allowed"
              />
            </div>
          )}
          
          {/* Task Description */}
          <div>
            <label className="block text-sm font-medium mb-1">Task Description</label>
            {taskType === 'new' ? (
              <div className="space-y-2">
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full p-2 border border-border rounded-md bg-background h-20 resize-none"
                  placeholder="What task will you be working on?"
                  required={taskType === 'new'}
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
            ) : (
              <textarea
                value={formData.description}
                readOnly
                className="w-full p-2 border border-border rounded-md bg-muted text-muted-foreground h-20 resize-none cursor-not-allowed"
              />
            )}
          </div>

          {/* Budgeted Hours */}
          <div>
            <label className="block text-sm font-medium mb-1">Budgeted Hours (Optional)</label>
            <input
              type="number"
              step="0.5"
              min="0"
              value={formData.budgetedHours || ''}
              onChange={(e) => setFormData({ ...formData, budgetedHours: parseFloat(e.target.value) || 0 })}
              className="w-full p-2 border border-border rounded-md bg-background"
              placeholder="Enter budgeted hours"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {taskType === 'recent' && formData.selectedTaskId
                ? `Current budget: ${formData.budgetedHours.toFixed(1)}h`
                : 'Set a budget to track hours remaining for this task'}
            </p>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium mb-1">Notes (Optional)</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full p-2 border border-border rounded-md bg-background h-20 resize-none"
              placeholder="Add any notes or additional information..."
            />
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
