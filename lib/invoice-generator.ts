import jsPDF from 'jspdf';
import { MonthlyStatement } from './schema';

// Configuration constants
export const DEFAULT_HOURLY_RATE = 115; // CAD
export const COMPANY_INFO = {
  name: 'Market Edge Analytics Pty Ltd',
  address: '3 Chiltern St',
  city: 'RANDWICK',
  postcode: '2031',
  country: 'Australia'
};

export interface LineAdjustment {
  description: string;
  amount: number; // Can be positive (fees) or negative (discounts)
}

export interface InvoiceData {
  invoiceNumber: string;
  customerName: string;
  issueDate: Date;
  dueDate: Date;
  hourlyRate: number;
  lineItems: Array<{
    productOrService: string;
    quantity: number; // hours
    unitPrice: number;
    total: number;
  }>;
  adjustments: LineAdjustment[];
  currency: string;
}

export function generateInvoicePDF(
  monthlyStatement: MonthlyStatement,
  invoiceNumber: string,
  customerName: string,
  hourlyRate: number = DEFAULT_HOURLY_RATE,
  adjustments: LineAdjustment[] = [],
  dueDateDays: number = 30,
  currency: string = 'CAD'
): void {
  // Prepare line items from monthly statement (already sorted alphabetically by getSummaryTasks)
  const lineItemsMap = new Map<string, { hours: number; project: string; description: string }>();
  
  monthlyStatement.tasks.forEach(task => {
    const key = `${task.project}|${task.description}`;
    if (lineItemsMap.has(key)) {
      const existing = lineItemsMap.get(key)!;
      existing.hours += task.hours;
    } else {
      lineItemsMap.set(key, {
        hours: task.hours,
        project: task.project,
        description: task.description
      });
    }
  });

  // Convert to array and sort alphabetically by product/service name
  const lineItemsArray = Array.from(lineItemsMap.values())
    .sort((a, b) => {
      // First sort by project alphabetically
      const projectCompare = a.project.localeCompare(b.project);
      if (projectCompare !== 0) {
        return projectCompare;
      }
      // Then sort by description alphabetically
      return a.description.localeCompare(b.description);
    })
    .map(value => ({
      productOrService: value.description, // Just use description as the main item
      project: value.project, // Keep project separate
      quantity: value.hours,
      unitPrice: hourlyRate,
      total: value.hours * hourlyRate
    }));

  // Calculate totals
  const subtotal = lineItemsArray.reduce((sum, item) => sum + item.total, 0);
  const adjustmentsTotal = adjustments.reduce((sum, adj) => sum + adj.amount, 0);
  const totalExcludingTax = subtotal + adjustmentsTotal;
  const tax = 0; // Tax is 0.00 as per example
  const amountDue = totalExcludingTax + tax;

  // Create PDF
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - (margin * 2);
  let yPos = margin;

  // Helper function to format currency
  const formatCurrency = (amount: number): string => {
    // Use locale based on currency for proper formatting
    const localeMap: { [key: string]: string } = {
      'CAD': 'en-CA',
      'USD': 'en-US',
      'EUR': 'de-DE',
      'GBP': 'en-GB',
      'AUD': 'en-AU'
    };
    const locale = localeMap[currency] || 'en-CA';
    
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  // Helper function to format date
  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  // Header - Invoice title (top left)
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  const invoiceTitleY = yPos;
  doc.text('Invoice', margin, yPos);
  
  // Invoice number and issue date (top right, stacked vertically)
  const issueDate = new Date();
  doc.setFontSize(10);
  
  // Calculate positions - invoice number on left, issue date on right
  // Both right-aligned but at different X positions
  const rightEdge = pageWidth - margin;
  const invoiceNumX = rightEdge - 80; // Position for invoice number
  const issueDateX = rightEdge; // Position for issue date (rightmost)
  
  // Invoice number (stacked: label then value)
  doc.setFont('helvetica', 'bold');
  doc.text('Invoice number', invoiceNumX, invoiceTitleY - 5, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.text(invoiceNumber, invoiceNumX, invoiceTitleY + 2, { align: 'right' });
  
  // Issue date (stacked: label then value, positioned to the right)
  doc.setFont('helvetica', 'bold');
  doc.text('Issue date', issueDateX, invoiceTitleY - 5, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.text(formatDate(issueDate), issueDateX, invoiceTitleY + 2, { align: 'right' });
  
  // Separator line - position it below the header content
  yPos = invoiceTitleY + 12;
  doc.setLineWidth(0.5);
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 15;

  // Billed to section (left side)
  const billedToStartY = yPos;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Billed to:', margin, yPos);
  yPos += 7;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(customerName, margin, yPos);
  const billedToEndY = yPos + 5;
  
  // Issued by section (right side, aligned with Billed to)
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Issued by:', pageWidth / 2 + margin, billedToStartY);
  let issuedByYPos = billedToStartY + 7;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(COMPANY_INFO.name, pageWidth / 2 + margin, issuedByYPos);
  issuedByYPos += 5;
  doc.text(COMPANY_INFO.address, pageWidth / 2 + margin, issuedByYPos);
  issuedByYPos += 5;
  doc.text(COMPANY_INFO.city, pageWidth / 2 + margin, issuedByYPos);
  issuedByYPos += 5;
  doc.text(COMPANY_INFO.postcode, pageWidth / 2 + margin, issuedByYPos);
  issuedByYPos += 5;
  doc.text(COMPANY_INFO.country, pageWidth / 2 + margin, issuedByYPos);
  
  // Move yPos to the bottom of the taller section with proper spacing
  yPos = Math.max(billedToEndY, issuedByYPos) + 10;

  // Payment summary
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  const dueDate = new Date(issueDate);
  dueDate.setDate(dueDate.getDate() + dueDateDays);
  doc.text(`${formatCurrency(amountDue)} due by ${formatDate(dueDate)}`, margin, yPos);
  yPos += 15;

  // Line items table header
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  const colWidths = {
    product: contentWidth * 0.40,
    quantity: contentWidth * 0.15,
    unitPrice: contentWidth * 0.20,
    tax: contentWidth * 0.10,
    total: contentWidth * 0.15
  };
  
  let xPos = margin;
  doc.text('Product or service', xPos, yPos);
  xPos += colWidths.product;
  doc.text('Hours', xPos, yPos);
  xPos += colWidths.quantity;
  doc.text(`Rate (${currency})`, xPos, yPos);
  xPos += colWidths.unitPrice;
  doc.text('Tax', xPos, yPos);
  xPos += colWidths.tax;
  doc.text(`Total (${currency})`, xPos, yPos);
  yPos += 5;

  // Draw table header line
  doc.setLineWidth(0.5);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 7;

  // Line items
  doc.setFont('helvetica', 'normal');
  lineItemsArray.forEach((item, index) => {
    // Check if we need a new page
    if (yPos > pageHeight - 60) {
      doc.addPage();
      yPos = margin;
    }

    // Add spacing before each item (soft line break between items)
    if (index > 0) {
      yPos += 3; // Small spacing between line items
    }

    xPos = margin;
    
    // Product/service - format as "Project: Description" on single line
    const productText = `${item.project}: ${item.productOrService}`;
    // Wrap text if needed for long descriptions
    const wrappedText = doc.splitTextToSize(productText, colWidths.product - 2);
    doc.text(wrappedText, xPos, yPos);
    const productHeight = wrappedText.length * 5;
    xPos += colWidths.product;
    
    // Hours
    doc.text(item.quantity.toFixed(2), xPos, yPos);
    xPos += colWidths.quantity;
    
    // Rate
    doc.text(formatCurrency(item.unitPrice), xPos, yPos);
    xPos += colWidths.unitPrice;
    
    // Tax (empty)
    doc.text('', xPos, yPos);
    xPos += colWidths.tax;
    
    // Total
    doc.text(formatCurrency(item.total), xPos, yPos);
    
    // Move to next row - add spacing after item
    yPos += Math.max(productHeight, 5) + 2;
    
    // Draw a subtle separator line after each item (soft styling)
    if (index < lineItemsArray.length - 1) { // Don't draw after last item
      doc.setLineWidth(0.3);
      doc.setDrawColor(220, 220, 220);
      doc.line(margin, yPos, pageWidth - margin, yPos);
      yPos += 2;
    }
  });

  // Adjustments section
  if (adjustments.length > 0) {
    yPos += 5;
    if (yPos > pageHeight - 50) {
      doc.addPage();
      yPos = margin;
    }
    
    doc.setFont('helvetica', 'normal');
    adjustments.forEach(adjustment => {
      if (yPos > pageHeight - 50) {
        doc.addPage();
        yPos = margin;
      }

      xPos = margin;
      doc.text(adjustment.description, xPos, yPos);
      xPos += colWidths.product + colWidths.quantity + colWidths.unitPrice + colWidths.tax;
      doc.text(formatCurrency(adjustment.amount), xPos, yPos);
      yPos += 7;
    });
  }

  // Summary section
  yPos += 8;
  if (yPos > pageHeight - 50) {
    doc.addPage();
    yPos = margin;
  }

  // Draw separator line
  doc.setLineWidth(0.5);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  
  // Position labels much further to the left to leave room for values
  const summaryLabelX = margin + colWidths.product + colWidths.quantity;
  // Position values at the right edge, aligned with the right side of the "Total" column
  const summaryValueX = pageWidth - margin;

  // Total excluding tax
  doc.text('Total excluding tax:', summaryLabelX, yPos);
  doc.setFont('helvetica', 'bold');
  // Calculate text width and position from right edge for right alignment
  const totalExcludingTaxText = formatCurrency(totalExcludingTax);
  const totalExcludingTaxWidth = doc.getTextWidth(totalExcludingTaxText);
  doc.text(totalExcludingTaxText, summaryValueX - totalExcludingTaxWidth, yPos);
  yPos += 6;

  // Total tax
  doc.setFont('helvetica', 'normal');
  doc.text('Total tax:', summaryLabelX, yPos);
  doc.setFont('helvetica', 'bold');
  const taxText = formatCurrency(tax);
  const taxWidth = doc.getTextWidth(taxText);
  doc.text(taxText, summaryValueX - taxWidth, yPos);
  yPos += 6;

  // Amount due
  doc.setFont('helvetica', 'normal');
  doc.text('Amount due:', summaryLabelX, yPos);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  const amountDueText = formatCurrency(amountDue);
  // Recalculate width with new font size for accurate positioning
  const amountDueWidth = doc.getTextWidth(amountDueText);
  doc.text(amountDueText, summaryValueX - amountDueWidth, yPos);

  // Save the PDF
  doc.save(`invoice-${invoiceNumber}.pdf`);
}

