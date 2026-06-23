import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export function Loading({ label = 'Loading…' }) {
  return (
    <div className="center-screen">
      <div style={{ textAlign: 'center' }}>
        <div className="spinner" />
        <div style={{ fontSize: 13, color: 'var(--text2)' }}>{label}</div>
      </div>
    </div>
  );
}

export function ProtectedRoute({ children, roles }) {
  const { user, profile, loading, hasRole } = useAuth();
  if (loading) return <Loading label="Connecting to MeraDhanda..." />;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !hasRole(...roles)) {
    return (
      <div className="card" style={{ maxWidth: 480, margin: '60px auto', textAlign: 'center' }}>
        <h3>Access denied</h3>
        <p style={{ color: 'var(--text2)', marginTop: 8 }}>
          Your role ({profile?.role || 'none'}) cannot view this page.
        </p>
      </div>
    );
  }
  return children;
}
