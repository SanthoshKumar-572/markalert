import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Role } from '../database/types';
import { config } from '../config';
import { prisma } from '../database/prisma';

export interface AuthUserPayload {
  id: string;
  email: string;
  role: Role;
  full_name: string;
  department: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUserPayload;
    }
  }
}

export function generateAccessToken(payload: AuthUserPayload): string {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.accessExpiry as any,
  });
}

export function generateRefreshToken(userId: string): string {
  return jwt.sign({ sub: userId }, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiry as any,
  });
}

export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'Authentication required. Authorization header missing or malformed.' });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, config.jwt.secret) as AuthUserPayload;
    req.user = decoded;
    next();
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      res.status(401).json({ success: false, error: 'Token has expired', code: 'TOKEN_EXPIRED' });
      return;
    }
    res.status(401).json({ success: false, error: 'Invalid authentication token', code: 'TOKEN_INVALID' });
  }
}

export function requireRole(allowedRoles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: `Forbidden: This action requires one of the following roles: ${allowedRoles.join(', ')}`,
      });
      return;
    }

    next();
  };
}

// Ensures a faculty user can ONLY access their own notification batch
export async function requireBatchOwnership(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.user) {
    res.status(401).json({ success: false, error: 'Authentication required' });
    return;
  }

  // Admins have access to view all batches
  if (req.user.role === Role.ADMIN) {
    next();
    return;
  }

  const batchId = req.params.id || req.params.batchId || req.body.batch_id;
  if (!batchId) {
    next();
    return;
  }

  try {
    const batch = await prisma.notificationBatch.findUnique({
      where: { id: batchId },
      select: { created_by: true },
    });

    if (!batch) {
      res.status(404).json({ success: false, error: `Notification batch '${batchId}' not found` });
      return;
    }

    if (batch.created_by !== req.user.id) {
      res.status(403).json({
        success: false,
        error: 'Forbidden: You do not have permission to access another faculty member\'s notification batch.',
      });
      return;
    }

    next();
  } catch (err: any) {
    console.error('[requireBatchOwnership Error]:', err.message);
    res.status(500).json({ success: false, error: 'Failed to verify batch ownership permissions' });
  }
}

export async function logAudit(
  userId: string | undefined,
  action: string,
  entity: string,
  entityId?: string | null,
  details?: any,
  ipAddress?: string
): Promise<void> {
  try {
    const detailsStr = details ? (typeof details === 'string' ? details : JSON.stringify(details)) : null;
    await prisma.auditLog.create({
      data: {
        user_id: userId || null,
        action,
        entity,
        entity_id: entityId || null,
        details: detailsStr,
        ip_address: ipAddress || null,
      },
    });
  } catch (err: any) {
    console.warn('[Audit Log Warning]:', err.message);
  }
}
