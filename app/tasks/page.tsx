'use client';

import { useState, useEffect, useCallback } from 'react';
import { Task, Project } from '@/lib/schema';
import TaskDetailsDialog from '@/components/TaskDetailsDialog';

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<{ id: string; project: string; description: string } | null>(null);

  // Filter states
  const [filterBudgetLeft, setFilterBudgetLeft] = useState(false);
  const [filterClosedStatus, setFilterClosedStatus] = useState<'all' | 'open' | 'closed'>('all');
  const [filterProject, setFilterProject] = useState<string>('');
  const [searchDescription, setSearchDescription] = useState('');
  const [filterHasBudget, setFilterHasBudget] = useState(false);
  const [filterNoBudget, setFilterNoBudget] = useState(false);

  const loadTasks = useCallback(async () => {
    try {
      const response = await fetch('/api/tasks');
      if (response.ok) {
        const data = await response.json();
        setTasks(data);
      } else {
        console.error('Error fetching tasks:', response.statusText);
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadProjects = useCallback(async () => {
    try {
      const response = await fetch('/api/projects?activeOnly=true');
      if (response.ok) {
        const data = await response.json();
        setProjects(data);
      }
    } catch (error) {
      console.error('Error loading projects:', error);
    }
  }, []);

  useEffect(() => {
    loadProjects();
    loadTasks();
  }, [loadProjects, loadTasks]);

  const getProjectColor = (projectName: string) => {
    const project = projects.find(p => p.name === projectName);
    return project?.color || '#3b82f6';
  };

  // Apply filters
  const filteredTasks = tasks.filter(task => {
    // Budget left filter
    if (filterBudgetLeft && (task.hours_remaining ?? 0) <= 0) {
      return false;
    }

    // Closed status filter
    if (filterClosedStatus === 'open' && task.is_closed) {
      return false;
    }
    if (filterClosedStatus === 'closed' && !task.is_closed) {
      return false;
    }

    // Project filter
    if (filterProject && task.project_name !== filterProject) {
      return false;
    }

    // Search by description
    if (searchDescription && !task.description.toLowerCase().includes(searchDescription.toLowerCase())) {
      return false;
    }

    // Budget status filters
    if (filterHasBudget && task.budgeted_hours <= 0) {
      return false;
    }
    if (filterNoBudget && task.budgeted_hours > 0) {
      return false;
    }

    return true;
  });

  // Sort tasks: by project name, then by description
  const sortedTasks = [...filteredTasks].sort((a, b) => {
    const projectCompare = a.project_name.localeCompare(b.project_name);
    if (projectCompare !== 0) {
      return projectCompare;
    }
    return a.description.localeCompare(b.description);
  });

  const handleTaskClick = (task: Task) => {
    setSelectedTask({
      id: task.id,
      project: task.project_name,
      description: task.description
    });
  };

  const handleTaskDialogClose = () => {
    setSelectedTask(null);
    loadTasks(); // Refresh tasks after update
  };

  const clearFilters = () => {
    setFilterBudgetLeft(false);
    setFilterClosedStatus('all');
    setFilterProject('');
    setSearchDescription('');
    setFilterHasBudget(false);
    setFilterNoBudget(false);
  };

  const hasActiveFilters = filterBudgetLeft || filterClosedStatus !== 'all' || filterProject || searchDescription || filterHasBudget || filterNoBudget;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="container mx-auto px-2 sm:px-4 py-4 sm:py-8">
        <div className="mb-4 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Tasks</h1>
          <p className="text-muted-foreground mt-1 sm:mt-2 text-sm sm:text-base">View and manage all tasks</p>
        </div>

        {/* Filters Section */}
        <div className="bg-card rounded-lg border border-border p-4 sm:p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">Filters</h2>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Clear all
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Budget Left Filter */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="filter-budget-left"
                checked={filterBudgetLeft}
                onChange={(e) => setFilterBudgetLeft(e.target.checked)}
                className="w-4 h-4 cursor-pointer"
              />
              <label htmlFor="filter-budget-left" className="text-sm text-foreground cursor-pointer">
                Has budget left
              </label>
            </div>

            {/* Closed Status Filter */}
            <div className="flex items-center gap-2">
              <label htmlFor="filter-closed-status" className="text-sm text-foreground">
                Status:
              </label>
              <select
                id="filter-closed-status"
                value={filterClosedStatus}
                onChange={(e) => setFilterClosedStatus(e.target.value as 'all' | 'open' | 'closed')}
                className="flex-1 px-2 py-1 text-sm bg-background border border-border rounded focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="all">All</option>
                <option value="open">Open</option>
                <option value="closed">Closed</option>
              </select>
            </div>

            {/* Project Filter */}
            <div className="flex items-center gap-2">
              <label htmlFor="filter-project" className="text-sm text-foreground">
                Project:
              </label>
              <select
                id="filter-project"
                value={filterProject}
                onChange={(e) => setFilterProject(e.target.value)}
                className="flex-1 px-2 py-1 text-sm bg-background border border-border rounded focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">All Projects</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.name}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Search by Description */}
            <div className="flex items-center gap-2">
              <label htmlFor="search-description" className="text-sm text-foreground">
                Search:
              </label>
              <input
                type="text"
                id="search-description"
                value={searchDescription}
                onChange={(e) => setSearchDescription(e.target.value)}
                placeholder="Description..."
                className="flex-1 px-2 py-1 text-sm bg-background border border-border rounded focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* Budget Status Filters */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="filter-has-budget"
                checked={filterHasBudget}
                onChange={(e) => setFilterHasBudget(e.target.checked)}
                className="w-4 h-4 cursor-pointer"
              />
              <label htmlFor="filter-has-budget" className="text-sm text-foreground cursor-pointer">
                Has budget
              </label>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="filter-no-budget"
                checked={filterNoBudget}
                onChange={(e) => setFilterNoBudget(e.target.checked)}
                className="w-4 h-4 cursor-pointer"
              />
              <label htmlFor="filter-no-budget" className="text-sm text-foreground cursor-pointer">
                No budget
              </label>
            </div>
          </div>
        </div>

        {/* Tasks Table/Card */}
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">
              Loading tasks...
            </div>
          ) : sortedTasks.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              {tasks.length === 0 ? 'No tasks found' : 'No tasks match the current filters'}
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted/50 border-b border-border">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Project</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Description</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-foreground">Budgeted</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-foreground">Billed</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-foreground">Remaining</th>
                      <th className="px-4 py-3 text-center text-sm font-semibold text-foreground">Status</th>
                      <th className="px-4 py-3 text-center text-sm font-semibold text-foreground">Progress</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedTasks.map((task) => (
                      <tr
                        key={task.id}
                        onClick={() => handleTaskClick(task)}
                        className="border-b border-border hover:bg-muted/50 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: getProjectColor(task.project_name) }}
                            ></div>
                            <span className="text-sm text-foreground">{task.project_name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-foreground">{task.description}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-sm text-foreground">{task.budgeted_hours.toFixed(1)}h</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-sm text-foreground">{task.hours_billed?.toFixed(1) || '0.0'}h</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span
                            className={`text-sm font-medium ${
                              (task.hours_remaining ?? 0) > 0
                                ? 'text-green-600 dark:text-green-400'
                                : (task.hours_remaining ?? 0) < 0
                                ? 'text-red-600 dark:text-red-400'
                                : 'text-foreground'
                            }`}
                          >
                            {(task.hours_remaining ?? 0).toFixed(1)}h
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {task.is_closed ? (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                              Closed
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                              Open
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {task.completion_percentage !== undefined ? (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                              {task.completion_percentage.toFixed(0)}%
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden divide-y divide-border">
                {sortedTasks.map((task) => (
                  <div
                    key={task.id}
                    onClick={() => handleTaskClick(task)}
                    className="p-4 hover:bg-muted/50 cursor-pointer transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2 flex-1">
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: getProjectColor(task.project_name) }}
                        ></div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm text-foreground truncate">
                            {task.project_name}
                          </div>
                          <div className="text-sm text-muted-foreground truncate">
                            {task.description}
                          </div>
                        </div>
                      </div>
                      <div className="flex-shrink-0 ml-2">
                        {task.is_closed ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                            Closed
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                            Open
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-sm mt-3">
                      <div>
                        <div className="text-xs text-muted-foreground">Budgeted</div>
                        <div className="font-medium text-foreground">{task.budgeted_hours.toFixed(1)}h</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Billed</div>
                        <div className="font-medium text-foreground">{task.hours_billed?.toFixed(1) || '0.0'}h</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Remaining</div>
                        <div
                          className={`font-medium ${
                            (task.hours_remaining ?? 0) > 0
                              ? 'text-green-600 dark:text-green-400'
                              : (task.hours_remaining ?? 0) < 0
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-foreground'
                          }`}
                        >
                          {(task.hours_remaining ?? 0).toFixed(1)}h
                        </div>
                      </div>
                    </div>
                    {task.completion_percentage !== undefined && (
                      <div className="mt-2">
                        <div className="text-xs text-muted-foreground mb-1">Progress</div>
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                          {task.completion_percentage.toFixed(0)}%
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

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
      </main>
    </div>
  );
}

