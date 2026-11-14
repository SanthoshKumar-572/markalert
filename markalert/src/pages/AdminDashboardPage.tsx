import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Users,
  UserPlus,
  KeyRound,
  Shield,
  CheckCircle2,
  AlertCircle,
  MoreVertical,
  Layers,
  Send,
} from 'lucide-react';
import { api } from '../lib/api';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card, CardHeader, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { User } from '../types';

const createFacultySchema = z.object({
  full_name: z.string().min(2, 'Full name is required'),
  employee_id: z.string().min(2, 'Employee ID is required'),
  email: z.string().email('Valid email address is required'),
  department: z.string().min(2, 'Department is required'),
  designation: z.string().min(2, 'Designation is required'),
  mobile_number: z.string().optional(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type CreateFacultyInput = z.infer<typeof createFacultySchema>;

export const AdminDashboardPage: React.FC = () => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [resettingFaculty, setResettingFaculty] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Auto-dismiss success notification after 3 seconds
  useEffect(() => {
    if (actionMessage) {
      const timer = setTimeout(() => {
        setActionMessage(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [actionMessage]);

  const { data: overview } = useQuery({
    queryKey: ['admin-overview'],
    queryFn: () => api.reports.getOverview(),
  });

  const { data: facultyData, isLoading, refetch } = useQuery({
    queryKey: ['admin-faculty-list'],
    queryFn: () => api.admin.listFaculty(),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateFacultyInput>({
    resolver: zodResolver(createFacultySchema),
    defaultValues: {
      password: 'Faculty@123',
    },
  });

  const handleCreateFaculty = async (data: CreateFacultyInput) => {
    try {
      await api.admin.createFaculty(data);
      setActionMessage(`Faculty account for ${data.full_name} created successfully.`);
      setShowCreateModal(false);
      reset();
      await refetch();
    } catch (err: any) {
      alert(err.response?.data?.error || err.message || 'Failed to create faculty');
    }
  };

  const handleToggleStatus = async (faculty: User) => {
    try {
      const newStatus = !faculty.is_active;
      await api.admin.setFacultyStatus(faculty.id, newStatus);
      setActionMessage(`Faculty account ${newStatus ? 'activated' : 'deactivated'}.`);
      await refetch();
    } catch (err: any) {
      alert(err.response?.data?.error || err.message || 'Status change failed');
    }
  };

  const handleResetPassword = async () => {
    if (!resettingFaculty || !newPassword) return;
    try {
      await api.admin.resetFacultyPassword(resettingFaculty.id, newPassword);
      setActionMessage(`Password reset successfully for ${resettingFaculty.full_name}.`);
      setResettingFaculty(null);
      setNewPassword('');
    } catch (err: any) {
      alert(err.response?.data?.error || err.message || 'Password reset failed');
    }
  };

  const facultyList = facultyData?.data || [];

  return (
    <div className="space-y-6">
      {/* Page Title & Add Button */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 tracking-tight">
            Administrator Portal
          </h1>
          <p className="text-xs text-stone-500 mt-0.5">
            Manage faculty accounts, monitor system-wide delivery performance, and system settings
          </p>
        </div>

        <Button
          onClick={() => setShowCreateModal(true)}
          className="gap-2 shadow-sm"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add Faculty Member</span>
        </Button>
      </div>

      {actionMessage && (
        <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center justify-between shadow-2xs animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionMessage}</span>
          </div>
          <button
            onClick={() => setActionMessage(null)}
            className="text-emerald-700 hover:text-emerald-900 text-xs font-semibold px-2 py-0.5 rounded-md hover:bg-emerald-100/60 transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* System Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5">
          <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider block mb-1">
            Faculty Accounts
          </span>
          <span className="text-2xl font-bold text-stone-900">{facultyList.length}</span>
          <span className="text-xs text-stone-400 block mt-0.5">Registered educators</span>
        </Card>

        <Card className="p-5">
          <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider block mb-1">
            Total Batches
          </span>
          <span className="text-2xl font-bold text-stone-900">{overview?.totalBatches || 0}</span>
          <span className="text-xs text-stone-400 block mt-0.5">Dispatched institution-wide</span>
        </Card>

        <Card className="p-5">
          <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider block mb-1">
            Delivered Messages
          </span>
          <span className="text-2xl font-bold text-emerald-700">{overview?.totalDelivered || 0}</span>
          <span className="text-xs text-stone-400 block mt-0.5">{overview?.deliveryRate || 0}% confirmed rate</span>
        </Card>

        <Card className="p-5">
          <span className="text-xs font-semibold text-rose-700 uppercase tracking-wider block mb-1">
            Total Failures
          </span>
          <span className="text-2xl font-bold text-rose-700">{overview?.totalFailed || 0}</span>
          <span className="text-xs text-stone-400 block mt-0.5">Requires phone correction</span>
        </Card>
      </div>

      {/* Faculty Management Table */}
      <Card>
        <CardHeader
          title="Registered Faculty Accounts"
          description="Faculty members authorized to upload marks and dispatch parent notifications"
        />

        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-xs text-stone-400">Loading accounts...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-stone-50 border-b border-stone-100 text-[10px] font-bold uppercase tracking-wider text-stone-500">
                    <th className="py-3 px-6">Faculty Name</th>
                    <th className="py-3 px-4">Employee ID</th>
                    <th className="py-3 px-4">Department / Role</th>
                    <th className="py-3 px-4">Email</th>
                    <th className="py-3 px-4 text-center">Batches</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 font-sans">
                  {facultyList.map((faculty: User) => (
                    <tr key={faculty.id} className="hover:bg-stone-50/50">
                      <td className="py-3 px-6 font-bold text-stone-900">
                        {faculty.full_name}
                      </td>
                      <td className="py-3 px-4 font-mono text-stone-600">
                        {faculty.employee_id}
                      </td>
                      <td className="py-3 px-4 text-stone-600">
                        <span className="block font-medium">{faculty.department}</span>
                        <span className="text-[10px] text-stone-400">{faculty.designation}</span>
                      </td>
                      <td className="py-3 px-4 text-stone-600 font-mono">
                        {faculty.email}
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-stone-700">
                        {(faculty as any)._count?.batches || 0}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge variant={faculty.is_active ? 'success' : 'error'}>
                          {faculty.is_active ? 'Active' : 'Deactivated'}
                        </Badge>
                      </td>
                      <td className="py-3 px-6 text-right space-x-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setResettingFaculty(faculty)}
                          title="Reset Password"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                        </Button>

                        <Button
                          size="sm"
                          variant={faculty.is_active ? 'outline' : 'primary'}
                          className="text-[11px]"
                          onClick={() => handleToggleStatus(faculty)}
                        >
                          {faculty.is_active ? 'Deactivate' : 'Activate'}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Faculty Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-stone-200">
            <h3 className="text-base font-bold text-stone-900 tracking-tight">
              Create Faculty Account
            </h3>

            <form onSubmit={handleSubmit(handleCreateFaculty)} className="space-y-3">
              <Input
                label="Full Name *"
                placeholder="Dr. S. Kumar"
                error={errors.full_name?.message}
                {...register('full_name')}
              />

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Employee ID *"
                  placeholder="FAC104"
                  error={errors.employee_id?.message}
                  {...register('employee_id')}
                />
                <Input
                  label="Department *"
                  placeholder="IT / CSE"
                  error={errors.department?.message}
                  {...register('department')}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Designation *"
                  placeholder="Assistant Professor"
                  error={errors.designation?.message}
                  {...register('designation')}
                />
                <Input
                  label="Mobile Number"
                  placeholder="9876543210"
                  error={errors.mobile_number?.message}
                  {...register('mobile_number')}
                />
              </div>

              <Input
                label="Academic Email *"
                type="email"
                placeholder="faculty@college.edu"
                error={errors.email?.message}
                {...register('email')}
              />

              <Input
                label="Initial Password *"
                type="password"
                placeholder="Faculty@123"
                error={errors.password?.message}
                {...register('password')}
              />

              <div className="flex justify-end gap-2 pt-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" isLoading={isSubmitting}>
                  Create Faculty
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Password Reset Modal */}
      {resettingFaculty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-xl border border-stone-200">
            <h3 className="text-base font-bold text-stone-900">
              Reset Password: {resettingFaculty.full_name}
            </h3>
            <p className="text-xs text-stone-500">
              Enter a new temporary password. Existing active sessions will be terminated immediately.
            </p>

            <Input
              label="New Temporary Password *"
              type="password"
              placeholder="••••••••"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setResettingFaculty(null)}
              >
                Cancel
              </Button>
              <Button
                disabled={!newPassword || newPassword.length < 6}
                onClick={handleResetPassword}
              >
                Confirm Reset
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
