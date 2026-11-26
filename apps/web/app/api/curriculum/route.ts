import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const grade = searchParams.get('grade');
    const subject = searchParams.get('subject');

    if (!grade || !subject) {
      return NextResponse.json(
        { error: 'Missing required query parameters: grade and subject' },
        { status: 400 }
      );
    }

    // Normalize grade: accept '12' or 'grade12'
    const normalizedGrade = grade.toLowerCase().replace(/^grade/, '');
    const fileName = `${subject.toLowerCase()}.json`;
    const filePath = path.join(
      process.cwd(),
      'school',
      'curriculum',
      `grade${normalizedGrade}`,
      fileName
    );

    // Check if file exists
    try {
      await fs.access(filePath);
    } catch {
      return NextResponse.json(
        { error: `Curriculum not found for grade="${grade}" subject="${subject}"` },
        { status: 404 }
      );
    }

    const raw = await fs.readFile(filePath, 'utf8');
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      // If not JSON, treat as plain text/markdown
      data = raw;
    }

    const stats = await fs.stat(filePath);

    return NextResponse.json({
      grade,
      subject,
      lastModified: stats.mtime.toISOString(),
      data,
    });
  } catch (error) {
    console.error('Curriculum API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
