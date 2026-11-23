/**
 * StaffSalarySlipModal — View, Print and Download PDF of an individual staff member's
 * salary slip / payroll record.
 *
 * Provides:
 * - A clean, standard Indian salary slip view
 * - Earnings vs Deductions (Absence + Advance deductions) breakdown
 * - Net Pay with amount in words
 * - Direct Print functionality with clean voucher / A4 print formatting
 * - Direct PDF Download (using pdfmake)
 * - Historical past slips tab/selector for that staff member
 */
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useT } from '../../i18n/LanguageContext';
import { amountInWords } from './amountInWords';
import { hrApi } from '../../services/api';

const S = {
  title:        { en: 'Staff Salary Slip', hi: 'स्टाफ सैलरी स्लिप', hinglish: 'Staff Salary Slip', gu: 'સ્ટાફ પગાર સ્લિપ', mr: 'कर्मचारी पगार स्लिप', mwr: 'स्टाफ सैलरी स्लिप' },
  print:        { en: 'Print Slip', hi: 'स्लिप प्रिंट करें', hinglish: 'Slip print karein', gu: 'સ્લિપ પ્રિન્ટ કરો', mr: 'स्लिप प्रिंट करा', mwr: 'स्लिप प्रिंट करो' },
  downloadPdf:  { en: 'Download PDF', hi: 'PDF डाउनलोड करें', hinglish: 'PDF download karein', gu: 'PDF ડાઉનલોડ કરો', mr: 'PDF डाउनलोड करा', mwr: 'PDF डाउनलोड करो' },
  close:        { en: 'Close', hi: 'बंद करें', hinglish: 'Band karein', gu: 'બંધ કરો', mr: 'बंद करा', mwr: 'बंद करो' },
  staffName:    { en: 'Staff Name', hi: 'स्टाफ का नाम', hinglish: 'Staff Name', gu: 'સ્ટાફનું નામ', mr: 'कर्मचाऱ्याचे नाव', mwr: 'स्टाफ रो नाम' },
  payPeriod:    { en: 'Pay Period', hi: 'सैलरी अवधि', hinglish: 'Pay Period', gu: 'પગાર ગાળો', mr: 'पगार कालावधी', mwr: 'सैलरी अवधि' },
  payDate:      { en: 'Pay Date', hi: 'तारीख', hinglish: 'Pay Date', gu: 'તારીખ', mr: 'दिनांक', mwr: 'तारीख' },
  workingDays:  { en: 'Total Working Days', hi: 'कुल कार्य दिवस', hinglish: 'Total Working Days', gu: 'કુલ કાર્ય દિવસ', mr: 'एकूण कामाचे दिवस', mwr: 'कुल काम रा दिन' },
  presentDays:  { en: 'Present Days', hi: 'उपस्थित दिन', hinglish: 'Present Days', gu: 'હાજર દિવસ', mr: 'उपस्थित दिवस', mwr: 'हाजर दिन' },
  absentDays:   { en: 'Absent Days', hi: 'अनुपस्थित दिन', hinglish: 'Absent Days', gu: 'ગેરહાજર દિવસ', mr: 'गैरहजर दिवस', mwr: 'गैरहाजर दिन' },
  perDayRate:   { en: 'Per Day Rate', hi: 'प्रति दिन दर', hinglish: 'Per day rate', gu: 'પ્રતિ દિવસ દર', mr: 'प्रतिदिन दर', mwr: 'हर दिन रो भाव' },
  earnings:     { en: 'Earnings', hi: 'कमाई (Earnings)', hinglish: 'Earnings', gu: 'કમાણી', mr: 'मिळकत', mwr: 'कमाई' },
  deductions:   { en: 'Deductions', hi: 'कटौती (Deductions)', hinglish: 'Deductions', gu: 'કપાત', mr: 'कपाती', mwr: 'कटौती' },
  basicSalary:  { en: 'Basic Salary', hi: 'बेसिक सैलरी', hinglish: 'Basic Salary', gu: 'બેઝિક પગાર', mr: 'मूळ पगार', mwr: 'बेसिक सैलरी' },
  absentCut:    { en: 'Absence Deduction', hi: 'अनुपस्थिति कटौती', hinglish: 'Absence deduction', gu: 'ગેરહાજરી કપાત', mr: 'गैरहजेरी कपात', mwr: 'गैरहाजरी कटौती' },
  advanceCut:   { en: 'Advance Recovery', hi: 'एडवांस कटौती', hinglish: 'Advance recovery', gu: 'એડવાન્સ કપાત', mr: 'अ‍ॅડવ્હાંસ कपात', mwr: 'एडवांस कटौती' },
  grossEarnings:{ en: 'Gross Earnings', hi: 'कुल कमाई (Gross)', hinglish: 'Gross Earnings', gu: 'કુલ કમાણી', mr: 'एकूण मिळकत', mwr: 'कुल कमाई' },
  totalDeduct:  { en: 'Total Deductions', hi: 'कुल कटौती', hinglish: 'Total Deductions', gu: 'કુલ કપાત', mr: 'एकूण कपात', mwr: 'कुल कटौती' },
  netPayable:   { en: 'Net Salary Payable', hi: 'नेट देय सैलरी', hinglish: 'Net Salary Payable', gu: 'નેટ ચૂકવવાપાત્ર પગાર', mr: 'निव्वळ देय पगार', mwr: 'नेट देय सैलरी' },
  amountInWords:{ en: 'Amount in words', hi: 'शब्दों में राशि', hinglish: 'Shabdon me', gu: 'શબ્દોમાં રકમ', mr: 'अक्षरी रक्कम', mwr: 'अखरां में रकम' },
  empSignature: { en: 'Employee Signature', hi: 'कर्मचारी हस्ताक्षर', hinglish: 'Employee Signature', gu: 'કર્મચારીની સહી', mr: 'कर्मचाऱ्याची सही', mwr: 'कर्मचारी रा दस्तखत' },
  authSignatory:{ en: 'Authorised Signatory', hi: 'अधिकृत हस्ताक्षर', hinglish: 'Authorised Signatory', gu: 'અધિકૃત સહી', mr: 'अधिकृत स्वाक्षरीकर्ता', mwr: 'अधिकृत दस्तखत' },
  historyTitle: { en: 'Past Slips', hi: 'पिछली स्लिप्स', hinglish: 'Past Slips', gu: 'અગાઉની સ્લિપ', mr: 'मागील स्लिप्स', mwr: 'पैली री स्लिप' },
  currentSlip:  { en: 'Current Cycle', hi: 'मौजूदा साइकिल', hinglish: 'Current Cycle', gu: 'હાલનું ચક્ર', mr: 'चालू चक्र', mwr: 'हाल रो चक्र' },
};

const inr = (v) => '₹' + Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function formatPeriodLabel(period) {
  if (!period) return 'Current Run';
  if (period.isCustom && period.from && period.to) {
    return `${period.from} to ${period.to}`;
  }
  if (period.month) {
    const [y, m] = period.month.split('-');
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const idx = parseInt(m, 10) - 1;
    return `${months[idx] || m} ${y}`;
  }
  return period.from && period.to ? `${period.from} → ${period.to}` : 'Current Month';
}

export function printSlip(record, period, companyName = 'MeraDhanda CRM') {
  const w = window.open('', '_blank', 'width=800,height=700');
  if (!w) {
    window.print();
    return;
  }
  const baseAmount = Number(record.gross || record.base || 0);
  const deduction = Number(record.deduction || 0);
  const advanceDeduction = Number(record.advanceDeduction || 0);
  const totalDeductions = deduction + advanceDeduction;
  const netAmount = Number(record.net || 0);
  const periodLabel = formatPeriodLabel(period);

  w.document.write(`<!DOCTYPE html><html><head>
    <title>Salary Slip - ${record.name || 'Staff'} - ${periodLabel}</title>
    <style>
      @page { size: A4 portrait; margin: 15mm; }
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #0f172a; margin: 0; padding: 20px; font-size: 13px; }
      .slip-box { border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 28px; max-width: 720px; margin: 0 auto; background: #fff; }
      .header { text-align: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 14px; margin-bottom: 18px; }
      .company { font-size: 22px; font-weight: 800; color: #0f172a; margin: 0; text-transform: uppercase; letter-spacing: 0.5px; }
      .doc-title { font-size: 13px; font-weight: 700; color: #475569; margin-top: 5px; text-transform: uppercase; }
      .period-tag { display: inline-block; background: #f1f5f9; padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: 600; color: #334155; margin-top: 6px; }
      .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px 18px; margin-bottom: 20px; font-size: 12.5px; }
      .info-row { display: flex; justify-content: space-between; }
      .info-label { color: #64748b; font-weight: 500; }
      .info-value { font-weight: 600; color: #0f172a; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 18px; font-size: 12.5px; }
      th, td { border: 1px solid #cbd5e1; padding: 9px 12px; text-align: left; }
      th { background: #f1f5f9; font-weight: 700; color: #334155; }
      .tar { text-align: right; }
      .danger { color: #dc2626; font-weight: 600; }
      .total-row { font-weight: 700; background: #f8fafc; }
      .net-box { display: flex; justify-content: space-between; align-items: center; background: #f0fdf4; border: 1.5px solid #86efac; border-radius: 6px; padding: 14px 18px; margin-top: 10px; margin-bottom: 36px; }
      .net-label { font-size: 13px; font-weight: 700; color: #166534; }
      .net-words { font-size: 11.5px; color: #475569; font-style: italic; margin-top: 4px; }
      .net-amount { font-size: 20px; font-weight: 800; color: #15803d; }
      .signatures { display: flex; justify-content: space-between; margin-top: 60px; padding: 0 20px; }
      .sig-line { border-top: 1px solid #94a3b8; width: 180px; text-align: center; padding-top: 6px; font-size: 11.5px; color: #64748b; font-weight: 500; }
      @media print {
        body { padding: 0; background: #fff; }
        .slip-box { border: none; padding: 0; }
      }
    </style>
  </head><body>
    <div class="slip-box">
      <div class="header">
        <h1 class="company">${companyName}</h1>
        <div class="doc-title">PAYSLIP / SALARY SLIP</div>
        <div class="period-tag">${periodLabel}</div>
      </div>
      <div class="info-grid">
        <div class="info-row"><span class="info-label">Staff Name:</span><span class="info-value">${record.name || '—'}</span></div>
        <div class="info-row"><span class="info-label">Pay Date:</span><span class="info-value">${new Date().toLocaleDateString('en-IN')}</span></div>
        <div class="info-row"><span class="info-label">Working Days:</span><span class="info-value">${record.workingDays || 26}</span></div>
        <div class="info-row"><span class="info-label">Present Days:</span><span class="info-value">${record.present || 0}</span></div>
        <div class="info-row"><span class="info-label">Absent Days:</span><span class="info-value">${record.absent || 0}</span></div>
        <div class="info-row"><span class="info-label">Per Day Rate:</span><span class="info-value">₹${Number(record.perDay || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })} / day</span></div>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width: 32%;">Earnings</th><th class="tar" style="width: 18%;">Amount</th>
            <th style="width: 32%;">Deductions</th><th class="tar" style="width: 18%;">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Basic Salary</td>
            <td class="tar">₹${baseAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
            <td>Absenteeism Deduction</td>
            <td class="tar ${deduction > 0 ? 'danger' : ''}">${deduction > 0 ? '− ₹' + deduction.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '—'}</td>
          </tr>
          <tr>
            <td></td><td></td>
            <td>Advance Recovery</td>
            <td class="tar ${advanceDeduction > 0 ? 'danger' : ''}">${advanceDeduction > 0 ? '− ₹' + advanceDeduction.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '—'}</td>
          </tr>
          <tr class="total-row">
            <td>Total Gross Earnings</td>
            <td class="tar">₹${baseAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
            <td>Total Deductions</td>
            <td class="tar ${totalDeductions > 0 ? 'danger' : ''}">${totalDeductions > 0 ? '− ₹' + totalDeductions.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '—'}</td>
          </tr>
        </tbody>
      </table>

      <div class="net-box">
        <div>
          <div class="net-label">NET SALARY PAYABLE</div>
          <div class="net-words">${amountInWords(netAmount)}</div>
        </div>
        <div class="net-amount">₹${netAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
      </div>

      <div class="signatures">
        <div class="sig-line">Employee Signature</div>
        <div class="sig-line">Authorised Signatory</div>
      </div>
    </div>
  </body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => { w.print(); }, 250);
}

export async function downloadSlipPdf(record, period, companyName = 'MeraDhanda CRM') {
  try {
    const [{ default: pdfMake }, { default: pdfFonts }] = await Promise.all([
      import('pdfmake/build/pdfmake'),
      import('pdfmake/build/vfs_fonts'),
    ]);
    pdfMake.vfs = pdfFonts.pdfMake && pdfFonts.pdfMake.vfs;

    const baseAmount = Number(record.gross || record.base || 0);
    const deduction = Number(record.deduction || 0);
    const advanceDeduction = Number(record.advanceDeduction || 0);
    const totalDeductions = deduction + advanceDeduction;
    const netAmount = Number(record.net || 0);
    const periodLabel = formatPeriodLabel(period);

    const doc = {
      pageSize: 'A4',
      pageMargins: [36, 36, 36, 36],
      content: [
        { text: companyName.toUpperCase(), style: 'companyHeader' },
        { text: 'SALARY SLIP / PAYSLIP', style: 'docTitle' },
        { text: `Pay Period: ${periodLabel}`, style: 'subTitle' },
        { text: '', margin: [0, 8] },

        // Employee Info Table
        {
          table: {
            widths: ['25%', '25%', '25%', '25%'],
            body: [
              [
                { text: 'Employee Name:', bold: true, fillColor: '#f8fafc' },
                { text: record.name || '—' },
                { text: 'Pay Date:', bold: true, fillColor: '#f8fafc' },
                { text: new Date().toLocaleDateString('en-IN') }
              ],
              [
                { text: 'Total Days:', bold: true, fillColor: '#f8fafc' },
                { text: `${record.workingDays || 26} days` },
                { text: 'Days Present:', bold: true, fillColor: '#f8fafc' },
                { text: `${record.present || 0} days` }
              ],
              [
                { text: 'Days Absent:', bold: true, fillColor: '#f8fafc' },
                { text: `${record.absent || 0} days` },
                { text: 'Per Day Rate:', bold: true, fillColor: '#f8fafc' },
                { text: `₹ ${Number(record.perDay || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` }
              ]
            ]
          },
          layout: {
            hLineWidth: () => 0.5,
            vLineWidth: () => 0.5,
            hLineColor: () => '#cbd5e1',
            vLineColor: () => '#cbd5e1'
          }
        },
        { text: '', margin: [0, 8] },

        // Earnings and Deductions Table
        {
          table: {
            widths: ['35%', '15%', '35%', '15%'],
            body: [
              [
                { text: 'EARNINGS', bold: true, fillColor: '#f1f5f9' },
                { text: 'AMOUNT', bold: true, alignment: 'right', fillColor: '#f1f5f9' },
                { text: 'DEDUCTIONS', bold: true, fillColor: '#f1f5f9' },
                { text: 'AMOUNT', bold: true, alignment: 'right', fillColor: '#f1f5f9' }
              ],
              [
                { text: 'Basic Salary' },
                { text: `₹ ${baseAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, alignment: 'right' },
                { text: 'Absenteeism Deduction' },
                { text: deduction > 0 ? `₹ ${deduction.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—', alignment: 'right', color: deduction > 0 ? '#b91c1c' : '#000' }
              ],
              [
                { text: '' },
                { text: '' },
                { text: 'Advance Recovery' },
                { text: advanceDeduction > 0 ? `₹ ${advanceDeduction.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—', alignment: 'right', color: advanceDeduction > 0 ? '#b91c1c' : '#000' }
              ],
              [
                { text: 'Total Gross Earnings', bold: true, fillColor: '#f8fafc' },
                { text: `₹ ${baseAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, bold: true, alignment: 'right', fillColor: '#f8fafc' },
                { text: 'Total Deductions', bold: true, fillColor: '#f8fafc' },
                { text: totalDeductions > 0 ? `₹ ${totalDeductions.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—', bold: true, alignment: 'right', fillColor: '#f8fafc', color: totalDeductions > 0 ? '#b91c1c' : '#000' }
              ]
            ]
          },
          layout: {
            hLineWidth: () => 0.5,
            vLineWidth: () => 0.5,
            hLineColor: () => '#cbd5e1',
            vLineColor: () => '#cbd5e1'
          }
        },
        { text: '', margin: [0, 10] },

        // Net Pay Box
        {
          table: {
            widths: ['70%', '30%'],
            body: [
              [
                {
                  stack: [
                    { text: 'NET SALARY PAYABLE', bold: true, fontSize: 11, color: '#1e293b' },
                    { text: amountInWords(netAmount), italics: true, fontSize: 9.5, color: '#475569', margin: [0, 4, 0, 0] }
                  ],
                  fillColor: '#f0fdf4'
                },
                {
                  text: `₹ ${netAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
                  bold: true,
                  fontSize: 14,
                  color: '#15803d',
                  alignment: 'right',
                  fillColor: '#f0fdf4',
                  margin: [0, 4, 0, 0]
                }
              ]
            ]
          },
          layout: {
            hLineWidth: () => 1,
            vLineWidth: () => 1,
            hLineColor: () => '#86efac',
            vLineColor: () => '#86efac'
          }
        },

        { text: '', margin: [0, 36] },

        // Signatures
        {
          columns: [
            {
              width: '50%',
              stack: [
                { text: '_______________________________', color: '#94a3b8' },
                { text: 'Employee Signature', fontSize: 10, margin: [0, 4, 0, 0] }
              ]
            },
            {
              width: '50%',
              alignment: 'right',
              stack: [
                { text: '_______________________________', color: '#94a3b8' },
                { text: 'Authorised Signatory', fontSize: 10, margin: [0, 4, 0, 0] }
              ]
            }
          ]
        }
      ],
      styles: {
        companyHeader: { fontSize: 18, bold: true, alignment: 'center', color: '#0f172a' },
        docTitle: { fontSize: 12, bold: true, alignment: 'center', color: '#475569', margin: [0, 3, 0, 2] },
        subTitle: { fontSize: 10, alignment: 'center', color: '#64748b' }
      }
    };

    const cleanName = (record.name || 'Staff').replace(/[^\w.-]+/g, '_');
    const cleanPeriod = (period?.month || period?.from || 'slip').replace(/[^\w.-]+/g, '_');
    pdfMake.createPdf(doc).download(`Payslip_${cleanName}_${cleanPeriod}.pdf`);
  } catch (err) {
    console.error('Error generating PDF slip:', err);
    window.print();
  }
}

export default function StaffSalarySlipModal({ open, onClose, record, period, company }) {
  const t = useT(S);
  const [historySlips, setHistorySlips] = useState([]);
  const [activeRecord, setActiveRecord] = useState(record);
  const [activePeriod, setActivePeriod] = useState(period);
  const companyName = company || 'Mr Print World';

  useEffect(() => {
    setActiveRecord(record);
    setActivePeriod(period);
  }, [record, period]);

  useEffect(() => {
    if (!open || !record?.userId) return;
    hrApi.payrollSlips({ userId: record.userId })
      .then((data) => {
        setHistorySlips(Array.isArray(data) ? data : []);
      })
      .catch(() => setHistorySlips([]));
  }, [open, record?.userId]);

  if (!open || !activeRecord) return null;

  const baseAmount = Number(activeRecord.gross || activeRecord.base || 0);
  const deduction = Number(activeRecord.deduction || 0);
  const advanceDeduction = Number(activeRecord.advanceDeduction || 0);
  const totalDeductions = deduction + advanceDeduction;
  const netAmount = Number(activeRecord.net || 0);
  const periodLabel = formatPeriodLabel(activePeriod);

  const selectHistorySlip = (slip) => {
    setActiveRecord(slip);
    setActivePeriod({ month: slip.month, isCustom: false });
  };

  const selectCurrentSlip = () => {
    setActiveRecord(record);
    setActivePeriod(period);
  };

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '40px 16px 24px',
        overflowY: 'auto',
        backdropFilter: 'blur(3px)',
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{
          maxWidth: 680,
          width: '100%',
          maxHeight: '92vh',
          overflowY: 'auto',
          position: 'relative',
          padding: 24,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Actions */}
        <div className="flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 12, marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <div className="flex items-center gap-2">
            <span style={{ fontSize: 18 }}>📄</span>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{t('title')}</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn btn-sm btn-outline"
              style={{ fontSize: 12 }}
              onClick={() => printSlip(activeRecord, activePeriod, companyName)}
            >
              🖨️ {t('print')}
            </button>
            <button
              type="button"
              className="btn btn-sm btn-primary"
              style={{ fontSize: 12 }}
              onClick={() => downloadSlipPdf(activeRecord, activePeriod, companyName)}
            >
              📥 {t('downloadPdf')}
            </button>
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={onClose}
              style={{ fontSize: 16, padding: '2px 8px' }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* History Switcher Tabs if past slips exist */}
        {historySlips.length > 0 && (
          <div style={{ marginBottom: 14, background: 'var(--bg2)', padding: '6px 10px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)' }}>{t('historyTitle')}:</span>
            <button
              type="button"
              className={'btn btn-xs ' + (activeRecord === record ? 'btn-primary' : 'btn-ghost')}
              style={{ fontSize: 11, padding: '2px 8px' }}
              onClick={selectCurrentSlip}
            >
              {t('currentSlip')} ({formatPeriodLabel(period)})
            </button>
            {historySlips.map((s) => (
              <button
                key={s.id || s._id}
                type="button"
                className={'btn btn-xs ' + (activeRecord === s ? 'btn-primary' : 'btn-ghost')}
                style={{ fontSize: 11, padding: '2px 8px' }}
                onClick={() => selectHistorySlip(s)}
              >
                {s.month}
              </button>
            ))}
          </div>
        )}

        {/* The Printable Slip Container */}
        <div style={{ border: '1px solid var(--border)', borderRadius: 6, padding: 20, background: 'var(--card-bg, #fff)' }}>
          {/* Header */}
          <div style={{ textAlign: 'center', borderBottom: '2px solid var(--border)', paddingBottom: 12, marginBottom: 16 }}>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {companyName}
            </h2>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginTop: 4 }}>
              SALARY SLIP / PAYSLIP
            </div>
            <div style={{ display: 'inline-block', background: 'var(--bg2)', padding: '2px 10px', borderRadius: 12, fontSize: 11.5, fontWeight: 600, marginTop: 6 }}>
              {periodLabel}
            </div>
          </div>

          {/* Employee Info Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px 16px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 6, padding: 12, marginBottom: 16, fontSize: 12 }}>
            <div className="flex justify-between">
              <span style={{ color: 'var(--text3)' }}>{t('staffName')}:</span>
              <b>{activeRecord.name}</b>
            </div>
            <div className="flex justify-between">
              <span style={{ color: 'var(--text3)' }}>{t('payDate')}:</span>
              <b>{new Date().toLocaleDateString('en-IN')}</b>
            </div>
            <div className="flex justify-between">
              <span style={{ color: 'var(--text3)' }}>{t('workingDays')}:</span>
              <b>{activeRecord.workingDays || 26} days</b>
            </div>
            <div className="flex justify-between">
              <span style={{ color: 'var(--text3)' }}>{t('presentDays')}:</span>
              <b style={{ color: 'var(--green)' }}>{activeRecord.present || 0} days</b>
            </div>
            <div className="flex justify-between">
              <span style={{ color: 'var(--text3)' }}>{t('absentDays')}:</span>
              <b style={{ color: activeRecord.absent ? 'var(--red)' : 'inherit' }}>{activeRecord.absent || 0} days</b>
            </div>
            <div className="flex justify-between">
              <span style={{ color: 'var(--text3)' }}>{t('perDayRate')}:</span>
              <b>{inr(activeRecord.perDay)} / day</b>
            </div>
          </div>

          {/* Earnings & Deductions Table */}
          <table className="crm-table" style={{ width: '100%', marginBottom: 16, fontSize: 12.5 }}>
            <thead>
              <tr>
                <th style={{ width: '32%' }}>{t('earnings')}</th>
                <th style={{ width: '18%', textAlign: 'right' }}>Amount</th>
                <th style={{ width: '32%' }}>{t('deductions')}</th>
                <th style={{ width: '18%', textAlign: 'right' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{t('basicSalary')}</td>
                <td style={{ textAlign: 'right' }}>{inr(baseAmount)}</td>
                <td>{t('absentCut')}</td>
                <td style={{ textAlign: 'right', color: deduction > 0 ? 'var(--red)' : 'inherit' }}>
                  {deduction > 0 ? `− ${inr(deduction)}` : '—'}
                </td>
              </tr>
              <tr>
                <td></td>
                <td></td>
                <td>{t('advanceCut')}</td>
                <td style={{ textAlign: 'right', color: advanceDeduction > 0 ? 'var(--red)' : 'inherit' }}>
                  {advanceDeduction > 0 ? `− ${inr(advanceDeduction)}` : '—'}
                </td>
              </tr>
              <tr style={{ fontWeight: 700, borderTop: '1.5px solid var(--border)', background: 'var(--bg2)' }}>
                <td>{t('grossEarnings')}</td>
                <td style={{ textAlign: 'right' }}>{inr(baseAmount)}</td>
                <td>{t('totalDeduct')}</td>
                <td style={{ textAlign: 'right', color: totalDeductions > 0 ? 'var(--red)' : 'inherit' }}>
                  {totalDeductions > 0 ? `− ${inr(totalDeductions)}` : '—'}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Net Pay Highlight Box */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg2)', border: '1.5px solid var(--green, #10b981)', borderRadius: 6, padding: '12px 16px', marginBottom: 24, flexWrap: 'wrap', gap: 10 }}>
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--green, #10b981)' }}>
                {t('netPayable')}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text2)', fontStyle: 'italic', marginTop: 2 }}>
                {amountInWords(netAmount)}
              </div>
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--green, #10b981)' }}>
              {inr(netAmount)}
            </div>
          </div>

          {/* Signatures */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 40, padding: '0 10px' }}>
            <div style={{ borderTop: '1px solid var(--border)', width: 160, textAlign: 'center', paddingTop: 6, fontSize: 11, color: 'var(--text3)' }}>
              {t('empSignature')}
            </div>
            <div style={{ borderTop: '1px solid var(--border)', width: 160, textAlign: 'center', paddingTop: 6, fontSize: 11, color: 'var(--text3)' }}>
              {t('authSignatory')}
            </div>
          </div>
        </div>

        {/* Modal Bottom Buttons */}
        <div className="flex justify-end gap-2" style={{ marginTop: 18 }}>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            {t('close')}
          </button>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => printSlip(activeRecord, activePeriod, companyName)}
          >
            🖨️ {t('print')}
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => downloadSlipPdf(activeRecord, activePeriod, companyName)}
          >
            📥 {t('downloadPdf')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
