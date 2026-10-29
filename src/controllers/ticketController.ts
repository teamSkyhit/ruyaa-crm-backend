import { Request, Response } from 'express';
import { TicketAuthor, TicketStatus } from '@prisma/client';
import prisma from '../prismaClient';
import { notify } from '../services/notificationService';
import { sendTicketReply } from '../services/resendService';

const STATUSES = new Set<TicketStatus>([TicketStatus.OPEN, TicketStatus.PENDING, TicketStatus.RESOLVED]);

async function nextTicketNumber(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const count = await prisma.supportTicket.count();
    const ticketNumber = `TKT-${String(count + 1 + attempt).padStart(5, '0')}`;
    const existing = await prisma.supportTicket.findUnique({ where: { ticketNumber }, select: { id: true } });
    if (!existing) return ticketNumber;
  }
  return `TKT-${Date.now().toString().slice(-8)}`;
}

async function resolveOrderId(orderNumber: unknown, phone: string, email: string | null, strictMatch: boolean): Promise<{ orderId: string | null } | { error: string; status: number }> {
  if (!orderNumber) return { orderId: null };
  const order = await prisma.order.findUnique({ where: { orderNumber: String(orderNumber) } });
  if (!order) return { error: 'Order not found', status: 400 };
  if (strictMatch) {
    const phoneMatch = order.customerPhone === phone;
    const emailMatch = email && order.customerEmail.toLowerCase() === email.toLowerCase();
    if (!phoneMatch && !emailMatch) return { error: 'Phone or email does not match this order', status: 403 };
  }
  return { orderId: order.id };
}

export async function openTicket(input: {
  name: string;
  phone: string;
  email?: string | null;
  subject: string;
  message: string;
  orderNumber?: string | null;
  enquiryId?: string | null;
  strictOrderMatch: boolean;
}): Promise<{ ticketNumber: string; id: string; existing: boolean } | { error: string; status: number }> {
  if (input.enquiryId) {
    const existing = await prisma.supportTicket.findUnique({ where: { enquiryId: input.enquiryId } });
    if (existing) return { ticketNumber: existing.ticketNumber, id: existing.id, existing: true };
  }
  const linked = await resolveOrderId(input.orderNumber, input.phone, input.email ?? null, input.strictOrderMatch);
  if ('error' in linked) return linked;
  const ticket = await prisma.supportTicket.create({
    data: {
      ticketNumber: await nextTicketNumber(),
      name: input.name,
      phone: input.phone,
      email: input.email ?? null,
      subject: input.subject,
      orderId: linked.orderId,
      enquiryId: input.enquiryId ?? null,
      messages: { create: { author: TicketAuthor.CUSTOMER, body: input.message } },
    },
  });
  await notify({
    type: 'NEW_TICKET',
    title: `Support ticket ${ticket.ticketNumber}`,
    body: ticket.subject,
    link: `/tickets/${ticket.id}`,
  });
  return { ticketNumber: ticket.ticketNumber, id: ticket.id, existing: false };
}

export async function createTicket(req: Request, res: Response): Promise<void> {
  try {
    const { name, phone, email, subject, message, orderNumber } = req.body ?? {};
    if (!name || !phone || !subject || !message) {
      res.status(400).json({ success: false, error: 'name, phone, subject, and message are required' });
      return;
    }

    const opened = await openTicket({
      name: String(name).trim(),
      phone: String(phone).trim(),
      email: email ? String(email).trim() : null,
      subject: String(subject).trim(),
      message: String(message).trim(),
      orderNumber: orderNumber ? String(orderNumber) : null,
      strictOrderMatch: true,
    });
    if ('error' in opened) {
      res.status(opened.status).json({ success: false, error: opened.error });
      return;
    }

    res.status(201).json({ success: true, data: { ticketNumber: opened.ticketNumber } });
  } catch (error) {
    console.error('createTicket error:', error);
    res.status(500).json({ success: false, error: 'Failed to create support ticket' });
  }
}

export async function getPublicTicket(req: Request, res: Response): Promise<void> {
  try {
    const phone = typeof req.query.phone === 'string' ? req.query.phone.trim() : '';
    const email = typeof req.query.email === 'string' ? req.query.email.trim().toLowerCase() : '';
    const ticket = await prisma.supportTicket.findUnique({
      where: { ticketNumber: req.params.ticketNumber },
      include: { messages: { orderBy: { createdAt: 'asc' } }, order: { select: { orderNumber: true } } },
    });
    if (!ticket) {
      res.status(404).json({ success: false, error: 'Ticket not found' });
      return;
    }
    if (!phone && !email) {
      res.json({ success: true, data: { ticketNumber: ticket.ticketNumber, status: ticket.status } });
      return;
    }
    if (phone && ticket.phone !== phone) {
      res.status(403).json({ success: false, error: 'Phone number does not match this ticket' });
      return;
    }
    if (email && ticket.email?.toLowerCase() !== email) {
      res.status(403).json({ success: false, error: 'Email address does not match this ticket' });
      return;
    }
    res.json({
      success: true,
      data: {
        ticketNumber: ticket.ticketNumber,
        subject: ticket.subject,
        status: ticket.status,
        orderNumber: ticket.order?.orderNumber ?? null,
        messages: ticket.messages.map((message) => ({
          author: message.author,
          body: message.body,
          createdAt: message.createdAt,
        })),
      },
    });
  } catch (error) {
    console.error('getPublicTicket error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch ticket' });
  }
}

export async function createTicketFromCrm(req: Request, res: Response): Promise<void> {
  try {
    const { name, phone, email, subject, message, orderNumber } = req.body ?? {};
    if (!name || !phone || !subject || !message) {
      res.status(400).json({ success: false, error: 'name, phone, subject, and message are required' });
      return;
    }
    const opened = await openTicket({
      name: String(name).trim(),
      phone: String(phone).trim(),
      email: email ? String(email).trim() : null,
      subject: String(subject).trim(),
      message: String(message).trim(),
      orderNumber: orderNumber ? String(orderNumber).trim() : null,
      strictOrderMatch: false,
    });
    if ('error' in opened) {
      res.status(opened.status).json({ success: false, error: opened.error });
      return;
    }
    res.status(201).json({ success: true, data: opened });
  } catch (error) {
    console.error('createTicketFromCrm error:', error);
    res.status(500).json({ success: false, error: 'Failed to create support ticket' });
  }
}

export async function createTicketFromEnquiry(req: Request, res: Response): Promise<void> {
  try {
    const enquiry = await prisma.enquiry.findUnique({ where: { id: req.params.id } });
    if (!enquiry) {
      res.status(404).json({ success: false, error: 'Enquiry not found' });
      return;
    }
    const opened = await openTicket({
      name: enquiry.name,
      phone: enquiry.phone,
      email: enquiry.email,
      subject: enquiry.message.slice(0, 180),
      message: enquiry.message,
      orderNumber: req.body?.orderNumber ? String(req.body.orderNumber).trim() : null,
      enquiryId: enquiry.id,
      strictOrderMatch: false,
    });
    if ('error' in opened) {
      res.status(opened.status).json({ success: false, error: opened.error });
      return;
    }
    res.status(opened.existing ? 200 : 201).json({ success: true, data: opened });
  } catch (error) {
    console.error('createTicketFromEnquiry error:', error);
    res.status(500).json({ success: false, error: 'Failed to open a ticket' });
  }
}

export async function listTickets(_req: Request, res: Response): Promise<void> {
  try {
    const tickets = await prisma.supportTicket.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { order: { select: { id: true, orderNumber: true } } },
    });
    res.json({ success: true, data: tickets });
  } catch (error) {
    console.error('listTickets error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch tickets' });
  }
}

export async function getTicket(req: Request, res: Response): Promise<void> {
  try {
    const ticket = await prisma.supportTicket.findUnique({
      where: { id: req.params.id },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
        order: { select: { id: true, orderNumber: true } },
      },
    });
    if (!ticket) {
      res.status(404).json({ success: false, error: 'Ticket not found' });
      return;
    }
    res.json({ success: true, data: ticket });
  } catch (error) {
    console.error('getTicket error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch ticket' });
  }
}

export async function updateTicket(req: Request, res: Response): Promise<void> {
  try {
    const status = req.body?.status as TicketStatus;
    if (!STATUSES.has(status)) {
      res.status(400).json({ success: false, error: 'status must be OPEN, PENDING, or RESOLVED' });
      return;
    }
    const ticket = await prisma.supportTicket.update({ where: { id: req.params.id }, data: { status } });
    res.json({ success: true, data: ticket });
  } catch (error: any) {
    if (error?.code === 'P2025') {
      res.status(404).json({ success: false, error: 'Ticket not found' });
      return;
    }
    console.error('updateTicket error:', error);
    res.status(500).json({ success: false, error: 'Failed to update ticket' });
  }
}

export async function replyToTicket(req: Request, res: Response): Promise<void> {
  try {
    const body = String(req.body?.body ?? '').trim();
    if (!body) {
      res.status(400).json({ success: false, error: 'body is required' });
      return;
    }
    const ticket = await prisma.supportTicket.findUnique({ where: { id: req.params.id } });
    if (!ticket) {
      res.status(404).json({ success: false, error: 'Ticket not found' });
      return;
    }
    const message = await prisma.supportMessage.create({
      data: { ticketId: ticket.id, author: TicketAuthor.STAFF, body },
    });
    if (ticket.status === TicketStatus.OPEN) {
      await prisma.supportTicket.update({ where: { id: ticket.id }, data: { status: TicketStatus.PENDING } });
    }
    const emailed = ticket.email ? await sendTicketReply(ticket.email, ticket.ticketNumber, body) : false;
    res.status(201).json({ success: true, data: message, emailed });
  } catch (error) {
    console.error('replyToTicket error:', error);
    res.status(500).json({ success: false, error: 'Failed to send reply' });
  }
}
