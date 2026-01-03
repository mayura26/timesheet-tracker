import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

// POST /api/tasks/[id]/sync - Sync a task to Plan My Day
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check environment variables
    const apiKey = process.env.PMY_API_KEY;
    const baseUrl = process.env.PMY_BASE_URL;

    if (!apiKey || !baseUrl) {
      return NextResponse.json(
        { error: 'Plan My Day API configuration is missing. Please set PMY_API_KEY and PMY_BASE_URL environment variables.' },
        { status: 500 }
      );
    }

    // Fetch the task from database
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
    const taskDescription = row.description as string;
    const budgetedHours = row.budgeted_hours as number;

    // Format task data for Plan My Day API
    const taskData = {
      title: taskDescription,
      task_type: 'task',
      group: 'Work',
      duration: Math.round(budgetedHours * 60) // Convert hours to minutes
    };

    // Make POST request to Plan My Day API
    const response = await fetch(`${baseUrl}/api/tasks/import`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(taskData),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      return NextResponse.json(
        { error: errorData.error || `Failed to sync task: ${response.statusText}` },
        { status: response.status }
      );
    }

    const resultData = await response.json();
    
    return NextResponse.json({
      success: true,
      data: resultData
    });
  } catch (error) {
    console.error('Error syncing task:', error);
    
    // Handle network errors
    if (error instanceof Error && error.message.includes('fetch')) {
      return NextResponse.json(
        { error: 'Failed to connect to Plan My Day API. Please check your network connection and PMY_BASE_URL.' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to sync task' },
      { status: 500 }
    );
  }
}
