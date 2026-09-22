/**
 * Purchase View — /purchase-view?id=<purchaseId>
 *
 * The purchase counterpart of InvoiceViewPage: the bill as a printable document,
 * with Print and Edit. Reached from the Purchases list and from a supplier's
 * Transactions in Parties.
 *
 * Edit is offered only when the server says the bill can be edited, and the
 * reason is shown when it can't. Offering a button that then fails with "₹5,000
 * has already been paid" teaches people to distrust the button; saying so up
 * front, with the alternative, does not.
 */
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { accountingApi, describeError } from '../services/api';
import PurchaseDocument from '../components/common/PurchaseDocument';
import CreatePurchaseFlow from '../components/common/CreatePurchaseFlow';

export default function PurchaseViewPage() {
  const [params] = useSearchParams();
  const id = params.get('id');
  const navigate = useNavigate();
  const [purchase, setPurchase] = useState(null);
  const [err, setErr] = useState('');
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    if (!id) { setErr('No purchase selected.'); return; }
    setErr('');
    try {
      setPurchase(await accountingApi.getPurchaseInvoice(id));
    } catch (e) {
      setPurchase(null);
      setErr(describeError(e, 'Could not open this purchase'));
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div className="flex items-center justify-between no-print" style={{ marginBottom: 12, gap: 8, flexWrap: 'wrap' }}>
        <div className="flex items-center" style={{ gap: 8 }}>
          <button className="btn btn-sm btn-ghost" onClick={() => navigate('/accounting/purchases')}>← Purchases</button>
          <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>
            {purchase ? `Purchase ${purchase.poNo || ''}` : 'Purchase'}
          </h2>
        </div>
        {purchase && (
          <div className="flex" style={{ gap: 8 }}>
            <button className="btn btn-sm btn-ghost" onClick={() => window.print()}>🖨 Print</button>
            <button
              className="btn btn-sm btn-primary"
              onClick={() => setEditing(true)}
              disabled={!purchase.editable}
              title={purchase.editable ? 'Edit this bill' : (purchase.editBlockedReason || '')}
            >
              ✏️ Edit
            </button>
          </div>
        )}
      </div>

      {purchase && !purchase.editable && purchase.editBlockedReason && (
        <div
          className="no-print"
          style={{ marginBottom: 12, padding: '9px 12px', borderRadius: 8, background: 'rgba(245,158,11,.12)', color: 'var(--amber, #B45309)', fontSize: 12.5 }}
        >
          {purchase.editBlockedReason}
        </div>
      )}

      {Array.isArray(purchase?.revisions) && purchase.revisions.length > 0 && (
        <div className="no-print" style={{ marginBottom: 12, fontSize: 12, color: 'var(--text3)' }}>
          Edited {purchase.revisions.length} time{purchase.revisions.length > 1 ? 's' : ''} — previous
          versions are kept.
        </div>
      )}

      {err && <div className="card" style={{ padding: 16, color: 'var(--red)' }}>{err}</div>}
      {!purchase && !err && <div className="card" style={{ padding: 30, textAlign: 'center', color: 'var(--text3)' }}>Loading…</div>}
      {purchase && <PurchaseDocument purchase={purchase} />}

      {editing && purchase && (
        <CreatePurchaseFlow
          purchase={purchase}
          onClose={() => setEditing(false)}
          onCreated={() => { setEditing(false); load(); }}
        />
      )}
    </div>
  );
}
