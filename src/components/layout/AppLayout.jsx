import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

export default function AppLayout() {
  const [open, setOpen] = useState(false);
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
