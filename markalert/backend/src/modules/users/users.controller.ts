import { Request, Response } from 'express';
import { usersService } from './users.service';

export class UsersController {
  public async list(req: Request, res: Response): Promise<void> {
    try {
      const { search, department, is_active, page, limit } = req.query;
      const result = await usersService.listFaculty({
        search: search ? String(search) : undefined,
        department: department ? String(department) : undefined,
        isActive: is_active !== undefined ? String(is_active) === 'true' : undefined,
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
      });
      res.json({ success: true, data: result.faculty, pagination: result.pagination });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Failed to list faculty' });
    }
  }

  public async create(req: Request, res: Response): Promise<void> {
    try {
      const adminId = req.user!.id;
      const result = await usersService.createFaculty(req.body, adminId);
      res.status(201).json({ success: true, data: result });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message || 'Failed to create faculty' });
    }
  }

  public async update(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const adminId = req.user!.id;
      const result = await usersService.updateFaculty(id, req.body, adminId);
      res.json({ success: true, data: result });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message || 'Failed to update faculty' });
    }
  }

  public async setStatus(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { is_active } = req.body;
      const adminId = req.user!.id;
      const result = await usersService.setFacultyStatus(id, Boolean(is_active), adminId);
      res.json({ success: true, data: result });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message || 'Failed to set status' });
    }
  }

  public async resetPassword(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { new_password } = req.body;
      const adminId = req.user!.id;
      const result = await usersService.resetPassword(id, new_password, adminId);
      res.json({ success: true, data: result });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message || 'Failed to reset password' });
    }
  }
}

export const usersController = new UsersController();
