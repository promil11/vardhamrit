import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import pool from '../config/db';
import { AppError } from '../middleware/errorHandler';

export interface InvoiceData {
  orderId: number;
  invoiceNumber: string;
  invoiceDate: string;
  order: any;
  items: any[];
}

export const INVOICE_STORAGE_DIR = path.resolve(__dirname, '../../invoices');

// Ensure invoices directory exists
if (!fs.existsSync(INVOICE_STORAGE_DIR)) {
  fs.mkdirSync(INVOICE_STORAGE_DIR, { recursive: true });
}

export async function generateInvoicePDF(orderId: number): Promise<{ filePath: string; invoiceNumber: string }> {
  // 1. Fetch order details with user & items
  const [orders]: any = await pool.query(
    `SELECT o.*, c.code as coupon_code, u.name as user_name, u.email as user_email, u.phone as user_phone
     FROM orders o
     LEFT JOIN coupons c ON o.coupon_id = c.id
     JOIN users u ON o.user_id = u.id
     WHERE o.id = ?`,
    [orderId]
  );

  if (orders.length === 0) {
    throw new AppError('Order not found', 404);
  }

  const order = orders[0];

  const [items]: any = await pool.query(
    'SELECT * FROM order_items WHERE order_id = ?',
    [orderId]
  );

  if (items.length === 0) {
    throw new AppError('No items found for order', 400);
  }

  // Parse address snapshot
  let address = order.address_snapshot;
  if (typeof address === 'string') {
    try {
      address = JSON.parse(address);
    } catch (e) {}
  }

  // Generate sequential invoice number if not already generated
  let invoiceNumber = order.invoice_number;
  if (!invoiceNumber) {
    const year = new Date().getFullYear();
    invoiceNumber = `INV-${year}-${String(order.id).padStart(6, '0')}`;
  }

  const fileName = `invoice_${order.id}_${invoiceNumber}.pdf`;
  const filePath = path.join(INVOICE_STORAGE_DIR, fileName);
  const invoiceUrl = `/invoices/${fileName}`;

  // Seller details from env
  const seller = {
    name: process.env.SELLER_NAME || 'Vardhamrit Tea Estates Pvt Ltd',
    address: process.env.SELLER_ADDRESS || '12, Tea Garden Road, Siliguri, West Bengal, India - 734001',
    phone: process.env.SELLER_PHONE || '+91 98765 43210',
    email: process.env.SELLER_EMAIL || 'care@vardhamrit.com',
    gstin: process.env.SELLER_GSTIN || '19AAACV1234F1Z5',
  };

  // Build PDF Document
  await new Promise<void>((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const writeStream = fs.createWriteStream(filePath);

    doc.pipe(writeStream);

    // Header: Brand & Title
    doc.fillColor('#2d5a27').fontSize(22).font('Helvetica-Bold').text('VARDHAMRIT', 40, 40);
    doc.fillColor('#666666').fontSize(10).font('Helvetica').text('Pure Mountain Chai & Fine Teas', 40, 65);

    doc.fillColor('#111111').fontSize(16).font('Helvetica-Bold').text('TAX INVOICE', 400, 40, { align: 'right' });
    doc.fillColor('#444444').fontSize(10).font('Helvetica')
      .text(`Invoice No: ${invoiceNumber}`, 350, 62, { align: 'right' })
      .text(`Date: ${new Date(order.created_at).toLocaleDateString('en-IN')}`, 350, 76, { align: 'right' })
      .text(`Order ID: #${order.id}`, 350, 90, { align: 'right' });

    doc.moveTo(40, 110).lineTo(555, 110).strokeColor('#e0e0e0').stroke();

    // Seller & Buyer Columns
    const startY = 120;
    // Seller Info
    doc.fillColor('#2d5a27').fontSize(11).font('Helvetica-Bold').text('SOLD BY (SELLER):', 40, startY);
    doc.fillColor('#222222').fontSize(9).font('Helvetica')
      .text(seller.name, 40, startY + 16)
      .text(seller.address, 40, startY + 28, { width: 230 })
      .text(`GSTIN: ${seller.gstin}`, 40, startY + 54)
      .text(`Email: ${seller.email} | Phone: ${seller.phone}`, 40, startY + 66);

    // Buyer Info
    doc.fillColor('#2d5a27').fontSize(11).font('Helvetica-Bold').text('BILL TO / SHIP TO:', 320, startY);
    doc.fillColor('#222222').fontSize(9).font('Helvetica')
      .text(address?.name || order.user_name, 320, startY + 16)
      .text(`${address?.line1 || ''} ${address?.line2 || ''}`, 320, startY + 28, { width: 230 })
      .text(`${address?.city || ''}, ${address?.state || ''} - ${address?.pincode || ''}`, 320, startY + 44)
      .text(`Phone: ${address?.phone || order.user_phone || 'N/A'}`, 320, startY + 58)
      .text(`Payment: ${order.payment_method} (${order.payment_status})`, 320, startY + 70);

    doc.moveTo(40, 205).lineTo(555, 205).strokeColor('#e0e0e0').stroke();

    // Table Header
    const tableTop = 220;
    doc.rect(40, tableTop - 5, 515, 22).fill('#f4f7f4');
    doc.fillColor('#2d5a27').fontSize(9).font('Helvetica-Bold')
      .text('ITEM', 45, tableTop)
      .text('VARIANT', 260, tableTop)
      .text('QTY', 350, tableTop, { width: 40, align: 'right' })
      .text('PRICE (INR)', 400, tableTop, { width: 70, align: 'right' })
      .text('TOTAL (INR)', 480, tableTop, { width: 70, align: 'right' });

    let currentY = tableTop + 24;
    doc.font('Helvetica').fontSize(9).fillColor('#333333');

    for (const item of items) {
      const lineTotal = (Number(item.price) * item.quantity).toFixed(2);
      doc
        .text(item.product_name, 45, currentY, { width: 205 })
        .text(item.variant_label, 260, currentY)
        .text(String(item.quantity), 350, currentY, { width: 40, align: 'right' })
        .text(`Rs. ${Number(item.price).toFixed(2)}`, 400, currentY, { width: 70, align: 'right' })
        .text(`Rs. ${lineTotal}`, 480, currentY, { width: 70, align: 'right' });

      currentY += 20;
    }

    doc.moveTo(40, currentY + 5).lineTo(555, currentY + 5).strokeColor('#e0e0e0').stroke();

    // Calculation Breakdown
    let totalY = currentY + 15;
    const subtotal = Number(order.subtotal || order.total || 0);
    const discount = Number(order.discount_amount || 0);
    const coinsDiscount = Number(order.coins_discount || order.coins_redeemed || 0);
    const coinsRedeemed = Number(order.coins_redeemed || 0);
    const taxable = Math.max(0, subtotal - discount - coinsDiscount);
    const delivery = Number(order.delivery_fee || 0);
    const tax = Number(order.tax_amount || 0);
    const cgst = (tax / 2).toFixed(2);
    const sgst = (tax / 2).toFixed(2);
    const grandTotal = Number(order.total || order.total_amount).toFixed(2);

    const rightLabelX = 350;
    const rightValX = 475;

    doc.font('Helvetica').fontSize(9).fillColor('#444444');
    doc.text('Subtotal:', rightLabelX, totalY);
    doc.text(`Rs. ${subtotal.toFixed(2)}`, rightValX, totalY, { width: 75, align: 'right' });
    totalY += 15;

    if (discount > 0) {
      doc.text(`Coupon Discount (${order.coupon_code || 'PROMO'}):`, rightLabelX, totalY);
      doc.fillColor('#b71c1c').text(`- Rs. ${discount.toFixed(2)}`, rightValX, totalY, { width: 75, align: 'right' });
      doc.fillColor('#444444');
      totalY += 15;
    }

    if (coinsDiscount > 0) {
      doc.text(`Wallet Coins (${coinsRedeemed} Coins):`, rightLabelX, totalY);
      doc.fillColor('#b71c1c').text(`- Rs. ${coinsDiscount.toFixed(2)}`, rightValX, totalY, { width: 75, align: 'right' });
      doc.fillColor('#444444');
      totalY += 15;
    }

    doc.text('Taxable Amount:', rightLabelX, totalY);
    doc.text(`Rs. ${taxable.toFixed(2)}`, rightValX, totalY, { width: 75, align: 'right' });
    totalY += 15;

    doc.text('CGST (2.5%):', rightLabelX, totalY);
    doc.text(`Rs. ${cgst}`, rightValX, totalY, { width: 75, align: 'right' });
    totalY += 15;

    doc.text('SGST (2.5%):', rightLabelX, totalY);
    doc.text(`Rs. ${sgst}`, rightValX, totalY, { width: 75, align: 'right' });
    totalY += 15;

    doc.text('Delivery Fee:', rightLabelX, totalY);
    doc.text(delivery === 0 ? 'FREE' : `Rs. ${delivery.toFixed(2)}`, rightValX, totalY, { width: 75, align: 'right' });
    totalY += 20;

    // Grand Total Box
    doc.rect(340, totalY - 5, 215, 26).fill('#e8efe8');
    doc.fillColor('#2d5a27').font('Helvetica-Bold').fontSize(11);
    doc.text('GRAND TOTAL:', 350, totalY);
    doc.text(`Rs. ${grandTotal}`, rightValX, totalY, { width: 75, align: 'right' });

    // Footer
    const footerY = 740;
    doc.moveTo(40, footerY).lineTo(555, footerY).strokeColor('#cccccc').stroke();
    doc.fillColor('#666666').font('Helvetica').fontSize(8)
      .text('Thank you for choosing Vardhamrit - Crafting the purest chai experience since harvest.', 40, footerY + 8, { align: 'center' })
      .text('This is a computer generated invoice and does not require a physical signature.', 40, footerY + 20, { align: 'center' });

    doc.end();

    writeStream.on('finish', () => resolve());
    writeStream.on('error', (err) => reject(err));
  });

  // Persist invoice number and invoice URL to order in DB
  await pool.query(
    'UPDATE orders SET invoice_number = ?, invoice_url = ? WHERE id = ?',
    [invoiceNumber, invoiceUrl, orderId]
  );

  return { filePath, invoiceNumber };
}
