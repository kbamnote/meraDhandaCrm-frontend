/**
 * DailyReportsPage — Daily End-of-Day (EOD) work reports for all staff and admin.
 *
 * Capabilities:
 * - Every staff member submits their daily work report at the end of the day.
 * - Staff can review their past submitted reports, view admin remarks, and edit today's report.
 * - Admin, HR, and Managers can view reports from all staff for any date or date range.
 * - Displays live metrics: Total Staff, Submitted Count, Pending Count, and a list of staff
 *   who have not submitted their report yet.
 * - Admin can acknowledge / mark reports as reviewed with remarks.
 * - Print daily summary for documentation / management review.
 */
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useT } from '../i18n/LanguageContext';
import { hrApi, meApi } from '../services/api';
import { showToast } from '../components/common/toast';

const S = {
  title:          { en: '📝 Daily Work Reports', hi: '📝 दैनिक कार्य रिपोर्ट', hinglish: '📝 Daily Work Reports', gu: '📝 દૈનિક કાર્ય રિપોર્ટ', mr: '📝 दैनिक काम अहवाल', mwr: '📝 दैनिक काम री रिपोर्ट' },
  subtitle:       { en: 'End-of-day staff reporting & team work overview', hi: 'स्टाफ की दिन के अंत की रिपोर्ट और टीम कार्य अवलोकन', hinglish: 'Staff end-of-day reporting & team overview', gu: 'સ્ટાફનો દિવસના અંતનો રિપોર્ટ', mr: 'कर्मचारी दैनिक अहवाल आणि आढावा', mwr: 'स्टाफ री दिन रा अंत री रिपोर्ट' },
  tabTeam:        { en: '👥 Team Reports', hi: '👥 सभी स्टाफ रिपोर्ट', hinglish: '👥 Team Reports', gu: '👥 ટીમ રિપોર્ટ', mr: '👥 टीम अहवाल', mwr: '👥 टीम रिपोर्ट' },
  tabMy:          { en: '✍️ Submit My Report', hi: '✍️ मेरी रिपोर्ट', hinglish: '✍️ Submit My Report', gu: '✍️ મારો રિપોર્ટ', mr: '✍️ माझा अहवाल', mwr: '✍️ म्हारी रिपोर्ट' },
  today:          { en: 'Today', hi: 'आज', hinglish: 'Today', gu: 'આજે', mr: 'आज', mwr: 'आज' },
  yesterday:      { en: 'Yesterday', hi: 'कल', hinglish: 'Yesterday', gu: 'ગઈકાલે', mr: 'काल', mwr: 'काल' },
  date:           { en: 'Report Date', hi: 'रिपोर्ट तारीख', hinglish: 'Report Date', gu: 'તારીખ', mr: 'दिनांक', mwr: 'तारीख' },
  summary:        { en: 'Work Done Today (Summary)', hi: 'आज क्या काम किया? (विवरण)', hinglish: 'Aaj kya kaam kiya? (Summary)', gu: 'આજે શું કામ કર્યું?', mr: 'आज काय काम केले? (तपशील)', mwr: 'आज कांई काम कियो? (विवरण)' },
  summaryPlh:     { en: 'List your accomplishments, completed jobs, designs, customer calls, or tasks handled today...', hi: 'आज किए गए कार्य, पूर्ण जॉब्स, डिजाइन, ग्राहक कॉल या हैंडल किए गए काम लिखें...', hinglish: 'Aaj jo kaam kiya, completed jobs, designs ya calls likhein...', gu: 'આજે પૂર્ણ કરેલ કામ, જોબ્સ, ડિઝાઇન લખો...', mr: 'आज पूर्ण केलेले काम, जॉब्स, डिझाइन, कॉल्स लिहा...', mwr: 'आज कियोड़ा काम, पूरा जॉब्स, डिजाइन लिखो...' },
  hours:          { en: 'Hours Worked', hi: 'कार्य घंटे', hinglish: 'Hours Worked', gu: 'કામના કલાકો', mr: 'कामाचे तास', mwr: 'काम रा घंटा' },
  tasksCompleted: { en: 'Tasks / Job IDs Completed (Optional)', hi: 'पूर्ण किए गए जॉब कार्ड / टास्क (वैकल्पिक)', hinglish: 'Tasks / Job IDs (Optional)', gu: 'પૂર્ણ થયેલ જોબ્સ / ટાસ્ક', mr: 'पूर्ण केलेले जॉब्स / टास्क', mwr: 'पूरा कियोड़ा जॉब्स' },
  blockers:       { en: 'Challenges / Blockers Faced (Optional)', hi: 'कोई समस्या या रुकावट? (वैकल्पिक)', hinglish: 'Koi issue ya challenge? (Optional)', gu: 'કોઈ મુશ્કેલી કે સમસ્યા?', mr: 'काही अडचणी किंवा अडथळे? (ऐच्छिक)', mwr: 'कोई अड़चन या दिक्कत?' },
  blockersPlh:    { en: 'Machine issues, delays, pending client feedback, materials needed...', hi: 'मशीन समस्या, देरी, पेंडिंग अप्रूवल, सामग्री की जरूरत...', hinglish: 'Machine issue, delay, pending approval ya koi zaroorat...', gu: 'મશીન સમસ્યા, સામગ્રીની જરૂરિયાત...', mr: 'मशीन समस्या, विलंब, मंजुरी प्रलंबित...', mwr: 'मशीन री दिक्कत, देरी...' },
  planTomorrow:   { en: 'Plan for Tomorrow (Optional)', hi: 'कल की योजना (वैकल्पिक)', hinglish: 'Kal ka plan (Optional)', gu: 'આવતીકાલનું આયોજન', mr: 'उद्याचे नियोजन (ऐच्छिक)', mwr: 'काल रो प्लान' },
  planPlh:        { en: 'Top priorities to focus on tomorrow...', hi: 'कल सबसे पहले क्या करेंगे...', hinglish: 'Kal ke priority kaam...', gu: 'આવતીકાલે શું કરશો...', mr: 'उद्या करावयाची कामे...', mwr: 'काल रा जरूरी काम...' },
  submitBtn:      { en: 'Submit Daily Report', hi: 'दैनिक रिपोर्ट सबमिट करें', hinglish: 'Daily Report Submit karein', gu: 'રિપોર્ટ સબમિટ કરો', mr: 'अहवाल सबमिट करा', mwr: 'रिपोर्ट सबमिट करो' },
  updateBtn:      { en: 'Update Report', hi: 'रिपोर्ट अपडेट करें', hinglish: 'Report Update karein', gu: 'રિપોર્ટ અપડેટ કરો', mr: 'अहवाल अपडेट करा', mwr: 'रिपोर्ट अपडेट करो' },
  submittedOn:    { en: 'Submitted on', hi: 'सबमिट किया गया', hinglish: 'Submitted on', gu: 'સબમિટ કરેલ', mr: 'सबमिट केले', mwr: 'सबमिट कियो गयो' },
  notSubmittedYet:{ en: 'Not submitted yet for this date', hi: 'इस तारीख की रिपोर्ट अभी सबमिट नहीं हुई है', hinglish: 'Is date ki report abhi submit nahi hui', gu: 'આ તારીખ માટે રિપોર્ટ હજુ સબમિટ નથી થયો', mr: 'या तारखेचा अहवाल अद्याप सबमिट केलेला नाही', mwr: 'इण तारीख री रिपोर्ट अजे तांई सबमिट कोनी हुई' },
  saveSuccess:    { en: 'Daily report saved successfully!', hi: 'दैनिक रिपोर्ट सफलतापूर्वक सेव हो गई!', hinglish: 'Daily report successfully save ho gayi!', gu: 'રિપોર્ટ સફળતાપૂર્વક સાચવવામાં આવ્યો!', mr: 'दैनिक अहवाल यशस्वीरीत्या जतन केला!', mwr: 'दैनिक रिपोर्ट ठीक सूं सेव हो गी!' },
  totalStaff:     { en: 'Total Staff', hi: 'कुल स्टाफ', hinglish: 'Total Staff', gu: 'કુલ સ્ટાફ', mr: 'एकूण कर्मचारी', mwr: 'कुल स्टाफ' },
  submittedCount: { en: 'Submitted Today', hi: 'रिपोर्ट आ गई', hinglish: 'Report aa gayi', gu: 'રિપોર્ટ આવ્યા', mr: 'अहवाल आले', mwr: 'रिपोर्ट आई' },
  pendingCount:   { en: 'Pending Submission', hi: 'रिपोर्ट बाकी', hinglish: 'Report baki', gu: 'રિપોર્ટ બાકી', mr: 'अहवाल प्रलंबित', mwr: 'रिपोर्ट बाकी' },
  missingAlert:   { en: 'Staff members who have not submitted yet for this date:', hi: 'जिन स्टाफ ने अभी तक इस तारीख की रिपोर्ट सबमिट नहीं की:', hinglish: 'Jin staff ne abhi tak report submit nahi ki:', gu: 'જે સ્ટાફે હજુ રિપોર્ટ સબમિટ નથી કર્યો:', mr: 'ज्या कर्मचाऱ्यांनी अद्याप अहवाल सबमिट केलेला नाही:', mwr: 'जिण स्टाफ अजे तांई रिपोर्ट कोनी दी:' },
  filterStaff:    { en: 'Staff Filter', hi: 'स्टाफ चुनें', hinglish: 'Staff Filter', gu: 'સ્ટાફ પસંદ કરો', mr: 'कर्मचारी निवडा', mwr: 'स्टाफ चुणो' },
  allStaff:       { en: 'All Staff Members', hi: 'सभी स्टाफ', hinglish: 'All Staff', gu: 'બધા સ્ટાફ', mr: 'सर्व कर्मचारी', mwr: 'सगळा स्टाफ' },
  filterDept:     { en: 'Department', hi: 'विभाग', hinglish: 'Department', gu: 'વિભાગ', mr: 'विभाग', mwr: 'विभाग' },
  allDepts:       { en: 'All Departments', hi: 'सभी विभाग', hinglish: 'All Departments', gu: 'બધા વિભાગો', mr: 'सर्व विभाग', mwr: 'सगळा विभाग' },
  filterStatus:   { en: 'Status', hi: 'स्थिति', hinglish: 'Status', gu: 'સ્થિતિ', mr: 'स्थिती', mwr: 'हालत' },
  allStatus:      { en: 'All Statuses', hi: 'सभी', hinglish: 'All Status', gu: 'બધા', mr: 'सर्व', mwr: 'सगळा' },
  submittedOnly:  { en: 'Submitted Only', hi: 'केवल सबमिट हुए', hinglish: 'Submitted Only', gu: 'ફક્ત સબમિટ', mr: 'फक्त सबमिट', mwr: 'बस सबमिट' },
  pendingOnly:    { en: 'Pending Only', hi: 'केवल बाकी', hinglish: 'Pending Only', gu: 'ફક્ત બાકી', mr: 'फक्त प्रलंबित', mwr: 'बस बाकी' },
  noReports:      { en: 'No daily reports found for this date.', hi: 'इस तारीख के लिए कोई रिपोर्ट नहीं मिली।', hinglish: 'Is date ke liye koi report nahi mili.', gu: 'કોઈ રિપોર્ટ મળ્યો નથી.', mr: 'या तारखेसाठी कोणताही अहवाल आढळला नाही.', mwr: 'इण तारीख री कोई रिपोर्ट कोनी मिली।' },
  printSummary:   { en: 'Print Daily Summary', hi: 'दैनिक समरी प्रिंट करें', hinglish: 'Summary print karein', gu: 'પ્રિન્ટ સમરી', mr: 'समरी प्रिंट करा', mwr: 'समरी प्रिंट करो' },
  markReviewed:   { en: 'Acknowledge / Mark Reviewed', hi: 'समीक्षा करें / मार्क करें', hinglish: 'Mark Reviewed karein', gu: 'રીવ્યૂ કરો', mr: 'तपासले म्हणून चिन्हांकित करा', mwr: 'मार्क करो' },
  reviewedBy:     { en: 'Reviewed by', hi: 'समीक्षा की', hinglish: 'Reviewed by', gu: 'રીવ્યૂ કરનાર', mr: 'तपासले', mwr: 'समीक्षा करी' },
  remarkPlh:      { en: 'Add an acknowledgment or note (e.g. Well done, follow up on XYZ)...', hi: 'कोई टिप्पणी लिखें (जैसे: बहुत बढ़िया, XYZ पर ध्यान दें)...', hinglish: 'Koi note ya remark likhein...', gu: 'કોઈ નોંધ લખો...', mr: 'काही शेरा लिहा...', mwr: 'कोई बात लिखो...' },
  saveRemark:     { en: 'Save Remark', hi: 'रिमार्क सेव करें', hinglish: 'Remark Save karein', gu: 'નોંધ સાચવો', mr: 'शेरा जतन करा', mwr: 'रिमार्क सेव करो' },
  myHistory:      { en: 'My Past Submitted Reports', hi: 'मेरी पिछली रिपोर्ट्स', hinglish: 'My Past Reports', gu: 'મારી અગાઉની રિપોર્ટ્સ', mr: 'माझे मागील अहवाल', mwr: 'म्हारी पैली री रिपोर्ट' },
};

function getTodayIST() {
  const d = new Date(Date.now() + 19800000);
  return d.toISOString().slice(0, 10);
}

function getYesterdayIST() {
  const d = new Date(Date.now() + 19800000 - 86400000);
  return d.toISOString().slice(0, 10);
}

function printTeamReports(reports, date, companyName) {
  const w = window.open('', '_blank', 'width=900,height=700');
  if (!w) {
    window.print();
    return;
  }

  w.document.write(`<!DOCTYPE html><html><head>
    <title>Daily Work Reports - ${date}</title>
    <style>
      @page { size: A4; margin: 15mm; }
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #0f172a; margin: 0; padding: 20px; font-size: 13px; line-height: 1.5; }
      .header { border-bottom: 2px solid #cbd5e1; padding-bottom: 12px; margin-bottom: 20px; text-align: center; }
      .company { font-size: 22px; font-weight: 800; text-transform: uppercase; margin: 0; }
      .title { font-size: 14px; font-weight: 600; color: #475569; margin-top: 4px; }
      .date-badge { display: inline-block; background: #e2e8f0; padding: 3px 12px; border-radius: 12px; font-weight: 700; margin-top: 6px; }
      .report-card { border: 1px solid #cbd5e1; border-radius: 6px; padding: 14px 18px; margin-bottom: 16px; page-break-inside: avoid; background: #f8fafc; }
      .card-header { display: flex; justify-content: space-between; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 10px; }
      .staff-name { font-size: 15px; font-weight: 700; color: #1e293b; }
      .staff-role { font-size: 12px; color: #64748b; }
      .section-label { font-weight: 700; font-size: 11.5px; color: #334155; text-transform: uppercase; margin-top: 8px; margin-bottom: 2px; }
      .section-content { white-space: pre-wrap; font-size: 12.5px; }
      .blocker-box { background: #fef2f2; border: 1px solid #fecaca; border-radius: 4px; padding: 8px 12px; margin-top: 8px; color: #991b1b; }
      .remark-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 4px; padding: 8px 12px; margin-top: 8px; color: #166534; font-size: 12px; }
      @media print { body { padding: 0; } }
    </style>
  </head><body>
    <div class="header">
      <h1 class="company">${companyName}</h1>
      <div class="title">STAFF DAILY WORK REPORTS</div>
      <div class="date-badge">${date} · Total Reports: ${reports.length}</div>
    </div>
    ${!reports.length ? '<p style="text-align: center; color: #64748b;">No daily reports submitted for this date.</p>' : ''}
    ${reports.map((r, i) => `
      <div class="report-card">
        <div class="card-header">
          <div>
            <div class="staff-name">${i + 1}. ${r.userName || 'Staff'}</div>
            <div class="staff-role">${r.userRole || ''}${r.department ? ` · ${r.department}` : ''}</div>
          </div>
          <div style="text-align: right; font-size: 12px; color: #64748b;">
            ${r.hoursWorked ? `<b>${r.hoursWorked} hrs</b> · ` : ''}${new Date(r.createdAt || r.updatedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
        <div class="section-label">Work Done Today:</div>
        <div class="section-content">${r.summary || '—'}</div>
        ${r.tasksCompleted ? `<div class="section-label">Tasks / Job IDs:</div><div class="section-content">${r.tasksCompleted}</div>` : ''}
        ${r.blockers ? `<div class="blocker-box"><b>Challenges / Blockers:</b> ${r.blockers}</div>` : ''}
        ${r.planTomorrow ? `<div class="section-label">Plan for Tomorrow:</div><div class="section-content">${r.planTomorrow}</div>` : ''}
        ${r.reviewed ? `<div class="remark-box"><b>✓ Reviewed by ${r.reviewedByName || 'Admin'}:</b> ${r.reviewerRemark || 'Reviewed'}</div>` : ''}
      </div>
    `).join('')}
  </body></html>`);

  w.document.close();
  w.focus();
  setTimeout(() => { w.print(); }, 250);
}

export default function DailyReportsPage() {
  const t = useT(S);
  const { profile, tenant } = useAuth();
  const isAdminOrManager = ['admin', 'owner', 'superadmin', 'hr', 'manager'].includes(profile?.role);

  // Tabs: 'team' | 'submit'
  const [activeTab, setActiveTab] = useState(isAdminOrManager ? 'team' : 'submit');

  // Submit form state
  const [selectedDate, setSelectedDate] = useState(getTodayIST());
  const [formSummary, setFormSummary] = useState('');
  const [formHours, setFormHours] = useState('8');
  const [formTasks, setFormTasks] = useState('');
  const [formBlockers, setFormBlockers] = useState('');
  const [formPlan, setFormPlan] = useState('');
  const [existingReport, setExistingReport] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [myHistory, setMyHistory] = useState([]);

  // Team reports view state (Admin)
  const [teamDate, setTeamDate] = useState(getTodayIST());
  const [teamFilterStaff, setTeamFilterStaff] = useState('');
  const [teamFilterDept, setTeamFilterDept] = useState('');
  const [teamFilterStatus, setTeamFilterStatus] = useState('all'); // 'all' | 'submitted' | 'pending'
  const [teamData, setTeamData] = useState({
    reports: [],
    totalStaff: 0,
    submittedCount: 0,
    pendingCount: 0,
    missingStaff: [],
  });
  const [teamLoading, setTeamLoading] = useState(false);
  const [reviewRemarkDraft, setReviewRemarkDraft] = useState({});
  const [activeReviewId, setActiveReviewId] = useState(null);

  // Load caller's own report for selectedDate
  const loadMyReportForDate = useCallback(async (date) => {
    try {
      const reports = await meApi.dailyReports();
      setMyHistory(Array.isArray(reports) ? reports : []);
      const match = (reports || []).find((r) => r.date === date);
      if (match) {
        setExistingReport(match);
        setFormSummary(match.summary || '');
        setFormHours(String(match.hoursWorked || '8'));
        setFormTasks(match.tasksCompleted || '');
        setFormBlockers(match.blockers || '');
        setFormPlan(match.planTomorrow || '');
      } else {
        setExistingReport(null);
        setFormSummary('');
        setFormHours('8');
        setFormTasks('');
        setFormBlockers('');
        setFormPlan('');
      }
    } catch {
      // Ignore
    }
  }, []);

  useEffect(() => {
    loadMyReportForDate(selectedDate);
  }, [selectedDate, loadMyReportForDate]);

  // Load team reports for admin
  const loadTeamReports = useCallback(async () => {
    if (!isAdminOrManager) return;
    setTeamLoading(true);
    try {
      const params = { date: teamDate };
      if (teamFilterStaff) params.userId = teamFilterStaff;
      if (teamFilterDept) params.department = teamFilterDept;
      const res = await hrApi.dailyReports(params);
      setTeamData(res || { reports: [], totalStaff: 0, submittedCount: 0, pendingCount: 0, missingStaff: [] });
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to load team daily reports', 'error');
    } finally {
      setTeamLoading(false);
    }
  }, [isAdminOrManager, teamDate, teamFilterStaff, teamFilterDept]);

  useEffect(() => {
    if (activeTab === 'team' && isAdminOrManager) {
      loadTeamReports();
    }
  }, [activeTab, isAdminOrManager, loadTeamReports]);

  // Submit handler for staff
  const handleSubmitMyReport = async (e) => {
    e.preventDefault();
    if (!formSummary.trim()) {
      showToast('Please describe your work done today', 'error');
      return;
    }
    setIsSubmitting(true);
    try {
      await meApi.submitDailyReport({
        date: selectedDate,
        summary: formSummary.trim(),
        hoursWorked: Number(formHours) || 0,
        tasksCompleted: formTasks.trim(),
        blockers: formBlockers.trim(),
        planTomorrow: formPlan.trim(),
      });
      showToast(t('saveSuccess'), 'success');
      await loadMyReportForDate(selectedDate);
      if (isAdminOrManager) {
        loadTeamReports();
      }
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to save daily report', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Review handler for admin
  const handleSaveReview = async (reportId) => {
    const remark = reviewRemarkDraft[reportId];
    try {
      await hrApi.reviewDailyReport(reportId, { remark });
      showToast('Report reviewed successfully', 'success');
      setActiveReviewId(null);
      loadTeamReports();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to submit review', 'error');
    }
  };

  // Extract unique departments from team data
  const departments = Array.from(new Set([
    ...teamData.reports.map((r) => r.department).filter(Boolean),
    ...teamData.missingStaff.map((s) => s.department).filter(Boolean),
  ]));

  // Filtered reports for view
  let filteredReports = teamData.reports;
  if (teamFilterStatus === 'submitted') {
    filteredReports = teamData.reports;
  }

  const companyName = tenant?.name || 'Mr Print World';

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', paddingBottom: 40 }}>
      {/* Top Header */}
      <div className="flex items-center justify-between" style={{ flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>{t('title')}</h2>
          <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 2 }}>{t('subtitle')}</div>
        </div>

        {/* Tab switchers if admin/manager */}
        {isAdminOrManager && (
          <div className="flex gap-2">
            <button
              type="button"
              className={'btn btn-sm ' + (activeTab === 'team' ? 'btn-primary' : 'btn-ghost')}
              onClick={() => setActiveTab('team')}
            >
              {t('tabTeam')}
            </button>
            <button
              type="button"
              className={'btn btn-sm ' + (activeTab === 'submit' ? 'btn-primary' : 'btn-ghost')}
              onClick={() => setActiveTab('submit')}
            >
              {t('tabMy')}
            </button>
          </div>
        )}
      </div>

      {/* ──────────────── TAB 1: TEAM REPORTS (ADMIN / MANAGER) ──────────────── */}
      {isAdminOrManager && activeTab === 'team' && (
        <div>
          {/* Filter Bar */}
          <div className="card" style={{ marginBottom: 16, padding: 14 }}>
            <div className="flex items-center justify-between" style={{ flexWrap: 'wrap', gap: 12 }}>
              <div className="flex items-center gap-2" style={{ flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className={'btn btn-xs ' + (teamDate === getTodayIST() ? 'btn-primary' : 'btn-ghost')}
                  onClick={() => setTeamDate(getTodayIST())}
                >
                  {t('today')}
                </button>
                <button
                  type="button"
                  className={'btn btn-xs ' + (teamDate === getYesterdayIST() ? 'btn-primary' : 'btn-ghost')}
                  onClick={() => setTeamDate(getYesterdayIST())}
                >
                  {t('yesterday')}
                </button>
                <input
                  type="date"
                  className="input"
                  style={{ width: 145, height: 32, fontSize: 12 }}
                  value={teamDate}
                  onChange={(e) => setTeamDate(e.target.value)}
                />

                {/* Department Filter */}
                {departments.length > 0 && (
                  <select
                    className="input"
                    style={{ width: 150, height: 32, fontSize: 12 }}
                    value={teamFilterDept}
                    onChange={(e) => setTeamFilterDept(e.target.value)}
                  >
                    <option value="">{t('allDepts')}</option>
                    {departments.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                )}

                {/* Status Filter */}
                <select
                  className="input"
                  style={{ width: 140, height: 32, fontSize: 12 }}
                  value={teamFilterStatus}
                  onChange={(e) => setTeamFilterStatus(e.target.value)}
                >
                  <option value="all">{t('allStatus')}</option>
                  <option value="submitted">{t('submittedOnly')}</option>
                  <option value="pending">{t('pendingOnly')}</option>
                </select>
              </div>

              <button
                type="button"
                className="btn btn-sm btn-outline"
                style={{ fontSize: 12 }}
                onClick={() => printTeamReports(teamData.reports, teamDate, companyName)}
              >
                🖨️ {t('printSummary')}
              </button>
            </div>
          </div>

          {/* Submission Status KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
            <div className="card" style={{ padding: '12px 16px', background: 'var(--card-bg, #fff)' }}>
              <div style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 600 }}>{t('totalStaff')}</div>
              <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4 }}>{teamData.totalStaff}</div>
            </div>
            <div className="card" style={{ padding: '12px 16px', background: 'var(--card-bg, #fff)', borderLeft: '4px solid var(--green, #10b981)' }}>
              <div style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 600 }}>{t('submittedCount')}</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--green, #10b981)', marginTop: 4 }}>
                {teamData.submittedCount}
              </div>
            </div>
            <div className="card" style={{ padding: '12px 16px', background: 'var(--card-bg, #fff)', borderLeft: '4px solid var(--amber, #f59e0b)' }}>
              <div style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 600 }}>{t('pendingCount')}</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--amber, #f59e0b)', marginTop: 4 }}>
                {teamData.pendingCount}
              </div>
            </div>
            <div className="card" style={{ padding: '12px 16px', background: 'var(--card-bg, #fff)' }}>
              <div style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 600 }}>Submission Rate</div>
              <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4 }}>
                {teamData.totalStaff > 0 ? Math.round((teamData.submittedCount / teamData.totalStaff) * 100) : 0}%
              </div>
            </div>
          </div>

          {/* Missing / Pending Staff Warning Callout */}
          {teamData.pendingCount > 0 && teamFilterStatus !== 'submitted' && (
            <div className="card" style={{ marginBottom: 16, borderLeft: '4px solid var(--amber, #f59e0b)', background: 'var(--bg2)' }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text1)', marginBottom: 8 }}>
                ⚠️ {t('missingAlert')} ({teamData.pendingCount})
              </div>
              <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
                {teamData.missingStaff.map((s) => (
                  <span
                    key={s.userId}
                    className="badge badge-amber"
                    style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6 }}
                    title={s.phone ? `Phone: ${s.phone}` : ''}
                  >
                    👤 {s.name}{s.role ? ` (${s.role})` : ''}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Submitted Reports Feed */}
          {teamFilterStatus !== 'pending' && (
            <div>
              {teamLoading ? (
                <div style={{ textAlign: 'center', padding: 40 }}><div className="spinner" /></div>
              ) : !filteredReports.length ? (
                <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
                  <div>{t('noReports')}</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {filteredReports.map((r, i) => (
                    <div key={r.id || r._id || i} className="card" style={{ padding: 18, borderLeft: '4px solid var(--primary)' }}>
                      {/* Card Header */}
                      <div className="flex items-center justify-between" style={{ flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                        <div className="flex items-center gap-2">
                          <b style={{ fontSize: 15 }}>{r.userName}</b>
                          {r.userRole && (
                            <span className="badge" style={{ fontSize: 11, background: 'var(--bg2)' }}>{r.userRole}</span>
                          )}
                          {r.department && (
                            <span className="badge" style={{ fontSize: 11, background: 'var(--bg2)' }}>{r.department}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2" style={{ fontSize: 12, color: 'var(--text3)' }}>
                          {r.hoursWorked > 0 && (
                            <span className="badge badge-green" style={{ fontSize: 11 }}>⏱ {r.hoursWorked} hrs</span>
                          )}
                          <span>
                            {new Date(r.createdAt || r.updatedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>

                      {/* Summary of Work Done */}
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 3 }}>
                          Work Accomplished:
                        </div>
                        <div style={{ fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap', color: 'var(--text1)' }}>
                          {r.summary}
                        </div>
                      </div>

                      {/* Tasks / Job IDs */}
                      {r.tasksCompleted && (
                        <div style={{ marginBottom: 10, background: 'var(--bg2)', padding: '8px 12px', borderRadius: 4, fontSize: 12 }}>
                          <span style={{ fontWeight: 600, color: 'var(--text2)' }}>Tasks / Jobs: </span>
                          <span>{r.tasksCompleted}</span>
                        </div>
                      )}

                      {/* Blockers / Issues if any */}
                      {r.blockers && (
                        <div style={{ marginBottom: 10, background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '8px 12px', borderRadius: 4, fontSize: 12, color: 'var(--red)' }}>
                          <b>⚠️ Challenge / Blocker: </b>{r.blockers}
                        </div>
                      )}

                      {/* Tomorrow's Plan */}
                      {r.planTomorrow && (
                        <div style={{ marginBottom: 10, fontSize: 12, color: 'var(--text2)' }}>
                          <b>Next Day Plan: </b>{r.planTomorrow}
                        </div>
                      )}

                      {/* Admin Review / Acknowledgment */}
                      <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                        {r.reviewed ? (
                          <div className="flex items-center justify-between" style={{ flexWrap: 'wrap', gap: 6 }}>
                            <div style={{ fontSize: 12, color: 'var(--green, #10b981)' }}>
                              <b>✓ {t('reviewedBy')} {r.reviewedByName || 'Admin'}</b>
                              {r.reviewerRemark ? `: "${r.reviewerRemark}"` : ''}
                            </div>
                            <button
                              type="button"
                              className="btn btn-xs btn-ghost"
                              onClick={() => {
                                setActiveReviewId(activeReviewId === (r.id || r._id) ? null : (r.id || r._id));
                                setReviewRemarkDraft((d) => ({ ...d, [r.id || r._id]: r.reviewerRemark || '' }));
                              }}
                            >
                              Edit Note
                            </button>
                          </div>
                        ) : (
                          <div>
                            {activeReviewId !== (r.id || r._id) ? (
                              <button
                                type="button"
                                className="btn btn-xs btn-outline"
                                onClick={() => {
                                  setActiveReviewId(r.id || r._id);
                                  setReviewRemarkDraft((d) => ({ ...d, [r.id || r._id]: '' }));
                                }}
                              >
                                ✍️ {t('markReviewed')}
                              </button>
                            ) : null}
                          </div>
                        )}

                        {/* Inline review form */}
                        {activeReviewId === (r.id || r._id) && (
                          <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                            <input
                              className="input"
                              style={{ flex: 1, minWidth: 200, height: 32, fontSize: 12 }}
                              placeholder={t('remarkPlh')}
                              value={reviewRemarkDraft[r.id || r._id] || ''}
                              onChange={(e) => setReviewRemarkDraft((d) => ({ ...d, [r.id || r._id]: e.target.value }))}
                            />
                            <button
                              type="button"
                              className="btn btn-xs btn-primary"
                              onClick={() => handleSaveReview(r.id || r._id)}
                            >
                              {t('saveRemark')}
                            </button>
                            <button
                              type="button"
                              className="btn btn-xs btn-ghost"
                              onClick={() => setActiveReviewId(null)}
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ──────────────── TAB 2: SUBMIT MY REPORT (EVERY STAFF MEMBER) ──────────────── */}
      {(activeTab === 'submit' || !isAdminOrManager) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 20 }}>
          {/* Submission Card */}
          <div className="card" style={{ padding: 22 }}>
            <div className="flex items-center justify-between" style={{ marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                  {existingReport ? t('updateBtn') : t('submitBtn')}
                </h3>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                  {existingReport
                    ? `✓ ${t('submittedOn')} ${new Date(existingReport.updatedAt || existingReport.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`
                    : t('notSubmittedYet')}
                </div>
              </div>

              {/* Date Selector */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className={'btn btn-xs ' + (selectedDate === getTodayIST() ? 'btn-primary' : 'btn-ghost')}
                  onClick={() => setSelectedDate(getTodayIST())}
                >
                  {t('today')}
                </button>
                <button
                  type="button"
                  className={'btn btn-xs ' + (selectedDate === getYesterdayIST() ? 'btn-primary' : 'btn-ghost')}
                  onClick={() => setSelectedDate(getYesterdayIST())}
                >
                  {t('yesterday')}
                </button>
                <input
                  type="date"
                  className="input"
                  style={{ width: 140, height: 32, fontSize: 12 }}
                  max={getTodayIST()}
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                />
              </div>
            </div>

            <form onSubmit={handleSubmitMyReport}>
              {/* Summary / Work Done */}
              <div className="form-group">
                <label style={{ fontWeight: 600, fontSize: 13 }}>
                  {t('summary')} <span style={{ color: 'var(--red)' }}>*</span>
                </label>
                <textarea
                  className="input"
                  rows={4}
                  style={{ width: '100%', resize: 'vertical', lineHeight: 1.5, fontSize: 13 }}
                  placeholder={t('summaryPlh')}
                  value={formSummary}
                  onChange={(e) => setFormSummary(e.target.value)}
                  required
                />
              </div>

              <div className="flex gap-3" style={{ flexWrap: 'wrap' }}>
                {/* Hours Worked */}
                <div className="form-group" style={{ width: 120 }}>
                  <label style={{ fontWeight: 600, fontSize: 12 }}>{t('hours')}</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="24"
                    className="input"
                    value={formHours}
                    onChange={(e) => setFormHours(e.target.value)}
                  />
                </div>

                {/* Tasks Completed / Job IDs */}
                <div className="form-group" style={{ flex: 1, minWidth: 220 }}>
                  <label style={{ fontWeight: 600, fontSize: 12 }}>{t('tasksCompleted')}</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. Job #2024, Logo Design, 12 Client Inquiries"
                    value={formTasks}
                    onChange={(e) => setFormTasks(e.target.value)}
                  />
                </div>
              </div>

              {/* Blockers */}
              <div className="form-group" style={{ marginTop: 8 }}>
                <label style={{ fontWeight: 600, fontSize: 12 }}>{t('blockers')}</label>
                <textarea
                  className="input"
                  rows={2}
                  style={{ width: '100%', resize: 'vertical', fontSize: 12.5 }}
                  placeholder={t('blockersPlh')}
                  value={formBlockers}
                  onChange={(e) => setFormBlockers(e.target.value)}
                />
              </div>

              {/* Plan for Tomorrow */}
              <div className="form-group" style={{ marginTop: 8 }}>
                <label style={{ fontWeight: 600, fontSize: 12 }}>{t('planTomorrow')}</label>
                <input
                  type="text"
                  className="input"
                  style={{ width: '100%', fontSize: 12.5 }}
                  placeholder={t('planPlh')}
                  value={formPlan}
                  onChange={(e) => setFormPlan(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-2" style={{ marginTop: 16 }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmitting || !formSummary.trim()}
                >
                  {isSubmitting ? '...' : (existingReport ? t('updateBtn') : t('submitBtn'))}
                </button>
              </div>
            </form>
          </div>

          {/* Past Submissions History */}
          {myHistory.length > 0 && (
            <div className="card" style={{ padding: 18 }}>
              <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>📋 {t('myHistory')}</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {myHistory.map((rep) => (
                  <div
                    key={rep.id || rep._id}
                    style={{
                      padding: '10px 14px',
                      background: 'var(--bg2)',
                      borderRadius: 6,
                      border: '1px solid var(--border)',
                    }}
                  >
                    <div className="flex items-center justify-between" style={{ marginBottom: 4, flexWrap: 'wrap' }}>
                      <b style={{ fontSize: 13 }}>{rep.date}</b>
                      <div className="flex items-center gap-2" style={{ fontSize: 11, color: 'var(--text3)' }}>
                        {rep.hoursWorked > 0 && <span>⏱ {rep.hoursWorked} hrs</span>}
                        {rep.reviewed ? (
                          <span className="badge badge-green" style={{ fontSize: 10 }}>
                            ✓ Reviewed
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div style={{ fontSize: 12.5, whiteSpace: 'pre-wrap', color: 'var(--text1)' }}>
                      {rep.summary}
                    </div>
                    {rep.reviewerRemark && (
                      <div style={{ fontSize: 11.5, color: 'var(--green, #10b981)', marginTop: 4 }}>
                        <b>Note:</b> {rep.reviewerRemark}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
