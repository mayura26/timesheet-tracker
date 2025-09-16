import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { Project } from '@/lib/schema';

// GET /api/projects - Get all projects
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('activeOnly') === 'true';

    let sql = 'SELECT * FROM projects';
    const args: any[] = [];

    if (activeOnly) {
      sql += ' WHERE is_active = ?';
      args.push(1);
    }

    sql += ' ORDER BY name ASC';

    const result = await db.execute({ sql, args });

    const projects: Project[] = result.rows.map(row => ({
      id: row.id as string,
      name: row.name as string,
      description: row.description as string,
      is_active: Boolean(row.is_active),
      color: row.color as string,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string
    }));

    return NextResponse.json(projects);
  } catch (error) {
    console.error('Error fetching projects:', error);
    return NextResponse.json(
      { error: 'Failed to fetch projects' },
      { status: 500 }
    );
  }
}

// POST /api/projects - Create a new project
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, color } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'name is required' },
        { status: 400 }
      );
    }

    const id = Date.now().toString();
    
    await db.execute({
      sql: `
        INSERT INTO projects (id, name, description, color, is_active)
        VALUES (?, ?, ?, ?, ?)
      `,
      args: [id, name, description || '', color || '#3b82f6', 1]
    });

    const newProject: Project = {
      id,
      name,
      description: description || '',
      is_active: true,
      color: color || '#3b82f6',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    return NextResponse.json(newProject, { status: 201 });
  } catch (error) {
    console.error('Error creating project:', error);
    return NextResponse.json(
      { error: 'Failed to create project' },
      { status: 500 }
    );
  }
}
