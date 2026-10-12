# Meridian Desk: handoff notes

A design-only lending support desk (fictional data). Single in-memory store, no backend. Use this as a starter for automation, KB or other desk apps.

## 1. Design tokens
- **Font:** Inter (fallback `-apple-system`), mono `ui-monospace`. Sizes: page title 20/600, section title 14/600, body 14/400, label 11/600 uppercase, letter-spacing .06em, small 12/16.
- **Colour:** brand violet `#7C3AED` (hover `#6D28D9`, 50 `#F5F3FF`, 100 `#EDE9FE`); page `#F8FAFC`; card `#FFF`; line `#E2E8F0`, hairline `#F1F5F9`; text `#0F172A`, secondary `#475569`, muted `#64748B` (smallest allowed text colour, 4.5:1); status red `#FF3B30`, orange `#FF9500`, blue `#007AFF`, green `#34C759`, purple `#AF52DE`, gray `#8E8E93`; rail navy `#0F1220`.
- **Spacing:** 8pt grid (8/16/24/32). Page padding 16 to 32.
- **Radius:** card 14 to 16, panel 12, button 10, pill 999, avatar 50%.
- **Shadow:** card `0 1px 2px rgba(15,18,32,.05)`; hover `0 6px 18px rgba(15,18,32,.08)`; popover `0 12px 32px rgba(15,23,42,.16)`; overlay panel `0 8px 32px rgba(15,18,32,.12)`.
- **Controls:** default 36px, compact 32px, minimum hit area 32px (global `::after` expander on buttons), rows 56px, icon stroke 1.75.
- **Motion:** 150ms hover, 200ms panel/modal slide, 250ms tour spotlight.
- **Focus:** 2px violet outline, 2px offset.

## 2. Routes (state `route`, rendered by `Meridian Desk.dc.html`)
| route | file | notes |
|---|---|---|
| inbox | Inbox.dc.html | Support list; Onboarding uses Onboarding.dc.html |
| kanban | Kanban.dc.html (Support), Onboarding.dc.html (dealers) | |
| dashboard | Dashboard.dc.html | Team Lead / Agent variants; Onboarding strip in Onboarding |
| ticket | TicketDetail.dc.html | `detailId` |
| dealer | DealerPage.dc.html | `dealerId` |
| kb | Knowledge.dc.html | list, overlay panel, editor modal |
| article | ArticlePage.dc.html | `kbArticleId` |
| settings | Settings.dc.html -> SettingsIntegrations / SettingsAutomations | `settingsPage` |
| help | HelpPage.dc.html | tips and shortcuts |
| portal | Portal.dc.html | full-screen customer overlay (no rail) |

Shell: `Meridian Desk.dc.html` (rail, header, toolbar, tour, welcome, shortcuts, focus trap).

## 3. Store (`store.js`)
Single `state` + `store.subscribe(fn)`. Every action produces new objects; `store.reset()` restores `INIT`.
- **Ticket:** id, subject, requester, requesterRole, loanRef, channel (Email / LINE / Phone / Form), status (New / Open / Pending / Escalated / Resolved), priority, team, assignee, email, phone, tags, createdAt, updatedAt, slaTarget, thread[], activity[], csat, portal.
- **Thread event:** id, type (`customer` / `agent` public; `note` / `system` / `rule` / `ai` / `call` internal), channel, by, text, at.
- **Agents:** `AGENTS`, `ME[role]`. Roles: Agent, Team Lead.
- **SLA:** `SLA_TARGETS` (fr/res minutes per priority, plus vendor), `SLA_CFG.pausePending`, `slaClocks(ticket)`, `bizAfter/bizMinutes` (08:00 to 22:00).
- **Rules and macros:** `rules[]` (cond field/value, action team/priority/tag/notify), `matchRule`; `macros[]`.
- **Onboarding:** `dealers[]` (stage 0 to 4, kym[5], lmsId, portalId, training, events[]), `vendorReqs[]`; `dealerView`, `kymOverall`, `idParity`, `onbKpis`.
- **KB:** `kb.categories[]` (id, name, icon, description), `kb.articles[]` (id, categoryId, title, summary, body blocks `{t:'p'|'ol', x}`, status Draft/Published, audience Public/Internal, tags, author, updatedAt, views, helpfulYes, helpfulNo).
- **Selectors:** `visibleTickets`, `viewCounts`, `dashboard`, `ticketsOfType`, `visibleDealers`, `onbViewCounts`, `kbList`, `kbPortalArticles`, `kbStats`, `kbTop`, `kbRelated`, `kbSuggest`, `kbHelpfulPct`, `portalCount`, `isPublicEvent`, `portalStage`.
- **Config:** `channelsOn`, `webhooks[]`, `webhookLog[]`.

## 4. Components (props)
- `Pill` kind=priority|status|team|tone, value, label. `SlaChip` / `SlaRing` size, pct, state, centre. `Icon` icon, size, stroke (default 1.75), color. `Avatar` initials, color, size (auto-contrast).
- `KCard` (ticket card) ticket, selected, onClick, onMenu. `DCard` (dealer card) dealer, selected, menuOpen, onClick, onMenu.
- `QuickPanel` (ticket overlay, 420px). `DealerPanel`. `FilterBar` (chips and Filters popover). `BulkImport` (3-step CSV modal).

## 5. Business rules
- **SLA:** Urgent 15 min / 4 h, High 1 h / 8 h, Normal 4 h / 24 h, Low 8 h / 72 h, vendor 24 h; clock runs 08:00 to 22:00 only. Pending pauses the clock when `pausePending` is on. Editing a target affects new tickets (existing keep a frozen `slaTarget` until Recalculate).
- **Routing:** rules run top to bottom, first enabled match wins; the "any" rule is the default.
- **Onboarding moves:** forward to stage 2 needs all KYM checks Pass; to stage 3 needs LMS and Portal IDs set and matching; to stage 4 needs a training date. Backward is always allowed. Stage 4 stops the SLA clock.
- **KB visibility:** the Portal shows only Published + Public articles. Internal notes and system events are never public.
- **Portal ticket:** channel Form, status New, priority Normal, routed by rules.

## 6. Replace mock logic with real APIs
- `createTicket`, `updateTicket`, `sendMessage`, `escalate`, `resolve`, `bulkUpdate`, `portalSubmit`, `portalReply`: ticket API.
- `moveDealer`, `setKym`, `setIds`, `setTraining`, `sendEmail`, `createDealer`, `bulkImport`, `createVendorReq`, `confirmVendorReq`: onboarding / vendor API.
- `kbSave`, `kbHelpful`, `openArticle`/`kbView` (view counters): KB API.
- `setSla`, `setPausePending`, `recalcSla`, `toggleRule`, `moveRule`, `addRule`, `addMacro`, `toggleChannel`, `addWebhook`, `testWebhook`: settings API.
- Portal "track" lookup (ref + email match in `Portal.dc.html`) must become an authenticated, rate-limited endpoint.
- `getNow()` is a simulated clock (fixed Tue 6 Oct 2026 14:00 plus elapsed); use real time in production.
- API key, webhooks, copy-to-clipboard and attachments are demo only.
