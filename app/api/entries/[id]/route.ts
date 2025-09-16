import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { TimeEntry } from '@/lib/schema';

// PUT /api/entries/[id] - Update a time entry
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { project, description, hours } = body;

    if (!project || !description || hours === undefined) {
      return NextResponse.json(
        { error: 'project, description, and hours are required' },
        { status: 400 }
      );
    }

    await db.execute({
      sql: `
        UPDATE timesheet_entries 
        SET project = ?, description = ?, hours = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      args: [project, description, hours, id]
    });

    // Fetch the updated entry
    const result = await db.execute({
      sql: 'SELECT * FROM timesheet_entries WHERE id = ?',
      args: [id]
    });

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Entry not found' },
        { status: 404 }
      );
    }

    const row = result.rows[0];
    const updatedEntry: TimeEntry = {
      id: row.id as string,
      date: row.date as string,
      project: row.project as string,
      description: row.description as string,
      hours: row.hours as number,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string
    };

    return NextResponse.json(updatedEntry);
  } catch (error) {
    console.error('Error updating entry:', error);
    return NextResponse.json(
      { error: 'Failed to update entry' },
      { status: 500 }
    );
  }
}

// DELETE /api/entries/[id] - Delete a time entry
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const result = await db.execute({
      sql: 'DELETE FROM timesheet_entries WHERE id = ?',
      args: [id]
    });

    if (result.rowsAffected === 0) {
      return NextResponse.json(
        { error: 'Entry not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting entry:', error);
    return NextResponse.json(
      { error: 'Failed to delete entry' },
      { status: 500 }
    );
  }
}
