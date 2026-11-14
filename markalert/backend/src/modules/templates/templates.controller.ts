import { Request, Response } from 'express';
import { templatesService } from './templates.service';

export class TemplatesController {
  public async list(_req: Request, res: Response): Promise<void> {
    try {
      const templates = await templatesService.listTemplates();
      res.json({ success: true, data: templates });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Failed to list templates' });
    }
  }

  public async create(req: Request, res: Response): Promise<void> {
    try {
      const template = await templatesService.createTemplate(req.body);
      res.status(201).json({ success: true, data: template });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message || 'Failed to create template' });
    }
  }

  public async update(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const updated = await templatesService.updateTemplate(id, req.body);
      res.json({ success: true, data: updated });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message || 'Failed to update template' });
    }
  }

  public async delete(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      await templatesService.deleteTemplate(id);
      res.json({ success: true, message: 'Template deleted successfully' });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message || 'Failed to delete template' });
    }
  }
}

export const templatesController = new TemplatesController();
