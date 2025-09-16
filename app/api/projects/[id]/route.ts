import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { Project } from '@/lib/schema';

// PUT /api/projects/[id] - Update a project
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, description, color, is_active } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'name is required' },
        { status: 400 }
      );
    }

    await db.execute({
      sql: `
        UPDATE projects 
        SET name = ?, description = ?, color = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      args: [name, description || '', color || '#3b82f6', is_active ? 1 : 0, id]
    });

    // Fetch the updated project
    const result = await db.execute({
      sql: 'SELECT * FROM projects WHERE id = ?',
      args: [id]
    });

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    const row = result.rows[0];
    const updatedProject: Project = {
      id: row.id as string,
      name: row.name as string,
      description: row.description as string,
      is_active: Boolean(row.is_active),
      color: row.color as string,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string
    };

    return NextResponse.json(updatedProject);
  } catch (error) {
    console.error('Error updating project:', error);
    return NextResponse.json(
      { error: 'Failed to update project' },
      { status: 500 }
    );
  }
}

// DELETE /api/projects/[id] - Delete a project
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Check if project is used in any time entries
    const usageCheck = await db.execute({
      sql: 'SELECT COUNT(*) as count FROM timesheet_entries WHERE project = (SELECT name FROM projects WHERE id = ?)',
      args: [id]
    });

    const usageCount = usageCheck.rows[0].count as number;
    if (usageCount > 0) {
      return NextResponse.json(
        { error: 'Cannot delete project that has time entries. Deactivate it instead.' },
        { status: 400 }
      );
    }

    const result = await db.execute({
      sql: 'DELETE FROM projects WHERE id = ?',
      args: [id]
    });

    if (result.rowsAffected === 0) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting project:', error);
    return NextResponse.json(
      { error: 'Failed to delete project' },
      { status: 500 }
    );
  }
}
