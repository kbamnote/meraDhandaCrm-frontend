/**
 * Onboarding wizard — shown once, right after a new company signs up. A few
 * dropdown questions tailor which modules the company sees. Answers are saved
 * to tenant.settings; the sidebar then hides modules they don't use.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { tenantApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { showToast } from '../components/common/toast';

const YESNO = ['Yes', 'No'];
const INDUSTRIES = [
  'Fabrication & Metalwork', 'Plastic & Moulding', 'Textile & Garments',
  'Engineering & Machining', 'Packaging', 'Food Processing',
  'Chemicals', 'Electronics', 'Other',
];
const TEAM_SIZES = ['1–10', '11–50', '51–200', '200+'];

// Each question maps a Yes/No answer to a module toggle.
const QUESTIONS = [
  { key: 'industry', label: 'What do you manufacture?', options: INDUSTRIES, default: 'Fabrication & Metalwork' },
  { key: 'teamSize', label: 'How big is your team?', options: TEAM_SIZES, default: '1–10' },
  { key: 'designers', label: 'Do you have an in-house design team?', options: YESNO, default: 'No', module: true,
    hint: 'Shows Designers & Job Setter' },
  { key: 'machines', label: 'Do you track machines & maintenance?', options: YESNO, default: 'Yes', module: true,
    hint: 'Shows Machines & Machine History' },
  { key: 'qcDispatch', label: 'Do you do quality control & dispatch?', options: YESNO, default: 'Yes', module: true,
    hint: 'Shows QC & Dispatch' },
  { key: 'hr', label: 'Do you manage HR (attendance, payroll)?', options: YESNO, default: 'Yes', module: true,
    hint: 'Shows Attendance, Leaves, Payroll' },
  { key: 'bulk', label: 'Do you take bulk / B2B orders?', options: YESNO, default: 'Yes', module: true,
    hint: 'Shows Bulk Orders, Enquiries, Samples' },
];

export default function OnboardingPage() {
  const { tenant, loading, refreshTenant } = useAuth();
  const nav = useNavigate();
  const [ans, setAns] = useState(() => {
    const init = {};
    QUESTIONS.forEach((q) => { init[q.key] = q.default; });
    return init;
  });
  const [busy, setBusy] = useState(false);

  // Already onboarded (or an existing paid company) → skip.
  useEffect(() => {
    if (!loading && tenant && (tenant.settings?.onboarded || tenant.plan === 'pro')) {
      nav('/admin', { replace: true });
    }
  }, [loading, tenant, nav]);

  const set = (k, v) => setAns((a) => ({ ...a, [k]: v }));

  const finish = async () => {
    setBusy(true);
    try {
      const modules = {};
      QUESTIONS.filter((q) => q.module).forEach((q) => { modules[q.key] = ans[q.key] === 'Yes'; });
      const settings = {
        ...(tenant?.settings || {}),
        onboarded: true,
        industry: ans.industry,
        teamSize: ans.teamSize,
        modules,
      };
      await tenantApi.update({ settings });
      await refreshTenant();
      showToast('All set! Your CRM is ready.', 'success');
      nav('/admin', { replace: true });
    } catch (err) {
      showToast(err.response?.data?.error || 'Could not save — try again', 'error');
    } finally { setBusy(false); }
  };

  return (
    <div className="center-screen" style={{ background: 'var(--bg)', padding: 16 }}>
      <div className="card" style={{ maxWidth: 560, width: '100%', maxHeight: '92vh', overflow: 'auto' }}>
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 30 }}>🏭</div>
          <h2 style={{ marginTop: 6 }}>Set up your CRM</h2>
          <p style={{ color: 'var(--text2)', fontSize: 13, marginTop: 4 }}>
            A few quick questions so we show you only what you need. You can change these any time in Settings.
          </p>
        </div>

        {QUESTIONS.map((q) => (
          <div className="form-group" key={q.key}>
            <label>{q.label}</label>
            <select className="input" value={ans[q.key]} onChange={(e) => set(q.key, e.target.value)}>
              {q.options.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
            {q.hint && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{q.hint}</div>}
          </div>
        ))}

        <button className="btn btn-primary w-full mt-2" onClick={finish} disabled={busy}>
          {busy ? 'Setting up…' : 'Finish setup & open my CRM'}
        </button>
      </div>
    </div>
  );
}
