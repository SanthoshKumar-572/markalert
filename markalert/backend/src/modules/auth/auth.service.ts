import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { prisma } from '../../database/prisma';
import { config } from '../../config';
import { generateAccessToken, generateRefreshToken, logAudit } from '../../middleware/auth';
import { Role } from '../../database/types';

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export class AuthService {
  public async login(email: string, passwordPlain: string, ipAddress?: string) {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      select: {
        id: true,
        email: true,
        password_hash: true,
        is_active: true,
        role: true,
        full_name: true,
        department: true,
        designation: true,
        mobile_number: true,
        employee_id: true,
      },
    });

    if (!user) {
      throw new Error('Invalid email or password');
    }

    if (!user.is_active) {
      throw new Error('Account has been deactivated. Please contact the administrator.');
    }

    const isValid = await bcrypt.compare(passwordPlain, user.password_hash);
    if (!isValid) {
      throw new Error('Invalid email or password');
    }

    const authPayload = {
      id: user.id,
      email: user.email,
      role: user.role as Role,
      full_name: user.full_name,
      department: user.department,
    };

    const accessToken = generateAccessToken(authPayload);
    const rawRefreshToken = generateRefreshToken(user.id);
    const tokenHash = hashToken(rawRefreshToken);

    // Save refresh token record (7 days expiry)
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const saveTokenPromise = prisma.refreshToken.create({
      data: {
        user_id: user.id,
        token_hash: tokenHash,
        expires_at: expiresAt,
      },
    });

    // Fire audit log asynchronously in background (saves ~250ms round-trip)
    void logAudit(user.id, 'LOGIN', 'users', user.id, { email: user.email }, ipAddress);

    await saveTokenPromise;

    return {
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        employee_id: user.employee_id,
        role: user.role,
        department: user.department,
        designation: user.designation,
        mobile_number: user.mobile_number,
      },
      accessToken,
      refreshToken: rawRefreshToken,
    };
  }

  public async refresh(rawRefreshToken: string) {
    let decoded: any;
    try {
      decoded = jwt.verify(rawRefreshToken, config.jwt.refreshSecret);
    } catch {
      throw new Error('Invalid or expired refresh token');
    }

    const userId = decoded.sub;
    const tokenHash = hashToken(rawRefreshToken);

    const storedToken = await prisma.refreshToken.findFirst({
      where: {
        token_hash: tokenHash,
        user_id: userId,
        revoked: false,
        expires_at: { gt: new Date() },
      },
      include: { user: true },
    });

    if (!storedToken || !storedToken.user || !storedToken.user.is_active) {
      throw new Error('Refresh token is invalid or revoked');
    }

    // Revoke old refresh token (Token Rotation for maximum security)
    await prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revoked: true },
    });

    const user = storedToken.user;
    const authPayload = {
      id: user.id,
      email: user.email,
      role: user.role as Role,
      full_name: user.full_name,
      department: user.department,
    };

    const newAccessToken = generateAccessToken(authPayload);
    const newRefreshToken = generateRefreshToken(user.id);
    const newTokenHash = hashToken(newRefreshToken);

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await prisma.refreshToken.create({
      data: {
        user_id: user.id,
        token_hash: newTokenHash,
        expires_at: expiresAt,
      },
    });

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  public async logout(rawRefreshToken?: string, userId?: string) {
    if (rawRefreshToken) {
      const tokenHash = hashToken(rawRefreshToken);
      await prisma.refreshToken.updateMany({
        where: { token_hash: tokenHash },
        data: { revoked: true },
      });
    }

    if (userId) {
      await logAudit(userId, 'LOGOUT', 'users', userId, null);
    }

    return { message: 'Logged out successfully' };
  }

  public async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        full_name: true,
        employee_id: true,
        role: true,
        department: true,
        designation: true,
        mobile_number: true,
        is_active: true,
        created_at: true,
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    return user;
  }
}

export const authService = new AuthService();
