import { Request, Response } from 'express';
import { authService } from './auth.service';

export class AuthController {
  public async login(req: Request, res: Response): Promise<void> {
    try {
      const { email, password } = req.body;
      const ip = req.ip || req.socket.remoteAddress;
      const result = await authService.login(email, password, ip);
      res.json({ success: true, data: result });
    } catch (err: any) {
      res.status(401).json({ success: false, error: err.message || 'Login failed' });
    }
  }

  public async refresh(req: Request, res: Response): Promise<void> {
    try {
      const { refreshToken } = req.body;
      const result = await authService.refresh(refreshToken);
      res.json({ success: true, data: result });
    } catch (err: any) {
      res.status(401).json({ success: false, error: err.message || 'Refresh failed' });
    }
  }

  public async logout(req: Request, res: Response): Promise<void> {
    try {
      const { refreshToken } = req.body;
      const userId = req.user?.id;
      const result = await authService.logout(refreshToken, userId);
      res.json({ success: true, data: result });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Logout failed' });
    }
  }

  public async getMe(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const profile = await authService.getProfile(userId);
      res.json({ success: true, data: profile });
    } catch (err: any) {
      res.status(404).json({ success: false, error: err.message || 'Profile not found' });
    }
  }
}

export const authController = new AuthController();
