/**
 * Screen smoke tests — does every page actually RENDER?
 *
 * Written after three crashes reached production that every other check passed:
 *
 *   1. `forParty` read from the wrong function scope   → ReferenceError
 *   2. `defaults` read before its const declaration    → TDZ ReferenceError
 *   3. MODULE_LABELS['tds'] missing, then dereferenced → TypeError
 *
 * All three parse cleanly, build green, and only fail when React renders. Unit
 * tests on the business logic could never have caught them, because none of that
 * logic was wrong — the components simply never mounted.
 *
 * So this asserts the one thing those bugs all broke: the screen appears. It
 * does not assert what's on it. A screen that renders empty passes here and is
 * caught by the logic suites instead; a screen that throws fails here, loudly,
 * naming itself.
 */
import { describe, it, expect } from 'vitest';
import { tryRender, OWNER, STAFF } from './renderScreen.jsx';

// Every accounting screen, plus the two that crashed outside accounting.
const SCREENS = {
  // — the ones that actually broke —
  PermissionsPage:      () => import('../src/pages/PermissionsPage.jsx'),
  PartiesPage:          () => import('../src/pages/accounting/PartiesPage.jsx'),
  CreateInvoiceFlow:    () => import('../src/components/common/CreateInvoiceFlow.jsx'),
  CreatePurchaseFlow:   () => import('../src/components/common/CreatePurchaseFlow.jsx'),
  PurchaseBulkUpload:   () => import('../src/components/common/PurchaseBulkUpload.jsx'),
  BankAccountSelect:    () => import('../src/components/common/BankAccountSelect.jsx'),
  // — accounting —
  AccountingDashboard:  () => import('../src/pages/accounting/AccountingDashboardPage.jsx'),
  SalesInvoicesPage:    () => import('../src/pages/accounting/SalesInvoicesPage.jsx'),
  ReportsPage:          () => import('../src/pages/accounting/ReportsPage.jsx'),
  GstPage:              () => import('../src/pages/accounting/GstPage.jsx'),
  EntriesPage:          () => import('../src/pages/accounting/EntriesPage.jsx'),
  DayBookPage:          () => import('../src/pages/accounting/DayBookPage.jsx'),
  ProfitPage:           () => import('../src/pages/accounting/ProfitPage.jsx'),
  JobProfitPage:        () => import('../src/pages/accounting/JobProfitPage.jsx'),
  YearEndPage:          () => import('../src/pages/accounting/YearEndPage.jsx'),
  CashBankPage:         () => import('../src/pages/accounting/CashBankPage.jsx'),
  ReconPage:            () => import('../src/pages/accounting/ReconPage.jsx'),
  TdsPage:              () => import('../src/pages/accounting/TdsPage.jsx'),
  InventoryPage:        () => import('../src/pages/accounting/InventoryPage.jsx'),
  PurchasesPage:        () => import('../src/pages/accounting/PurchasesPage.jsx'),
  ExpensesPage:         () => import('../src/pages/accounting/ExpensesPage.jsx'),
  CreditNotesPage:      () => import('../src/pages/accounting/CreditNotesPage.jsx'),
  DebitNotesPage:       () => import('../src/pages/accounting/DebitNotesPage.jsx'),
  DeliveryChallansPage: () => import('../src/pages/accounting/DeliveryChallansPage.jsx'),
  RecurringInvoices:    () => import('../src/pages/accounting/RecurringInvoicesPage.jsx'),
  BranchesPage:         () => import('../src/pages/accounting/BranchesPage.jsx'),
  ClientLedgerPage:     () => import('../src/pages/accounting/ClientLedgerPage.jsx'),
  SearchPage:           () => import('../src/pages/accounting/SearchPage.jsx'),
  // — high-traffic screens outside accounting —
  CompanySettingsPage:  () => import('../src/pages/CompanySettingsPage.jsx'),
  InvoiceViewPage:      () => import('../src/pages/InvoiceViewPage.jsx'),
  JobCardsPage:         () => import('../src/pages/JobCardsPage.jsx'),
  Sidebar:              () => import('../src/components/layout/Sidebar.jsx'),
};

// Props for the few components that are not standalone pages.
const PROPS = {
  CreateInvoiceFlow: { onClose: () => {}, onCreated: () => {} },
  CreatePurchaseFlow: { onClose: () => {}, onCreated: () => {} },
  Sidebar: { open: true, onClose: () => {} },
};

describe('every screen renders without throwing', () => {
  for (const [name, load] of Object.entries(SCREENS)) {
    it(name, async () => {
      const mod = await load();
      const Component = mod.default;
      expect(Component, `${name} has no default export`).toBeTypeOf('function');
      const err = tryRender(Component, { props: PROPS[name] || {} });
      if (err) {
        throw new Error(`${name} crashed on render: ${err.message}`);
      }
    });
  }
});

describe('screens render for a non-privileged role too', () => {
  // Permission-gated branches only execute for a non-admin, and admins skip
  // every access check — so an owner-only pass would miss anything that reads
  // a permission map.
  const GATED = ['PermissionsPage', 'PartiesPage', 'ReportsPage', 'Sidebar', 'JobCardsPage'];
  for (const name of GATED) {
    it(`${name} (staff)`, async () => {
      const mod = await SCREENS[name]();
      const err = tryRender(mod.default, { auth: STAFF, props: PROPS[name] || {} });
      if (err) throw new Error(`${name} crashed for staff: ${err.message}`);
    });
  }
});

describe('the specific bugs that shipped stay fixed', () => {
  it('CreateInvoiceFlow mounts when opened from a party (TDZ regression)', async () => {
    const mod = await import('../src/components/common/CreateInvoiceFlow.jsx');
    const err = tryRender(mod.default, {
      props: {
        party: { id: 'c1', name: 'Sharma Traders', phone: '9876543210', gstNo: '23AAAAA0000A1Z5' },
        onClose: () => {}, onCreated: () => {},
      },
    });
    if (err) throw new Error(`crashed: ${err.message}`);
  });

  it('CreateInvoiceFlow mounts in edit mode', async () => {
    const mod = await import('../src/components/common/CreateInvoiceFlow.jsx');
    const err = tryRender(mod.default, {
      props: {
        invoice: {
          id: 'i1', invoiceNo: 'MPW-001', type: 'invoice', date: '2026-08-01',
          clientName: 'Sharma Traders', clientGstNo: '23AAAAA0000A1Z5',
          items: [{ name: 'Cards', qty: 1000, rate: 6, amount: 6000 }],
          subtotal: 6000, gstRate: 18, discount: 0, total: 7080,
        },
        onClose: () => {}, onCreated: () => {},
      },
    });
    if (err) throw new Error(`crashed: ${err.message}`);
  });

  it('a bill in a party\'s Transactions opens the invoice', async () => {
    // The rows were plain <div>s with no handler at all — clicking a bill did
    // nothing. Only the `invoices` collection has a per-document view, so the
    // rule is: invoice rows navigate, everything else stays inert rather than
    // becoming a link that goes nowhere.
    const { canOpenTxn } = await import('../src/pages/accounting/PartiesPage.jsx');
    expect(canOpenTxn({ collectionName: 'invoices', id: 'i1' }), 'a sales invoice must open').toBe(true);
    for (const c of ['payments', 'creditNotes', 'debitNotes', 'purchaseOrders', 'expenses']) {
      expect(canOpenTxn({ collectionName: c, id: 'x1' }), `${c} has no document view to open`).toBe(false);
    }
    expect(canOpenTxn({ collectionName: 'invoices' }), 'no id means nothing to deep-link to').toBe(false);
    expect(canOpenTxn(null), 'must not throw on a missing row').toBe(false);

    // Then the actual DOM. A source regex was the first attempt here and it was
    // useless: commenting the handler out left the matched text in place, so
    // the test passed against a row that no longer did anything.
    const { TransactionsTab } = await import('../src/pages/accounting/PartiesPage.jsx');
    const { renderScreen } = await import('./renderScreen.jsx');
    const rows = [
      { id: 'inv1', collectionName: 'invoices', docType: 'invoice', label: 'Sales', number: 'MPW-001', date: '2026-08-01', amount: 7080, unpaid: 0, status: 'Paid' },
      { id: 'pay1', collectionName: 'payments', docType: 'payment_in', label: 'Payment In', number: 'RCPT-01', date: '2026-08-02', amount: 7080, unpaid: 0 },
    ];
    const { container } = renderScreen(TransactionsTab, { props: { rows, t: (k) => k } });
    const clickable = container.querySelectorAll('[role="button"]');
    expect(clickable.length, 'exactly the invoice row should be clickable').toBe(1);
    expect(clickable[0].textContent).toContain('MPW-001');
    expect(clickable[0].getAttribute('tabindex'), 'a clickable row must be keyboard reachable').toBe('0');
  });

  it('CreatePurchaseFlow mounts when opened from a supplier', async () => {
    // The path the Parties page uses: a supplier is already chosen, so the form
    // renders the Bill From card and the totals panel on the first paint.
    const mod = await import('../src/components/common/CreatePurchaseFlow.jsx');
    const err = tryRender(mod.default, {
      props: {
        vendor: { id: 'v1', name: 'Kagaz Suppliers', phone: '9876500000', address: 'Indore', gstNo: '23AAAAA0000A1Z5' },
        onClose: () => {}, onCreated: () => {},
      },
    });
    if (err) throw new Error(`crashed: ${err.message}`);
  });

  it('the purchase form lists vendors (a shadowed helper emptied it)', async () => {
    // `const [vendorName] = useState('')` shadowed the module-level vendorName()
    // helper, so building the vendor list threw, the catch emptied it, and the
    // form could never be submitted — no vendor could be selected.
    const fs = await import('node:fs');
    const src = fs.readFileSync('src/pages/accounting/PurchasesPage.jsx', 'utf8');
    const helper = /^const vendorName = /m.test(src);
    const shadowed = /const \[vendorName, /.test(src);
    expect(helper, 'vendorName helper missing').toBe(true);
    expect(shadowed, 'state named vendorName shadows the helper again').toBe(false);
  });

  it('purchases post through an accounting endpoint, not the raw DB route', async () => {
    // dbApi.create writes the document and nothing else, so a purchase saved
    // that way never reached the ledger, the P&L or the balance sheet.
    //
    // Asserts the PROPERTY (it goes through a posting endpoint), not one
    // specific call — the original fix routed to createPO and this test pinned
    // that name, so replacing the form with CreatePurchaseFlow/
    // createPurchaseInvoice failed a test whose actual concern was still met.
    const fs = await import('node:fs');
    for (const f of [
      'src/pages/accounting/PurchasesPage.jsx',
      'src/components/common/CreatePurchaseFlow.jsx',
    ]) {
      const src = fs.readFileSync(f, 'utf8');
      expect(/dbApi\.create\('purchaseOrders'/.test(src),
        `${f}: purchase creation bypasses the ledger via dbApi.create`).toBe(false);
    }
    const flow = fs.readFileSync('src/components/common/CreatePurchaseFlow.jsx', 'utf8');
    expect(/accountingApi\.(createPurchaseInvoice|createPO)\(/.test(flow),
      'the purchase form does not call a posting endpoint').toBe(true);
  });

  it('the purchase form sends round-off as a boolean the server can see as false', async () => {
    // `roundOff: form.autoRoundOff || undefined` would drop the field when the
    // user UNticks Auto Round Off, and the server defaults an absent roundOff to
    // rounding — so switching it off would silently do nothing.
    const fs = await import('node:fs');
    const src = fs.readFileSync('src/components/common/CreatePurchaseFlow.jsx', 'utf8');
    expect(/roundOff:\s*form\.autoRoundOff\s*\|\|/.test(src),
      'roundOff is sent as `x || undefined`, so unticking it is lost').toBe(false);
    expect(/roundOff:\s*form\.autoRoundOff\s*,/.test(src)).toBe(true);
  });

  it('every PERMISSION_CATALOG feature has a label (missing one crashed the dialog)', async () => {
    const { PERMISSION_CATALOG } = await import('../src/config/access.js');
    // Read from the project root: under vitest the module URL is a transformed
    // virtual path, so new URL(..., import.meta.url) is not a real file.
    const fs = await import('node:fs');
    const src = fs.readFileSync('src/pages/PermissionsPage.jsx', 'utf8');
    const labelBlock = src.slice(src.indexOf('const MODULE_LABELS = {'), src.indexOf('\n};', src.indexOf('const MODULE_LABELS = {')));
    const labelled = new Set([...labelBlock.matchAll(/^\s{2}'?([a-zA-Z0-9_.-]+)'?\s*:/gm)].map((m) => m[1]));
    const missing = PERMISSION_CATALOG.flatMap((g) => g.features).map((f) => f.key).filter((k) => !labelled.has(k));
    expect(missing, `features with no MODULE_LABELS entry: ${missing.join(', ')}`).toEqual([]);
  });
});
