'use client';

import { useState, useEffect } from 'react';
import { Task } from '@/lib/schema';
import { toast } from 'sonner';

interface TaskDetailsDialogProps {
  taskId: string;
  projectName: string;
  description: string;
  onClose: () => void;
  onUpdate: () => void;
}

export default function TaskDetailsDialog({ 
  taskId, 
  projectName, 
  description, 
  onClose, 
  onUpdate 
}: TaskDetailsDialogProps) {
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    description: '',
    budgeted_hours: 0,
    notes: ''
  });

  useEffect(() => {
    loadTaskDetails();
  }, [taskId]);

  const loadTaskDetails = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/tasks/${encodeURIComponent(taskId)}`);
      
      if (response.ok) {
        const data = await response.json();
        setTask(data);
        setFormData({
          description: data.description || description,
          budgeted_hours: data.budgeted_hours || 0,
          notes: data.notes || ''
        });
      } else {
        // Task doesn't exist yet, create it
        const createResponse = await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            project_name: projectName,
            description: description,
            budgeted_hours: 0,
            notes: ''
          })
        });
        
        if (createResponse.ok) {
          const newTask = await createResponse.json();
          setTask(newTask);
          setFormData({
            description: newTask.description || description,
            budgeted_hours: newTask.budgeted_hours || 0,
            notes: newTask.notes || ''
          });
        }
      }
    } catch (error) {
      console.error('Error loading task details:', error);
      toast.error('Failed to load task details');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!task) return;

    // Validate description
    if (!formData.description.trim()) {
      toast.error('Description cannot be empty');
      return;
    }

    try {
      setSaving(true);
      
      // Check if description changed
      const descriptionChanged = formData.description.trim() !== task.description;
      
      if (descriptionChanged) {
        // If description changed, we need to update the task ID and all related entries
        const response = await fetch(`/api/tasks/${encodeURIComponent(taskId)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...formData,
            update_description: true
          })
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to update task');
        }
      } else {
        // Just update the budget and notes
        const response = await fetch(`/api/tasks/${encodeURIComponent(taskId)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            budgeted_hours: formData.budgeted_hours,
            notes: formData.notes
          })
        });

        if (!response.ok) throw new Error('Failed to update task');
      }

      toast.success('Task updated successfully');
      onUpdate();
      onClose();
    } catch (error) {
      console.error('Error updating task:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update task');
    } finally {
      setSaving(false);
    }
  };

  const getProgressPercentage = () => {
    if (!task || task.budgeted_hours === 0) return 0;
    return Math.min((task.hours_billed! / task.budgeted_hours) * 100, 100);
  };

  const getProgressColor = () => {
    if (!task) return 'bg-gray-500';
    const percentage = getProgressPercentage();
    if (percentage >= 100) return 'bg-red-500';
    if (percentage >= 80) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getRemainingHoursColor = () => {
    if (!task || task.budgeted_hours === 0) return 'text-muted-foreground';
    const remaining = task.hours_remaining!;
    const percentage = (remaining / task.budgeted_hours) * 100;
    
    if (remaining <= 0) return 'text-red-600 dark:text-red-400';
    if (percentage <= 20) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-green-600 dark:text-green-400';
  };

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50">
      <div className="bg-card rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h3 className="text-xl font-semibold">Task Details</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Manage budget and notes for this task
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : task ? (
          <div className="space-y-6">
            {/* Task Info */}
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase">Project (Read-only)</label>
                  <p className="text-sm font-medium mt-1">{task.project_name}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase">Description</label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full p-2 border border-border rounded-md bg-background text-sm mt-1"
                    placeholder="Task description"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Changing this will update all time entries for this task
                  </p>
                </div>
              </div>
            </div>

            {/* Budget Statistics */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-primary/10 rounded-lg p-4">
                <label className="text-xs font-medium text-muted-foreground uppercase">Budgeted</label>
                <p className="text-2xl font-bold text-primary mt-1">
                  {task.budgeted_hours.toFixed(1)}h
                </p>
              </div>
              <div className="bg-blue-500/10 rounded-lg p-4">
                <label className="text-xs font-medium text-muted-foreground uppercase">Billed</label>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
                  {task.hours_billed?.toFixed(1) || '0.0'}h
                </p>
              </div>
              <div className="bg-muted rounded-lg p-4">
                <label className="text-xs font-medium text-muted-foreground uppercase">Remaining</label>
                <p className={`text-2xl font-bold mt-1 ${getRemainingHoursColor()}`}>
                  {task.hours_remaining?.toFixed(1) || '0.0'}h
                </p>
              </div>
            </div>

            {/* Progress Bar */}
            {task.budgeted_hours > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium">Progress</label>
                  <span className="text-sm text-muted-foreground">
                    {getProgressPercentage().toFixed(0)}%
                  </span>
                </div>
                <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full ${getProgressColor()} transition-all duration-300`}
                    style={{ width: `${getProgressPercentage()}%` }}
                  ></div>
                </div>
                {task.hours_remaining! < 0 && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                    ⚠ Over budget by {Math.abs(task.hours_remaining!).toFixed(1)} hours
                  </p>
                )}
              </div>
            )}

            {/* Editable Fields */}
            <div className="space-y-4 pt-4 border-t border-border">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Budgeted Hours
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={formData.budgeted_hours}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    budgeted_hours: parseFloat(e.target.value) || 0 
                  })}
                  className="w-full p-2 border border-border rounded-md bg-background"
                  placeholder="Enter budgeted hours"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Set the total hours budgeted for this task
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full p-2 border border-border rounded-md bg-background h-32 resize-none"
                  placeholder="Add notes about this task, deliverables, or any important information..."
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 justify-end pt-4 border-t border-border">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="px-4 py-2 border border-border rounded-md hover:bg-muted transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin"></div>
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-muted-foreground">Failed to load task details</p>
          </div>
        )}
      </div>
    </div>
  );
}
