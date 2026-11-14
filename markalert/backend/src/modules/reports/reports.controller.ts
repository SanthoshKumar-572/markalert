import { Request, Response } from 'express';
import { reportsService } from './reports.service';

export class ReportsController {
  public async getOverview(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const role = req.user!.role;
      const overview = await reportsService.getOverview(userId, role);
      res.json({ success: true, data: overview });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Failed to retrieve overview metrics' });
    }
  }

  public async getSettings(_req: Request, res: Response): Promise<void> {
    try {
      const settings = await reportsService.getSystemSettings();
      res.json({ success: true, data: settings });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Failed to retrieve settings' });
    }
  }

  public async updateSettings(req: Request, res: Response): Promise<void> {
    try {
      const result = await reportsService.updateSystemSettings(req.body.settings || {});
      res.json({ success: true, data: result });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message || 'Failed to update settings' });
    }
  }
}

export const reportsController = new ReportsController();
