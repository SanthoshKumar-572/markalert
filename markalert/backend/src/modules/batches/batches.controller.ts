import { Request, Response } from 'express';
import { batchesService } from './batches.service';

export class BatchesController {
  public async create(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const batch = await batchesService.createDraft(req.body, userId);
      res.status(201).json({ success: true, data: batch });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message || 'Failed to create batch' });
    }
  }

  public async uploadFile(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      if (!req.file) {
        res.status(400).json({ success: false, error: 'No Excel file was uploaded' });
        return;
      }

      const result = await batchesService.handleFileUpload(id, req.file, userId);
      res.json({ success: true, data: result });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message || 'Failed to process Excel upload' });
    }
  }

  public async validate(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { mapping, sheet_name, max_marks, stored_file_name } = req.body;

      if (!stored_file_name) {
        res.status(400).json({ success: false, error: 'stored_file_name is required' });
        return;
      }

      const result = await batchesService.validateBatch(
        id,
        stored_file_name,
        mapping,
        sheet_name,
        max_marks || {}
      );

      res.json({ success: true, data: result });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message || 'Validation failed' });
    }
  }

  public async getPreview(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { status } = req.query;
      const preview = await batchesService.getPreview(id, status ? String(status) : undefined);
      res.json({ success: true, data: preview });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message || 'Failed to retrieve preview' });
    }
  }

  public async downloadErrorReport(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const csv = await batchesService.getErrorReportCsv(id);

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="error_report_${id}.csv"`);
      res.send(csv);
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message || 'Failed to generate error report' });
    }
  }

  public async list(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const role = req.user!.role;
      const { page, limit } = req.query;

      const result = await batchesService.listBatches(userId, role, {
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
      });

      res.json({ success: true, data: result.batches, pagination: result.pagination });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Failed to list batches' });
    }
  }

  public async getById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const batch = await batchesService.getBatchById(id);
      res.json({ success: true, data: batch });
    } catch (err: any) {
      res.status(404).json({ success: false, error: err.message || 'Batch not found' });
    }
  }
}

export const batchesController = new BatchesController();
