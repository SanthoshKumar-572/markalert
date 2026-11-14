import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../database/db';
import { generateToken, logAudit, AuthUser } from '../middleware/auth';

export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ success: false, error: 'Email and password are required' });
      return;
    }

    const user = await db.queryOne<any>('SELECT * FROM users WHERE email = ?', [email.trim().toLowerCase()]);
    if (!user) {
      res.status(401).json({ success: false, error: 'Invalid email or password' });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      res.status(401).json({ success: false, error: 'Invalid email or password' });
      return;
    }

    const tokenUser: AuthUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role === 'ADMIN' ? 'ADMIN' : 'FACULTY',
      department_id: user.department_id
    };

    const token = generateToken(tokenUser);

    await logAudit(user.id, 'LOGIN', 'users', user.id, { email: user.email, role: user.role });

    res.json({
      success: true,
      token,
      user: tokenUser
    });
  } catch (err: any) {
    console.error('[Login Error]:', err);
    res.status(500).json({ success: false, error: 'Internal server error during login' });
  }
}

export async function register(req: Request, res: Response): Promise<void> {
  try {
    const { name, email, password, department_id } = req.body;
    if (!name || !email || !password) {
      res.status(400).json({ success: false, error: 'Full name, staff email, and password are required' });
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    const existing = await db.queryOne<any>('SELECT id FROM users WHERE email = ?', [cleanEmail]);
    if (existing) {
      res.status(400).json({ success: false, error: 'A user with this staff email is already registered' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userId = `user-faculty-${Date.now()}`;
    const deptId = department_id || 'dept-it';

    await db.execute(
      `INSERT INTO users (id, name, email, password_hash, role, department_id, is_active)
       VALUES (?, ?, ?, ?, 'FACULTY', ?, 1)`,
      [userId, name.trim(), cleanEmail, passwordHash, deptId]
    );

    // Automatically assign to default IT class (class-it-c)
    try {
      await db.execute(
        `INSERT INTO faculty_class_assignments (id, faculty_id, class_id, academic_year, assigned_by)
         VALUES (?, ?, 'class-it-c', '2026-27', 'SYSTEM')`,
        [`fca-${userId}-it-c`, userId]
      );
    } catch {
      // Ignore if assignment table schema differs
    }

    const tokenUser: AuthUser = {
      id: userId,
      name: name.trim(),
      email: cleanEmail,
      role: 'FACULTY',
      department_id: deptId
    };

    const token = generateToken(tokenUser);
    await logAudit(userId, 'REGISTER', 'users', userId, { email: cleanEmail, role: 'FACULTY' });

    res.json({
      success: true,
      message: 'Faculty account registered successfully!',
      token,
      user: tokenUser
    });
  } catch (err: any) {
    console.error('[Register Error]:', err);
    res.status(500).json({ success: false, error: err.message || 'Registration failed' });
  }
}

export async function getMe(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ success: false, error: 'Not authenticated' });
    return;
  }
  res.json({ success: true, user: req.user });
}
