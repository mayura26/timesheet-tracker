import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { Task } from '@/lib/schema';

// GET /api/tasks - Get all tasks with billed hours
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const project = searchParams.get('project');
    const description = searchParams.get('description');

    let sql = 'SELECT * FROM tasks';
    const args: any[] = [];
    const conditions: string[] = [];

    if (project) {
      conditions.push('project_name = ?');
      args.push(project);
    }

    if (description) {
      conditions.push('description = ?');
      args.push(description);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY project_name ASC, description ASC';

    const result = await db.execute({ sql, args });

    // Calculate billed hours for each task
    const tasks: Task[] = await Promise.all(
      result.rows.map(async (row) => {
        const billedResult = await db.execute({
          sql: 'SELECT COALESCE(SUM(hours), 0) as total FROM timesheet_entries WHERE project = ? AND description = ?',
          args: [row.project_name as string, row.description as string]
        });

        const hoursBilled = billedResult.rows[0].total as number;
        const budgetedHours = row.budgeted_hours as number;
        const hoursRemaining = budgetedHours - hoursBilled;

        return {
          id: row.id as string,
          project_name: row.project_name as string,
          description: row.description as string,
          budgeted_hours: budgetedHours,
          notes: row.notes as string || '',
          created_at: row.created_at as string,
          updated_at: row.updated_at as string,
          hours_billed: hoursBilled,
          hours_remaining: hoursRemaining
        };
      })
    );

    return NextResponse.json(tasks);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tasks' },
      { status: 500 }
    );
  }
}

// POST /api/tasks - Create a new task
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { project_name, description, budgeted_hours, notes } = body;

    if (!project_name || !description) {
      return NextResponse.json(
        { error: 'project_name and description are required' },
        { status: 400 }
      );
    }

    const id = `${project_name}|${description}`;
    
    await db.execute({
      sql: `
        INSERT INTO tasks (id, project_name, description, budgeted_hours, notes)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(project_name, description) DO UPDATE SET
          budgeted_hours = excluded.budgeted_hours,
          notes = excluded.notes,
          updated_at = CURRENT_TIMESTAMP
      `,
      args: [id, project_name, description, budgeted_hours || 0, notes || '']
    });

    // Fetch the created/updated task with billed hours
    const billedResult = await db.execute({
      sql: 'SELECT COALESCE(SUM(hours), 0) as total FROM timesheet_entries WHERE project = ? AND description = ?',
      args: [project_name, description]
    });

    const hoursBilled = billedResult.rows[0].total as number;
    const budgetedHoursValue = budgeted_hours || 0;

    const newTask: Task = {
      id,
      project_name,
      description,
      budgeted_hours: budgetedHoursValue,
      notes: notes || '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      hours_billed: hoursBilled,
      hours_remaining: budgetedHoursValue - hoursBilled
    };

    return NextResponse.json(newTask, { status: 201 });
  } catch (error) {
    console.error('Error creating task:', error);
    return NextResponse.json(
      { error: 'Failed to create task' },
      { status: 500 }
    );
  }
}
