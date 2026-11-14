import { Request, Response } from 'express';
import { db } from '../database/db';
import { getFacultyAssignedClassIds, checkFacultyClassAccess } from '../middleware/auth';

export async function getDashboardStats(req: Request, res: Response): Promise<void> {
  try {
    const user = req.user;
    const isAdmin = user?.role === 'ADMIN';

    if (isAdmin) {
      // Admin gets college-wide statistics
      const facultyCountRow = await db.queryOne<any>('SELECT COUNT(*) as cnt FROM users WHERE role = "FACULTY"');
      const classCountRow = await db.queryOne<any>('SELECT COUNT(*) as cnt FROM classes');
      const studentCountRow = await db.queryOne<any>('SELECT COUNT(*) as cnt FROM students');
      const examCountRow = await db.queryOne<any>('SELECT COUNT(*) as cnt FROM exams');

      const marksCountRow = await db.queryOne<any>('SELECT COUNT(*) as cnt FROM marks');

      // Count distinct unique recipient numbers so sending twice to the same number does not double count
      const notifStats = await db.queryOne<any>(`
        SELECT 
          COUNT(DISTINCT recipient) as unique_total,
          COUNT(DISTINCT CASE WHEN status IN ('SENT', 'DELIVERED') THEN recipient END) as unique_delivered,
          COUNT(DISTINCT CASE WHEN status = 'FAILED' THEN recipient END) as unique_failed,
          COUNT(DISTINCT CASE WHEN status IN ('PENDING', 'QUEUED', 'RETRYING') THEN recipient END) as unique_pending
        FROM notifications
      `);

      const totalNotifications = notifStats?.unique_total || 0;
      const deliveredCount = notifStats?.unique_delivered || 0;
      const failedCount = notifStats?.unique_failed || 0;
      const pendingCount = notifStats?.unique_pending || 0;

      const recentUploads = await db.query<any>(`
        SELECT u.*, us.name as uploaded_by_name
        FROM uploaded_files u
        LEFT JOIN users us ON u.uploaded_by = us.id
        ORDER BY u.created_at DESC
        LIMIT 5
      `);

      const recentBatches = await db.query<any>(`
        SELECT b.*, ex.exam_name, us.name as created_by_name
        FROM notification_batches b
        JOIN exams ex ON b.exam_id = ex.id
        LEFT JOIN users us ON b.created_by = us.id
        ORDER BY b.created_at DESC
        LIMIT 5
      `);

      const recentFailures = await db.query<any>(`
        SELECT n.*, s.register_number, s.name as student_name, ex.exam_name
        FROM notifications n
        JOIN students s ON n.student_id = s.id
        JOIN exams ex ON n.exam_id = ex.id
        WHERE n.status = 'FAILED'
        ORDER BY n.created_at DESC
        LIMIT 5
      `);

      res.json({
        success: true,
        data: {
          isAdmin: true,
          facultyCount: facultyCountRow?.cnt || 0,
          classesCount: classCountRow?.cnt || 0,
          studentsCount: studentCountRow?.cnt || 0,
          examsCount: examCountRow?.cnt || 0,
          marksCount: marksCountRow?.cnt || 0,
          notificationsSent: totalNotifications,
          deliveredCount: deliveredCount,
          pendingCount: pendingCount,
          failedCount: failedCount,
          recentUploads,
          recentBatches,
          recentFailures
        }
      });
    } else {
      // Faculty view (Section 16: Show only information relevant to logged-in Faculty)
      const facultyId = user?.id || '';
      const assignedClassIds = await getFacultyAssignedClassIds(facultyId);

      if (assignedClassIds.length === 0) {
        res.json({
          success: true,
          data: {
            isAdmin: false,
            assignedClasses: [],
            studentsCount: 0,
            examsCount: 0,
            notificationsSent: 0,
            deliveredCount: 0,
            failedCount: 0,
            recentBatches: [],
            recentFailures: []
          }
        });
        return;
      }

      const placeholders = assignedClassIds.map(() => '?').join(',');

      // Assigned classes details
      const assignedClasses = await db.query<any>(`
        SELECT c.*, d.name as department_name, d.code as department_code,
               (SELECT COUNT(*) FROM students s WHERE s.class_id = c.id) as student_count
        FROM classes c
        JOIN departments d ON c.department_id = d.id
        WHERE c.id IN (${placeholders})
        ORDER BY c.name ASC
      `, assignedClassIds);

      // Student count in faculty's assigned classes
      const studentCountRow = await db.queryOne<any>(`
        SELECT COUNT(*) as cnt FROM students WHERE class_id IN (${placeholders})
      `, assignedClassIds);

      // Exams in faculty's assigned classes
      const examCountRow = await db.queryOne<any>(`
        SELECT COUNT(*) as cnt FROM exams WHERE class_id IN (${placeholders})
      `, assignedClassIds);

      // Marks count in faculty's assigned classes
      const marksCountRow = await db.queryOne<any>(`
        SELECT COUNT(*) as cnt 
        FROM marks m
        JOIN students s ON m.student_id = s.id
        WHERE s.class_id IN (${placeholders})
      `, assignedClassIds);

      // Notification stats for faculty's students (distinct recipients)
      const notifStats = await db.queryOne<any>(`
        SELECT 
          COUNT(DISTINCT n.recipient) as unique_total,
          COUNT(DISTINCT CASE WHEN n.status IN ('SENT', 'DELIVERED') THEN n.recipient END) as unique_delivered,
          COUNT(DISTINCT CASE WHEN n.status = 'FAILED' THEN n.recipient END) as unique_failed,
          COUNT(DISTINCT CASE WHEN n.status IN ('PENDING', 'QUEUED', 'RETRYING') THEN n.recipient END) as unique_pending
        FROM notifications n
        JOIN students s ON n.student_id = s.id
        WHERE s.class_id IN (${placeholders})
      `, assignedClassIds);

      const totalNotifications = notifStats?.unique_total || 0;
      const deliveredCount = notifStats?.unique_delivered || 0;
      const failedCount = notifStats?.unique_failed || 0;
      const pendingCount = notifStats?.unique_pending || 0;

      const recentBatches = await db.query<any>(`
        SELECT b.*, ex.exam_name, us.name as created_by_name
        FROM notification_batches b
        JOIN exams ex ON b.exam_id = ex.id
        LEFT JOIN users us ON b.created_by = us.id
        WHERE ex.class_id IN (${placeholders})
        ORDER BY b.created_at DESC
        LIMIT 5
      `, assignedClassIds);

      const recentFailures = await db.query<any>(`
        SELECT n.*, s.register_number, s.name as student_name, ex.exam_name
        FROM notifications n
        JOIN students s ON n.student_id = s.id
        JOIN exams ex ON n.exam_id = ex.id
        WHERE n.status = 'FAILED' AND s.class_id IN (${placeholders})
        ORDER BY n.created_at DESC
        LIMIT 5
      `, assignedClassIds);

      // Mask phone numbers in failures
      const sanitizedFailures = recentFailures.map((f: any) => {
        const rec = f.recipient || '';
        return {
          ...f,
          recipient_masked: rec.length >= 4 ? '******' + rec.slice(-4) : '******',
          recipient: rec.length >= 4 ? '******' + rec.slice(-4) : '******'
        };
      });

      res.json({
        success: true,
        data: {
          isAdmin: false,
          assignedClasses,
          studentsCount: studentCountRow?.cnt || 0,
          examsCount: examCountRow?.cnt || 0,
          marksCount: marksCountRow?.cnt || 0,
          notificationsSent: totalNotifications,
          deliveredCount: deliveredCount,
          pendingCount: pendingCount,
          failedCount: failedCount,
          recentBatches,
          recentFailures: sanitizedFailures
        }
      });
    }
  } catch (err: any) {
    console.error('[Get Dashboard Stats Error]:', err);
    res.status(500).json({ success: false, error: 'Failed to retrieve dashboard statistics' });
  }
}

export async function getStudentReport(req: Request, res: Response): Promise<void> {
  try {
    const user = req.user;
    const { exam_id, department_id, class_id, search } = req.query;

    let queryStr = `
      SELECT s.id as student_id, s.register_number, s.name as student_name,
             d.name as department_name, c.name as class_name, c.year as class_year, c.section as class_section,
             ex.exam_name,
             COALESCE(s.parent_phone, p.mobile_number) as mobile_number,
             COALESCE(s.parent_name, p.parent_name) as parent_name,
             GROUP_CONCAT(sub.subject_code || ': ' || m.marks_obtained || '/' || m.max_marks, ', ') as marks_summary,
             SUM(m.marks_obtained) as total_obtained,
             SUM(m.max_marks) as total_max,
             (SELECT n.status FROM notifications n WHERE n.student_id = s.id AND n.exam_id = ex.id ORDER BY n.created_at DESC LIMIT 1) as notification_status,
             (SELECT n.channel FROM notifications n WHERE n.student_id = s.id AND n.exam_id = ex.id ORDER BY n.created_at DESC LIMIT 1) as notification_channel
      FROM students s
      JOIN marks m ON m.student_id = s.id
      JOIN subjects sub ON m.subject_id = sub.id
      JOIN exams ex ON m.exam_id = ex.id
      LEFT JOIN departments d ON s.department_id = d.id
      LEFT JOIN classes c ON s.class_id = c.id
      LEFT JOIN parents p ON p.student_id = s.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (user?.role === 'FACULTY') {
      const assignedClassIds = await getFacultyAssignedClassIds(user.id);
      if (assignedClassIds.length === 0) {
        res.json({ success: true, count: 0, data: [] });
        return;
      }
      const placeholders = assignedClassIds.map(() => '?').join(',');
      queryStr += ` AND s.class_id IN (${placeholders})`;
      params.push(...assignedClassIds);
    }

    if (exam_id) {
      queryStr += ` AND (m.exam_id = ? OR ex.id = ?)`;
      params.push(exam_id, exam_id);
    }
    if (department_id) {
      queryStr += ` AND s.department_id = ?`;
      params.push(department_id);
    }
    if (class_id) {
      queryStr += ` AND s.class_id = ?`;
      params.push(class_id);
    }
    if (search) {
      queryStr += ` AND (s.name LIKE ? OR s.register_number LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }

    queryStr += ` GROUP BY s.id, ex.id ORDER BY s.register_number ASC`;

    const reportRows = await db.query<any>(queryStr, params);

    const data = reportRows.map(r => {
      const totalObtained = Number(r.total_obtained || 0);
      const totalMax = Number(r.total_max || 0);
      const percentage = totalMax > 0 ? Number(((totalObtained / totalMax) * 100).toFixed(2)) : 0;
      const maskedPhone = r.mobile_number ? '******' + r.mobile_number.slice(-4) : 'N/A';

      return {
        ...r,
        total_obtained: totalObtained,
        total_max: totalMax,
        percentage,
        mobile_number_masked: maskedPhone
      };
    });

    res.json({ success: true, count: data.length, data });
  } catch (err: any) {
    console.error('[Get Student Report Error]:', err);
    res.status(500).json({ success: false, error: 'Failed to generate student report' });
  }
}

export async function getClassReport(req: Request, res: Response): Promise<void> {
  try {
    const classes = await db.query<any>(`
      SELECT c.id as class_id, c.year, c.section, c.academic_year,
             d.name as department_name, d.code as department_code,
             COUNT(DISTINCT s.id) as total_students
      FROM classes c
      JOIN departments d ON c.department_id = d.id
      LEFT JOIN students s ON s.class_id = c.id
      GROUP BY c.id
      ORDER BY d.name ASC, c.year ASC, c.section ASC
    `);

    const result = [];
    for (const cls of classes) {
      const marksCount = await db.queryOne<any>(
        `SELECT COUNT(DISTINCT m.student_id) as cnt
         FROM marks m
         JOIN students s ON m.student_id = s.id
         WHERE s.class_id = ?`,
        [cls.class_id]
      );

      const notifs = await db.queryOne<any>(
        `SELECT 
           COUNT(DISTINCT n.recipient) as unique_total,
           COUNT(DISTINCT CASE WHEN n.status IN ('SENT', 'DELIVERED') THEN n.recipient END) as unique_delivered,
           COUNT(DISTINCT CASE WHEN n.status = 'FAILED' THEN n.recipient END) as unique_failed
         FROM notifications n
         JOIN students s ON n.student_id = s.id
         WHERE s.class_id = ?`,
        [cls.class_id]
      );

      result.push({
        ...cls,
        marks_imported_students: marksCount?.cnt || 0,
        notifications_sent: notifs?.unique_total || 0,
        delivered: notifs?.unique_delivered || 0,
        failed: notifs?.unique_failed || 0
      });
    }

    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to generate class report' });
  }
}

export async function getNotificationAnalytics(req: Request, res: Response): Promise<void> {
  try {
    const channelStats = await db.query<any>(`
      SELECT channel, status, COUNT(DISTINCT recipient) as count
      FROM notifications
      GROUP BY channel, status
    `);

    const dailyTrends = await db.query<any>(`
      SELECT substr(created_at, 1, 10) as day, status, COUNT(DISTINCT recipient) as count
      FROM notifications
      GROUP BY day, status
      ORDER BY day DESC
      LIMIT 14
    `);

    res.json({
      success: true,
      data: {
        channelStats,
        dailyTrends
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to generate notification analytics' });
  }
}
