import bcrypt from 'bcryptjs';
import { Role } from '../../database/types';
import { prisma } from '../../database/prisma';
import { logAudit } from '../../middleware/auth';

export class UsersService {
  public async listFaculty(params: { search?: string; department?: string; isActive?: boolean; page?: number; limit?: number }) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = {
      role: Role.FACULTY,
    };

    if (params.department) {
      where.department = params.department;
    }

    if (params.isActive !== undefined) {
      where.is_active = params.isActive;
    }

    if (params.search) {
      const q = params.search.trim();
      where.OR = [
        { full_name: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { employee_id: { contains: q, mode: 'insensitive' } },
        { department: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [total, faculty] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        select: {
          id: true,
          full_name: true,
          employee_id: true,
          email: true,
          department: true,
          designation: true,
          mobile_number: true,
          is_active: true,
          created_at: true,
          _count: {
            select: { batches: true },
          },
        },
      }),
    ]);

    return {
      faculty,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  public async createFaculty(
    data: {
      full_name: string;
      employee_id: string;
      email: string;
      department: string;
      designation: string;
      mobile_number?: string;
      password?: string;
    },
    adminId?: string
  ) {
    const email = data.email.toLowerCase().trim();
    const employee_id = data.employee_id.trim();

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { employee_id }],
      },
    });

    if (existingUser) {
      if (existingUser.email === email) {
        throw new Error(`Email '${email}' is already registered.`);
      }
      if (existingUser.employee_id === employee_id) {
        throw new Error(`Employee ID '${employee_id}' is already assigned to another user.`);
      }
    }

    const passwordHash = await bcrypt.hash(data.password || 'Faculty@123', 10);

    const faculty = await prisma.user.create({
      data: {
        full_name: data.full_name.trim(),
        employee_id,
        email,
        password_hash: passwordHash,
        department: data.department.trim(),
        designation: data.designation.trim(),
        mobile_number: data.mobile_number?.trim() || null,
        role: Role.FACULTY,
        is_active: true,
      },
      select: {
        id: true,
        full_name: true,
        employee_id: true,
        email: true,
        department: true,
        designation: true,
        mobile_number: true,
        is_active: true,
        created_at: true,
      },
    });

    await logAudit(adminId, 'CREATE_FACULTY', 'users', faculty.id, { email, employee_id });
    return faculty;
  }

  public async updateFaculty(id: string, data: any, adminId?: string) {
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      throw new Error(`Faculty user '${id}' not found`);
    }

    const updated = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        full_name: true,
        employee_id: true,
        email: true,
        department: true,
        designation: true,
        mobile_number: true,
        is_active: true,
        updated_at: true,
      },
    });

    await logAudit(adminId, 'UPDATE_FACULTY', 'users', id, data);
    return updated;
  }

  public async setFacultyStatus(id: string, is_active: boolean, adminId?: string) {
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      throw new Error(`Faculty user '${id}' not found`);
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { is_active },
      select: { id: true, email: true, is_active: true },
    });

    // If deactivating, revoke all active refresh tokens immediately
    if (!is_active) {
      await prisma.refreshToken.updateMany({
        where: { user_id: id },
        data: { revoked: true },
      });
    }

    await logAudit(adminId, is_active ? 'ACTIVATE_FACULTY' : 'DEACTIVATE_FACULTY', 'users', id, { is_active });
    return updated;
  }

  public async resetPassword(id: string, newPasswordPlain: string, adminId?: string) {
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      throw new Error(`Faculty user '${id}' not found`);
    }

    const passwordHash = await bcrypt.hash(newPasswordPlain, 10);

    await prisma.user.update({
      where: { id },
      data: { password_hash: passwordHash },
    });

    // Revoke all existing sessions to force re-login
    await prisma.refreshToken.updateMany({
      where: { user_id: id },
      data: { revoked: true },
    });

    await logAudit(adminId, 'RESET_PASSWORD', 'users', id, { target_user: existing.email });
    return { message: 'Password has been securely reset' };
  }
}

export const usersService = new UsersService();
