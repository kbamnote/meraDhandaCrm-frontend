/**
 * Profile — read-only self-service page.
 * Shows the caller's own profile from useAuth() and a sign-out button.
 */
import { useAuth } from '../context/AuthContext';

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between" style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: 13, color: 'var(--text2)' }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 500, textAlign: 'right' }}>{value}</span>
    </div>
  );
}

export default function ProfilePage() {
  const { profile, signOut } = useAuth();
  const p = profile || {};
  const permissionKeys = Object.keys(p.permissions || {});

  return (
    <div data-legacy-id="page-profile">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 600 }}>👤 My Profile</h2>
          <div style={{ fontSize: 13, color: 'var(--text2)' }}>Your account details</div>
        </div>
        <button className="btn btn-danger btn-sm" onClick={signOut}>Sign out</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 12 }}>
        <div className="card">
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>
            Details
          </div>
          <Row label="Name" value={p.name || '—'} />
          <Row label="Phone" value={p.phone || '—'} />
          <Row
            label="Role"
            value={p.role ? <span className="badge badge-blue">{p.role}</span> : '—'}
          />
          <Row
            label="Custom role"
            value={p.customRole ? <span className="badge badge-amber">{p.customRole}</span> : '—'}
          />
          <Row label="Department" value={p.department || '—'} />
        </div>

        <div className="card">
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>
            Permissions ({permissionKeys.length})
          </div>
          {permissionKeys.length ? (
            <div className="flex" style={{ flexWrap: 'wrap', gap: 6 }}>
              {permissionKeys.map((k) => (
                <span key={k} className="badge badge-green">{k}</span>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 13, color: 'var(--text3)' }}>
              No special permissions assigned.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
