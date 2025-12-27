import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

// GET /api/holidays - Get holidays for a date range
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
        SELECT date FROM holidays 
        WHERE date >= ? AND date <= ? 
        ORDER BY date ASC
      `,
      args: [startDate, endDate]
    });

    const holidays = result.rows.map(row => row.date as string);

    return NextResponse.json(holidays);
  } catch (error) {
    console.error('Error fetching holidays:', error);
    return NextResponse.json(
      { error: 'Failed to fetch holidays' },
      { status: 500 }
    );
  }
}

// POST /api/holidays - Add a holiday
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { date } = body;

    if (!date) {
      return NextResponse.json(
        { error: 'date is required' },
        { status: 400 }
      );
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return NextResponse.json(
        { error: 'date must be in YYYY-MM-DD format' },
        { status: 400 }
      );
    }

    await db.execute({
      sql: `
        INSERT INTO holidays (date, created_at)
        VALUES (?, CURRENT_TIMESTAMP)
        ON CONFLICT(date) DO NOTHING
      `,
      args: [date]
    });

    return NextResponse.json({ date }, { status: 201 });
  } catch (error) {
    console.error('Error creating holiday:', error);
    return NextResponse.json(
      { error: 'Failed to create holiday' },
      { status: 500 }
    );
  }
}

// DELETE /api/holidays - Remove a holiday
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');

    if (!date) {
      return NextResponse.json(
        { error: 'date is required' },
        { status: 400 }
      );
    }

    const result = await db.execute({
      sql: 'DELETE FROM holidays WHERE date = ?',
      args: [date]
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting holiday:', error);
    return NextResponse.json(
      { error: 'Failed to delete holiday' },
      { status: 500 }
    );
  }
}

