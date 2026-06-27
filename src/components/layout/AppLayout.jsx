import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { useAuth } from '../../context/AuthContext';

// Apply the tenant's saved branding (theme class + accent colour + font size) to
// the whole app. Lives here so it covers every authenticated page.
function useBranding() {
  const { tenant } = useAuth();
  const b = (tenant && tenant.settings && tenant.settings.branding) || {};
  useEffect(() => {
    const body = document.body;
    body.className = body.className.replace(/\btheme-[\w-]+\b/g, '').trim();
    if (b.theme && b.theme !== 'default') body.classList.add(`theme-${b.theme}`);
    if (b.primaryColor) body.style.setProperty('--blue', b.primaryColor); else body.style.removeProperty('--blue');
    body.style.fontSize = b.fontSize ? `${b.fontSize}px` : '';
  }, [b.theme, b.primaryColor, b.fontSize]);
}

export default function AppLayout() {
  const [open, setOpen] = useState(false);
  useBranding();
  return (
    <div className="crm-layout">
      <Sidebar open={open} onClose={() => setOpen(false)} />
      <div className="main-area">
        <Topbar onMenu={() => setOpen(true)} />
        <main className="page-content">
          <Outlet />
        </main>
      </div>
      <div id="toast-container" />
    </div>
  );
}
