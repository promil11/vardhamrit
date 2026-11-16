import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import pool from '../config/db';
import { generateInvoicePDF } from '../services/invoiceService';
import { sendError } from '../utils/response';

export async function downloadOrderInvoice(req: Request, res: Response, next: NextFunction) {
  try {
    const orderId = Number(req.params.id);
    const userId = req.user!.userId;
    const isAdmin = req.user!.role === 'admin';

    const [orders]: any = await pool.query(
      'SELECT id, user_id, invoice_url, invoice_number, status FROM orders WHERE id = ?',
      [orderId]
    );

    if (orders.length === 0) {
      return sendError(res, 'Order not found', 404);
    }

    const order = orders[0];

    // Customer can only download their own order
    if (!isAdmin && order.user_id !== userId) {
      return sendError(res, 'Unauthorized to view this invoice', 403);
    }

    // Generate or get PDF
    const { filePath, invoiceNumber } = await generateInvoicePDF(orderId);

    if (!fs.existsSync(filePath)) {
      return sendError(res, 'Failed to locate generated invoice file', 500);
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="invoice_${invoiceNumber}.pdf"`
    );

    const readStream = fs.createReadStream(filePath);
    return readStream.pipe(res);
  } catch (err) {
    return next(err);
  }
}
