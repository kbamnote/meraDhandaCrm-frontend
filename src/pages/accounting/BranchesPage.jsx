/**
 * Branches — /accounting/branches. Manage the multi-location list. A branch is
 * just metadata (name / address / phone / GSTIN / main flag); financial
 * documents tag themselves with a branchId and the Reports page can filter the
 * whole ledger by branch. The main branch shows first everywhere.
 */
import { useEffect, useState } from 'react';
import { accountingApi } from '../../services/api';
import { useT } from '../../i18n/LanguageContext';
import { Kpi, KpiGrid } from '../../components/common/DashboardCharts';

const S = {
  title:   { en: 'Branches', hi: 'शाखाएँ', hinglish: 'Branches' },
  addNew:  { en: 'Add Branch', hi: 'शाखा जोड़ें', hinglish: 'Add Branch' },
  edit:    { en: 'Edit', hinglish: 'Edit' },
  delete:  { en: 'Delete', hinglish: 'Delete' },
  count:   { en: 'Branches', hi: 'शाखाएँ', hinglish: 'Branches' },
  main:    { en: 'Main', hi: 'मुख्य', hinglish: 'Main' },
  name:    { en: 'Branch name', hi: 'शाखा का नाम', hinglish: 'Branch name' },
  address: { en: 'Address', hi: 'पता', hinglish: 'Address' },
  phone:   { en: 'Phone', hi: 'फोन', hinglish: 'Phone' },
  gst:     { en: 'GSTIN', hinglish: 'GSTIN' },
  setMain: { en: 'Set as main branch', hi: 'मुख्य शाखा बनाएँ', hinglish: 'Set as main' },
  save:    { en: 'Save', hinglish: 'Save' },
  cancel:  { en: 'Cancel', hinglish: 'Cancel' },
  none:    { en: 'No branches yet — add your first location.', hinglish: 'Abhi koi branch nahi.' },
  confirm: { en: 'Delete this branch?', hinglish: 'Delete?' },
  mainBadge:{ en: '⭐ Main', hinglish: '⭐ Main' },
};

export default function BranchesPage() {
  const t = useT(S);
  const [branches, setBranches] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState(empty());
  const [saving, setSaving] = useState(false);

  function empty() { return { name: '', address: '', phone: '', gstNo: '', main: false }; }

  const load = () => accountingApi.branches().then(setBranches).catch(() => setBranches([]));
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditItem(null); setForm(empty()); setShowForm(true); };
  const openEdit = (b) => { setEditItem(b); setForm({ name: b.name || '', address: b.address || '', phone: b.phone || '', gstNo: b.gstNo || '', main: !!b.main }); setShowForm(true); };

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (editItem) await accountingApi.updateBranch(editItem.id, form);
      else await accountingApi.createBranch(form);
      setShowForm(false);
      load();
    } catch (e) { alert(e?.response?.data?.error || 'Save failed'); }
    setSaving(false);
  };

  const remove = async (b) => {
    if (!window.confirm(t('confirm'))) return;
    try { await accountingApi.deleteBranch(b.id); load(); }
    catch (e) { alert(e?.response?.data?.error || 'Delete failed'); }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>{t('title')}</h2>
        <button className="btn btn-primary" onClick={openNew}>+ {t('addNew')}</button>
      </div>

      <KpiGrid>
        <Kpi label={t('count')} value={branches.length} icon="🏬" color="var(--blue)" />
        <Kpi label={t('main')} value={branches.filter((b) => b.main).length || '—'} icon="⭐" color="var(--amber)" />
      </KpiGrid>

      {branches.length === 0 ? (
        <div style={{ color: 'var(--text3)', fontSize: 13, padding: '24px 0', textAlign: 'center' }}>{t('none')}</div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'auto' }}>
          <table className="table table-sm" style={{ minWidth: 640, margin: 0 }}>
            <thead>
              <tr>
                <th>{t('name')}</th><th>{t('address')}</th><th>{t('phone')}</th><th>{t('gst')}</th><th style={{ width: 110 }}></th>
              </tr>
            </thead>
            <tbody>
              {branches.map((b) => (
                <tr key={b.id}>
                  <td style={{ fontWeight: 500 }}>
                    {b.name}
                    {b.main && <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--amber)' }}>{t('mainBadge')}</span>}
                  </td>
                  <td style={{ fontSize: 12 }}>{b.address || '—'}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{b.phone || '—'}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{b.gstNo || '—'}</td>
                  <td>
                    <button className="btn btn-xs btn-ghost" onClick={() => openEdit(b)}>{t('edit')}</button>
                    <button className="btn btn-xs btn-ghost" style={{ color: 'var(--red)' }} onClick={() => remove(b)}>{t('delete')}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowForm(false); }}>
          <div className="card" style={{ width: '100%', maxWidth: 440, padding: 20 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>{editItem ? t('edit') : t('addNew')}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>{t('name')} *</label>
                <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Main Street" />
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>{t('address')}</label>
                <input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </div>
              <div className="form-group"><label>{t('phone')}</label><input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div className="form-group"><label>{t('gst')}</label><input className="input" value={form.gstNo} onChange={(e) => setForm({ ...form, gstNo: e.target.value })} /></div>
              <label style={{ gridColumn: '1 / -1', display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: 'var(--text2)' }}>
                <input type="checkbox" checked={form.main} onChange={(e) => setForm({ ...form, main: e.target.checked })} />
                {t('setMain')}
              </label>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14 }}>
              <button className="btn btn-ghost" onClick={() => setShowForm(false)}>{t('cancel')}</button>
              <button className="btn btn-primary" disabled={saving || !form.name.trim()} onClick={save}>{saving ? '…' : t('save')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
