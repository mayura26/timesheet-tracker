import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { Task } from '@/lib/schema';

// Helper function to calculate completion percentage from notes
function calculateCompletionPercentage(notes: string): number | undefined {
  if (!notes) return undefined;
  
  const lines = notes.split('\n');
  let totalHours = 0;
  let completedHours = 0;
  
  lines.forEach((line) => {
    const uncheckedMatch = line.match(/^- \[ \] (.+?)(?:\s*\(([0-9.]+)h\))?$/);
    const checkedMatch = line.match(/^- \[x\] (.+?)(?:\s*\(([0-9.]+)h\))?$/i);
    
    if (uncheckedMatch) {
      const hours = uncheckedMatch[2] ? parseFloat(uncheckedMatch[2]) : 0;
      totalHours += hours;
    } else if (checkedMatch) {
      const hours = checkedMatch[2] ? parseFloat(checkedMatch[2]) : 0;
      totalHours += hours;
      completedHours += hours;
    }
  });
  
  if (totalHours === 0) return undefined;
  return (completedHours / totalHours) * 100;
}

// GET /api/tasks/[id] - Get a specific task with billed hours
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const result = await db.execute({
      sql: 'SELECT * FROM tasks WHERE id = ?',
      args: [id]
    });

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    const row = result.rows[0];

    // Calculate billed hours
    const billedResult = await db.execute({
      sql: 'SELECT COALESCE(SUM(hours), 0) as total FROM timesheet_entries WHERE project = ? AND description = ?',
      args: [row.project_name as string, row.description as string]
    });

    const hoursBilled = billedResult.rows[0].total as number;
    const budgetedHours = row.budgeted_hours as number;
    const notes = row.notes as string || '';
    const completionPercentage = calculateCompletionPercentage(notes);

    const task: Task = {
      id: row.id as string,
      project_name: row.project_name as string,
      description: row.description as string,
      budgeted_hours: budgetedHours,
      notes: notes,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
      hours_billed: hoursBilled,
      hours_remaining: budgetedHours - hoursBilled,
      completion_percentage: completionPercentage
    };

    return NextResponse.json(task);
  } catch (error) {
    console.error('Error fetching task:', error);
    return NextResponse.json(
      { error: 'Failed to fetch task' },
      { status: 500 }
    );
  }
}

// PUT /api/tasks/[id] - Update a task
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { description, budgeted_hours, notes, update_description } = body;

    // Get the current task
    const currentTaskResult = await db.execute({
      sql: 'SELECT * FROM tasks WHERE id = ?',
      args: [id]
    });

    if (currentTaskResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    const currentTask = currentTaskResult.rows[0];
    const oldDescription = currentTask.description as string;
    const projectName = currentTask.project_name as string;

    // If description is being updated
    if (update_description && description && description.trim() !== oldDescription) {
      const newDescription = description.trim();
      const newId = `${projectName}|${newDescription}`;

      // Check if a task with the new description already exists
      const existingResult = await db.execute({
        sql: 'SELECT * FROM tasks WHERE id = ? AND id != ?',
        args: [newId, id]
      });

      if (existingResult.rows.length > 0) {
        return NextResponse.json(
          { error: 'A task with this description already exists for this project' },
          { status: 400 }
        );
      }

      // Update all timesheet entries with the new description
      await db.execute({
        sql: `
          UPDATE timesheet_entries 
          SET description = ?, updated_at = CURRENT_TIMESTAMP
          WHERE project = ? AND description = ?
        `,
        args: [newDescription, projectName, oldDescription]
      });

      // Delete the old task record
      await db.execute({
        sql: 'DELETE FROM tasks WHERE id = ?',
        args: [id]
      });

      // Create new task record with updated ID
      await db.execute({
        sql: `
          INSERT INTO tasks (id, project_name, description, budgeted_hours, notes, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `,
        args: [
          newId,
          projectName,
          newDescription,
          budgeted_hours ?? (currentTask.budgeted_hours as number),
          notes ?? (currentTask.notes as string) ?? '',
          currentTask.created_at as string
        ]
      });

      // Fetch the new task
      const result = await db.execute({
        sql: 'SELECT * FROM tasks WHERE id = ?',
        args: [newId]
      });

      const row = result.rows[0];

      // Calculate billed hours
      const billedResult = await db.execute({
        sql: 'SELECT COALESCE(SUM(hours), 0) as total FROM timesheet_entries WHERE project = ? AND description = ?',
        args: [projectName, newDescription]
      });

      const hoursBilled = billedResult.rows[0].total as number;
      const budgetedHoursValue = row.budgeted_hours as number;
      const notesValue = row.notes as string || '';
      const completionPercentage = calculateCompletionPercentage(notesValue);

      const updatedTask: Task = {
        id: row.id as string,
        project_name: row.project_name as string,
        description: row.description as string,
        budgeted_hours: budgetedHoursValue,
        notes: notesValue,
        created_at: row.created_at as string,
        updated_at: row.updated_at as string,
        hours_billed: hoursBilled,
        hours_remaining: budgetedHoursValue - hoursBilled,
        completion_percentage: completionPercentage
      };

      return NextResponse.json(updatedTask);
    } else {
      // Just update budget and notes without changing description
      await db.execute({
        sql: `
          UPDATE tasks 
          SET budgeted_hours = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `,
        args: [budgeted_hours ?? 0, notes ?? '', id]
      });

      // Fetch the updated task with billed hours
      const result = await db.execute({
        sql: 'SELECT * FROM tasks WHERE id = ?',
        args: [id]
      });

      if (result.rows.length === 0) {
        return NextResponse.json(
          { error: 'Task not found' },
          { status: 404 }
        );
      }

      const row = result.rows[0];

      // Calculate billed hours
      const billedResult = await db.execute({
        sql: 'SELECT COALESCE(SUM(hours), 0) as total FROM timesheet_entries WHERE project = ? AND description = ?',
        args: [row.project_name as string, row.description as string]
      });

      const hoursBilled = billedResult.rows[0].total as number;
      const budgetedHoursValue = row.budgeted_hours as number;
      const notesValue = row.notes as string || '';
      const completionPercentage = calculateCompletionPercentage(notesValue);

      const updatedTask: Task = {
        id: row.id as string,
        project_name: row.project_name as string,
        description: row.description as string,
        budgeted_hours: budgetedHoursValue,
        notes: notesValue,
        created_at: row.created_at as string,
        updated_at: row.updated_at as string,
        hours_billed: hoursBilled,
        hours_remaining: budgetedHoursValue - hoursBilled,
        completion_percentage: completionPercentage
      };

      return NextResponse.json(updatedTask);
    }
  } catch (error) {
    console.error('Error updating task:', error);
    return NextResponse.json(
      { error: 'Failed to update task' },
      { status: 500 }
    );
  }
}

// DELETE /api/tasks/[id] - Delete a task
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const result = await db.execute({
      sql: 'DELETE FROM tasks WHERE id = ?',
      args: [id]
    });

    if (result.rowsAffected === 0) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting task:', error);
    return NextResponse.json(
      { error: 'Failed to delete task' },
      { status: 500 }
    );
  }
}
