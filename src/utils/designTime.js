/**
 * How long a design took, and how to say it.
 *
 * The server stamps `designWorkMs` / `designElapsedMs` when a design is marked
 * complete. Jobs finished before that existed carry neither, so the numbers are
 * reconstructed from what those jobs do have: the claim time and the moment the
 * job left the designer on its stage history. Without the fallback, every job
 * completed up to now would show a blank where the time should be.
 */

// When the design was finished: the stamp, else the stage-history move OFF the
// designer stage, else nothing (an unfinished job).
export function designCompletedAt(job) {
  if (!job) return null;
  if (job.designCompletedAt) return Number(job.designCompletedAt);
  const history = Array.isArray(job.stageHistory) ? job.stageHistory : [];
  // The LAST move off designer, because a job passed back and re-designed has
  // more than one, and the final one is when it was actually done.
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const h = history[i];
    if (h && h.from === 'designer' && h.stage && h.stage !== 'designer' && h.at) return Number(h.at);
  }
  return null;
}

/**
 * { workMs, elapsedMs, pausedMs, completedAt } for a finished design, or null
 * when the job has not been designed yet. `workMs` excludes time spent waiting
 * on the client; `elapsedMs` is the wall clock.
 */
export function designDuration(job) {
  if (!job) return null;
  const completedAt = designCompletedAt(job);
  if (!completedAt) return null;

  if (job.designWorkMs != null || job.designElapsedMs != null) {
    const elapsedMs = job.designElapsedMs != null ? Number(job.designElapsedMs) : null;
    const workMs = job.designWorkMs != null ? Number(job.designWorkMs) : elapsedMs;
    return {
      completedAt,
      elapsedMs,
      workMs,
      pausedMs: elapsedMs != null && workMs != null ? Math.max(0, elapsedMs - workMs) : 0,
    };
  }

  const claimedAt = job.designerClaimedAt ? Number(job.designerClaimedAt) : null;
  if (!claimedAt || completedAt < claimedAt) return { completedAt, elapsedMs: null, workMs: null, pausedMs: 0 };
  const elapsedMs = completedAt - claimedAt;
  const pausedMs = Math.max(0, Number(job.designPausedTotal) || 0);
  return { completedAt, elapsedMs, workMs: Math.max(0, elapsedMs - pausedMs), pausedMs };
}

/**
 * A duration as a person would say it: "2h 15m", "45m", "3d 4h".
 * Under a minute reads "under a minute" rather than "0m", which looks broken.
 */
export function formatDuration(ms) {
  if (ms == null || Number.isNaN(Number(ms))) return '—';
  const total = Math.max(0, Math.round(Number(ms) / 1000));
  if (total < 60) return 'under a minute';
  const minutes = Math.floor(total / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  return `${minutes}m`;
}

// The average of the work times that are known. Jobs with no timing (claimed
// before the stamping existed, or never claimed) are left out rather than
// counted as zero, which would drag the average down and mislead.
export function averageWorkMs(jobs) {
  const times = (jobs || [])
    .map((j) => designDuration(j))
    .filter((d) => d && d.workMs != null)
    .map((d) => d.workMs);
  if (!times.length) return null;
  return Math.round(times.reduce((a, b) => a + b, 0) / times.length);
}
