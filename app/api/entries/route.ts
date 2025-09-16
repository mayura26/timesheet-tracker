import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { TimeEntry } from '@/lib/schema';

// GET /api/entries - Get all entries for a specific date range
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'startDate and endDate are required' },
        { status: 400 }
      );
    }

    const result = await db.execute({
      sql: `
        SELECT * FROM timesheet_entries 
        WHERE date >= ? AND date <= ? 
        ORDER BY date ASC, created_at ASC
      `,
      args: [startDate, endDate]
    });

    const entries: TimeEntry[] = result.rows.map(row => ({
      id: row.id as string,
      date: row.date as string,
      project: row.project as string,
      description: row.description as string,
      hours: row.hours as number,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string
    }));

    return NextResponse.json(entries);
  } catch (error) {
    console.error('Error fetching entries:', error);
    return NextResponse.json(
      { error: 'Failed to fetch entries' },
      { status: 500 }
    );
  }
}

// POST /api/entries - Create a new time entry
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { date, project, description, hours } = body;

    if (!date || !project || !description || hours === undefined) {
      return NextResponse.json(
        { error: 'date, project, description, and hours are required' },
        { status: 400 }
      );
    }

    const id = Date.now().toString();
    
    await db.execute({
      sql: `
        INSERT INTO timesheet_entries (id, date, project, description, hours)
        VALUES (?, ?, ?, ?, ?)
      `,
      args: [id, date, project, description, hours]
    });

    const newEntry: TimeEntry = {
      id,
      date,
      project,
      description,
      hours,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    return NextResponse.json(newEntry, { status: 201 });
  } catch (error) {
    console.error('Error creating entry:', error);
    return NextResponse.json(
      { error: 'Failed to create entry' },
      { status: 500 }
    );
  }
}
