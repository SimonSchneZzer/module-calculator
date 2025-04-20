import { NextResponse } from 'next/server';
import path from 'path';
import { promises as fs } from 'fs';

export async function GET() {
  const filePath = path.join(process.cwd(), 'public', 'data', 'modules.json');
  const fileContents = await fs.readFile(filePath, 'utf-8');
  const data = JSON.parse(fileContents);

  return NextResponse.json(data);
}