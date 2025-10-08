'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Task } from '@/lib/schema';
import { toast } from 'sonner';

interface ChecklistItem {
  id: string;
  text: string;
  checked: boolean;
  hours: number;
  lineIndex: number;
}

// Parse notes to extract checklist items and regular text
function parseNotes(notes: string): { checklist: ChecklistItem[], regularText: string[] } {
  const lines = notes.split('\n');
  const checklist: ChecklistItem[] = [];
  const regularText: string[] = [];
  
  lines.forEach((line, index) => {
    // Match patterns: "- [ ] text" or "- [ ] text (2.5h)"
    const uncheckedMatch = line.match(/^- \[ \] (.+?)(?:\s*\(([0-9.]+)h\))?$/);
    const checkedMatch = line.match(/^- \[x\] (.+?)(?:\s*\(([0-9.]+)h\))?$/i);
    
    if (uncheckedMatch) {
      checklist.push({
        id: `item-${index}-${Date.now()}`,
        text: uncheckedMatch[1].trim(),
        checked: false,
        hours: uncheckedMatch[2] ? parseFloat(uncheckedMatch[2]) : 0,
        lineIndex: index
      });
    } else if (checkedMatch) {
      checklist.push({
        id: `item-${index}-${Date.now()}`,
        text: checkedMatch[1].trim(),
        checked: true,
        hours: checkedMatch[2] ? parseFloat(checkedMatch[2]) : 0,
        lineIndex: index
      });
    } else if (line.trim()) {
      regularText.push(line);
    }
  });
  
  return { checklist, regularText };
}

// Convert checklist items and regular text back to notes string
function serializeNotes(checklist: ChecklistItem[], regularText: string[]): string {
  const checklistLines = checklist.map(item => 
    `- [${item.checked ? 'x' : ' '}] ${item.text} (${item.hours}h)`
  );
  
  return [...checklistLines, ...regularText].join('\n');
}

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
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [regularNotes, setRegularNotes] = useState('');
  const [showAddItem, setShowAddItem] = useState(false);
  const [newItemText, setNewItemText] = useState('');
  const [autoSaving, setAutoSaving] = useState(false);
  const newItemInputRef = useRef<HTMLInputElement>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
        const notes = data.notes || '';
        const parsed = parseNotes(notes);
        
        setFormData({
          description: data.description || description,
          budgeted_hours: data.budgeted_hours || 0,
          notes: notes
        });
        setChecklist(parsed.checklist);
        setRegularNotes(parsed.regularText.join('\n'));
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
          setChecklist([]);
          setRegularNotes('');
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
      
      // Serialize checklist and regular notes back to notes field
      const serializedNotes = serializeNotes(checklist, regularNotes.split('\n').filter(line => line.trim()));
      
      // Check if description changed
      const descriptionChanged = formData.description.trim() !== task.description;
      
      if (descriptionChanged) {
        // If description changed, we need to update the task ID and all related entries
        const response = await fetch(`/api/tasks/${encodeURIComponent(taskId)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            description: formData.description,
            budgeted_hours: formData.budgeted_hours,
            notes: serializedNotes,
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
            notes: serializedNotes
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

  // Checklist handlers
  const toggleChecklistItem = (itemId: string) => {
    setChecklist(prev => {
      const updated = prev.map(item => 
        item.id === itemId ? { ...item, checked: !item.checked } : item
      );
      // Immediate auto-save for checkbox toggles
      autoSave(updated, regularNotes);
      return updated;
    });
  };

  const updateChecklistItemText = (itemId: string, newText: string) => {
    setChecklist(prev => {
      const updated = prev.map(item => 
        item.id === itemId ? { ...item, text: newText } : item
      );
      // Debounced auto-save for text edits
      debouncedAutoSave(updated, regularNotes);
      return updated;
    });
  };

  const updateChecklistItemHours = (itemId: string, hours: number) => {
    setChecklist(prev => {
      const updated = prev.map(item => 
        item.id === itemId ? { ...item, hours: Math.max(0, hours) } : item
      );
      // Debounced auto-save for hours edits
      debouncedAutoSave(updated, regularNotes);
      return updated;
    });
  };

  const removeChecklistItem = (itemId: string) => {
    setChecklist(prev => {
      const updated = prev.filter(item => item.id !== itemId);
      // Immediate auto-save for deletions
      autoSave(updated, regularNotes);
      return updated;
    });
  };

  const addChecklistItem = () => {
    if (!newItemText.trim()) return;
    
    const newItem: ChecklistItem = {
      id: `item-${Date.now()}`,
      text: newItemText.trim(),
      checked: false,
      hours: 0,
      lineIndex: checklist.length
    };
    
    setChecklist(prev => {
      const updated = [...prev, newItem];
      // Immediate auto-save for new items
      autoSave(updated, regularNotes);
      return updated;
    });
    setNewItemText('');
    setShowAddItem(false);
  };

  const handleAddItemKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addChecklistItem();
    } else if (e.key === 'Escape') {
      setShowAddItem(false);
      setNewItemText('');
    }
  };

  // Auto-focus on new item input when it appears
  useEffect(() => {
    if (showAddItem && newItemInputRef.current) {
      newItemInputRef.current.focus();
    }
  }, [showAddItem]);

  // Auto-save function
  const autoSave = useCallback(async (checklistToSave: ChecklistItem[], notesToSave: string) => {
    if (!task) return;

    try {
      setAutoSaving(true);
      const serializedNotes = serializeNotes(checklistToSave, notesToSave.split('\n').filter(line => line.trim()));
      
      await fetch(`/api/tasks/${encodeURIComponent(taskId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          budgeted_hours: formData.budgeted_hours,
          notes: serializedNotes
        })
      });

      // Update formData to keep it in sync
      setFormData(prev => ({ ...prev, notes: serializedNotes }));
    } catch (error) {
      console.error('Auto-save failed:', error);
      toast.error('Failed to auto-save changes');
    } finally {
      setAutoSaving(false);
    }
  }, [task, taskId, formData.budgeted_hours]);

  // Debounced auto-save for text edits
  const debouncedAutoSave = useCallback((checklistToSave: ChecklistItem[], notesToSave: string) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(() => {
      autoSave(checklistToSave, notesToSave);
    }, 1000); // 1 second debounce
  }, [autoSave]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Auto-split hours evenly across all subtasks with 0.5h minimum rounding
  const autoSplitHours = () => {
    if (checklist.length === 0 || formData.budgeted_hours <= 0) return;

    const numTasks = checklist.length;
    const totalBudget = formData.budgeted_hours;
    
    // Calculate base hours per task
    const baseHours = totalBudget / numTasks;
    
    // Round to nearest 0.5
    const roundToHalf = (num: number) => Math.round(num * 2) / 2;
    const roundedBase = roundToHalf(baseHours);
    
    // Ensure minimum of 0.5h per task
    const safeBase = Math.max(0.5, roundedBase);
    
    // Start with all tasks getting the safe base amount
    const hoursArray = new Array(numTasks).fill(safeBase);
    
    // Calculate current total and difference from budget
    const currentTotal = safeBase * numTasks;
    let difference = totalBudget - currentTotal;
    
    // Distribute the difference in 0.5h increments
    let taskIndex = 0;
    while (Math.abs(difference) >= 0.5) {
      if (difference > 0) {
        // Add 0.5h to tasks
        hoursArray[taskIndex] += 0.5;
        difference -= 0.5;
      } else {
        // Remove 0.5h from tasks (but never go below 0.5)
        if (hoursArray[taskIndex] > 0.5) {
          hoursArray[taskIndex] -= 0.5;
          difference += 0.5;
        }
      }
      taskIndex = (taskIndex + 1) % numTasks;
      
      // Safety check to prevent infinite loop
      if (Math.abs(difference) < 0.25) break;
    }
    
    // Apply the calculated hours to the checklist
    setChecklist(prev => {
      const updated = prev.map((item, index) => ({
        ...item,
        hours: hoursArray[index]
      }));
      // Auto-save the changes
      autoSave(updated, regularNotes);
      return updated;
    });
    
    toast.success('Hours distributed evenly across subtasks', {
      description: `${totalBudget}h split among ${numTasks} subtasks`,
      duration: 2000
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50">
      <div className="bg-card rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-semibold">Task Details</h3>
              {autoSaving && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                  Saving...
                </span>
              )}
            </div>
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

            {/* Progress Bars */}
            <div className="space-y-4">
              {/* Budget Progress */}
              {task.budgeted_hours > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium">Budget Progress</label>
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

              {/* Work Completion Progress */}
              {checklist.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium">Work Completion</label>
                    <span className="text-sm text-muted-foreground">
                      {(() => {
                        const totalHours = checklist.reduce((sum, item) => sum + item.hours, 0);
                        const completedHours = checklist.filter(item => item.checked).reduce((sum, item) => sum + item.hours, 0);
                        return totalHours > 0 ? ((completedHours / totalHours) * 100).toFixed(0) : '0';
                      })()}%
                    </span>
                  </div>
                  <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 transition-all duration-300"
                      style={{ 
                        width: `${(() => {
                          const totalHours = checklist.reduce((sum, item) => sum + item.hours, 0);
                          const completedHours = checklist.filter(item => item.checked).reduce((sum, item) => sum + item.hours, 0);
                          return totalHours > 0 ? (completedHours / totalHours) * 100 : 0;
                        })()}%` 
                      }}
                    ></div>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-xs text-muted-foreground">
                      {checklist.filter(item => item.checked).length} of {checklist.length} subtasks
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {checklist.filter(item => item.checked).reduce((sum, item) => sum + item.hours, 0).toFixed(1)}h / {checklist.reduce((sum, item) => sum + item.hours, 0).toFixed(1)}h
                    </p>
                  </div>
                </div>
              )}
            </div>

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

              {/* Checklist Section */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium">
                    Subtasks Checklist {checklist.length > 0 && (
                      <span className="text-muted-foreground">
                        ({checklist.reduce((sum, item) => sum + item.hours, 0).toFixed(1)}h)
                      </span>
                    )}
                  </label>
                  {checklist.length > 0 && formData.budgeted_hours > 0 && (
                    <button
                      type="button"
                      onClick={() => autoSplitHours()}
                      className="text-xs px-2 py-1 bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 rounded transition-colors flex items-center gap-1"
                      title="Evenly distribute budgeted hours across all subtasks"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 3h18v18H3zM9 3v18M15 3v18M3 9h18M3 15h18"/>
                      </svg>
                      Auto Split
                    </button>
                  )}
                </div>
                
                <div className="space-y-2 mb-4">
                  {checklist.length === 0 && !showAddItem && (
                    <p className="text-sm text-muted-foreground italic py-2">
                      No subtasks yet. Click "Add Item" to create a checklist.
                    </p>
                  )}
                  
                  {checklist.map((item) => (
                    <div key={item.id} className="flex items-start gap-2 group p-2 rounded hover:bg-muted/50 transition-colors">
                      <input
                        type="checkbox"
                        checked={item.checked}
                        onChange={() => toggleChecklistItem(item.id)}
                        className="mt-1 w-4 h-4 cursor-pointer flex-shrink-0"
                      />
                      <input
                        type="text"
                        value={item.text}
                        onChange={(e) => updateChecklistItemText(item.id, e.target.value)}
                        className={`flex-1 bg-transparent border-none outline-none text-sm ${
                          item.checked ? 'line-through text-muted-foreground' : ''
                        }`}
                        placeholder="Subtask description"
                      />
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          value={item.hours}
                          onChange={(e) => updateChecklistItemHours(item.id, parseFloat(e.target.value) || 0)}
                          className="w-16 px-2 py-1 text-xs border border-border rounded bg-background text-right"
                          placeholder="0"
                        />
                        <span className="text-xs text-muted-foreground">h</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeChecklistItem(item.id)}
                        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity flex-shrink-0"
                        title="Remove item"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="18" y1="6" x2="6" y2="18"></line>
                          <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                      </button>
                    </div>
                  ))}
                  
                  {showAddItem && (
                    <div className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                      <input
                        type="checkbox"
                        disabled
                        className="w-4 h-4 opacity-50"
                      />
                      <input
                        ref={newItemInputRef}
                        type="text"
                        value={newItemText}
                        onChange={(e) => setNewItemText(e.target.value)}
                        onKeyDown={handleAddItemKeyPress}
                        placeholder="Enter subtask description..."
                        className="flex-1 bg-transparent border-none outline-none text-sm"
                      />
                      <button
                        type="button"
                        onClick={addChecklistItem}
                        className="text-green-600 hover:text-green-700"
                        title="Add"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowAddItem(false);
                          setNewItemText('');
                        }}
                        className="text-muted-foreground hover:text-destructive"
                        title="Cancel"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="18" y1="6" x2="6" y2="18"></line>
                          <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
                
                {!showAddItem && (
                  <button
                    type="button"
                    onClick={() => setShowAddItem(true)}
                    className="w-full text-xs px-3 py-2 bg-primary/10 text-primary hover:bg-primary/20 rounded transition-colors flex items-center justify-center gap-1 mb-4"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="12" y1="5" x2="12" y2="19"></line>
                      <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                    Add Item
                  </button>
                )}
                
                {checklist.length > 0 && (
                  <div className="text-xs text-muted-foreground flex items-center justify-between">
                    <span>
                      {checklist.filter(item => item.checked).length} of {checklist.length} completed
                    </span>
                    <span>
                      Total: {checklist.reduce((sum, item) => sum + item.hours, 0).toFixed(1)}h
                    </span>
                  </div>
                )}
              </div>

              {/* Regular Notes Section */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Additional Notes
                </label>
                <textarea
                  value={regularNotes}
                  onChange={(e) => {
                    const newNotes = e.target.value;
                    setRegularNotes(newNotes);
                    // Debounced auto-save for regular notes
                    debouncedAutoSave(checklist, newNotes);
                  }}
                  className="w-full p-2 border border-border rounded-md bg-background h-24 resize-none"
                  placeholder="Add any additional notes, deliverables, or important information..."
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
                Close
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
                  'Save Budget & Description'
                )}
              </button>
            </div>
            <p className="text-xs text-center text-muted-foreground mt-2">
              Checklist and notes auto-save as you type
            </p>
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
