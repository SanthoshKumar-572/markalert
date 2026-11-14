import { Request, Response } from 'express';
import { baileysWhatsAppManager } from '../services/whatsapp/baileysService';
import { db } from '../database/db';
import { logAudit } from '../middleware/auth';

export async function getSessionStatus(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const session = baileysWhatsAppManager.getSession(userId);
    res.json({
      success: true,
      data: {
        status: session.status,
        phoneNumber: session.phoneNumber,
        pushName: session.pushName,
        qrCode: session.qrCodeDataUrl,
        lastConnectedAt: session.lastConnectedAt,
        isSimulated: !!session.isSimulated,
        error: session.lastError
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function connectSession(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const session = await baileysWhatsAppManager.initializeSession(userId);
    res.json({
      success: true,
      message: 'WhatsApp session initialization started. Please scan the QR code.',
      data: {
        status: session.status,
        qrCode: session.qrCodeDataUrl,
        phoneNumber: session.phoneNumber
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function simulateConnect(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const user = await db.queryOne<any>('SELECT name FROM users WHERE id = ?', [userId]);
    const facultyName = user?.name || req.user?.name || 'Faculty Member';
    const facultyPhone = req.body.phoneNumber || '9876543210';

    const session = await baileysWhatsAppManager.simulateConnect(userId, facultyName, facultyPhone);

    await logAudit(userId, 'LINK_WHATSAPP_DEVICE_SIMULATED', 'users', userId, {
      phoneNumber: session.phoneNumber,
      facultyName
    });

    res.json({
      success: true,
      message: `WhatsApp device simulated and linked successfully as ${session.phoneNumber}`,
      data: {
        status: session.status,
        phoneNumber: session.phoneNumber,
        pushName: session.pushName,
        isSimulated: true
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function disconnectSession(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    await baileysWhatsAppManager.disconnectSession(userId);

    await logAudit(userId, 'UNLINK_WHATSAPP_DEVICE', 'users', userId, {});

    res.json({
      success: true,
      message: 'WhatsApp session disconnected and device unlinked successfully.'
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function sendTestMessage(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const { targetPhone, message } = req.body;
    const session = baileysWhatsAppManager.getSession(userId);

    if (session.status !== 'CONNECTED') {
      res.status(400).json({
        success: false,
        error: 'Your WhatsApp device is not connected. Please scan QR or simulate connect first.'
      });
      return;
    }

    const recipient = targetPhone || session.phoneNumber;
    if (!recipient) {
      res.status(400).json({ success: false, error: 'Target phone number is required.' });
      return;
    }

    const bodyText = message || `Hello! This is a test notification from College Internal Marks System via ${session.pushName || 'Faculty'}'s linked WhatsApp number (${session.phoneNumber}).`;

    const sendRes = await baileysWhatsAppManager.sendMessage(userId, recipient, bodyText);

    if (!sendRes.success) {
      res.status(500).json({ success: false, error: sendRes.error });
      return;
    }

    res.json({
      success: true,
      message: `Test message dispatched successfully to ${recipient}!`,
      data: sendRes
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}
