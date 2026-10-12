// Meridian Desk — shared in-memory store + selectors. No storage, no network.
export const NOW = new Date(2026, 9, 6, 14, 0, 0); // fixed "now": Tue 6 Oct 2026, 14:00 (inside support hours)
let T_START = Date.now();
export const getNow = () => new Date(NOW.getTime() + (Date.now() - T_START));
export const HOURS = { open: 8, close: 22 };
export const SLA_TARGETS = { // minutes
  Urgent: { fr: 15, res: 240 }, High: { fr: 60, res: 480 }, Normal: { fr: 240, res: 1440 }, Low: { fr: 480, res: 4320 }, vendor: 1440,
};
export const SLA_CFG = { pausePending: true };
const SLA_DEFAULT = JSON.parse(JSON.stringify(SLA_TARGETS));
export const TEAMS = ['Servicing', 'Collections', 'Onboarding Ops', 'Legal'];
export const STATUSES = ['New', 'Open', 'Pending', 'Escalated', 'Resolved'];
export const PRIORITIES = ['Urgent', 'High', 'Normal', 'Low'];
export const CHANNELS = ['Email', 'LINE', 'Phone', 'Form'];
export const AGENTS = [
  { id: 'mali', name: 'Mali', initials: 'ML', color: '#8B5CF6', role: 'Agent', team: 'Servicing' },
  { id: 'ton', name: 'Ton', initials: 'TN', color: '#3B82F6', role: 'Agent', team: 'Servicing' },
  { id: 'nan', name: 'Nan', initials: 'NN', color: '#E8590C', role: 'Agent', team: 'Collections' },
  { id: 'pim', name: 'Pim', initials: 'PM', color: '#0EA5E9', role: 'Agent', team: 'Onboarding Ops' },
  { id: 'arm', name: 'Arm', initials: 'AR', color: '#2F855A', role: 'Agent', team: 'Collections' },
  { id: 'kanda', name: 'Kanda', initials: 'KD', color: '#BE185D', role: 'Ops Leader', team: 'Servicing' },
  { id: 'admin', name: 'Admin', initials: 'AD', color: '#64748B', role: 'Admin', team: 'Servicing' },
  { id: 'legal', name: 'Legal desk', initials: 'LG', color: '#475569', role: 'Legal contact', team: 'Legal' },
];
export const agentById = (id) => AGENTS.find((a) => a.id === id) || null;
export const ME = { Agent: 'mali', 'Team Lead': 'kanda' };

// ---- business-hours clock maths (08:00–22:00, 7 days) ----
const atHour = (d, h) => { const x = new Date(d); x.setHours(h, 0, 0, 0); return x; };
export function bizAgo(mins, from = NOW) {
  let c = new Date(from), r = mins;
  for (let i = 0; i < 400 && r > 0; i++) {
    const open = atHour(c, HOURS.open), close = atHour(c, HOURS.close);
    if (c > close) c = close;
    if (c <= open) { c = atHour(open, HOURS.close); c.setDate(c.getDate() - 1); continue; }
    const avail = (c - open) / 60000;
    if (r <= avail) return new Date(c - r * 60000);
    r -= avail; c = new Date(open);
  }
  return c;
}
export function bizMinutes(a, b) {
  if (b <= a) return 0;
  let total = 0, day = atHour(a, 0);
  while (day < b) {
    const s = Math.max(a, atHour(day, HOURS.open)), e = Math.min(b, atHour(day, HOURS.close));
    if (e > s) total += (e - s) / 60000;
    day = new Date(day); day.setDate(day.getDate() + 1);
  }
  return total;
}
export function bizAfter(from, mins) {
  let c = new Date(from), r = mins;
  for (let i = 0; i < 400; i++) {
    const open = atHour(c, HOURS.open), close = atHour(c, HOURS.close);
    if (c < open) c = open;
    if (c >= close) { c = atHour(c, HOURS.open); c.setDate(c.getDate() + 1); continue; }
    const avail = (close - c) / 60000;
    if (r <= avail) return new Date(+c + r * 60000);
    r -= avail; c = atHour(c, HOURS.open); c.setDate(c.getDate() + 1);
  }
  return c;
}
export function curElapsed(t, now = getNow()) {
  if (t.resolvedMin != null) return t.resolvedMin;
  if (t.pauseMin != null && SLA_CFG.pausePending) return t.pauseMin;
  return bizMinutes(t.createdAt, now) - (t.pausedTotal || 0);
}

// ---- tickets ----
const T = {
  pay: { s: 'Payment not reflected after transfer', c1: 'I transferred THB 12,400 via mobile banking yesterday and my loan balance has not changed.', c2: 'Here is the slip. The transfer reference is 0241-7781.', a1: 'Thank you. I can see the transfer reference and I am checking the bank statement feed now.', note: 'Bank feed shows the credit as unmatched. Need Finance to map it to the loan.', ai: 'Thank you for your patience. Your transfer of THB 12,400 has been received and is being matched to your loan. The balance will update within 2 hours.', tags: ['payment', 'bank-transfer'] },
  id: { s: 'Borrower ID correction on contract', c1: 'The national ID number printed on my contract has a typo. Please correct it.', c2: 'I have attached a clear photo of my ID card.', a1: 'Thanks. To protect your account I need to verify the corrected ID before changing the contract.', note: 'ID photo is legible. OTP not yet confirmed. Hold the contract edit until verification is complete.', ai: 'We have received your ID photo. For security, we will send a one-time code to your registered number before we update the contract.', tags: ['contract', 'kyc'] },
  settle: { s: 'Early settlement quote request', c1: 'I would like to close my loan early. Can you send the settlement amount valid until Friday?', c2: 'Also, will there be any early settlement fee?', a1: 'Happy to help. I am preparing a payoff quote including remaining interest.', note: 'Remaining principal THB 84,200. No early settlement fee after month 12 per product terms.', ai: 'Your early settlement quote is THB 84,950, valid until Friday 18:00. There is no early settlement fee on your loan.', tags: ['settlement', 'quote'] },
  disb: { s: 'Disbursement delay on approved loan', c1: 'My loan was approved on Monday but the funds have not arrived in my account.', c2: 'It has been two days. The device is already handed over to the customer.', a1: 'I am sorry for the delay. I am checking the disbursement batch status with Finance.', note: 'Batch is held for an account name mismatch. Confirming bank account details with the dealer.', ai: 'We apologise for the delay. The disbursement is held for a bank account check and will be released today once confirmed.', tags: ['disbursement', 'dealer'] },
  slip: { s: 'Payslip mismatch with declared income', c1: 'The income on my application is different from my payslip. Which one is used?', c2: 'I can send the last three months of payslips if needed.', a1: 'Thank you for flagging this. Could you send your most recent payslip so we can reconcile it?', note: 'Declared THB 38,000 vs payslip THB 35,500. Within tolerance but needs updated document.', ai: 'Please upload your latest payslip through the secure link and we will update your application within one business day.', tags: ['income', 'documents'] },
  overdue: { s: 'Overdue notice dispute', c1: 'I received an overdue notice but I paid on time. Please review.', c2: 'My payment was made on the 14th, before the due date.', a1: 'I understand the concern. I am comparing your payment timestamp with the notice trigger date.', note: 'Payment posted on the 16th due to bank cut-off. Notice was generated on the 15th. Waive late fee candidate.', ai: 'Your payment was received after the bank cut-off. We have paused late fees while we review and will confirm the outcome shortly.', tags: ['overdue', 'dispute'] },
  date: { s: 'Change of repayment date', c1: 'My salary now arrives on the 28th. Can the repayment date move from the 15th?', c2: 'Please confirm the new date will not add any fee.', a1: 'Let me check eligibility for a due-date change on your loan.', note: 'Eligible: no arrears, over 3 instalments paid. New date takes effect next cycle.', ai: 'Your repayment date can move to the 28th from the next cycle with no extra fee. Please confirm and we will update it.', tags: ['repayment', 'schedule'] },
  dup: { s: 'Duplicate charge on instalment', c1: 'My account was debited twice for this month’s instalment.', c2: 'Both debits show on my statement for the same day.', a1: 'I am sorry about that. I can see two debits and I am raising a refund request.', note: 'Duplicate autodebit confirmed in ledger. Refund of THB 4,150 needs Finance approval.', ai: 'We have confirmed the duplicate debit and started a refund of THB 4,150. It usually reaches your account in 3 business days.', tags: ['refund', 'autodebit'] },
  cert: { s: 'Closure certificate request', c1: 'My loan is fully paid. I need the closure certificate for my records.', c2: 'Please send it as a PDF to my email.', a1: 'Congratulations on completing your loan. I am generating your closure certificate now.', note: 'Final payment cleared. Certificate template v3, signed by authorised officer.', ai: 'Your closure certificate is attached. Please keep it for your records. It is also available in your account.', tags: ['closure', 'certificate'] },
  vip: { s: 'VIP borrower escalation: repeated failed autodebit', c1: 'Autodebit failed three times this month and I am being charged late fees. This is unacceptable.', c2: 'I expect a call from a senior person today.', a1: 'I am very sorry. I have put the late fees on hold and escalated this to our Ops Leader.', note: 'Failures caused by bank mandate expiry on our side. Waive fees, re-register mandate.', ai: 'We apologise for the repeated failures. Late fees are on hold and a senior colleague will call you today.', tags: ['vip', 'autodebit', 'escalation'] },
};
const EXTRA = {
  1002: { collision: { viewer: 'ton', typer: 'nan' } }, 1003: { collision: { viewer: 'pim', typer: 'nan' } }, 1006: { collision: { viewer: 'ton', typer: 'arm' } }, 1007: { collision: { viewer: 'kanda', typer: 'nan' } },
  1005: { verify: { level: 'High', checks: [true, false, false, false] } }, 1012: { verify: { level: 'Medium', checks: [true, true, false, false] } },
  1008: { verify: { level: 'Medium', checks: [true, false, false, false] } }, 1016: { verify: { level: 'Low', checks: [true, true, true, true] } },
  1001: { vip: true }, 1013: { csat: { stars: 5, comment: 'Fast and clear. Thank you.', day: -1 } }, 1015: { csat: { stars: 4, comment: 'Quote was accurate. Wish it was quicker.', day: -1 } }, 1016: { verify: { level: 'Low', checks: [true, true, true, true] }, csat: { stars: 5, comment: 'Easy to change my date.', day: -1 } },
};
export const VERIFY_ITEMS = ['ID match', 'OTP confirmed', 'Document match', 'Payment proof'];
// [id, themeKey, subjectSuffix, requester, role, loanRef, channel, status, priority, team, assignee, ageBiz, frMin, resolvedMin, pauseMin, updatedAgo, flags]
const RAW = [
  [1001, 'vip', '', 'Pranee Kaewmanee', 'VIP Borrower', 'LN-208431', 'Phone', 'Escalated', 'Urgent', 'Servicing', 'kanda', 300, 6, null, null, 18, {}],
  [1002, 'pay', '', 'Anucha Sripadung', 'Borrower', 'LN-310977', 'LINE', 'New', 'Urgent', 'Servicing', null, 20, null, null, null, 20, {}],
  [1003, 'disb', '', 'Wipada Charoensuk', 'Dealer · Nova Mobile', 'LN-188520', 'Email', 'Open', 'High', 'Servicing', 'ton', 400, 25, null, null, 42, {}],
  [1004, 'dup', ' (LockSure unlock pending)', 'Kittisak Boonmee', 'Borrower', 'LN-402216', 'Email', 'Escalated', 'High', 'Collections', 'nan', 200, 30, null, null, 55, { vendor: true }],
  [1005, 'id', '', 'Napat Jaidee', 'Borrower', 'LN-275404', 'LINE', 'New', 'High', 'Servicing', null, 50, null, null, null, 50, {}],
  [1006, 'overdue', '', 'Suda Phromsorn', 'Borrower', 'LN-361092', 'Phone', 'Open', 'High', 'Collections', 'arm', 90, 20, null, null, 12, {}],
  [1007, 'settle', '', 'Thanawat Limsakul', 'Borrower', 'LN-199873', 'Email', 'Open', 'Normal', 'Servicing', 'mali', 1100, 100, null, null, 95, {}],
  [1008, 'date', '', 'Orn-anong Saetang', 'Borrower', 'LN-244158', 'LINE', 'Open', 'Normal', 'Servicing', 'mali', 300, 60, null, null, 75, {}],
  [1009, 'slip', '', 'Chaiwat Pongpan', 'Borrower', 'LN-420665', 'Email', 'New', 'Normal', 'Onboarding Ops', null, 45, null, null, null, 45, {}],
  [1010, 'cert', '', 'Mayuree Intarasuk', 'Borrower', 'LN-157720', 'Form', 'Open', 'Normal', 'Servicing', 'ton', 200, 90, null, null, 130, {}],
  [1011, 'slip', ' (awaiting new payslip)', 'Piyawat Chantra', 'Borrower', 'LN-333041', 'Email', 'Pending', 'Normal', 'Onboarding Ops', 'pim', 500, 80, null, 420, 210, {}],
  [1012, 'id', ' (waiting on LockSure)', 'Rungnapa Sukhum', 'Dealer · Nova Mobile', 'LN-298816', 'LINE', 'Pending', 'Normal', 'Onboarding Ops', 'pim', 600, 40, null, 300, 180, { vendor: true }],
  [1013, 'pay', '', 'Nattaya Wongsa', 'Borrower', 'LN-215509', 'Phone', 'Resolved', 'Normal', 'Servicing', 'nan', 700, 30, 380, null, 320, {}],
  [1014, 'cert', ' (awaiting borrower signature)', 'Surachai Dechkul', 'Borrower', 'LN-142387', 'Form', 'Pending', 'Low', 'Servicing', 'arm', 900, 200, null, 600, 400, {}],
  [1015, 'settle', '', 'Jirapa Thongdee', 'Borrower', 'LN-389204', 'LINE', 'Resolved', 'Low', 'Collections', 'ton', 1500, 300, 1100, null, 600, {}],
  [1016, 'date', '', 'Wichai Anantasri', 'Borrower', 'LN-266931', 'Email', 'Resolved', 'Low', 'Servicing', 'mali', 1200, 150, 900, null, 520, {}],
];
const chLabel = { Email: 'Email', LINE: 'LINE chat', Phone: 'Phone call', Form: 'Web form' };
const altCh = { Email: 'LINE', LINE: 'Email', Phone: 'LINE', Form: 'Email' };
function buildTicket(r) {
  const [n, k, suf, requester, role, loanRef, channel, status, priority, team, assignee, age, frMin, resMin, pauseMin, updAgo, flags] = r;
  const created = bizAgo(age), th = T[k], ex = EXTRA[n] || {}, id = 'TK-' + n;
  const wall = (m) => { const d = new Date(created.getTime() + m * 60000); return d > NOW ? new Date(NOW.getTime() - 60000 * (1 + (m % 7))) : d; };
  const ev = []; const push = (e) => ev.push({ id: id + '-e' + (ev.length + 1), ...e });
  push({ type: 'system', text: 'Ticket created from ' + chLabel[channel] + '. Linked to loan ' + loanRef + '.', at: created });
  push({ type: 'rule', text: k === 'vip' ? 'VIP borrower + overdue balance over THB 500,000, so escalated to Collections Lead.' : 'Routed by rule: ' + team + ' round-robin.', at: wall(1) });
  if (channel === 'Phone') push({ type: 'call', direction: 'Inbound', duration: ['4:12', '6:40', '3:05', '8:21'][n % 4], outcome: frMin != null ? 'Resolved on call, follow-up by email' : 'Voicemail left, callback requested', text: th.c1, at: wall(2), channel });
  else push({ type: 'customer', channel, text: th.c1, at: wall(2) });
  if (frMin != null) push({ type: 'agent', channel: channel === 'Form' ? 'Email' : channel, by: assignee, text: th.a1, at: wall(frMin) });
  if (frMin != null && status !== 'New') push({ type: 'customer', channel: altCh[channel], text: th.c2, at: wall(frMin + 15) });
  if (frMin != null && status !== 'Resolved') push({ type: 'note', by: assignee, text: th.note, at: wall(frMin + 22) });
  if (flags.vendor) push({ type: 'note', by: assignee, text: 'Waiting on LockSure to confirm device-lock status before we can proceed. Vendor SLA 24 h.', at: wall((frMin || 0) + 30) });
  if (status === 'Pending') push({ type: 'agent', channel: altCh[channel], by: assignee, text: 'We are waiting for your reply or document to continue. The case is paused until we hear from you.', at: wall((frMin || 0) + 40) });
  if (status === 'Resolved') { push({ type: 'agent', channel: 'Email', by: assignee, text: 'This is now resolved. Please reply if anything still looks wrong.', at: wall(resMin) }); push({ type: 'system', text: 'CSAT survey sent to customer.', at: wall(resMin + 1) }); }
  const live = ['New', 'Open', 'Escalated'].includes(status);
  if (live) push({ type: 'ai', text: th.ai, at: wall(Math.min(age - 1, (frMin || 0) + 24)), state: 'pending' });
  const slug = requester.split(' ')[0].toLowerCase().replace(/[^a-z]/g, '');
  const activity = [{ at: created, by: 'System', text: 'Ticket created' }, { at: wall(1), by: 'Rule engine', text: 'Routed to ' + team }];
  if (assignee) activity.push({ at: wall(2), by: 'Rule engine', text: 'Assigned to ' + agentById(assignee).name });
  return {
    id, themeKey: k, type: 'support', subject: th.s + suf, requester, requesterRole: role, loanRef, channel, status, priority, team, assignee,
    phone: '+66 80-000-' + (1000 + n), email: slug + '.' + String(n).slice(-2) + '@example.com', customerType: ex.vip ? 'VIP' : 'Standard', tags: [...th.tags],
    createdAt: created, updatedAt: new Date(NOW.getTime() - updAgo * 60000), frMin, resolvedMin: resMin, pauseMin, waitingVendor: !!flags.vendor,
    thread: ev, activity, collision: ex.collision || null, verify: ex.verify ? { level: ex.verify.level, checks: [...ex.verify.checks] } : null,
    csat: ex.csat ? { stars: ex.csat.stars, comment: ex.csat.comment, at: new Date(NOW.getTime() + ex.csat.day * 86400000) } : null, aiText: th.ai, aiDismissed: false, related: [],
  };
}
export const SUPPORT_TICKETS = RAW.map(buildTicket);
SUPPORT_TICKETS.forEach((t) => { t.related = [...SUPPORT_TICKETS.filter((o) => o !== t && o.themeKey === t.themeKey), ...SUPPORT_TICKETS.filter((o) => o !== t && o.themeKey !== t.themeKey && o.team === t.team)].slice(0, 2).map((o) => o.id); });

// ---- SLA ----
export function slaClocks(t, now = getNow()) {
  const tg = t.slaTarget || SLA_TARGETS[t.priority];
  const elapsed = curElapsed(t, now);
  const mk = (name, target, used, done) => {
    const left = target - used, pct = Math.max(0, Math.min(100, (left / target) * 100));
    const state = done ? 'done' : t.status === 'Pending' && SLA_CFG.pausePending ? 'paused' : left < 0 ? 'breached' : pct < 25 ? 'risk' : 'ok';
    return { name, target, used, left, pct, state, done };
  };
  const fr = t.frMin != null ? mk('First response', tg.fr, t.frMin, true) : mk('First response', tg.fr, elapsed, t.status === 'Resolved');
  const res = mk('Resolution', tg.res, elapsed, t.status === 'Resolved');
  const vendor = t.waitingVendor ? { name: 'Vendor wait', target: SLA_TARGETS.vendor, used: 0, left: SLA_TARGETS.vendor, pct: 100, state: 'ok' } : null;
  const active = !fr.done ? fr : res;
  return { fr, res, vendor, active };
}
export const fmtDur = (m) => { const a = Math.abs(Math.round(m)), h = Math.floor(a / 60), mm = a % 60; return h ? (mm ? `${h}h ${mm}m` : `${h}h`) : `${mm}m`; };
export function slaView(t, now = getNow()) {
  const { active, fr, res } = slaClocks(t, now); const c = active;
  const label = t.status === 'Resolved' ? 'Resolved' : c.state === 'paused' ? 'Paused' : c.left < 0 ? `${fmtDur(c.left)} over` : `${fmtDur(c.left)} left`;
  const centre = t.status === 'Resolved' ? '✓' : c.state === 'paused' ? 'II' : c.left < 0 ? '!' : c.left >= 60 ? `${Math.floor(c.left / 60)}h` : `${Math.round(c.left)}m`;
  return { clock: c.name, state: t.status === 'Resolved' ? 'done' : c.state, pct: t.status === 'Resolved' ? 100 : c.pct, label, centre, fr, res };
}
export function relTime(d, now = getNow()) {
  const m = Math.round((now - d) / 60000);
  if (m < 1) return 'now'; if (m < 60) return `${m}m ago`; if (m < 1440) return `${Math.floor(m / 60)}h ago`; return `${Math.floor(m / 1440)}d ago`;
}
export const fmtClock = (m) => { const s = Math.round(Math.abs(m) * 60), h = Math.floor(s / 3600), mm = Math.floor((s % 3600) / 60), ss = s % 60, p = (n) => String(n).padStart(2, '0'); return (m < 0 ? '−' : '') + (h ? `${h}h ${p(mm)}m ${p(ss)}s` : `${mm}m ${p(ss)}s`); };
export function dueLabel(t) {
  const c = slaClocks(t);
  if (t.status === 'Resolved') return 'Resolved'; if (c.res.state === 'paused') return 'Resolution due: paused'; if (c.res.left < 0) return 'Resolution overdue';
  const d = bizAfter(getNow(), c.res.left), same = d.toDateString() === getNow().toDateString();
  return 'Resolution due ' + (same ? '' : d.toLocaleDateString('en-GB', { weekday: 'short' }) + ' ') + fmtTime(d);
}
export const fmtTime = (d) => d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
export const fmtStamp = (d) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ' · ' + fmtTime(d);

// ---- selectors ----
export const countBy = (list, key, values) => Object.fromEntries(values.map((v) => [v, list.filter((t) => t[key] === v).length]));
export const isBreached = (t) => { const s = slaView(t).state; return s === 'breached'; };
export const isAtRisk = (t) => slaView(t).state === 'risk';
export const VIEWS = ['All', 'My open', 'Unassigned', 'Escalated', 'SLA alerts', 'Waiting on vendor'];
export const viewTest = (view, me) => ({
  'All': () => true,
  'My open': (t) => t.assignee === me && t.status !== 'Resolved',
  'Unassigned': (t) => !t.assignee && t.status !== 'Resolved',
  'Escalated': (t) => t.status === 'Escalated',
  'SLA alerts': (t) => t.status !== 'Resolved' && ['risk', 'breached'].includes(slaView(t).state),
  'Waiting on vendor': (t) => t.waitingVendor && t.status !== 'Resolved',
}[view]);
export const viewCounts = (list, me) => Object.fromEntries(VIEWS.map((v) => [v, list.filter(viewTest(v, me)).length]));
export function filterTickets(list, { view = 'All', priority = 'All', query = '', me, filters = {} }) {
  const inF = (a, v) => !a || !a.length || a.includes(v);
  const q = query.trim().toLowerCase(), vt = viewTest(view, me);
  return list.filter((t) => vt(t) && (priority === 'All' || t.priority === priority) && inF(filters.status, t.status) && inF(filters.channel, t.channel) && inF(filters.team, t.team) && inF(filters.assignee, t.assignee || 'unassigned') &&
    (!q || [t.id, t.subject, t.requester, t.loanRef].some((s) => s.toLowerCase().includes(q))));
}
export function agentStats(list) {
  return AGENTS.filter((a) => a.role === 'Agent').map((a) => {
    const mine = list.filter((t) => t.assignee === a.id);
    return { agent: a, total: mine.length, open: mine.filter((t) => t.status !== 'Resolved').length,
      resolved: mine.filter((t) => t.status === 'Resolved').length, breached: mine.filter(isBreached).length };
  });
}
export function kpis(list) {
  const active = list.filter((t) => t.status !== 'Resolved');
  return { total: list.length, open: active.length, breached: list.filter(isBreached).length,
    atRisk: list.filter(isAtRisk).length, unassigned: list.filter((t) => !t.assignee && t.status !== 'Resolved').length,
    resolved: list.length - active.length };
}

// ---- store ----

// ---- closed-ticket history (last 30 days), deterministic; kept out of the live ticket list ----
const rng = (seed) => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
export const HISTORY = (() => {
  const R = rng(20261006), out = [], AG = ['mali', 'ton', 'nan', 'pim', 'arm'];
  const pick = (arr, w) => { let x = R() * w.reduce((p, q) => p + q, 0); for (let i = 0; i < arr.length; i++) { x -= w[i]; if (x <= 0) return arr[i]; } return arr[arr.length - 1]; };
  for (let d = 30; d >= 0; d--) {
    const n = d === 0 ? 6 : 3 + Math.floor(R() * 5);
    for (let i = 0; i < n; i++) {
      const hr = d === 0 ? 8 + Math.floor(R() * 4.5) : 8 + Math.floor(R() * 14), mi = Math.floor(R() * 60);
      const created = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() - d, hr, mi);
      const priority = pick(PRIORITIES, [2, 4, 9, 3]), tg = SLA_TARGETS[priority], channel = pick(CHANNELS, [6, 5, 3, 2]), team = pick(TEAMS, [8, 5, 3, 1]), assignee = AG[Math.floor(R() * 5)];
      const frMin = Math.max(2, Math.round(tg.fr * (0.15 + R() * 1.05)));
      let resMin = Math.max(frMin + 5, Math.round(tg.res * (0.15 + R() * 1.0)));
      if (d === 0) resMin = Math.min(resMin, 90);
      const survey = R() < 0.65, stars = pick([5, 4, 3, 2, 1], [40, 30, 15, 8, 7]);
      if (created >= NOW) continue;
      const resolvedAt = bizAfter(created, resMin);
      if (resolvedAt >= NOW) continue;
      out.push({ id: 'H-' + (out.length + 1), createdAt: created, resolvedAt, channel, priority, team, assignee, frMin, resMin, breached: frMin > tg.fr || resMin > tg.res, stars: survey ? stars : null });
    }
  }
  return out;
})();
const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
export function poolOf(s = state) {
  const cur = ticketsOfType(s).map((t) => { const c = slaClocks(t); return { id: t.id, createdAt: t.createdAt, resolvedAt: t.status === 'Resolved' ? t.updatedAt : null, channel: t.channel, priority: t.priority, team: t.team, assignee: t.assignee,
    frMin: t.frMin, resMin: t.resolvedMin, open: t.status !== 'Resolved', breached: c.fr.used > c.fr.target || c.res.used > c.res.target, stars: t.csat && t.csat.stars ? t.csat.stars : null, cur: true }; });
  return [...cur, ...HISTORY.map((h) => ({ ...h, open: false, cur: false }))];
}
export function vendorClock(t) {
  const n = t.thread.find((e) => e.type === 'note' && /LockSure/.test(e.text)); if (!n) return null;
  const left = SLA_TARGETS.vendor - bizMinutes(n.at, getNow());
  return { left, pct: Math.max(0, Math.min(100, (left / SLA_TARGETS.vendor) * 100)), state: left < 0 ? 'breached' : left / SLA_TARGETS.vendor < 0.25 ? 'risk' : 'ok' };
}
export function dashboard(s = state, f = s.dash) {
  const now = getNow(), r = f.range, day = 864e5;
  const from = r === 'today' ? startOfDay(now) : new Date(now - +r * day), shift = r === 'today' ? day : +r * day, pf = new Date(+from - shift), pt = new Date(+now - shift);
  const ok = (x) => (f.team === 'All' || x.team === f.team) && (f.channel === 'All' || x.channel === f.channel);
  const items = poolOf(s).filter(ok), tix = ticketsOfType(s).filter(ok), inW = (d, a, b) => d >= a && d < b;
  const avg = (arr) => (arr.length ? arr.reduce((x, y) => x + y, 0) / arr.length : null);
  const metrics = (list, a, b) => { const cr = list.filter((i) => inW(i.createdAt, a, b)), rs = list.filter((i) => i.resolvedAt && inW(i.resolvedAt, a, b));
    return { created: cr.length, resolved: rs.length, compliance: cr.length ? 100 * (1 - cr.filter((i) => i.breached).length / cr.length) : null, fr: avg(cr.filter((i) => i.frMin != null).map((i) => i.frMin)), res: avg(rs.filter((i) => i.resMin != null).map((i) => i.resMin)), csat: avg(rs.filter((i) => i.stars).map((i) => i.stars)), cr, rs }; };
  const openAt = (list, T) => list.filter((i) => i.createdAt <= T && (i.cur ? i.open || (i.resolvedAt && i.resolvedAt > T) : i.resolvedAt > T)).length;
  const cur = metrics(items, from, new Date(+now + 1)), prev = metrics(items, pf, pt);
  const nb = r === '30' ? 10 : 7, step = r === '30' ? 3 * day : day;
  const spark = (fn) => { let last = 0; return Array.from({ length: nb }, (_, k) => { const end = new Date(+now - (nb - 1 - k) * step), v = fn(end, new Date(+end - step)); if (v != null) last = v; return v != null ? v : last; }); };
  const kpi = {
    open: { cur: openAt(items, now), prev: openAt(items, from), spark: spark((e) => openAt(items, e)), lowerBetter: true },
    compliance: { cur: cur.compliance, prev: prev.compliance, spark: spark((e, b) => metrics(items, b, e).compliance), lowerBetter: false },
    fr: { cur: cur.fr, prev: prev.fr, spark: spark((e, b) => metrics(items, b, e).fr), lowerBetter: true },
    res: { cur: cur.res, prev: prev.res, spark: spark((e, b) => metrics(items, b, e).res), lowerBetter: true },
    csat: { cur: cur.csat, prev: prev.csat, spark: spark((e, b) => metrics(items, b, e).csat), lowerBetter: false },
  };
  // volume series
  let buckets;
  if (r === 'today') buckets = Array.from({ length: Math.max(1, now.getHours() - 7) }, (_, k) => { const a = new Date(startOfDay(now)); a.setHours(8 + k); const b = new Date(a); b.setHours(a.getHours() + 1); return { a, b, label: String(8 + k).padStart(2, '0') + ':00' }; });
  else buckets = Array.from({ length: +r }, (_, k) => { const a = startOfDay(new Date(+now - (+r - 1 - k) * day)), b = new Date(+a + day); return { a, b, label: +r === 7 ? a.toLocaleDateString('en-GB', { weekday: 'short' }) : a.getDate() + ' ' + a.toLocaleDateString('en-GB', { month: 'short' }) }; });
  const volume = buckets.map((bk) => ({ label: bk.label, counts: Object.fromEntries(CHANNELS.map((c) => [c, items.filter((i) => i.channel === c && inW(i.createdAt, bk.a, bk.b)).length])) }));
  const stateOf = (t) => slaView(t).state, open = tix.filter((t) => t.status !== 'Resolved');
  const sla = { onTrack: open.filter((t) => ['ok', 'paused'].includes(stateOf(t))).length, risk: open.filter((t) => stateOf(t) === 'risk').length, breached: open.filter((t) => stateOf(t) === 'breached').length };
  const dist = [1, 2, 3, 4, 5].map((n) => cur.rs.filter((i) => i.stars === n).length);
  const left = (t) => slaClocks(t).active.left;
  const agents = AGENTS.filter((a) => a.role === 'Agent').map((a) => { const mine = tix.filter((t) => t.assignee === a.id), pi = items.filter((i) => i.assignee === a.id), m = metrics(pi, from, new Date(+now + 1));
    return { agent: a, open: mine.filter((t) => t.status !== 'Resolved' && t.status !== 'Pending' && t.status !== 'Escalated').length, pending: mine.filter((t) => t.status === 'Pending').length, escalated: mine.filter((t) => t.status === 'Escalated').length, fr: m.fr, compliance: m.compliance }; });
  const me_ = ME[s.role], myItems = poolOf(s).filter((i) => i.assignee === me_), myM = metrics(myItems, from, new Date(+now + 1)), myT = ticketsOfType(s).filter((t) => t.assignee === me_);
  return { from, now, kpi, created: cur.created, volume, backlog: countBy(tix, 'status', STATUSES), sla, priority: countBy(cur.cr.filter((i) => PRIORITIES.includes(i.priority)), 'priority', PRIORITIES), csat: { avg: cur.csat, n: cur.rs.filter((i) => i.stars).length, dist }, agents,
    attention: open.filter((t) => ['risk', 'breached'].includes(stateOf(t))).sort((a, b) => left(a) - left(b)),
    verify: open.filter((t) => t.verify && !t.verify.checks.every(Boolean)).sort((a, b) => ['High', 'Medium', 'Low'].indexOf(a.verify.level) - ['High', 'Medium', 'Low'].indexOf(b.verify.level)),
    vendor: open.filter((t) => t.waitingVendor).map((t) => ({ t, v: vendorClock(t) })),
    mine: { open: myT.filter((t) => t.status !== 'Resolved').length, alerts: myT.filter((t) => t.status !== 'Resolved' && ['risk', 'breached'].includes(stateOf(t))).length, fr: myM.fr, csat: myM.csat,
      queue: myT.filter((t) => t.status !== 'Resolved').sort((a, b) => left(a) - left(b)) } };
}
export const PRIO_RANK = { Urgent: 0, High: 1, Normal: 2, Low: 3 }, STATUS_RANK = { New: 0, Open: 1, Escalated: 2, Pending: 3, Resolved: 4 };
export function sortTickets(list, { key, dir }) {
  const val = { priority: (t) => PRIO_RANK[t.priority], id: (t) => t.id, subject: (t) => t.subject.toLowerCase(), requester: (t) => t.requester.toLowerCase(), channel: (t) => t.channel,
    status: (t) => STATUS_RANK[t.status], assignee: (t) => (t.assignee ? agentById(t.assignee).name : '~'), updated: (t) => +t.updatedAt,
    sla: (t) => { const v = slaView(t); return v.state === 'done' ? 1e9 : v.state === 'paused' ? 1e8 : slaClocks(t).active.left; } }[key];
  const k = dir === 'asc' ? 1 : -1;
  return [...list].sort((a, b) => { const x = val(a), y = val(b); return (x < y ? -1 : x > y ? 1 : 0) * k; });
}
export const EMPTY_FILTERS = { status: [], channel: [], assignee: [], team: [] };
export const ROUTES = {
  inbox: { label: 'Inbox', icon: 'target', toolbar: true }, kanban: { label: 'Kanban', icon: 'kanban', toolbar: true },
  dashboard: { label: 'Dashboard', icon: 'home' }, automations: { label: 'Automations', icon: 'workflow' },
  reports: { label: 'Reports', icon: 'chart' }, integrations: { label: 'Integrations', icon: 'plug' },
  kb: { label: 'Knowledge Base', icon: 'book' }, article: { label: 'Article', icon: 'book' }, portal: { label: 'Customer Portal', icon: 'help' }, help: { label: 'Help Center', icon: 'help' }, dealer: { label: 'Dealer', icon: 'building' }, ticket: { label: 'Ticket', icon: 'target' }, settings: { label: 'Settings', icon: 'gear' },
};
export const NAV = {
  Agent: ['inbox', 'kanban', 'dashboard', 'kb', 'help'],
  'Team Lead': ['inbox', 'kanban', 'dashboard', 'automations', 'reports', 'integrations', 'kb', 'help'],
};
export const LANDING = { Agent: 'inbox', 'Team Lead': 'inbox' };
export const DEFAULT_VIEW = { Agent: 'My open', 'Team Lead': 'All' };

export const MACROS = [
  ['Payment confirmation received', 'Hello {{Customer Name}}, we have received your payment for reference {{Reference Number}}. It will be reflected on your balance within 2 hours.'],
  ['Document resubmission request', 'Hello {{Customer Name}}, the document for reference {{Reference Number}} was not legible. Could you please upload a clearer copy?'],
  ['Early settlement quote', 'Hello {{Customer Name}}, your early settlement quote for reference {{Reference Number}} is attached and valid for 3 business days.'],
  ['Apology for delay', 'Hello {{Customer Name}}, we are sorry for the delay on reference {{Reference Number}}. We are prioritising your case and will update you shortly.'],
  ['Repayment date change confirmed', 'Hello {{Customer Name}}, your repayment date for reference {{Reference Number}} has been updated. The new date applies from the next cycle.'],
  ['Closure certificate sent', 'Hello {{Customer Name}}, your closure certificate for reference {{Reference Number}} is attached. Thank you for banking with Meridian Lending.'],
];
export const ARTICLES = [
  ['How early settlement works', 'https://help.meridian-lending.example/kb/early-settlement'],
  ['Why a payment may take 2 hours to appear', 'https://help.meridian-lending.example/kb/payment-posting'],
  ['Changing your repayment date', 'https://help.meridian-lending.example/kb/repayment-date'],
];
export const ESCALATION_TARGETS = { 'Collections Lead': { assignee: 'arm', team: 'Collections' }, Legal: { assignee: 'legal', team: 'Legal' }, 'Ops Leader': { assignee: 'kanda', team: 'Servicing' } };
function applyPatch(t, patch, who) {
  const now = getNow(), n = { ...t, ...patch, updatedAt: now }, el = curElapsed(t, now), log = [];
  if (patch.status && patch.status !== t.status) {
    if (t.status === 'New' && t.frMin == null) n.frMin = el;
    if (patch.status === 'Pending') n.pauseMin = el; else n.pauseMin = null;
    if (patch.status === 'Resolved') { n.resolvedMin = el; if (n.frMin == null) n.frMin = el; } else n.resolvedMin = null;
    if (t.status === 'Pending' || t.status === 'Resolved') n.pausedTotal = Math.max(0, bizMinutes(t.createdAt, now) - (t.status === 'Pending' ? t.pauseMin : t.resolvedMin));
    log.push('Status changed to ' + patch.status);
  }
  if (patch.priority && patch.priority !== t.priority) { log.push('Priority changed to ' + patch.priority); n.slaTarget = { ...SLA_TARGETS[patch.priority] }; }
  if ('assignee' in patch && patch.assignee !== t.assignee) log.push('Assigned to ' + (patch.assignee ? agentById(patch.assignee).name : 'nobody'));
  if (patch.team && patch.team !== t.team) log.push('Team changed to ' + patch.team);
  if (log.length) { n.thread = [...t.thread, { id: t.id + '-e' + (t.thread.length + 1), type: 'system', text: log.join('. ') + ' by ' + who + '.', at: now }]; n.activity = [...(t.activity || []), ...log.map((text) => ({ at: now, by: who, text }))]; }
  return n;
}
// ================= ONBOARDING =================
export const STAGES = ['Intake received', 'KYM screening', 'Account setup', 'Kickoff & training', 'Success & go-live'];
export const STAGE_SUB = ['Request logged', 'Know-your-merchant checks', 'LMS + Portal IDs', 'Kickoff email, training booked', 'Success email, go-live'];
export const KYM_CHECKS = ['Registry filing', 'AML screening', 'Legal review', 'Restricted area', 'Shopfront'];
export const DAY_MIN = (HOURS.close - HOURS.open) * 60;
export const ONB_VIEWS = ['All', 'At risk', 'Overdue', 'Waiting on vendor', 'Mine'];
export const VENDOR_SLA_MIN = 1440;
export const kymOverall = (d) => { const v = d.kym; if (v.includes('Fail')) return 'Rejected'; if (v.every((x) => x === 'Pass')) return 'Approved'; if (v.every((x) => x === 'Pending')) return 'Pending'; return 'Review'; };
const idNum = (x) => (x ? String(x).replace(/\D/g, '') : '');
export const idParity = (d) => (!d.lmsId || !d.portalId ? 'missing' : idNum(d.lmsId) === idNum(d.portalId) ? 'match' : 'mismatch');
export const dealerDue = (d) => bizAfter(d.createdAt, d.stage <= 2 ? DAY_MIN : DAY_MIN * 2);
export const dealerPlanDue = (d) => bizAfter(d.createdAt, DAY_MIN * 2);
export function dealerView(d, now = getNow()) {
  if (d.stage === 4) return { state: 'done', status: 'Done', left: 0, pct: 100, label: 'Done', centre: '✓', due: dealerDue(d) };
  const due = dealerDue(d), left = due > now ? bizMinutes(now, due) : -bizMinutes(due, now), pct = Math.max(0, Math.min(100, (left / DAY_MIN) * 100));
  const state = left < 0 ? 'breached' : pct < 25 ? 'risk' : 'ok';
  return { state, status: { breached: 'Overdue', risk: 'At risk', ok: 'On track' }[state], left, pct, due,
    label: left < 0 ? fmtDur(left) + ' overdue' : fmtDur(left) + ' left', centre: left < 0 ? '!' : left >= 60 ? Math.floor(left / 60) + 'h' : Math.round(left) + 'm' };
}
export const vendorLeft = (q, now = getNow()) => { const V = SLA_TARGETS.vendor, left = V - bizMinutes(q.requestedAt, now); return { left, pct: Math.max(0, Math.min(100, (left / V) * 100)), state: left < 0 ? 'breached' : left / V < 0.25 ? 'risk' : 'ok' }; };
export const openVendorReqs = (d, s = state) => s.vendorReqs.filter((q) => q.dealerId === d.id && q.status !== 'Confirmed');
export const salesEmail = (d) => d.salesOwner.toLowerCase().replace(/[^a-z]+/g, '.').replace(/^\.|\.$/g, '') + '@meridian-lending.example';
export const toLocalInput = (d) => { if (!d) return ''; const p = (n) => String(n).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes()); };
const mkEv = (d, type, text, at, by) => ({ id: d.id + '-v' + (d.events.length + 1), type, text, at, by: by || 'System' });
const SEED = [
  ['Nova Mobile Harbor', 'Main Road 55', 'Capital', 'Dara Wongsa', '080-000-2001', 'dara@novamobile.example', 'Boon R.', 'mali', 120, 0, [0, 0, 0, 0, 0], null, null, null, null],
  ['Pacific Phone House', 'Plaza Square', 'Capital', 'Narong Saeli', '080-000-2002', 'narong@pacificphone.example', 'Anan K.', 'ton', 700, 0, [0, 0, 0, 0, 0], null, null, null, null],
  ['Lanna Digital Store', 'Hillside', 'North', 'Pimchanok Ruang', '080-000-2003', 'pimchanok@lannadigital.example', 'Malee S.', 'pim', 200, 1, [1, 1, 1, 0, 0], null, null, null, null],
  ['Isan Gadget Point', 'Northgate Plaza', 'Northeast', 'Somsak Daeng', '080-000-2004', 'somsak@isangadget.example', 'Anan K.', 'mali', 250, 1, [1, 1, 1, 1, 1], null, null, null, null],
  ['Andaman Mobile Phuket', 'Seaside', 'South', 'Kamon Pao', '080-000-2005', 'kamon@andamanmobile.example', 'Boon R.', 'kanda', 900, 1, [1, 1, 2, 1, 1], null, null, null, null],
  ['Capital Tech Corner', 'Riverside', 'Capital', 'Waraporn Tia', '080-000-2006', 'waraporn@bkktech.example', 'Malee S.', 'nan', 300, 2, [1, 1, 1, 1, 1], null, null, null, null],
  ['Chonburi Phone Plaza', 'Harbor Town', 'East', 'Prasit Mee', '080-000-2007', 'prasit@chonburiphone.example', 'Anan K.', 'mali', 760, 2, [1, 1, 1, 1, 1], 'LMS-40231', 'PRT-40231', null, null],
  ['Korat Smart Shop', 'Plaza Nine Korat', 'Northeast', 'Duangjai Lek', '080-000-2008', 'duangjai@koratsmart.example', 'Boon R.', 'kanda', 300, 2, [1, 1, 1, 1, 1], 'LMS-40233', 'PRT-40238', null, null],
  ['Hat Yai Mobile World', 'Old Market', 'South', 'Thanin Rat', '080-000-2009', 'thanin@hatyaimobile.example', 'Malee S.', 'ton', 1000, 3, [1, 1, 1, 1, 1], 'LMS-40220', 'PRT-40220', 1, null],
  ['Ayutthaya Phone Club', 'Industrial Park', 'Central', 'Siri Phan', '080-000-2010', 'siri@ayutthayaphone.example', 'Anan K.', 'pim', 1100, 3, [1, 1, 1, 1, 1], 'LMS-40215', 'PRT-40215', null, null],
  ['Rayong Digital Mart', 'Port Estate', 'East', 'Ekkachai Nok', '080-000-2011', 'ekkachai@rayongdigital.example', 'Boon R.', 'arm', 1500, 4, [1, 1, 1, 1, 1], 'LMS-40201', 'PRT-40201', -1, 120],
  ['Udon Mobile Centre', 'Civic Plaza Udon', 'Northeast', 'Malinee Chai', '080-000-2012', 'malinee@udonmobile.example', 'Malee S.', 'ton', 1700, 4, [1, 1, 1, 1, 1], 'LMS-40198', 'PRT-40198', -1, 700],
];
const mkSeed = () => SEED.map((x, i) => {
  const [name, branch, region, cn, ph, em, sales, owner, age, stage, kymN, lms, prt, trOff, doneAgo] = x, created = bizAgo(age), id = 'DLR-' + String(i + 1).padStart(5, '0'), on = AGENTS.find((a) => a.id === owner).name;
  let tr = null; if (trOff != null) { tr = new Date(NOW); tr.setDate(tr.getDate() + trOff); tr.setHours(10, 0, 0, 0); }
  const d = { id, name, branch, region, contact: { name: cn, phone: ph, email: em }, salesOwner: sales, owner, createdAt: created, stage, kym: kymN.map((v) => ['Pending', 'Pass', 'Fail'][v]), lmsId: lms, portalId: prt, training: tr, notes: '', events: [], doneAt: doneAgo != null ? bizAgo(doneAgo) : null, kickoffSentAt: stage >= 3 ? bizAgo(Math.max(10, age - 600)) : null, successSentAt: stage === 4 ? bizAgo(doneAgo) : null };
  d.events.push(mkEv(d, 'system', 'Dealer created from intake form.', created));
  if (stage >= 1) d.events.push(mkEv(d, 'system', 'Moved to Stage 1: KYM screening.', bizAfter(created, 20), on));
  if (stage >= 2) d.events.push(mkEv(d, 'system', 'KYM approved. Moved to Stage 2: Account setup.', bizAfter(created, 120), on));
  if (stage >= 3) d.events.push(mkEv(d, 'email', 'Kickoff email sent to ' + cn + '. CC ' + sales + '.', d.kickoffSentAt, on));
  if (stage === 4) d.events.push(mkEv(d, 'email', 'Success email sent. Dealer marked Done.', d.doneAt, on));
  if (i === 4) d.events.push(mkEv(d, 'note', 'Legal review failed: trade licence name does not match registry record. Waiting for corrected document.', bizAfter(created, 90), 'Kanda'));
  if (i === 7) d.events.push(mkEv(d, 'note', 'Portal ID was keyed with a typo. Needs correction before kickoff.', bizAfter(created, 200), 'Kanda'));
  return d;
});
const SEED_DEALERS = mkSeed();
const SEED_VR = [['Lock', 3, 'DEV-7731', 'Requested', 600], ['Lock', 6, 'DEV-7742', 'Requested', 200], ['Unlock', 8, 'DEV-7750', 'Requested', 1300], ['Unlock', 9, 'DEV-7755', 'Confirmed', 900]]
  .map(([type, di, deviceRef, status, age], i) => ({ id: 'VR-' + (1001 + i), type, dealerId: SEED_DEALERS[di].id, deviceRef, status, requestedAt: bizAgo(age) }));
export const SAMPLE_CSV = [
  'Dealer name,Branch,Region,Contact name,Phone,Email,Sales owner',
  'Krabi Phone Gallery,Beach Road,South,Preecha Sawang,080-000-3001,preecha@krabiphone.example,Anan K.',
  'Lamphun Mobile Shop,Central,North,Siriporn Kaew,080-000-3002,siriporn@lamphunmobile.example,Anan K.',
  'Saraburi Digital World,Friendship Rd,Central,Wichai Pong,080-000-3003,wichai@saraburidigital.example,Malee S.',
  'Nakhon Smart Phone,Town Square,South,Kanya Rat,080-000-3004,kanya@nakhonsmart.example,Malee S.',
  'Pattaya Phone Plaza,Night Market,East,Tawan Dee,080-000-3005,tawan@pattayaphone.example,Boon R.',
  'Nova Mobile Harbor,Main Road 55,Capital,Dara Wongsa,080-000-3006,dara@novamobile.example,Boon R.',
  'Phitsanulok Mobile Hub,Old Town Road,North,Lek Charoen,080-000-3007,not-an-email,Anan K.',
  'Surat Gadget Zone,New Market,South,Noi Suk,,noi@suratgadget.example,Malee S.',
].join('\n');
export const CSV_COLS = ['Dealer name', 'Branch', 'Region', 'Contact name', 'Phone', 'Email', 'Sales owner'];
const CSV_KEYS = ['name', 'branch', 'region', 'contactName', 'phone', 'email', 'salesOwner'];
export function parseCsv(text) {
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) { const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
    else if (c === '"') q = true; else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cur); cur = ''; rows.push(row); row = []; } else cur += c; }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim()));
}
export function csvToRows(text) {
  const t = parseCsv(text); if (!t.length) return { error: 'The file is empty.' };
  const head = t[0].map((h) => h.trim().toLowerCase()), idx = CSV_COLS.map((c) => head.indexOf(c.toLowerCase()));
  if (idx.some((i) => i < 0)) return { error: 'Missing columns: ' + CSV_COLS.filter((c, i) => idx[i] < 0).join(', ') };
  return { rows: t.slice(1).map((r) => Object.fromEntries(CSV_KEYS.map((k, i) => [k, (r[idx[i]] || '').trim()]))) };
}
export function validateRows(rows, existing = state.dealers) {
  const names = new Set(existing.map((d) => d.name.toLowerCase())), seen = new Set();
  return rows.map((data) => { const errors = [], warnings = [];
    CSV_KEYS.forEach((k, i) => { if (!data[k]) errors.push('Missing ' + CSV_COLS[i].toLowerCase()); });
    if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) errors.push('Invalid email');
    const nm = (data.name || '').toLowerCase();
    if (nm && names.has(nm)) warnings.push('Duplicate: dealer already exists'); else if (nm && seen.has(nm)) warnings.push('Duplicate: repeated in this file');
    if (nm) seen.add(nm);
    return { data, errors, warnings, level: errors.length ? 'error' : warnings.length ? 'warning' : 'valid' }; });
}
export const onbViewTest = (view, meId) => ({
  'All': () => true, 'At risk': (d) => dealerView(d).state === 'risk', 'Overdue': (d) => dealerView(d).state === 'breached',
  'Waiting on vendor': (d, s) => openVendorReqs(d, s).length > 0, 'Mine': (d) => d.owner === meId,
}[view] || (() => true));
export const onbViewCounts = (s = state) => Object.fromEntries(ONB_VIEWS.map((v) => [v, s.dealers.filter((d) => onbViewTest(v, me(s))(d, s)).length]));
export const visibleDealers = (s = state) => {
  const q = s.query.trim().toLowerCase(), t = onbViewTest(s.view, me(s));
  return s.dealers.filter((d) => t(d, s) && (!q || [d.id, d.name, d.branch, d.contact.name, d.region].some((x) => x.toLowerCase().includes(q))));
};
export const stageCounts = (list) => STAGES.map((_, i) => list.filter((d) => d.stage === i).length);
export function onbKpis(s = state) {
  const now = getNow(), L = s.dealers, act = L.filter((d) => d.stage < 4), sameDay = (a, b) => a.toDateString() === b.toDateString();
  const mon = new Date(now); mon.setHours(0, 0, 0, 0); mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7));
  const days = Array.from({ length: 6 }, (_, k) => { const day = new Date(now); day.setHours(0, 0, 0, 0); day.setDate(day.getDate() + k - 3);
    return { label: day.toLocaleDateString('en-GB', { weekday: 'short' }), planned: L.filter((d) => sameDay(dealerPlanDue(d), day)).length, onboarded: L.filter((d) => d.doneAt && sameDay(d.doneAt, day)).length, today: sameDay(day, now) }; });
  return { inProgress: act.length, dueToday: act.filter((d) => sameDay(dealerDue(d), now)).length, overdue: act.filter((d) => dealerView(d, now).state === 'breached').length, weekDone: L.filter((d) => d.doneAt && d.doneAt >= mon).length, days };
}
export const MACRO_SEED = [
  ['Payment confirmation received', 'Payments', 'Hello {{Customer Name}}, we have received your payment for reference {{Reference Number}}. It will be reflected on your balance within 2 hours.', 42],
  ['Document resubmission request', 'Documents', 'Hello {{Customer Name}}, the document for reference {{Reference Number}} was not legible. Could you please upload a clearer copy?', 31],
  ['Early settlement quote', 'Settlement', 'Hello {{Customer Name}}, your early settlement quote for reference {{Reference Number}} is attached and valid for 3 business days.', 27],
  ['Apology for delay', 'Service', 'Hello {{Customer Name}}, we are sorry for the delay on reference {{Reference Number}}. We are prioritising your case and will update you shortly.', 24],
  ['Repayment date change confirmed', 'Repayment', 'Hello {{Customer Name}}, your repayment date for reference {{Reference Number}} has been updated. The new date applies from the next cycle.', 18],
  ['Closure certificate sent', 'Closure', 'Hello {{Customer Name}}, your closure certificate for reference {{Reference Number}} is attached. Thank you for banking with Meridian Lending.', 15],
].map(([title, category, body, uses], i) => ({ id: 'MC-' + (101 + i), title, category, body, uses }));
export const RULE_SEED = [
  ['LockSure issues → Servicing', { field: 'keyword', value: 'locksure, device lock, unlock' }, { team: 'Servicing', tag: 'Device lock' }],
  ['Urgent priority → notify Team Lead', { field: 'priority', value: 'Urgent' }, { priority: 'Urgent', notify: true }],
  ['Collections keywords → Collections', { field: 'keyword', value: 'overdue, late fee, collection, arrears' }, { team: 'Collections' }],
  ['Dealer onboarding → Onboarding Ops', { field: 'keyword', value: 'dealer, onboarding, kym' }, { team: 'Onboarding Ops' }],
  ['Default → round-robin Servicing', { field: 'any', value: '' }, { team: 'Servicing' }],
].map(([name, cond, action], i) => ({ id: 'RL-' + (1 + i), name, enabled: true, cond, action }));
export const PRODUCTS = ['Device loan', 'Personal loan'];
export function matchRule(t, rules) {
  rules = rules || state.rules; const subj = (t.subject || '').toLowerCase();
  const test = { any: () => true, keyword: (r) => r.cond.value.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean).some((k) => subj.includes(k)), channel: (r) => t.channel === r.cond.value, priority: (r) => t.priority === r.cond.value, product: (r) => (t.product || '') === r.cond.value };
  return rules.find((r) => r.enabled && (test[r.cond.field] || (() => false))(r)) || null;
}
export const ruleText = (r) => { const c = r.cond, a = r.action; const ifp = c.field === 'any' ? 'IF any ticket' : 'IF ' + c.field + (c.field === 'keyword' ? ' contains ' : ' is ') + '"' + c.value + '"'; const th = [a.team && 'assign to ' + a.team, a.assignee && 'assign to ' + a.assignee, a.priority && 'set priority ' + a.priority, a.tag && 'tag "' + a.tag + '"', a.notify && 'notify Team Lead'].filter(Boolean); return ifp + ' THEN ' + (th.join(', ') || 'no action'); };
// ================= KNOWLEDGE BASE =================
export const KB_CATS = [
  { id: 'kc1', name: 'Loans & Repayment', icon: 'form', description: 'Repayment dates, settlement and fees' },
  { id: 'kc2', name: 'Account & Verification', icon: 'user', description: 'Documents, identity checks and sign-in' },
  { id: 'kc3', name: 'Dealers & Devices', icon: 'lock', description: 'Device lock requests and dealer processes' },
];
const kbAgo = (d) => new Date(NOW.getTime() - d * 864e5);
const P = (x) => ({ t: 'p', x }), OL = (x) => ({ t: 'ol', x });
export const KB_SEED = [
  ['KB-101', 'kc1', 'How to change your repayment date', 'Move your monthly due date once per loan term, free of charge.', [P('You can ask to move your monthly repayment date once for each loan. The new date applies from the next billing cycle.'), OL(['Open your loan in the Meridian Lending app or contact support with your loan reference.', 'Choose a new due date between the 1st and the 25th.', 'Confirm the change. You will receive a confirmation message within one business day.']), P('Payments already scheduled for this month are not moved. If the new date falls before your next billing cycle, we adjust the amount shown on your statement.'), P('There is no fee for the first change. Later changes may be reviewed by the servicing team.')], 'Published', 'Public', ['repayment', 'due date', 'schedule'], 'Mali', 6, 1240, 96, 7],
  ['KB-102', 'kc1', 'How early settlement works', 'See what you pay when you close a loan before the end of its term.', [P('Early settlement means paying the remaining principal plus any interest accrued to the settlement date.'), OL(['Request an early settlement quote with your loan reference.', 'Pay the quoted amount before the quote expires (3 business days).', 'Receive your closure certificate within two business days of payment.']), P('Loans in their final three months carry no early settlement fee. Earlier closures may include a small administrative fee shown in the quote.')], 'Published', 'Public', ['settlement', 'close loan', 'quote'], 'Ton', 9, 980, 71, 6],
  ['KB-103', 'kc1', 'Late fees explained', 'How late fees are calculated and when they can be waived.', [P('A late fee applies when a repayment is not received by its due date plus a three-day grace period.'), P('The fee is a fixed amount per missed instalment, not a percentage of your balance. It is shown on your statement under Fees.'), P('If a bank outage or a Meridian system issue caused the delay, contact support with your payment proof and we will review a waiver.')], 'Published', 'Public', ['late fee', 'overdue', 'waiver'], 'Mali', 12, 760, 58, 9],
  ['KB-201', 'kc2', 'Payslip requirements', 'What a valid payslip must show so your application is not delayed.', [P('We accept the two most recent payslips from your current employer.'), OL(['The document must show your full name, employer name and pay period.', 'Net and gross pay must be visible and legible.', 'Photos must show all four corners; screenshots of the payslip are not accepted.']), P('Self-employed applicants can submit bank statements for the last three months instead.')], 'Published', 'Public', ['payslip', 'income', 'documents'], 'Pim', 5, 640, 49, 4],
  ['KB-202', 'kc2', 'How document verification works', 'What happens after you upload your documents and how long it takes.', [P('Every document goes through an automatic check and, if needed, a manual review by the verification team.'), P('Most documents are verified within one business day. You will get a message if something is unclear or missing.'), OL(['Upload your documents in the app or send them to support.', 'We check name, date and legibility.', 'You are notified when verification is complete.']), P('You can see the status of each document under Profile → Documents.')], 'Published', 'Public', ['verification', 'documents', 'identity'], 'Nan', 8, 520, 40, 8],
  ['KB-203', 'kc2', 'Reset your portal password', 'Steps to regain access if you cannot sign in.', [P('If you cannot sign in, you can reset your password from the sign-in page.'), OL(['Select "Forgot password" and enter your registered email.', 'Open the reset link we send you. It expires after 30 minutes.', 'Choose a new password with at least 10 characters.']), P('If you do not receive the email, check your spam folder or contact support.')], 'Draft', 'Public', ['password', 'sign in', 'access'], 'Pim', 1, 0, 0, 0],
  ['KB-301', 'kc3', 'Request a device lock or unlock', 'How borrowers and dealers request a lock or unlock through LockSure.', [P('Device locks are managed through LockSure. Support submits the request on your behalf; it is usually confirmed within one business day.'), OL(['Provide the loan reference and the device reference (DEV number).', 'Support creates a Lock or Unlock request and notifies you.', 'LockSure confirms the change and we update your ticket.']), P('Unlock requests are only processed once the account is in good standing or an exception is approved by a Team Lead.')], 'Published', 'Public', ['locksure', 'device lock', 'unlock'], 'Ton', 4, 410, 33, 5],
  ['KB-302', 'kc3', 'Dealer onboarding steps', 'Internal checklist for the five onboarding stages and what blocks a move.', [P('Internal only. Do not share outside the Meridian Lending support team.'), OL(['Intake received: log the request and confirm contact details.', 'KYM screening: all five checks must pass before account setup.', 'Account setup: LMS ID and Portal ID must match.', 'Kickoff & training: send the kickoff email and book a training date.', 'Success & go-live: send the success email and mark the dealer Done.']), P('If any check fails, add an internal note and wait for the corrected document.')], 'Published', 'Internal', ['dealer', 'onboarding', 'kym'], 'Kanda', 3, 210, 18, 2],
].map(([id, categoryId, title, summary, body, status, audience, tags, author, d, views, helpfulYes, helpfulNo]) => ({ id, categoryId, title, summary, body, status, audience, tags, author, updatedAt: kbAgo(d), views, helpfulYes, helpfulNo }));
export const kbHelpfulPct = (a) => (a.helpfulYes + a.helpfulNo ? Math.round((100 * a.helpfulYes) / (a.helpfulYes + a.helpfulNo)) : null);
export const kbMatch = (a, q) => { q = (q || '').trim().toLowerCase(); return !q || a.title.toLowerCase().includes(q) || a.summary.toLowerCase().includes(q) || a.tags.some((t) => t.includes(q)); };
export const kbList = (s = state, { categoryId = 'all', tab = 'All', q = '' } = {}) => s.kb.articles.filter((a) => (categoryId === 'all' || a.categoryId === categoryId) && kbMatch(a, q) && ({ All: true, Published: a.status === 'Published', Draft: a.status === 'Draft', Internal: a.audience === 'Internal' }[tab]));
export const kbPortalArticles = (s = state) => s.kb.articles.filter((a) => a.status === 'Published' && a.audience === 'Public');
export const kbStats = (s = state) => { const A = s.kb.articles, yes = A.reduce((n, a) => n + a.helpfulYes, 0), no = A.reduce((n, a) => n + a.helpfulNo, 0); return { published: A.filter((a) => a.status === 'Published').length, views: A.reduce((n, a) => n + a.views, 0), helpful: yes + no ? Math.round((100 * yes) / (yes + no)) : null }; };
export const kbTop = (s = state, n = 5) => [...kbPortalArticles(s)].sort((a, b) => b.views - a.views).slice(0, n);
export const kbRelated = (s, a, pub) => s.kb.articles.filter((x) => x.id !== a.id && (!pub || (x.status === 'Published' && x.audience === 'Public')) && (x.categoryId === a.categoryId || x.tags.some((t) => a.tags.includes(t)))).slice(0, 3);
export const kbSuggest = (s, text, n = 3) => { const w = ((text || '').toLowerCase().match(/[a-z]{4,}/g) || []); if (!w.length) return []; return kbPortalArticles(s).map((a) => { const hay = (a.title + ' ' + a.summary + ' ' + a.tags.join(' ')).toLowerCase(); return { a, sc: w.filter((x) => hay.includes(x)).length }; }).filter((x) => x.sc > 0).sort((x, y) => y.sc - x.sc || y.a.views - x.a.views).slice(0, n).map((x) => x.a); };
export const portalCount = (s = state) => s.tickets.filter((t) => t.portal).length;
export const isPublicEvent = (e) => e.type === 'agent' || e.type === 'customer';
export const portalStage = (t) => ({ New: 0, Open: 1, Escalated: 1, Pending: 2, Resolved: 3 }[t.status] ?? 0);
export const PORTAL_STAGES = ['Received', 'In progress', 'Waiting on you', 'Resolved'];
export const PORTAL_TOPICS = ['Repayment', 'Early settlement', 'Documents', 'Device lock / unlock', 'Other'];
export const kbLink = (a) => 'https://help.meridian-lending.example/kb/' + a.id.toLowerCase();
let state = { role: 'Team Lead', ticketType: 'Support', route: 'inbox', detailId: null, view: 'All', tourReq: false, priority: 'All', query: '', selectedId: null, tickets: [...SUPPORT_TICKETS],
  filters: { ...EMPTY_FILTERS }, filtersOpen: false, sort: { key: 'updated', dir: 'desc' }, checked: [], toast: null, inboxScroll: 0, autoTimer: true, newReq: null, kb: { categories: KB_CATS, articles: KB_SEED }, kbPanelId: null, kbArticleId: null, kbEditor: null, portalFrom: 'inbox', channelsOn: { Email: true, LINE: true, Phone: true, Form: true }, rules: RULE_SEED, macros: MACRO_SEED, settingsPage: 'integrations', draftInsert: null,
  webhooks: [{ id: 'WH-1', url: 'https://hooks.example.test/meridian/tickets', event: 'ticket.created', active: true }, { id: 'WH-2', url: 'https://hooks.example.test/crm/resolved', event: 'ticket.resolved', active: true }, { id: 'WH-3', url: 'https://hooks.example.test/pager/sla', event: 'sla.breached', active: false }], webhookLog: [], dealers: SEED_DEALERS, vendorReqs: SEED_VR, dealerId: null, importOpen: false, newDealerReq: null, dash: { range: '7', team: 'All', channel: 'All' },
  timeEntries: [{ id: 'te1', ticketId: 'TK-1007', agent: 'mali', minutes: 12, note: 'Prepared payoff quote', date: '2026-10-06' }, { id: 'te2', ticketId: 'TK-1013', agent: 'nan', minutes: 18, note: 'Traced bank feed credit', date: '2026-10-05' }],
  notifications: [{ id: 'n1', text: 'TK-1002 has breached its first-response SLA', at: new Date(NOW.getTime() - 5 * 60000), read: false }, { id: 'n2', text: 'Ops Leader flagged TK-1001 as VIP', at: new Date(NOW.getTime() - 18 * 60000), read: false }] };
const INIT = { ...state };
const subs = new Set();
const set = (p) => { state = { ...state, ...p }; subs.forEach((f) => f(state)); };
const toast = (text) => { const id = Date.now(); set({ toast: { id, text } }); setTimeout(() => state.toast && state.toast.id === id && set({ toast: null }), 2600); };
const who = () => agentById(ME[state.role]).name;
const mapT = (id, fn) => set({ tickets: state.tickets.map((t) => (t.id === id ? fn(t) : t)) });
const addEv = (t, e) => ({ ...t, thread: [...t.thread, { id: t.id + '-e' + (t.thread.length + 1), at: getNow(), ...e }], updatedAt: getNow() });
const notify = (text) => set({ notifications: [{ id: 'n' + Date.now() + Math.random(), text, at: getNow(), read: false }, ...state.notifications] });
export const store = {
  get: () => state,
  requestNew: (status) => set({ newReq: { status } }), clearNewReq: () => set({ newReq: null }),
  subscribe: (f) => { subs.add(f); return () => subs.delete(f); },
  setRole: (role) => set({ role, route: LANDING[role], detailId: null, dealerId: null, view: state.ticketType === 'Onboarding' ? 'All' : DEFAULT_VIEW[role], priority: 'All', filters: { ...EMPTY_FILTERS }, checked: [], selectedId: null, filtersOpen: false }),
  setType: (ticketType) => set({ ticketType, route: state.route === 'dashboard' ? 'dashboard' : ticketType === 'Onboarding' ? 'kanban' : 'inbox', view: ticketType === 'Onboarding' ? 'All' : DEFAULT_VIEW[state.role], priority: 'All', selectedId: null, checked: [], filtersOpen: false }),
  setRoute: (route) => set({ route, filtersOpen: false }),
  openTicket: (id) => set({ route: 'ticket', detailId: id, filtersOpen: false }), back: () => set({ route: 'inbox' }),
  setDash: (p) => set({ dash: { ...state.dash, ...p } }),
  navInbox: ({ view = 'All', status } = {}) => set({ route: 'inbox', view, priority: 'All', query: '', filters: { ...EMPTY_FILTERS, status: status ? [status] : [] }, selectedId: null, filtersOpen: false }),
  reset: () => { T_START = Date.now(); Object.keys(SLA_DEFAULT).forEach((k) => { SLA_TARGETS[k] = typeof SLA_DEFAULT[k] === 'object' ? { ...SLA_DEFAULT[k] } : SLA_DEFAULT[k]; }); SLA_CFG.pausePending = true; set({ ...INIT, role: state.role, route: 'inbox', ticketType: 'Support', view: DEFAULT_VIEW[state.role], toast: null }); toast('Demo data reset. Back to the Inbox.'); },
  requestTour: () => set({ tourReq: true }), clearTour: () => set({ tourReq: false }), demo: (what) => toast('Demo only' + (what ? ': ' + what : '')),
  setAutoTimer: (autoTimer) => set({ autoTimer }),
  saveScroll: (n) => { state.inboxScroll = n; },
  setView: (view) => set({ view }), setPriority: (priority) => set({ priority }), setQuery: (query) => set({ query }),
  select: (selectedId) => set({ selectedId }),
  setFilters: (filters) => set({ filters, filtersOpen: false }), toggleFilters: () => set({ filtersOpen: !state.filtersOpen }), closeFilters: () => set({ filtersOpen: false }),
  clearFilters: () => set({ view: 'All', priority: 'All', query: '', filters: { ...EMPTY_FILTERS } }),
  setSort: (key) => set({ sort: { key, dir: state.sort.key === key && state.sort.dir === 'asc' ? 'desc' : 'asc' } }),
  setChecked: (checked) => set({ checked }), toggleCheck: (id) => set({ checked: state.checked.includes(id) ? state.checked.filter((x) => x !== id) : [...state.checked, id] }),
  clearChecked: () => set({ checked: [] }), toast, notify,
  markRead: () => set({ notifications: state.notifications.map((n) => ({ ...n, read: true })) }),
  addTickets: (list) => set({ tickets: [...state.tickets, ...list] }), // extension point for Onboarding tickets
  updateTicket: (id, patch) => set({ tickets: state.tickets.map((t) => (t.id === id ? applyPatch(t, patch, who()) : t)) }),
  bulkUpdate: (ids, patch) => { set({ tickets: state.tickets.map((t) => (ids.includes(t.id) ? applyPatch(t, patch, who()) : t)), checked: [] }); toast(ids.length + (ids.length > 1 ? ' tickets updated' : ' ticket updated')); },
  addEvent: (id, e) => mapT(id, (t) => addEv(t, e)),
  setTags: (id, tags) => mapT(id, (t) => ({ ...t, tags })),
  toggleVerify: (id, i) => mapT(id, (t) => ({ ...t, verify: { ...t.verify, checks: t.verify.checks.map((c, j) => (j === i ? !c : c)) } })),
  dismissAi: (id) => mapT(id, (t) => ({ ...t, aiDismissed: true, thread: t.thread.map((e) => (e.type === 'ai' ? { ...e, state: 'dismissed' } : e)) })),
  acceptAi: (id) => mapT(id, (t) => ({ ...t, thread: t.thread.map((e) => (e.type === 'ai' ? { ...e, state: 'accepted' } : e)) })),
  sendMessage: (id, { text, mode, after }) => {
    const now = getNow(), meId = ME[state.role], t0 = state.tickets.find((t) => t.id === id);
    mapT(id, (t) => { let n = addEv(t, { type: mode === 'note' ? 'note' : 'agent', channel: t.channel === 'Form' ? 'Email' : t.channel, by: meId, text });
      if (mode !== 'note') { if (n.frMin == null) n.frMin = curElapsed(t, now); if (!n.assignee) n.assignee = meId; } return n; });
    if (mode !== 'note' && t0.status === 'New') store.updateTicket(id, { status: 'Open' });
    if (mode === 'note') AGENTS.filter((a) => a.role !== 'Admin' && new RegExp('@' + a.name + '\\b').test(text)).forEach((a) => notify('You mentioned ' + a.name + ' in ' + id));
    if (after === 'pending') store.updateTicket(id, { status: 'Pending' });
    if (after === 'resolve') store.resolve(id);
  },
  resolve: (id) => { store.updateTicket(id, { status: 'Resolved' }); mapT(id, (t) => ({ ...addEv(t, { type: 'system', text: 'CSAT survey sent to customer.' }), csat: t.csat || { pending: true } })); toast('Ticket resolved. CSAT survey sent'); },
  escalate: (id, { reason, target }) => { const tg = ESCALATION_TARGETS[target]; store.updateTicket(id, { status: 'Escalated', assignee: tg.assignee, team: tg.team });
    mapT(id, (t) => addEv(t, { type: 'system', text: 'Escalated to ' + target + '. Reason: ' + (reason || 'not given') })); toast('Escalated to ' + target); },
  alertLead: (id) => { mapT(id, (t) => addEv(t, { type: 'system', text: 'Team Lead alerted by ' + who() + '.' })); notify('You alerted the Team Lead about ' + id); toast('Team Lead alerted'); },
  takeOver: (id) => { store.updateTicket(id, { assignee: ME[state.role] }); mapT(id, (t) => ({ ...addEv(t, { type: 'system', text: who() + ' took over this ticket.' }), collision: null })); },
  createTicket: ({ subject, requester, channel, priority, team, status = 'New', email, loanRef, portal }) => {
    const n = Math.max(1000, ...state.tickets.map((t) => +t.id.slice(3))) + 1, now = getNow(), id = 'TK-' + n;
    const rule = matchRule({ subject, channel, priority }), real = rule && rule.cond.field !== 'any', eff = { team: real && rule.action.team ? rule.action.team : team, priority: real && rule.action.priority ? rule.action.priority : priority };
    const t = { id, themeKey: 'new', type: 'support', subject, requester: requester || 'Walk-in customer', requesterRole: 'Borrower', loanRef: loanRef || 'LN-' + (100000 + n * 7), portal: !!portal, channel, status, priority: eff.priority, team: eff.team, slaTarget: { ...SLA_TARGETS[eff.priority] }, assignee: null,
      phone: '+66 80-000-' + (1000 + n), email: email || 'new.' + n + '@example.com', customerType: 'Standard', tags: ['new', ...(rule && rule.action.tag ? [rule.action.tag] : [])], createdAt: now, updatedAt: now, frMin: null, resolvedMin: null, pauseMin: null, waitingVendor: false,
      thread: [{ id: id + '-e1', type: 'system', text: portal ? 'Request submitted through the customer portal.' : 'Ticket created manually by ' + who() + '.', at: now }, { id: id + '-e2', type: 'rule', text: rule ? 'Routed by rule "' + rule.name + '" to ' + eff.team + '.' : 'Routed by rule: ' + eff.team + ' round-robin.', at: now }],
      activity: [{ at: now, by: who(), text: 'Ticket created' }], collision: null, verify: null, csat: null, aiText: '', aiDismissed: true, related: [] };
    set({ tickets: [t, ...state.tickets] }); if (rule && rule.action.notify) notify('Urgent ticket ' + id + ' routed to Team Lead'); toast(id + ' created'); return id;
  },
  setSettingsPage: (p) => set({ settingsPage: p }),
  toggleChannel: (c) => set({ channelsOn: { ...state.channelsOn, [c]: !state.channelsOn[c] } }),
  setSla: (prio, field, minutes) => {
    const frozen = state.tickets.map((t) => (t.slaTarget ? t : { ...t, slaTarget: { ...SLA_TARGETS[t.priority] } }));
    if (prio === 'vendor') SLA_TARGETS.vendor = minutes; else SLA_TARGETS[prio] = { ...SLA_TARGETS[prio], [field]: minutes };
    set({ tickets: frozen }); toast('SLA updated. New tickets use the new value.');
  },
  setPausePending: (v) => { SLA_CFG.pausePending = v; set({ tickets: [...state.tickets] }); toast(v ? 'Clock pauses while Pending' : 'Clock keeps running while Pending'); },
  recalcSla: () => { let n = 0; set({ tickets: state.tickets.map((t) => { if (t.status === 'Resolved') return t; n++; return { ...t, slaTarget: { ...SLA_TARGETS[t.priority] } }; }) }); toast(n + ' open tickets recalculated'); },
  toggleRule: (id) => set({ rules: state.rules.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)) }),
  moveRule: (id, dir) => { const a = [...state.rules], i = a.findIndex((r) => r.id === id), j = i + dir; if (i < 0 || j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; set({ rules: a }); },
  addRule: (rule) => { const id = 'RL-' + (state.rules.length + 1 + Math.floor(Math.random() * 1000)); const a = [...state.rules], di = a.findIndex((r) => r.cond.field === 'any'); a.splice(di < 0 ? a.length : di, 0, { id, enabled: true, ...rule }); set({ rules: a }); toast('Rule added above the default rule'); },
  addMacro: (m) => { set({ macros: [...state.macros, { id: 'MC-' + (101 + state.macros.length), uses: 0, ...m }] }); toast('Macro added. It is now in the reply box.'); },
  macroUse: (id) => set({ macros: state.macros.map((m) => (m.id === id ? { ...m, uses: m.uses + 1 } : m)) }),
  insertInReply: (id) => { const mc = state.macros.find((x) => x.id === id), mine = state.tickets.find((t) => t.assignee === ME[state.role] && t.status !== 'Resolved'), target = state.detailId || (mine && mine.id) || 'TK-1002'; set({ route: 'ticket', detailId: target, draftInsert: { text: mc.body, id } }); },
  clearDraftInsert: () => set({ draftInsert: null }),
  toggleWebhook: (id) => set({ webhooks: state.webhooks.map((w) => (w.id === id ? { ...w, active: !w.active } : w)) }),
  addWebhook: (w) => { set({ webhooks: [...state.webhooks, { id: 'WH-' + (state.webhooks.length + 1), active: true, ...w }] }); toast('Webhook added'); },
  testWebhook: (url, event) => set({ webhookLog: [{ at: getNow(), url, event, status: '200 OK', ms: 120 + Math.floor(Math.random() * 90) }, ...state.webhookLog].slice(0, 6) }),
  kbPanel: (id) => set({ kbPanelId: id }),
  kbEdit: (id) => set({ kbEditor: { id: id || null } }), kbEditClose: () => set({ kbEditor: null }),
  openArticle: (id) => { set({ kb: { ...state.kb, articles: state.kb.articles.map((a) => (a.id === id ? { ...a, views: a.views + 1 } : a)) }, route: 'article', kbArticleId: id, kbPanelId: null }); },
  kbView: (id) => set({ kb: { ...state.kb, articles: state.kb.articles.map((a) => (a.id === id ? { ...a, views: a.views + 1 } : a)) } }),
  kbHelpful: (id, yes) => { set({ kb: { ...state.kb, articles: state.kb.articles.map((a) => (a.id === id ? { ...a, helpfulYes: a.helpfulYes + (yes ? 1 : 0), helpfulNo: a.helpfulNo + (yes ? 0 : 1) } : a)) } }); },
  kbSave: (f, publish) => {
    const status = publish ? 'Published' : 'Draft', now = getNow(), base = { categoryId: f.categoryId, title: f.title.trim(), summary: f.summary.trim(), body: f.bodyText.split(/\n{2,}/).map((x) => x.trim()).filter(Boolean).map((x) => { const L = x.split('\n'); return L.every((l) => /^\d+\.\s/.test(l)) ? OL(L.map((l) => l.replace(/^\d+\.\s/, ''))) : P(x); }), audience: f.audience, tags: f.tags, status, updatedAt: now };
    if (f.id) set({ kb: { ...state.kb, articles: state.kb.articles.map((a) => (a.id === f.id ? { ...a, ...base, body: base.body.length ? base.body : a.body } : a)) }, kbEditor: null });
    else { const n = Math.max(0, ...state.kb.articles.map((a) => +a.id.slice(3))) + 1, id = 'KB-' + n; set({ kb: { ...state.kb, articles: [...state.kb.articles, { id, ...base, body: base.body.length ? base.body : [P(base.summary)], author: who(), views: 0, helpfulYes: 0, helpfulNo: 0 }] }, kbEditor: null }); }
    toast(publish ? 'Article published' : 'Draft saved');
  },
  openPortal: () => set({ route: 'portal', portalFrom: state.route === 'portal' ? state.portalFrom : state.route, selectedId: null, kbPanelId: null }), closePortal: () => set({ route: state.portalFrom || 'inbox' }),
  portalSubmit: ({ name, email, loanRef, topic, subject, description }) => {
    const id = store.createTicket({ subject: subject.trim(), requester: name.trim(), channel: 'Form', priority: 'Normal', team: 'Servicing', status: 'New', email: email.trim().toLowerCase(), loanRef: (loanRef || '').trim() || undefined, portal: true });
    mapT(id, (t) => ({ ...addEv(t, { type: 'customer', channel: 'Form', text: description.trim() + (topic ? ' (Topic: ' + topic + ')' : '') }), tags: [...t.tags, 'portal'] })); return id;
  },
  portalReply: (id, text) => { mapT(id, (t) => ({ ...addEv(t, { type: 'customer', channel: 'Form', text: text.trim() }), status: t.status === 'Pending' ? 'Open' : t.status })); notify('Customer replied on ' + id); },
  openDealer: (id) => set({ route: 'dealer', dealerId: id, selectedId: null }),
  openImport: () => set({ importOpen: true }), closeImport: () => set({ importOpen: false }),
  requestNewDealer: (stage) => set({ newDealerReq: { stage } }), clearNewDealer: () => set({ newDealerReq: null }),
  updateDealer: (id, fn, ev) => set({ dealers: state.dealers.map((d) => { if (d.id !== id) return d; const n = fn(d); return ev ? { ...n, events: [...n.events, mkEv(n, ev.type || 'system', ev.text, getNow(), ev.by || who())] } : n; }) }),
  moveDealer: (id, target) => {
    const d = state.dealers.find((x) => x.id === id); if (!d || d.stage === target) return { ok: true };
    const fwd = target > d.stage, bad = (k) => KYM_CHECKS.filter((c, i) => d.kym[i] === k);
    if (fwd && d.stage < 2 && target >= 2 && kymOverall(d) !== 'Approved') { const f = bad('Fail'), p = bad('Pending'); return { ok: false, reason: 'Blocked: KYM is ' + kymOverall(d) + '.' + (f.length ? ' Failing: ' + f.join(', ') + '.' : '') + (p.length ? ' Pending: ' + p.join(', ') + '.' : '') }; }
    if (fwd && d.stage < 3 && target >= 3 && idParity(d) !== 'match') return { ok: false, reason: 'Blocked: ' + (idParity(d) === 'missing' ? 'LMS ID and Portal ID must both be set.' : 'LMS ID (' + d.lmsId + ') and Portal ID (' + d.portalId + ') do not match.') };
    if (fwd && d.stage < 4 && target >= 4 && !d.training) return { ok: false, reason: 'Blocked: set a training appointment date and time before go-live.' };
    const now = getNow();
    store.updateDealer(id, (x) => ({ ...x, stage: target, doneAt: target === 4 ? now : null }), { text: 'Moved to Stage ' + target + ': ' + STAGES[target] + '.' + (target === 4 ? ' Dealer marked Done. SLA clocks stopped.' : '') });
    toast(id + ' moved to ' + STAGES[target]); return { ok: true };
  },
  setKym: (id, i, v) => store.updateDealer(id, (d) => ({ ...d, kym: d.kym.map((x, j) => (j === i ? v : x)) }), { text: 'KYM: ' + KYM_CHECKS[i] + ' set to ' + v + '.' }),
  setIds: (id, lms, portal) => store.updateDealer(id, (d) => ({ ...d, lmsId: lms.trim() || null, portalId: portal.trim() || null }), { text: 'IDs saved. LMS ' + (lms.trim() || 'empty') + ', Portal ' + (portal.trim() || 'empty') + '.' }),
  setTraining: (id, v) => { const t = v ? new Date(v) : null; store.updateDealer(id, (d) => ({ ...d, training: t && !isNaN(t) ? t : null }), { text: t && !isNaN(t) ? 'Training appointment set to ' + fmtStamp(t) + '.' : 'Training appointment cleared.' }); },
  sendEmail: (id, kind) => { const d = state.dealers.find((x) => x.id === id), now = getNow(); store.updateDealer(id, (x) => ({ ...x, [kind === 'kickoff' ? 'kickoffSentAt' : 'successSentAt']: now }), { type: 'email', text: (kind === 'kickoff' ? 'Kickoff' : 'Success') + ' email sent to ' + d.contact.name + '. CC ' + d.salesOwner + '.' }); toast((kind === 'kickoff' ? 'Kickoff' : 'Success') + ' email logged (mock send)'); },
  addDealerNote: (id, text) => store.updateDealer(id, (d) => d, { type: 'note', text }),
  setDealerOwner: (id, owner) => store.updateDealer(id, (d) => ({ ...d, owner }), { text: 'Owner changed to ' + agentById(owner).name + '.' }),
  createVendorReq: (dealerId, { type, deviceRef }) => { const q = { id: 'VR-' + (1001 + state.vendorReqs.length), type, dealerId, deviceRef: deviceRef || 'DEV-' + (7800 + state.vendorReqs.length), status: 'Requested', requestedAt: getNow() }; set({ vendorReqs: [...state.vendorReqs, q] }); store.updateDealer(dealerId, (d) => d, { text: type + ' request ' + q.id + ' sent to LockSure for ' + q.deviceRef + '.' }); toast(q.id + ' sent to LockSure'); },
  confirmVendorReq: (qid) => { const q = state.vendorReqs.find((x) => x.id === qid); set({ vendorReqs: state.vendorReqs.map((x) => (x.id === qid ? { ...x, status: 'Confirmed' } : x)) }); store.updateDealer(q.dealerId, (d) => d, { text: 'LockSure confirmed ' + q.type.toLowerCase() + ' request ' + qid + '.' }); },
  createDealer: (f, source) => {
    const n = Math.max(0, ...state.dealers.map((d) => +d.id.slice(4))) + 1, now = getNow(), stage = f.stage || 0, id = 'DLR-' + String(n).padStart(5, '0');
    const d = { id, name: f.name, branch: f.branch || '-', region: f.region || '-', contact: { name: f.contactName || '-', phone: f.phone || '-', email: f.email || '-' }, salesOwner: f.salesOwner || 'Anan K.', owner: ME[state.role], createdAt: now, stage, kym: KYM_CHECKS.map(() => 'Pending'), lmsId: null, portalId: null, training: null, notes: '', events: [], doneAt: stage === 4 ? now : null, kickoffSentAt: null, successSentAt: null };
    d.events.push(mkEv(d, 'system', 'Created by ' + (source === 'import' ? 'bulk import' : who()) + (stage ? ' at Stage ' + stage + '.' : '.'), now, who()));
    set({ dealers: [...state.dealers, d] }); return id;
  },
  bulkImport: (rows) => { const ids = rows.map((r) => store.createDealer(r, 'import')); toast(ids.length + (ids.length === 1 ? ' dealer imported' : ' dealers imported')); return ids; },
  addTimeEntry: (e) => set({ timeEntries: [{ id: 'te' + Date.now(), agent: ME[state.role], date: '2026-10-06', ...e }, ...state.timeEntries] }),
};
export const ticketsOfType = (s = state) => s.tickets.filter((t) => t.type === (s.ticketType === 'Support' ? 'support' : 'onboarding'));
export const me = (s = state) => ME[s.role];
export const visibleTickets = (s = state) => sortTickets(filterTickets(ticketsOfType(s), { view: s.view, priority: s.priority, query: s.query, me: me(s), filters: s.filters }), s.sort);
