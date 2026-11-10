import { memo } from 'react';
import { useAuth } from '../../context/AuthContext';
import LanguageSwitcher from '../common/LanguageSwitcher';
import NotificationBell from './NotificationBell';

// memo: Topbar has no per-page props that change — it re-renders only when the
// auth profile actually updates (login / role change), not on every navigation.
function Topbar({ onMenu, title }) {
  const { profile } = useAuth();
  return (
    <header className="topbar">
      <div className="flex items-center gap-3">
        <button className="menu-toggle" onClick={onMenu} aria-label="Open menu">☰</button>
        <h1>{title || 'MeraDhanda CRM'}</h1>
      </div>
      <div className="flex items-center gap-3">
        <LanguageSwitcher />
        <NotificationBell />
        <span className="badge badge-blue">{profile?.role || 'guest'}</span>
      </div>
    </header>
  );
}

export default memo(Topbar);
