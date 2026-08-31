/**
 * Mounts one screen inside the providers it expects, and reports whether it
 * rendered or threw.
 *
 * The auth context is supplied directly rather than through AuthProvider: the
 * real provider fetches a profile on mount, so a test would race it and every
 * screen would render its logged-out branch — which is precisely the branch
 * where nothing interesting happens. Handing it a ready profile means the
 * screens render the way an actual user sees them.
 */
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { createElement } from 'react';
import { LanguageProvider } from '../src/i18n/LanguageContext';
import { AuthContext } from '../src/context/AuthContext';

export const OWNER = {
  user: { uid: 'u1', email: 'owner@test.in' },
  profile: {
    id: 'u1', name: 'Test Owner', email: 'owner@test.in',
    role: 'owner', tenantId: 't1', permissions: {}, active: true,
  },
  tenant: { id: 't1', name: 'Test Co', plan: 'pro', status: 'active', settings: { branding: {} } },
  loading: false,
  login: async () => {}, signOut: async () => {},
  hasRole: () => true, isPlatformAdmin: false,
  refreshTenant: async () => {}, setProfile: () => {}, setTenant: () => {},
};

// A non-privileged role, to exercise the permission-gated branches too.
export const STAFF = {
  ...OWNER,
  profile: { ...OWNER.profile, role: 'staff' },
  hasRole: (...roles) => roles.includes('staff'),
};

export function renderScreen(Component, { auth = OWNER, route = '/', props = {} } = {}) {
  return render(
    createElement(MemoryRouter, { initialEntries: [route] },
      createElement(AuthContext.Provider, { value: auth },
        createElement(LanguageProvider, null,
          createElement(Component, props))))
  );
}

/**
 * Render and return the error if it threw, or null if it mounted.
 * Deliberately returns rather than throws so a suite can report EVERY broken
 * screen in one run instead of stopping at the first.
 */
export function tryRender(Component, opts) {
  try {
    renderScreen(Component, opts);
    return null;
  } catch (e) {
    return e;
  }
}
