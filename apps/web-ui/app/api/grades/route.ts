import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  // Fetch grades from the SQLite database using Prisma
  const grades = await prisma.grade.findMany({
    include: {
      student: {
        select: { name: true },
      },
    },
  });

  // Transform data to match the previous shape expected by the UI
  const response = grades.map((g) => ({
    id: g.id,
    studentName: g.student?.name ?? 'Unknown',
    subject: g.subject,
    score: g.score,
  }));

  return NextResponse.json(response);
}
