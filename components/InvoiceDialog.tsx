'use client';

import { useState } from 'react';
import { MonthlyStatement } from '@/lib/schema';
import { generateInvoicePDF, DEFAULT_HOURLY_RATE, LineAdjustment } from '@/lib/invoice-generator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface InvoiceDialogProps {
  monthlyStatement: MonthlyStatement;
  onClose: () => void;
}

export default function InvoiceDialog({ monthlyStatement, onClose }: InvoiceDialogProps) {
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [currency, setCurrency] = useState('CAD');
  const [hourlyRate, setHourlyRate] = useState(DEFAULT_HOURLY_RATE.toString());
  const [dueDateDays, setDueDateDays] = useState('30');
  const [adjustments, setAdjustments] = useState<Array<{ id: string; description: string; amount: string }>>([]);

  const handleGenerateInvoice = () => {
    // Validate invoice number format (INV-xxx)
    const invoiceNumberPattern = /^INV-\d+$/;
    if (!invoiceNumberPattern.test(invoiceNumber)) {
      alert('Invoice number must be in the format INV-xxx (e.g., INV-002)');
      return;
    }

    if (!customerName.trim()) {
      alert('Please enter a customer name');
      return;
    }

    const rate = parseFloat(hourlyRate);
    if (isNaN(rate) || rate <= 0) {
      alert('Please enter a valid hourly rate');
      return;
    }

    const days = parseInt(dueDateDays);
    if (isNaN(days) || days < 0) {
      alert('Please enter a valid number of days for due date');
      return;
    }

    // Convert adjustments to the format expected by the generator
    const formattedAdjustments: LineAdjustment[] = adjustments
      .filter(adj => adj.description.trim() && adj.amount.trim())
      .map(adj => ({
        description: adj.description.trim(),
        amount: parseFloat(adj.amount) || 0
      }));

    // Generate the PDF
    generateInvoicePDF(monthlyStatement, invoiceNumber, customerName, rate, formattedAdjustments, days, currency);
    
    // Close the dialog
    onClose();
  };

  const addAdjustment = () => {
    setAdjustments([
      ...adjustments,
      { id: Date.now().toString(), description: '', amount: '' }
    ]);
  };

  const removeAdjustment = (id: string) => {
    setAdjustments(adjustments.filter(adj => adj.id !== id));
  };

  const updateAdjustment = (id: string, field: 'description' | 'amount', value: string) => {
    setAdjustments(adjustments.map(adj => 
      adj.id === id ? { ...adj, [field]: value } : adj
    ));
  };

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50">
      <div className="bg-card rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-6">
          <h3 className="text-xl font-semibold">Generate Invoice</h3>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div className="space-y-6">
          {/* Invoice Number */}
          <div className="space-y-2">
            <Label htmlFor="invoice-number">Invoice Number</Label>
            <Input
              id="invoice-number"
              type="text"
              placeholder="INV-002"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value.toUpperCase())}
            />
            <p className="text-xs text-muted-foreground">Format: INV-xxx (e.g., INV-002)</p>
          </div>

          {/* Customer Name */}
          <div className="space-y-2">
            <Label htmlFor="customer-name">Customer Name</Label>
            <Input
              id="customer-name"
              type="text"
              placeholder="Enter customer name"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
            />
          </div>

          {/* Currency */}
          <div className="space-y-2">
            <Label htmlFor="currency">Currency</Label>
            <select
              id="currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
            >
              <option value="CAD">CAD - Canadian Dollar</option>
              <option value="USD">USD - US Dollar</option>
              <option value="EUR">EUR - Euro</option>
              <option value="GBP">GBP - British Pound</option>
              <option value="AUD">AUD - Australian Dollar</option>
            </select>
          </div>

          {/* Hourly Rate */}
          <div className="space-y-2">
            <Label htmlFor="hourly-rate">Hourly Rate ({currency})</Label>
            <Input
              id="hourly-rate"
              type="number"
              step="0.01"
              placeholder={DEFAULT_HOURLY_RATE.toString()}
              value={hourlyRate}
              onChange={(e) => setHourlyRate(e.target.value)}
            />
          </div>

          {/* Due Date */}
          <div className="space-y-2">
            <Label htmlFor="due-date-days">Payment Terms (Days)</Label>
            <Input
              id="due-date-days"
              type="number"
              min="0"
              placeholder="30"
              value={dueDateDays}
              onChange={(e) => setDueDateDays(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Net {dueDateDays || '30'} days (default: Net 30)</p>
          </div>

          {/* Line Adjustments */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Line Adjustments</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addAdjustment}
              >
                Add Adjustment
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Add discounts (negative) or fees (positive)</p>
            
            {adjustments.length > 0 && (
              <div className="space-y-2 border border-border rounded-md p-4">
                {adjustments.map((adjustment) => (
                  <div key={adjustment.id} className="flex gap-2 items-start">
                    <div className="flex-1 space-y-2">
                      <Input
                        type="text"
                        placeholder="Description (e.g., Discount, Fee)"
                        value={adjustment.description}
                        onChange={(e) => updateAdjustment(adjustment.id, 'description', e.target.value)}
                      />
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Amount (negative for discounts)"
                        value={adjustment.amount}
                        onChange={(e) => updateAdjustment(adjustment.id, 'amount', e.target.value)}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeAdjustment(adjustment.id)}
                      className="mt-1"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                      </svg>
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Preview Info */}
          <div className="bg-muted/50 rounded-md p-4 space-y-2">
            <p className="text-sm font-medium">Invoice Preview</p>
            <div className="text-xs text-muted-foreground space-y-1">
              <p>Period: {monthlyStatement.month} {monthlyStatement.year}</p>
              <p>Total Hours: {monthlyStatement.totalHours.toFixed(2)}</p>
              <p>Line Items: {(() => {
                const uniqueItems = new Set(monthlyStatement.tasks.map(t => `${t.project}|${t.description}`));
                return uniqueItems.size;
              })()}</p>
              <p className="pt-2 border-t border-border/50 font-medium text-foreground">
                Total Cost: {(() => {
                  const rate = parseFloat(hourlyRate) || DEFAULT_HOURLY_RATE;
                  const subtotal = monthlyStatement.totalHours * rate;
                  const adjustmentsTotal = adjustments
                    .filter(adj => adj.description.trim() && adj.amount.trim())
                    .reduce((sum, adj) => sum + (parseFloat(adj.amount) || 0), 0);
                  const total = subtotal + adjustmentsTotal;
                  return new Intl.NumberFormat('en-CA', {
                    style: 'currency',
                    currency: currency
                  }).format(total);
                })()}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleGenerateInvoice}
            >
              Generate PDF
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

