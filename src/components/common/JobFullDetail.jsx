/**
 * JobFullDetail — a read-only CONTENT component that renders a job's ENTIRE
 * lifecycle in labelled sections. Used by JobViewPage (a full-screen page that
 * scrolls naturally) for read-only job views (Completed, Hold, …) selected via
 * config.detail = 'job'.
 *
 * Props: { job (the job object) }.
 * Renders only the sections whose data actually exists on the job — a job
 * that never reached production shows "Not sent to production", a job with no
 * stageHistory hides the Timeline entirely, etc. This component renders just
 * the sections (no modal/overlay/footer) so it drops into a normal page.
 *
 * All timestamps on a job are ms-epoch numbers; fmt() formats them NaN-safely.
 * Labels are kept in plain English for readability (matches the read-only,
 * back-office nature of these pipeline views).
 */

// --- pretty-label maps -----------------------------------------------------
const STAGE_LABELS = {
  enquiry: 'Enquiry',
  designer: 'Designer',
  jobsetter: 'Job Setter',
  production: 'Production',
  qc: 'Quality Check',
  dispatch: 'Dispatch',
  delivered: 'Delivered',
  hold: 'On Hold',
  cancelled: 'Cancelled',
};

const DISPATCH_MODE_LABELS = {
  self_delivery: 'Self Delivery',
  porter: 'Porter',
  private_vehicle: 'Private Vehicle',
  courier: 'Courier',
  customer_pickup: 'Customer Pickup',
};

const prettyStage = (s) => STAGE_LABELS[s] || (s ? String(s) : '');
const prettyMode = (m) => DISPATCH_MODE_LABELS[m] || (m ? String(m) : '');

// --- helpers ---------------------------------------------------------------
/** Format a ms-epoch number as "dd MMM, HH:MM" (en-IN). NaN/invalid → ''. */
function fmt(ms) {
  const n = Number(ms);
  if (!Number.isFinite(n) || n <= 0) return '';
  const d = new Date(n);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

const isUrgent = (p) => p === 'urgent' || p === 'high';
const has = (v) => v != null && v !== '';
const hasArr = (v) => Array.isArray(v) && v.length > 0;

// --- little presentational bits --------------------------------------------
function Section({ title, children }) {
  return (
    <div style={{ marginTop: 18 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.4 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function Row({ label, value }) {
  if (!has(value)) return null;
  return (
    <div style={{ display: 'flex', gap: 10, fontSize: 13, padding: '3px 0' }}>
      <div style={{ color: 'var(--text3)', minWidth: 110, flexShrink: 0 }}>{label}</div>
      <div style={{ color: 'var(--text)', wordBreak: 'break-word' }}>{value}</div>
    </div>
  );
}

// --- component -------------------------------------------------------------
export default function JobFullDetail({ job: jobProp }) {
  const job = jobProp || {};

  const plan = Array.isArray(job.plan) ? job.plan : [];
  const productionLog = Array.isArray(job.productionLog) ? job.productionLog : [];
  const stageHistory = Array.isArray(job.stageHistory) ? job.stageHistory : [];
  const dispatchInfo = job.dispatchInfo || null;

  const hasDesigner = has(job.designerName) || has(job.designerClaimedAt) || job.designReady != null || has(job.designWait);
  const hasProduction = hasArr(plan) || hasArr(productionLog) || job.stage === 'production';
  const hasBilling = has(job.billNumber) || has(job.billType) || (dispatchInfo && dispatchInfo.gstInvoice != null);
  const hasDispatch = !!dispatchInfo || has(job.deliveredAt);

  const subCard = {
    background: 'var(--surface2)',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  };

  return (
    <div className="card" style={{ maxWidth: 640, width: '100%', margin: '0 auto' }}>
        {/* --- Header --- */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: 'monospace', fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
              {job.jobNo || '—'}
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginTop: 2 }}>
              {job.clientName || ''}
            </div>
            {has(job.clientMobile) && (
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>{job.clientMobile}</div>
            )}
            {has(job.work) && (
              <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 2 }}>{job.work}</div>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
            {has(job.stage) && (
              <span className="badge badge-blue">{prettyStage(job.stage)}</span>
            )}
            {isUrgent(job.priority) && (
              <span className="badge" style={{ background: 'var(--amber, #f59e0b)', color: '#fff' }}>⚡ Urgent</span>
            )}
          </div>
        </div>

        {/* --- Order details --- */}
        <Section title="Order details">
          <Row label="Work" value={job.work} />
          <Row
            label="Delivery"
            value={[job.deliveryDate, job.deliveryTime].filter(has).join(' ')}
          />
          <Row label="Priority" value={isUrgent(job.priority) ? 'Urgent' : job.priority} />
          <Row label="Created" value={fmt(job.createdAt)} />
          <Row label="Created by" value={job.createdBy} />
        </Section>

        {/* --- Designer --- */}
        {hasDesigner && (
          <Section title="Designer">
            {has(job.designerName) && <Row label="Design by" value={job.designerName} />}
            <Row label="Claimed at" value={fmt(job.designerClaimedAt)} />
            {job.designReady != null && (
              <Row label="Design ready" value={job.designReady ? '✓ Ready' : 'Pending'} />
            )}
            {job.designWait === 'approval' && <Row label="Wait status" value="Awaiting approval" />}
            {job.designWait === 'client_data' && <Row label="Wait status" value="Awaiting client data" />}
          </Section>
        )}

        {/* --- Production --- */}
        {hasProduction && (
          <Section title="Production">
            {!hasArr(plan) && !hasArr(productionLog) ? (
              <div style={{ fontSize: 13, color: 'var(--text3)' }}>Not sent to production</div>
            ) : (
              <>
                {plan.map((p, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, padding: '3px 0' }}>
                    <span style={{ color: 'var(--text)' }}>{p.name || p.dept}</span>
                    {p.outsource && <span className="badge" style={{ background: 'var(--surface2)', color: 'var(--text2)' }}>outsource</span>}
                    {has(p.assignedToName) && (
                      <span style={{ color: 'var(--text3)' }}>→ {p.assignedToName}</span>
                    )}
                  </div>
                ))}

                {productionLog.map((log, i) => {
                  const materials = Array.isArray(log.materials) ? log.materials : [];
                  const assembly = Array.isArray(log.assembly) ? log.assembly : [];
                  const w = log.wastage;
                  return (
                    <div key={i} style={{ ...subCard, marginTop: i === 0 ? 10 : 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                        <span>{log.deptName || log.dept}</span>
                        <span style={{ color: 'var(--text3)', fontWeight: 400 }}>{fmt(log.at)}</span>
                      </div>
                      {hasArr(materials) && (
                        <div style={{ marginBottom: 4 }}>
                          <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600 }}>Materials</div>
                          {materials.map((m, j) => (
                            <div key={j} style={{ fontSize: 12, color: 'var(--text2)' }}>
                              {m.item} — {m.qtyUsed} {m.unit || ''}
                            </div>
                          ))}
                        </div>
                      )}
                      {w && w.hasWastage && (
                        <div style={{ marginBottom: 4 }}>
                          <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600 }}>Wastage</div>
                          <div style={{ fontSize: 12, color: 'var(--text2)' }}>
                            {w.qty}{has(w.note) ? ` — ${w.note}` : ''}
                          </div>
                        </div>
                      )}
                      {hasArr(assembly) && (
                        <div>
                          <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600 }}>Assembly</div>
                          {assembly.map((a, j) => (
                            <div key={j} style={{ fontSize: 12, color: 'var(--text2)' }}>
                              {a.item} × {a.qty}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            )}
          </Section>
        )}

        {/* --- Billing --- */}
        {hasBilling && (
          <Section title="Billing">
            <Row label="Bill No" value={job.billNumber} />
            <Row label="Type" value={job.billType} />
            {dispatchInfo && dispatchInfo.gstInvoice != null && (
              <Row label="GST invoice" value={dispatchInfo.gstInvoice ? 'Yes' : 'No'} />
            )}
          </Section>
        )}

        {/* --- Dispatch & Delivery --- */}
        {hasDispatch && (
          <Section title="Dispatch & Delivery">
            {dispatchInfo && (
              <>
                <Row label="Mode" value={prettyMode(dispatchInfo.dispatchMode)} />
                <Row
                  label="Carrier"
                  value={[dispatchInfo.receiverName, dispatchInfo.receiverNumber].filter(has).join(' · ')}
                />
                <Row label="Vehicle" value={dispatchInfo.vehicleNumber} />
                <Row label="Notes" value={dispatchInfo.notes} />
                <Row label="Dispatched at" value={fmt(dispatchInfo.at)} />
              </>
            )}
            <Row label="Delivered at" value={fmt(job.deliveredAt)} />
          </Section>
        )}

        {/* --- Timeline --- */}
        {hasArr(stageHistory) && (
          <Section title="Timeline">
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {stageHistory.map((h, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, paddingBottom: 10, position: 'relative' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                    <div style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--primary, #3b82f6)', marginTop: 4 }} />
                    {i < stageHistory.length - 1 && (
                      <div style={{ flex: 1, width: 2, background: 'var(--border, #e5e7eb)', marginTop: 2 }} />
                    )}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                        {prettyStage(h.stage)}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text3)' }}>{fmt(h.at)}</span>
                    </div>
                    {has(h.note) && (
                      <div style={{ fontSize: 12, color: 'var(--text2)' }}>{h.note}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

    </div>
  );
}
