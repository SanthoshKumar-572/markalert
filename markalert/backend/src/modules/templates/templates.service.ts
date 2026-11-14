import { TemplateChannel } from '../../database/types';
import { prisma } from '../../database/prisma';

export const DEFAULT_WHATSAPP_TEMPLATE = `{EXAM_NAME} RESULT

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

export const DEFAULT_SMS_TEMPLATE = `{EXAM_NAME} RESULT

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

export class TemplatesService {
  public async listTemplates() {
    let templates = await prisma.messageTemplate.findMany({
      orderBy: { created_at: 'desc' },
    });

    if (templates.length === 0) {
      // Seed default templates automatically
      const defaultWa = await prisma.messageTemplate.create({
        data: {
          name: 'Standard Internal Marks Alert (WhatsApp)',
          channel: TemplateChannel.WHATSAPP,
          template_text: DEFAULT_WHATSAPP_TEMPLATE,
          is_active: true,
        },
      });

      const defaultSms = await prisma.messageTemplate.create({
        data: {
          name: 'Standard Internal Marks Alert (SMS)',
          channel: TemplateChannel.SMS,
          template_text: DEFAULT_SMS_TEMPLATE,
          is_active: true,
        },
      });

      templates = [defaultWa, defaultSms];
    }

    return templates;
  }

  public async getActiveTemplate(channel: TemplateChannel = TemplateChannel.BOTH) {
    const template = await prisma.messageTemplate.findFirst({
      where: {
        is_active: true,
        OR: [{ channel }, { channel: TemplateChannel.BOTH }],
      },
      orderBy: { updated_at: 'desc' },
    });

    if (template) return template.template_text;
    return channel === TemplateChannel.SMS ? DEFAULT_SMS_TEMPLATE : DEFAULT_WHATSAPP_TEMPLATE;
  }

  public async createTemplate(data: { name: string; channel?: TemplateChannel; template_text: string }) {
    return prisma.messageTemplate.create({
      data: {
        name: data.name,
        channel: data.channel || TemplateChannel.BOTH,
        template_text: data.template_text,
        is_active: true,
      },
    });
  }

  public async updateTemplate(id: string, data: any) {
    return prisma.messageTemplate.update({
      where: { id },
      data,
    });
  }

  public async deleteTemplate(id: string) {
    return prisma.messageTemplate.delete({
      where: { id },
    });
  }
}

export const templatesService = new TemplatesService();
