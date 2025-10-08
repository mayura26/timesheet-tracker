# Task Budgeting Feature - Implementation Summary

## Overview
This feature adds budgeting capabilities to tasks in the timesheet tracker, allowing users to set budgeted hours for tasks, track hours billed, see remaining hours, and add notes.

## Changes Made

### 1. Database Changes
- **New Migration**: `migrations/003_add_tasks_table.sql`
  - Created new `tasks` table with columns:
    - `id` (TEXT PRIMARY KEY)
    - `project_name` (TEXT)
    - `description` (TEXT)
    - `budgeted_hours` (REAL, default 0)
    - `notes` (TEXT)
    - `created_at`, `updated_at` (DATETIME)
  - Added index on `project_name` for performance
  - Automatically populated with existing task combinations from time entries

### 2. Schema Updates
- **File**: `lib/schema.ts`
- Added new `Task` interface:
  ```typescript
  interface Task {
    id: string;
    project_name: string;
    description: string;
    budgeted_hours: number;
    notes?: string;
    created_at?: string;
    updated_at?: string;
    hours_billed?: number;     // Calculated
    hours_remaining?: number;  // Calculated
  }
  ```

### 3. API Endpoints
- **New Files**:
  - `app/api/tasks/route.ts` - GET (list/filter) and POST (create) tasks
  - `app/api/tasks/[id]/route.ts` - GET (single), PUT (update), DELETE tasks
- All endpoints calculate `hours_billed` and `hours_remaining` dynamically
- Supports filtering by project and description

### 4. UI Components

#### TaskDetailsDialog Component
- **New File**: `components/TaskDetailsDialog.tsx`
- Modal dialog for viewing and editing task details
- Features:
  - Displays project name (read-only)
  - **Editable task description** - updates all related time entries
  - Shows budget statistics: budgeted, billed, remaining hours
  - Visual progress bar with color coding (green/yellow/red)
  - Editable budgeted hours field
  - Editable notes textarea
  - Auto-creates task record if not exists
  - Validates that new descriptions don't conflict with existing tasks

#### TimesheetMatrix Updates
- **File**: `components/TimesheetMatrix.tsx`
- Added task budget integration:
  - Task rows now clickable to open TaskDetailsDialog
  - Displays remaining hours badge with color coding:
    - **Green**: >20% budget remaining
    - **Yellow**: 0-20% budget remaining
    - **Red**: Over budget
  - AddTaskForm updated with:
    - Budgeted hours input (optional)
    - Notes textarea (optional)
  - Auto-loads budget data when displaying tasks
  - Refreshes budget data after dialog updates

#### Reports Page Updates
- **File**: `app/reports/page.tsx`
- Task budget dialog integration:
  - Click info icon on any task in summary view to open TaskDetailsDialog
  - Allows viewing and editing budget for tasks in reports
  - Budget changes reflect across entire system
  - Hover over task row shows info icon

### 5. User Experience

#### Adding a New Task
1. Click "+ Add Task" button
2. Select project from dropdown
3. Enter task description (required)
4. Optionally set budgeted hours
5. Optionally add notes
6. Click "Add Task"

#### Managing Task Budget
1. Click on any task row in the timesheet (or info icon in reports)
2. Dialog opens showing:
   - Current budget statistics
   - Progress bar
   - Hours billed vs budgeted
   - Hours remaining
3. Edit task description (updates all time entries)
4. Edit budgeted hours
5. Edit notes
6. Click "Save Changes"

#### Visual Indicators
- Tasks with budgets show remaining hours badge
- Color coding helps identify budget status at a glance
- Progress bars provide quick visual feedback

## Color Coding System

### Remaining Hours Badge
- **Green** (>20% remaining): `bg-green-100 text-green-800`
- **Yellow** (0-20% remaining): `bg-yellow-100 text-yellow-800`
- **Red** (over budget): `bg-red-100 text-red-800`

### Progress Bar
- **Green**: <80% of budget used
- **Yellow**: 80-100% of budget used
- **Red**: >100% of budget used (over budget)

## Migration
The migration automatically:
1. Creates the tasks table
2. Populates it with unique task combinations from existing time entries
3. Sets default budgeted_hours to 0 for all existing tasks

To run manually:
```bash
node scripts/run-migration.mjs
```

## API Examples

### Get all tasks with budget info
```
GET /api/tasks
```

### Get specific task
```
GET /api/tasks/ProjectA|Task%20Description
```

### Create/Update task budget
```
POST /api/tasks
{
  "project_name": "Client A",
  "description": "Design mockups",
  "budgeted_hours": 20,
  "notes": "Includes revisions"
}
```

### Update task budget/notes
```
PUT /api/tasks/{taskId}
{
  "budgeted_hours": 25,
  "notes": "Updated budget after scope change"
}
```

### Update task description (and all related time entries)
```
PUT /api/tasks/{taskId}
{
  "description": "New task description",
  "budgeted_hours": 25,
  "notes": "Notes",
  "update_description": true
}
```
Note: This updates all timesheet entries for this task to use the new description.

## Backward Compatibility
- All existing tasks automatically get `budgeted_hours = 0`
- Tasks without budgets don't show the remaining hours badge
- System works seamlessly with tasks that don't have budgets set
- No breaking changes to existing functionality

## Recent Updates

### Latest Features (v1.1)
- ✅ **Editable Task Descriptions**: Can now modify task descriptions from the dialog
  - Updates all related time entries automatically
  - Validates against duplicate descriptions
  - Maintains budget and hours data through the change
- ✅ **Reports Integration**: Task budget dialog now accessible from reports page
  - Click info icon in summary view to manage task budgets
  - Changes reflect across entire system

## Future Enhancements
Potential improvements:
- Budget alerts/notifications when approaching limit
- Historical budget vs actual reports
- Project-level budget aggregation
- Budget templates for common tasks
- Export budget reports
- Bulk task description updates
