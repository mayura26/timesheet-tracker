'use client';

import { useState, useEffect } from 'react';
import { TimeEntry, DayData, WeekData, Project } from '@/lib/schema';

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

interface TaskRow {
  id: string;
  project: string;
  description: string;
  hours: { [date: string]: number };
  totalHours: number;
}

export default function TimesheetMatrix() {
  const [currentWeek, setCurrentWeek] = useState<WeekData | null>(null);
  const [taskRows, setTaskRows] = useState<TaskRow[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [recentDescriptions, setRecentDescriptions] = useState<string[]>([]);
  const [showAddTask, setShowAddTask] = useState(false);

  // Initialize current week and load projects
  useEffect(() => {
    const today = new Date();
    const startOfWeek = new Date(today);
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    startOfWeek.setDate(diff);
    
    const weekData = generateWeekData(startOfWeek);
    setCurrentWeek(weekData);
    loadWeekData(weekData);
    loadProjects();
    loadRecentDescriptions();
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
      const startDate = thirtyDaysAgo.toISOString().split('T')[0];
      const endDate = new Date().toISOString().split('T')[0];
      
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
      const endDate = new Date(new Date(startDate).getTime() + 6 * 24 * 60 * 60 * 1000)
        .toISOString().split('T')[0];
      
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
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      const dateString = date.toISOString().split('T')[0];
      
      const dayData: DayData = {
        date: dateString,
        entries: [],
        totalHours: 0
      };
      
      days.push(dayData);
    }

    return {
      weekStart: startDate.toISOString().split('T')[0],
      days,
      weekTotal
    };
  };

  const addTask = async (project: string, description: string) => {
    try {
      const taskKey = `${project}|${description}`;
      
      // Check if task already exists
      if (taskRows.some(task => task.id === taskKey)) {
        alert('This task already exists for this week');
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
    } catch (error) {
      console.error('Error adding task:', error);
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
            body: JSON.stringify({ hours })
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
    } catch (error) {
      console.error('Error updating task hours:', error);
      // Reload data on error to sync with database
      if (currentWeek) {
        loadWeekData(currentWeek);
      }
    }
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    if (!currentWeek) return;

    const currentStart = new Date(currentWeek.weekStart);
    const newStart = new Date(currentStart);
    newStart.setDate(currentStart.getDate() + (direction === 'next' ? 7 : -7));
    
    const newWeekData = generateWeekData(newStart);
    setCurrentWeek(newWeekData);
    loadWeekData(newWeekData);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const getDayName = (dateString: string) => {
    const date = new Date(dateString);
    return DAYS_OF_WEEK[date.getDay() === 0 ? 6 : date.getDay() - 1];
  };

  const getProjectColor = (projectName: string) => {
    const project = projects.find(p => p.name === projectName);
    return project?.color || '#3b82f6';
  };

  if (!currentWeek) {
    return <div className="flex justify-center items-center h-64">Loading...</div>;
  }

  const weekTotal = taskRows.reduce((sum, task) => sum + task.totalHours, 0);

  return (
    <div className="space-y-6">
      {/* Week Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigateWeek('prev')}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
        >
          ← Previous Week
        </button>
        
        <h2 className="text-xl font-semibold">
          Week of {formatDate(currentWeek.weekStart)}
        </h2>
        
        <button
          onClick={() => navigateWeek('next')}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
        >
          Next Week →
        </button>
      </div>

      {/* Task-based Timesheet Matrix */}
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <div className="grid grid-cols-8 gap-0">
          {/* Header Row */}
          <div className="bg-muted p-4 font-semibold border-r border-border">
            <div className="flex items-center justify-between">
              <span>Tasks</span>
              <button
                onClick={() => setShowAddTask(true)}
                className="text-xs px-2 py-1 bg-primary text-primary-foreground rounded hover:bg-primary/90"
              >
                + Add Task
              </button>
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
                <div className="flex items-center gap-2 mb-1">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: getProjectColor(task.project) }}
                  ></div>
                  <span className="font-medium text-sm">{task.project}</span>
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
              <button
                onClick={() => setShowAddTask(true)}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
              >
                Add Your First Task
              </button>
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
