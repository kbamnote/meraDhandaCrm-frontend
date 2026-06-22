import { useAuth } from '../../context/AuthContext';

export default function Topbar({ onMenu, title }) {
  const { profile } = useAuth();
  return (
    <header className="topbar">
      <div className="flex items-center gap-3">
        <button className="menu-toggle" onClick={onMenu} aria-label="Open menu">☰</button>
        <h1>{title || 'MrPrint World CRM'}</h1>
      </div>
      <div className="flex items-center gap-3">
        <span className="badge badge-blue">{profile?.role || 'guest'}</span>
      </div>
    </header>
  );
}
