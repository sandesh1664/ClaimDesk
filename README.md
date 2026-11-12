# ClaimDesk
Multi-line insurance claims portal concept prepared for ADNIC by Sandesh Joshi. The demo uses fictional policies, customers and documents and a simulated garage partner.

## Run and verify

Requires Node.js 22.13 or later.

- `npm run dev` starts the UI and the same Worker used in deployment, backed locally by in-memory SQLite.
- `npm test` checks authentication, role enforcement, cross-portal handoffs, attachment access, sandbox isolation, administrator changes and concurrent retries.
- `npm run build` packages the TypeScript authentication module, JavaScript workflow engine and browser UI into a Cloudflare Worker. Hosted data uses D1.

## Public portfolio demo

The Render deployment runs the same server and workflows with temporary, in-memory SQLite and fictional records. Visitors can open it directly and choose a sample account. Demo workspaces reset when the service restarts.

For a Node deployment, use `npm run build` and `npm start`. Set `RENDER_EXTERNAL_URL` to the public HTTPS origin when using a compatible reverse proxy outside Render. The service listens on `PORT` and exposes `/api/health`.

## Demo accounts

Use `ClaimsDemo2026!` with `client@claimdesk.test`, `officer@claimdesk.test`, `support@claimdesk.test` or `admin@claimdesk.test`. The sign-in screen fills in the sample credentials when you select an account. Sign out and back in to continue the same sandbox under another role.

| Portal | Workflow |
| --- | --- |
| Client | Multi-line, multi-step intake, case tracking, categorized document uploads |
| Claims officer | Searchable queue, document requests, assessment, garage referral and closure |
| Service desk | Restricted dispatch view, partner response history, retry and duplicate protection |
| Admin | Case assignment, priority, team directory, audit history and demo reset |

## Architecture

The Worker hashes session tokens before storing them, expires them after eight hours, and invalidates them on sign-out or account switch. HTTP-only cookies tie authenticated accounts to a browser sandbox. The server derives the role from the session, checks every mutation and attachment download, and projects only the fields that each role needs. The client sees only claims belonging to the sample account.

The database uses compare-and-swap updates for demo claim mutations. The first simulated dispatch fails and the next succeeds with the original referral reference. Concurrent retries commit a single recovery event and leave exactly two dispatch attempts in the log. Upload sizes and session storage are bounded. The sample login code is intentionally public.

## Design references

- ADNIC public visual language and claims journey: https://www.adnic.ae/
- Motor claim steps and document categories: https://www.adnic.ae/web/guest/personal-claim-motor

Independent portfolio concept. Use the supplied demo identities and fictional documents. An actual insurance deployment would require an identity provider, production policy verification, a real partner API, and dedicated document storage and retention controls.

## Evidence, assessment and service levels

- The claims team requests a document by category and records an acceptance or replacement decision. The client can see that decision and the explanation in the Evidence tab.
- New motor cases must have a repair estimate, policy excess, assessment note and repair partner before referral. Estimates use integer fils and stay visible to staff. Claims created by earlier demo versions continue to follow their original workflow.
- Client correspondence and staff-only notes share the case history. Staff-only notes are removed by the server from the client projection.
- First-review targets are 4 hours for urgent cases, 12 hours for high priority and 24 hours for standard. The administrator can see review performance and download the audit export. Formula-like values are escaped in CSV output.
- Repeated submission keys return the original claim for the same payload. Concurrent retries and claims updates are checked through revision-based database writes.

## Deployment checks

1. Run `npm test`, `npm run build`, and `node --check dist/server/index.js`.
2. Verify `GET /api/health` returns HTTP 200 with `{"status":"ready"}` after the D1 migrations and Worker deployment.
3. Walk through client submission, evidence review, assessment, simulated dispatch recovery and administrator export with the sample accounts.

For a live insurer deployment, replace the public demo credentials with the insurer's identity provider, use durable attachment storage with malware scanning and retention controls, and connect the real policy and garage integrations. The demo uses bounded fictional data, a simulated garage and a resettable operational history.


## Insurance lines

The shared TypeScript catalog defines policy references, insured items, incident types, evidence categories and handling queues for eleven demo lines.

- Personal: motor, health, home, travel and personal accident.
- Commercial: property, marine, aviation, energy, engineering and construction, and liability.

New sandboxes include a fictional case for every line. Existing sandboxes retain their saved cases and can submit new lines immediately. Resetting the demo from Administration restores the expanded sample set.

Motor cases retain their assessment, simulated garage referral and recovery workflow. Non-motor cases use examiner decisions after evidence review. The sample outcomes exercise the workflow and make no coverage determination, payment or policy promise. The demo accepts fictional evidence only.
