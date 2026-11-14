import fs from 'fs';
import path from 'path';
import { BatchStatus, RecipientStatus, Role } from '../../database/types';
import { prisma } from '../../database/prisma';
import { excelService, ColumnMapping, ExcelValidationResult } from '../excel/excel.service';
import { encryptText } from '../../utils/crypto';
import { logAudit } from '../../middleware/auth';

const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

export class BatchesService {
  public async createDraft(
    data: { exam_name: string; department?: string; class_name?: string; academic_year?: string },
    userId: string
  ) {
    const batch = await prisma.notificationBatch.create({
      data: {
        created_by: userId,
        exam_name: data.exam_name.trim(),
        department: data.department?.trim() || null,
        class_name: data.class_name?.trim() || null,
        academic_year: data.academic_year?.trim() || null,
        original_file_name: 'pending_upload',
        batch_status: BatchStatus.DRAFT,
      },
    });

    await logAudit(userId, 'CREATE_BATCH', 'notification_batches', batch.id, data);
    return batch;
  }

  public async handleFileUpload(batchId: string, file: Express.Multer.File, userId: string) {
    const batch = await prisma.notificationBatch.findUnique({ where: { id: batchId } });
    if (!batch) throw new Error(`Batch '${batchId}' not found`);

    // Save uploaded file to disk
    const storedFileName = `${batchId}-${Date.now()}-${file.originalname}`;
    const filePath = path.join(UPLOADS_DIR, storedFileName);
    fs.writeFileSync(filePath, file.buffer);

    // Parse Excel workbook structure
    const sheets = excelService.getSheetNames(file.buffer);
    const parsed = excelService.parseSheet(file.buffer, sheets[0]);
    const suggestedMapping = excelService.detectColumnMapping(parsed.columns);

    // Update batch record with original file name
    await prisma.notificationBatch.update({
      where: { id: batchId },
      data: {
        original_file_name: file.originalname,
      },
    });

    return {
      batchId,
      fileName: file.originalname,
      storedFileName,
      availableSheets: sheets,
      activeSheet: parsed.sheetName,
      totalRows: parsed.rows.length,
      columns: parsed.columns,
      suggestedMapping,
      detectedSubjects: Object.keys(suggestedMapping.subjectCols),
    };
  }

  public async validateBatch(
    batchId: string,
    storedFileName: string,
    mapping: ColumnMapping,
    sheetName?: string,
    maxMarksMap: Record<string, number> = {}
  ): Promise<ExcelValidationResult> {
    const filePath = path.join(UPLOADS_DIR, storedFileName);
    if (!fs.existsSync(filePath)) {
      throw new Error('Uploaded file is no longer available on server. Please upload the file again.');
    }

    const buffer = fs.readFileSync(filePath);
    const parsed = excelService.parseSheet(buffer, sheetName);
    const validation = excelService.validateRows(parsed.rows, mapping, maxMarksMap, {
      fileName: storedFileName,
      sheetName: parsed.sheetName,
      availableSheets: parsed.availableSheets,
    });

    // Clean up any previously stored recipients for this draft
    await prisma.batchRecipient.deleteMany({
      where: { batch_id: batchId },
    });

    // Save recipients into temporary batch_recipients storage
    const recipientData = validation.rows.map(row => {
      let recipientStatus: RecipientStatus = RecipientStatus.VALID;
      if (row.status === 'ERROR') recipientStatus = RecipientStatus.ERROR;
      else if (row.status === 'WARNING') recipientStatus = RecipientStatus.WARNING;

      return {
        batch_id: batchId,
        register_number: row.registerNumber,
        student_name: row.studentName,
        parent_name: row.parentName || null,
        encrypted_phone: encryptText(row.parentMobileFormatted || row.parentMobileSanitized),
        phone_masked: row.parentMobileMasked,
        marks_data: JSON.stringify(row.marks),
        total_marks: row.totalMarks,
        max_marks: row.totalMaxMarks,
        percentage: row.percentage,
        status: recipientStatus,
        issues: row.issues.length > 0 ? JSON.stringify(row.issues) : null,
      };
    });

    // Chunked insertion to prevent query parameter limits
    const CHUNK_SIZE = 100;
    for (let i = 0; i < recipientData.length; i += CHUNK_SIZE) {
      const chunk = recipientData.slice(i, i + CHUNK_SIZE);
      await prisma.batchRecipient.createMany({
        data: chunk,
      });
    }

    // Update batch stats
    await prisma.notificationBatch.update({
      where: { id: batchId },
      data: {
        total_records: validation.totalRows,
        valid_records: validation.validRows + validation.warningRows,
        invalid_records: validation.errorRows,
        batch_status: BatchStatus.VALIDATED,
      },
    });

    return validation;
  }

  public async getPreview(batchId: string, filterStatus?: string) {
    const where: any = { batch_id: batchId };
    if (filterStatus && filterStatus !== 'ALL') {
      where.status = filterStatus as RecipientStatus;
    }

    const recipients = await prisma.batchRecipient.findMany({
      where,
      orderBy: { created_at: 'asc' },
    });

    return recipients.map((r: any, idx: number) => ({
      rowNumber: idx + 2,
      id: r.id,
      registerNumber: r.register_number,
      studentName: r.student_name,
      parentName: r.parent_name || 'Parent/Guardian',
      parentMobileMasked: r.phone_masked,
      marks: JSON.parse(r.marks_data || '{}'),
      totalMarks: Number(r.total_marks),
      maxMarks: Number(r.max_marks),
      percentage: Number(r.percentage),
      status: r.status,
      issues: r.issues ? JSON.parse(r.issues) : [],
    }));
  }

  public async getErrorReportCsv(batchId: string): Promise<string> {
    const errorRecipients = await prisma.batchRecipient.findMany({
      where: {
        batch_id: batchId,
        status: { in: [RecipientStatus.ERROR, RecipientStatus.WARNING] },
      },
      orderBy: { created_at: 'asc' },
    });

    const header = ['Register Number', 'Student Name', 'Status', 'Field', 'Issue Description'].join(',');
    const lines = [header];

    for (const r of errorRecipients) {
      const issues = r.issues ? JSON.parse(r.issues) : [];
      for (const issue of issues) {
        const line = [
          `"${r.register_number.replace(/"/g, '""')}"`,
          `"${r.student_name.replace(/"/g, '""')}"`,
          r.status,
          `"${issue.field.replace(/"/g, '""')}"`,
          `"${issue.message.replace(/"/g, '""')}"`,
        ].join(',');
        lines.push(line);
      }
    }

    return lines.join('\n');
  }

  public async listBatches(userId: string, role: Role, params: { page?: number; limit?: number }) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (role === Role.FACULTY) {
      where.created_by = userId;
    }

    const [total, batches] = await Promise.all([
      prisma.notificationBatch.count({ where }),
      prisma.notificationBatch.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          creator: {
            select: { full_name: true, email: true, department: true },
          },
          _count: {
            select: { notifications: true, recipients: true },
          },
        },
      }),
    ]);

    return {
      batches,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  public async getBatchById(batchId: string) {
    const batch = await prisma.notificationBatch.findUnique({
      where: { id: batchId },
      include: {
        creator: {
          select: { id: true, full_name: true, email: true, department: true },
        },
        _count: {
          select: { notifications: true, recipients: true },
        },
      },
    });

    if (!batch) throw new Error(`Batch '${batchId}' not found`);
    return batch;
  }
}

export const batchesService = new BatchesService();
