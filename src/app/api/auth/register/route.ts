import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import pool from '@/lib/db';

export async function POST(request: Request) {
  try {
    const { name, email, password } = await request.json();

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Tum alanlar zorunlu' }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: 'Sifre en az 6 karakter olmali' }, { status: 400 });
    }

    // Email kontrolü
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return NextResponse.json({ error: 'Bu email zaten kayitli' }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email',
      [name, email, passwordHash]
    );

    return NextResponse.json({ user: result.rows[0], message: 'Kayit basarili' });
  } catch (error) {
    console.error('Register error:', error);
    return NextResponse.json({ error: 'Kayit sirasinda hata olustu' }, { status: 500 });
  }
}
