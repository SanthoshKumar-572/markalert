import { PrismaClient } from '@prisma/client';
import { Role, TemplateChannel } from '../src/database/types';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export async function seedDatabase() {
  console.log('[Seed] Seeding MarkAlert v2 initial data...');

  const adminPasswordHash = await bcrypt.hash('Admin@123', 10);
  const facultyPasswordHash = await bcrypt.hash('Faculty@123', 10);

  // 1. Seed Admin User
  const admin = await prisma.user.upsert({
    where: { email: 'admin@college.edu' },
    update: {},
    create: {
      full_name: 'System Administrator',
      employee_id: 'ADM001',
      email: 'admin@college.edu',
      password_hash: adminPasswordHash,
      department: 'Administration',
      designation: 'Chief Administrator',
      role: Role.ADMIN,
      is_active: true,
    },
  });
  console.log(`[Seed] Admin user verified: ${admin.email}`);

  // 2. Seed Faculty User
  const faculty = await prisma.user.upsert({
    where: { email: 'faculty@college.edu' },
    update: {},
    create: {
      full_name: 'Dr. S. Kumar',
      employee_id: 'FAC102',
      email: 'faculty@college.edu',
      password_hash: facultyPasswordHash,
      department: 'Information Technology',
      designation: 'Associate Professor',
      mobile_number: '9876543210',
      role: Role.FACULTY,
      is_active: true,
    },
  });
  console.log(`[Seed] Faculty user verified: ${faculty.email}`);

  // 3. Seed Message Templates
  const defaultWaText = `{EXAM_NAME} RESULT

Dear Parent,

We are pleased to share the {EXAM_NAME} results of {STUDENT_NAME}  (Reg. No: {REGISTER_NUMBER}).

{SUBJECT_1}: {MARK_1}/100 – {STATUS_1}
{SUBJECT_2}: {MARK_2}/100 – {STATUS_2}
{SUBJECT_3}: {MARK_3}/100 – {STATUS_3}
{SUBJECT_4}: {MARK_4}/100 – {STATUS_4}
{SUBJECT_5}: {MARK_5}/100 – {STATUS_5}

Overall Result: {OVERALL_RESULT}

Thank you for your continued support.

Regards,
{COLLEGE_NAME}, Karur.`;

  const defaultSmsText = `{EXAM_NAME} RESULT

Dear Parent,

We are pleased to share the {EXAM_NAME} results of {STUDENT_NAME}  (Reg. No: {REGISTER_NUMBER}).

{SUBJECT_1}: {MARK_1}/100 – {STATUS_1}
{SUBJECT_2}: {MARK_2}/100 – {STATUS_2}
{SUBJECT_3}: {MARK_3}/100 – {STATUS_3}
{SUBJECT_4}: {MARK_4}/100 – {STATUS_4}
{SUBJECT_5}: {MARK_5}/100 – {STATUS_5}

Overall Result: {OVERALL_RESULT}

Thank you for your continued support.

Regards,
{COLLEGE_NAME}, Karur.`;

  await prisma.messageTemplate.upsert({
    where: { id: 'default-template-whatsapp' },
    update: {},
    create: {
      id: 'default-template-whatsapp',
      name: 'Default WhatsApp Marks Template',
      channel: TemplateChannel.WHATSAPP,
      template_text: defaultWaText,
      is_active: true,
    },
  });

  await prisma.messageTemplate.upsert({
    where: { id: 'default-template-sms' },
    update: {},
    create: {
      id: 'default-template-sms',
      name: 'Default SMS Marks Template',
      channel: TemplateChannel.SMS,
      template_text: defaultSmsText,
      is_active: true,
    },
  });

  // 4. Seed System Settings
  await prisma.systemSetting.upsert({
    where: { key: 'COLLEGE_NAME' },
    update: {},
    create: {
      key: 'COLLEGE_NAME',
      value: 'V.S.B. Engineering College',
      description: 'Official College Name for Message Signatures',
    },
  });

  await prisma.systemSetting.upsert({
    where: { key: 'MOCK_NOTIFICATION_PROVIDER' },
    update: {},
    create: {
      key: 'MOCK_NOTIFICATION_PROVIDER',
      value: 'true',
      description: 'Simulates WhatsApp and SMS delivery without incurring charges',
    },
  });

  console.log('[Seed] Database seeding completed successfully.');
}

if (process.argv[1] && process.argv[1].includes('seed')) {
  seedDatabase()
    .then(async () => {
      await prisma.$disconnect();
    })
    .catch(async (e) => {
      console.error(e);
      await prisma.$disconnect();
      process.exit(1);
    });
}
