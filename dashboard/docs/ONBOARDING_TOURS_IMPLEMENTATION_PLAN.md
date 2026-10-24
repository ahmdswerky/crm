# CRM onboarding tours implementation plan

## Recommendation

Use React Joyride v3.

It fits this React 19 dashboard better because it provides:

- Native React integration and the `useJoyride` hook.
- React 19 compatibility, focus trapping, keyboard navigation, ARIA support, and focus restoration.
- Async `before` hooks, target waiting, route coordination, custom portals, and failure reporting.
- Custom tooltip components that can match the CRM's Quiet Ledger design.

References: [React Joyride repository](https://github.com/gilbarbara/react-joyride), [Joyride hook](https://react-joyride.com/docs/hook), [conditional steps](https://react-joyride.com/docs/how-it-works).

Driver.js is preferable only if bundle size and framework independence are the primary goals. It is dependency-free, approximately 5 KB gzipped, MIT licensed, keyboard-enabled, and supports async elements and contextual hints. References: [Driver.js repository](https://github.com/nilbuild/driver.js), [Driver.js configuration](https://driverjs.com/docs/configuration).

| Concern | React Joyride | Driver.js |
|---|---|---|
| React 19 integration | Strong | Imperative bridge required |
| Lazy routes and route transitions | Strong through hooks | Manual orchestration |
| Async targets | `before` hooks and target waiting | `waitForElement` and callbacks |
| Accessibility | Focus trap, ARIA, keyboard, restoration | Keyboard support; more behavior must be integrated |
| Custom CRM styling | Custom tooltip/components | CSS and DOM hooks |
| Hints/contextual highlights | Adequate | Excellent |
| Bundle size | Larger | Smaller |
| Fit for this CRM | Best | Good fallback |

Use one universal onboarding strategy: every user receives the same general product orientation, while unavailable routes and actions are filtered according to permissions. Do not create separate agent, manager, and administrator tour copies.

The automatic tour should remain short. Full product coverage should come from additional page-specific tours launched on demand, rather than one overwhelming 30-step sequence.

## Current product boundaries

The current authenticated shell exposes Overview, Reports, Agents, Pipeline, Deals, Properties, Accounts, Payments → Invoices, Profile, and super-admin Access. Navigation is permission-filtered and includes collapsible Payments, Real estate, and Settings groups. See [app-shell.tsx](/home/swerky/dev/crm/dashboard/src/components/shared/app-shell.tsx) and [App.tsx](/home/swerky/dev/crm/dashboard/src/App.tsx).

Routes are lazy-loaded, so the tour must wait for route mounts before resolving targets.

Contacts are used by account and lead pages, but there is currently no `/contacts` route in the application router. Do not ship a standalone Contacts tour until that route is reachable.

Invoices currently displays an empty “Invoice records will appear here” state. Ship only a navigation/boundary explanation for it; do not teach invoice workflows that do not exist. See [Invoices page](/home/swerky/dev/crm/dashboard/src/pages/invoices/index.tsx).

Payments remain a product boundary, not a fabricated workflow. See [PRODUCT.md](/home/swerky/dev/crm/dashboard/PRODUCT.md) and [AGENTS.md](/home/swerky/dev/crm/dashboard/AGENTS.md).

## Tour catalog

| Tour | Required coverage |
|---|---|
| `workspace-introduction` | Welcome, sidebar groups, Overview, Profile menu, theme/language controls, command palette, and how to restart tours |
| `overview` | KPI cards, revenue and leaderboard ranges, record-summary areas, and links into operational work |
| `pipeline` | Lead stages, search, status/source/agent filters, refresh, preview drawer, pagination/load-more, and Add new lead when permitted |
| `lead-record` | Lead details, connected contact, assigned agent/account, status, edit, activity history, and delete boundary |
| `deals` | Deal filters, relation pickers, property selection, explicit details/edit actions, create flow, and deal value/status |
| `properties` | Listing filters, search, create/edit, property gallery, details, related Deals, and Make deal |
| `accounts` | Organization search/filtering, row actions, account details, related contacts, and deletion restrictions |
| `contacts` | Contact list/detail/create/edit/delete once the missing route is implemented |
| `reports` | Saved report archive, refresh, report details, status, period, and CSV download when available |
| `people-and-access` | Agents list, agent detail/edit, profile, and super-admin Access/roles |
| `invoices-boundary` | Payments group, Invoices entry, and the current empty-state explanation only |

The automatic first-run tour should contain approximately 8–10 steps:

1. Welcome to the CRM.
2. Sidebar and product areas.
3. Overview workspace.
4. Pipeline as the lead-to-deal starting point.
5. Deals and Properties as connected workflows.
6. Accounts and people context.
7. Reports and operational visibility.
8. Profile, preferences, and tour restart.
9. Optional Invoices boundary step when visible.
10. Completion message with “Explore a page tour” guidance.

Page-specific tours should be available from the account menu and, where useful, a small “Tour this page” action in the page header.

## Implementation changes

### Tour foundation

- Add `react-joyride` using npm and commit the resolved version to `package-lock.json`; the repository explicitly uses npm.
- Add a global `OnboardingProvider` and `TourHost` inside the authenticated application.
- Use `useJoyride`, not only the basic uncontrolled component, because the tour must coordinate with React Router and lazy-mounted pages.
- Define typed tour IDs, step definitions, route requirements, permission requirements, and target keys.
- Render Joyride through `document.body` or a dedicated portal so sidebar, table, dialog, and overflow containers cannot clip the tooltip.
- Add a custom tooltip component using existing CRM tokens: Inter, low-radius surfaces, thin rules, restrained Ledger Blue, dark-mode support, RTL-safe logical positioning, and reduced-motion support.
- Keep the tour informational. It must never submit forms, delete records, change statuses, or trigger backend mutations.

### Persistence and lifecycle

Use versioned, per-user local storage:

```text
crm-dashboard-onboarding:<user-id>:v1
```

Persist `started`, `completed`, `dismissed`, and the last completion version.

Behavior:

- Auto-start once after successful authentication only when the user is on `/`.
- Do not interrupt users who deep-link directly to another page.
- Allow manual restart at any time.
- Closing or skipping stops the tour without marking it completed.
- A completed tour never auto-runs again unless the version changes.
- Isolate state by authenticated user ID so shared browsers do not leak completion state.
- Do not add a backend onboarding API in this phase.

### Route and target coordination

- Extract the existing navigation metadata into a reusable configuration module so navigation visibility and tour visibility use the same permission rules.
- Add stable `data-onboarding` attributes rather than relying on visible text, Tailwind classes, row content, or DOM positions.
- Add markers to shell groups, navigation items, account menu, command palette, page headers, filters, search fields, refresh actions, create actions, tables, preview areas, forms, galleries, related-record sections, reports, profile controls, and Access.
- Before a cross-route step, navigate with React Router, expand the required sidebar group, and wait for the target to mount.
- Filter permission-dependent steps before starting the tour. Missing permissions should remove steps, not display forbidden or confusing content.
- If a target still cannot be resolved after the configured wait, record the failure, skip it, and continue safely.

### Design and accessibility

- Support Next, Back, Skip, Close, and Done.
- Keep `Esc`, keyboard navigation, focus trapping, and focus restoration functional.
- Ensure tooltip content has an accessible name and readable contrast.
- Test light, dark, mobile, RTL, and `prefers-reduced-motion`.
- Do not add focus borders, rings, or shadows to CRM form controls; tour styling must not violate the existing input-focus rule.
- Keep tour animation within the product’s 150–200 ms motion guidance or disable animation for reduced-motion users.

## Delivery phases

1. Add the dependency, provider, persistence, manual restart action, and custom tooltip.
2. Instrument the shell and implement `workspace-introduction`.
3. Implement Overview, Pipeline, Deals, Properties, and Accounts tours.
4. Implement Reports, Agents, Profile, and super-admin Access tours with permission filtering.
5. Add the Invoices boundary tour only; defer invoice workflow education.
6. Restore or implement the Contacts route, then add the Contacts tour.
7. Run accessibility, responsive, RTL, reduced-motion, and browser verification.

## Test plan

Add focused Vitest/Testing Library coverage for:

- First-run auto-start.
- No repeat auto-start after completion.
- Per-user and versioned persistence.
- Manual replay.
- Skip, close, finish, and restart behavior.
- Permission-filtered steps.
- Super-only Access steps.
- Route navigation and lazy target waiting.
- Missing-target recovery.
- Collapsed sidebar and mobile sheet behavior.
- Dark mode, RTL, and reduced-motion configuration.

Add Playwright coverage for:

- New authenticated user completing the universal tour.
- Restricted user visibility for Reports, Agents, and Access.
- Super user receiving Access steps.
- Desktop and mobile layouts.
- Keyboard-only completion and `Esc` dismissal.
- Focus restoration after completion and dismissal.
- Empty Reports and Invoices states.
- Slow API responses and missing targets.
- No console errors, clipped tooltips, horizontal overflow, or accidental backend mutations.

Run the repository’s normal verification gates:

```text
npm run api:check
npm run lint
npm run typecheck
npm run test
npm run build
npm run test:e2e
```

