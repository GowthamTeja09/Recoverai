# RecoverAI v2.1 Enterprise

Autonomous revenue-recovery orchestration for failed digital payments, with AI-style diagnosis, deterministic safety guardrails, recovery actions, payment verification, RBAC, and tamper-evident audit trails.

RecoverAI is a hackathon-focused full-stack prototype for AI Revenue Recovery. It demonstrates a closed-loop flow:

**Payment Failure → Webhook Ingestion → Risk Scoring → Diagnostic / Recovery Recommendation → Safety & Policy Evaluation → Recovery Orchestration → Customer Payment / Recovery Event → Verification → Revenue Recovered → Audit Trail**

---

## Important Implementation Note

This repository is a **working demo/simulation, not a production Razorpay deployment**.

- The project contains a Razorpay-compatible webhook ingestion path and a simulated Razorpay client for recovery actions. The current `razorpayClient.js` does **not** make live outbound Razorpay REST API calls; payment links, recovery orders, subscription retries, and customer payments are simulated in memory.
- Likewise, the AI diagnostic agent currently uses **deterministic domain heuristics** rather than making a live Gemini/OpenAI/LLM API request. The model registry contains seeded model metadata/metrics for the dashboard; it is not training or serving those ML models.

These distinctions are intentional for the hackathon demo and should be preserved when presenting the project.

---

## 🎯 Problem

Failed payments create immediate revenue leakage. A merchant needs to determine:

1. Why did the payment fail?
2. Is the failure worth attempting to recover automatically?
3. Which recovery action is most appropriate?
4. Is the action safe to execute?
5. When should the customer be contacted?
6. Did the recovery actually result in a successful payment?
7. Can every decision be audited?

RecoverAI turns those questions into a closed-loop recovery pipeline instead of treating every failed payment with the same retry strategy.

---

## 💡 Solution

RecoverAI evaluates each failed payment using transaction and customer context, recommends a recovery strategy, subjects that recommendation to deterministic policy checks, executes an appropriate recovery action, and verifies the eventual payment outcome.

> **Key design principle:** AI recommends; deterministic policy decides; the recovery orchestrator executes; payment events verify the outcome.

---

## 🏗️ Architecture

### Pipeline Overview

| Stage | Component | Responsibility |
|---|---|---|
| 1 | **Razorpay / Simulator** | Emits `payment.failed` events |
| 2 | **Webhook Receiver** | HMAC verification, event validation, deduplication |
| 3 | **Event Queue** | In-memory `EventEmitter`, async pipeline trigger |
| 4 | **Revenue Risk Engine** | Feature extraction, risk score, recovery probabilities |
| 5 | **AI Diagnostic Agent** | Domain heuristics, root-cause classification, action recommendation |
| 6 | **Policy Safety Engine** | Amount limit, retry limit, cooldown, confidence, contact limits, quiet hours, action whitelist, in-flight/idempotency |
| 7 | **Decision Routing** | Routes to `APPROVED`, `ESCALATED`, or `REJECTED` |
| 8 | **Recovery Orchestrator** | Executes: Subscription Retry / Recovery Order / Payment Link / Reminder |
| 9 | **Customer Payment Event** | Customer completes (or fails) the recovery action |
| 10 | **Outcome Verification** | Classifies result as `RECOVERED` or `PARTIAL` |
| 11 | **Revenue Metrics** | Updates dashboard metrics |
| 12 | **Audit Hash Chain** | Tamper-evident logging of every step |

### Decision Routing

```
APPROVED    → Recovery Orchestrator → (Subscription Retry | Recovery Order | Payment Link | Reminder)
ESCALATED   → CRM Ticket
REJECTED    → Action Halted
```

### RecoverAI Complete System Architecture
<img width="1536" height="1024" alt="Complete System Architecture" src="https://github.com/user-attachments/assets/fab5f9e4-b47b-4f20-ab14-38c6d5907246" />

### Flow Diagram

```
                     ┌─────────────────────────┐
                     │   Razorpay / Simulator   │
                     │   payment.failed events  │
                     └────────────┬─────────────┘
                                  │
                                  ▼
                     ┌─────────────────────────┐
                     │     Webhook Receiver     │
                     │  HMAC verification       │
                     │  Event validation        │
                     │  Deduplication            │
                     └────────────┬─────────────┘
                                  │
                                  ▼
                     ┌─────────────────────────┐
                     │       Event Queue        │
                     │  In-memory EventEmitter  │
                     │  async pipeline trigger  │
                     └────────────┬─────────────┘
                                  │
                                  ▼
                     ┌─────────────────────────┐
                     │   Revenue Risk Engine    │
                     │  feature extraction      │
                     │  risk score               │
                     │  recovery probabilities  │
                     └────────────┬─────────────┘
                                  │
                                  ▼
                     ┌─────────────────────────┐
                     │  AI Diagnostic Agent     │
                     │  domain heuristics       │
                     │  root-cause classification│
                     │  action recommendation   │
                     └────────────┬─────────────┘
                                  │
                                  ▼
                     ┌─────────────────────────┐
                     │  Policy Safety Engine    │
                     │  amount limit             │
                     │  retry limit              │
                     │  cooldown                 │
                     │  confidence                │
                     │  contact limits            │
                     │  quiet hours               │
                     │  action whitelist          │
                     │  in-flight/idempotency    │
                     └────────────┬─────────────┘
                                  │
              ┌───────────────────┼───────────────────┐
              ▼                   ▼                   ▼
          APPROVED            ESCALATED            REJECTED
              │                   │                   │
              ▼                   ▼                   ▼
   Recovery Orchestrator     CRM Ticket          Action Halted
              │
   ┌──────────┼───────────┬──────────────┐
   ▼          ▼           ▼              ▼
Subscription  Recovery   Payment       Reminder
Retry         Order      Link
   │          │           │              │
   └──────────┴───────────┴──────────────┘
                          │
                          ▼
              Customer Payment Event
                          │
                          ▼
               Outcome Verification
                          │
              ┌───────────┴───────────┐
              ▼                       ▼
          RECOVERED                PARTIAL
              │
              ▼
        Revenue Metrics
              │
              ▼
        Audit Hash Chain
```

---

## 🔄 Recovery Strategies

RecoverAI currently supports these action types:

| Action | Intended Use |
|---|---|
| `SUBSCRIPTION_RETRY` | Recurring payment with a transient failure |
| `RECOVERY_ORDER` | One-time payment where a fresh checkout/order is appropriate |
| `PAYMENT_LINK` | Customer can complete payment through a recovery link |
| `REMINDER` | Customer notification without creating a new payment action |
| `ESCALATE` | Human/CRM escalation for risky or blocked cases |

### Examples

**3DS / authentication failure**
```
payment.failed → AUTHENTICATION_FAILED → CUSTOMER_3DS_ABANDONMENT
→ PAYMENT_LINK → Customer payment → Verification → RECOVERED
```

**Subscription gateway failure**
```
subscription.charge.failed → GATEWAY_ERROR → TRANSIENT_ISSUER_OUTAGE
→ SUBSCRIPTION_RETRY
```

**High-value transaction**
```
₹1,45,000 → Amount > ₹50,000 autonomous limit → ESCALATED → CRM ticket
```

---

## 🛡️ Safety & Guardrails

The policy engine is deterministic and independent of the diagnostic recommendation.

| Guardrail | Default |
|---|---|
| Maximum autonomous recovery amount | ₹50,000 |
| Maximum recovery attempts | 3 |
| Minimum cooldown | 4 hours |
| Minimum diagnostic confidence | 70% |
| Maximum customer contacts / 24h | 2 |
| Quiet hours | 22:00–08:00 |
| Allowed actions | Subscription retry, recovery order, payment link, reminder, escalation |

The policy engine can return: `APPROVED`, `REJECTED`, or `ESCALATED`.

This prevents an AI recommendation from automatically becoming an unrestricted financial action.

---

## 🤖 Diagnostic & Risk Engine

### Revenue Risk Engine

The risk engine extracts:

- Transaction amount
- Failure code
- Failure source
- Attempt count
- Payment method
- Subscription status
- Customer LTV
- Customer order count
- Historical failed-payment count
- Customer failure rate

It calculates:

- `riskScore`: 0.05 – 0.98
- `riskLevel`: `LOW` / `MEDIUM` / `HIGH` / `CRITICAL`

It also estimates recovery probabilities for the supported strategies.

### Diagnostic Agent

`AIDiagnosticAgent_v3.2` classifies common failure patterns such as:

- `CUSTOMER_3DS_ABANDONMENT`
- `TRANSIENT_ISSUER_OUTAGE`
- `INSUFFICIENT_FUNDS_RECURRING`
- `SUBSCRIPTION_TOKEN_EXPIRED`
- `ACQUIRER_TRANSIENT_FAILURE`
- `GENERAL_DECLINE`
- `HIGH_VALUE_REPEATED_DECLINE`
- `RISK_SECURITY_BLOCK`

The current implementation is deterministic JavaScript domain logic, **not** a live LLM call.

---

## 💳 Razorpay Integration Status

### Implemented

- Razorpay-style `payment.failed` webhook ingestion
- `subscription.charge.failed` event support
- `payment.captured`, `order.paid`, and `invoice.paid` verification events
- HMAC-SHA256 signature verification logic
- Razorpay-style payment entity fields
- Simulated payment-link creation
- Simulated recovery-order creation
- Simulated subscription retry scheduling
- Simulated customer payment
- Recovery reference IDs
- Payment recovery metadata

### Demo / Simulated

The following are currently simulated locally:

- Outbound Payment Links API call
- Outbound Orders API call
- Subscription retry API call
- Actual customer payment
- WhatsApp/SMS/email dispatch
- CRM/Zendesk/Freshdesk ticket creation

The generated `rzp.io` URLs are demo-style identifiers and are not created by a live Razorpay account.

---

## 📥 Event Ingestion

### Live-style webhook endpoint

`POST /api/webhooks/razorpay`

The receiver:

1. Reads the webhook event.
2. Checks the signature.
3. Creates an idempotency key.
4. Drops duplicates.
5. Enqueues the event.
6. Starts the recovery pipeline.

### Demo webhook endpoint

`POST /api/webhooks/simulate`

The frontend's Simulate Webhook modal uses this endpoint.

**Available presets:**

- 3DS Bank OTP Abandonment
- Subscription Bank Gateway Timeout
- Insufficient Balance Decline
- Enterprise High-Ticket Limit Breach

---

## 🔁 Verification & Closed Loop

After a recovery action is dispatched, the system tracks the recovery action.

A simulated customer payment can be triggered through:

`POST /api/webhooks/simulate-pay`

The outcome analyzer:

1. Locates the recovery case.
2. Determines the paid amount.
3. Classifies the result as `RECOVERED` or `PARTIAL`.
4. Updates the recovery case.
5. Marks the recovery action `VERIFIED_PAID`.
6. Updates customer LTV/order statistics.
7. Writes verification and recovery audit events.

---

## 🔐 Audit Trail

Every important system action is recorded in `audit_logs`.

Each record contains:

- Previous hash
- Timestamp
- Actor
- Action
- Details
- Current hash

The current hash is calculated using SHA-256 over the previous hash and event data:

```
Hash(n) = SHA256(Hash(n-1) + Timestamp + Actor + Action + Details)
```

The audit service can verify the entire chain.

**Endpoint:** `GET /api/audit/verify`

The UI displays the chain as verified when integrity validation succeeds.

> This is tamper-evident, not an externally immutable ledger. The audit records are stored in the application's local data store.

---

## 👥 Role-Based Access Control

The UI exposes four roles: **Super Admin**, **Risk Officer**, **Merchant Operator**, and **Support Agent**.

### Permission Matrix

| Permission | Super Admin | Risk Officer | Merchant Operator | Support Agent |
|---|:---:|:---:|:---:|:---:|
| View metrics | ✓ | ✓ | ✓ | ✓ |
| View cases | ✓ | ✓ | ✓ | ✓ |
| Trigger manual action | ✓ | ✓ | ✓ | — |
| Update policy rules | ✓ | ✓ | — | — |
| Manage models | ✓ | ✓ | — | — |
| View audit logs | ✓ | ✓ | — | — |
| Manage secrets | ✓ | — | — | — |

### Demo Authentication Note

For frictionless hackathon use, requests without a JWT receive a demo user, and the frontend supplies the selected role through `x-demo-role`.

Therefore the current RBAC is suitable for demonstrating permission behavior, but this authentication approach **should not be considered production-grade authentication**.

---

## 🗃️ Data Store

The project uses a lightweight custom JSON-backed relational-style store:

`data/recoverai_store.json`

**Logical tables include:**

- merchants
- customers
- payments
- recovery_cases
- recovery_actions
- audit_logs
- policy_rules
- model_registry
- processed_events

> The repository contains a `better-sqlite3` dependency, but the current implementation does not use SQLite. `server/db/database.js` implements the persistence layer directly using JSON files.

---

## 📊 Dashboard

The React dashboard provides:

- Revenue at risk
- Revenue recovered
- Recovery success rate
- Active recovery cases
- Guardrail status
- Live audit stream
- Recovery case explorer
- Execution timelines
- Safety policy studio
- Model registry
- Integration/secrets view
- Webhook simulator
- Batch ingestion
- Audit integrity verification

The dashboard receives periodic snapshots through Server-Sent Events:

`GET /api/stream/dashboard`

---

## 🧪 Demo Scenarios

### Scenario 1 — 3DS Recovery

**Select:** 3DS Bank OTP Abandonment, ₹2,499

```
payment.failed → CUSTOMER_3DS_ABANDONMENT → PAYMENT_LINK → APPROVED
→ Payment Link dispatched → Simulate Customer Payment → VERIFIED_PAID → RECOVERED
```

### Scenario 2 — Subscription Recovery

**Select:** Subscription Bank Gateway Timeout, ₹14,999, Recurring = true

```
subscription.charge.failed → TRANSIENT_ISSUER_OUTAGE → SUBSCRIPTION_RETRY
→ APPROVED → Retry scheduled
```

### Scenario 3 — High-Value Escalation

**Select:** Enterprise High-Ticket Limit Breach, ₹1,45,000

```
payment.failed → high-value risk → amount guardrail breached → ESCALATED → CRM ticket simulation
```

### Scenario 4 — Duplicate Event

Submit the same webhook event more than once.

```
First event  → INGESTED
Duplicate    → DUPLICATE_IGNORED
```

---

## 🧪 Automated Tests

Run:

```bash
npm test
```

**Current test suite covers:**

- Risk feature extraction and scoring
- Recovery probability calculation
- Diagnostic root-cause classification
- Diagnostic recovery recommendation
- Normal policy approval
- High-value policy escalation
- Subscription recovery routing
- SHA-256 audit-chain integrity

The uploaded project was tested during preparation of this README:

- ✓ Revenue Risk Engine
- ✓ AI Diagnostic Agent
- ✓ Policy Safety Engine approval
- ✓ Policy Safety Engine escalation
- ✓ Subscription routing
- ✓ Audit hash-chain verification

**ALL RECOVERAI ENGINE TESTS PASSED**

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm 9+

> Node.js 22 was used when validating the backend test suite.

### 1. Install backend dependencies

From the project root:

```bash
npm install
```

### 2. Install frontend dependencies

```bash
cd client
npm install
cd ..
```

### 3. Start backend

```bash
npm run server
```

- Backend: `http://localhost:5000`
- Health check: `http://localhost:5000/api/health`

### 4. Start frontend

Open another terminal:

```bash
cd client
npm run dev
```

Frontend: `http://localhost:5173`

The Vite development server proxies `/api` requests to `http://localhost:5000`.

---

## 📁 Project Structure

```
recoverai/
├── package.json
├── package-lock.json
├── README.md
│
├── server/
│   ├── index.js
│   │
│   ├── db/
│   │   ├── database.js
│   │   └── seed.js
│   │
│   ├── engines/
│   │   ├── aiDiagnosticAgent.js
│   │   ├── pipeline.js
│   │   ├── policySafetyEngine.js
│   │   ├── recoveryOrchestrator.js
│   │   └── riskEngine.js
│   │
│   ├── ingestion/
│   │   ├── apiIngestionService.js
│   │   ├── deduplicator.js
│   │   ├── eventQueue.js
│   │   └── webhookReceiver.js
│   │
│   ├── integrations/
│   │   ├── crmClient.js
│   │   ├── notificationChannels.js
│   │   └── razorpayClient.js
│   │
│   ├── ml/
│   │   └── modelRegistry.js
│   │
│   ├── routes/
│   │   ├── audit.js
│   │   ├── cases.js
│   │   ├── ingestion.js
│   │   ├── metrics.js
│   │   ├── models.js
│   │   ├── policies.js
│   │   ├── secrets.js
│   │   ├── stream.js
│   │   └── webhooks.js
│   │
│   ├── security/
│   │   ├── auditLogStore.js
│   │   ├── auth.js
│   │   ├── rbac.js
│   │   └── secretsManager.js
│   │
│   ├── verification/
│   │   └── outcomeAnalyzer.js
│   │
│   └── test/
│       └── engines.test.js
│
└── client/
    ├── src/
    │   ├── App.jsx
    │   ├── components/
    │   └── views/
    ├── package.json
    ├── vite.config.js
    └── tailwind.config.js
```

---

## 🔌 Main API Endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | Backend health |
| POST | `/api/webhooks/razorpay` | Razorpay-style webhook ingestion |
| POST | `/api/webhooks/simulate` | Demo failure event |
| POST | `/api/webhooks/simulate-pay` | Simulate recovery payment |
| GET | `/api/cases` | Recovery cases |
| GET | `/api/cases/:id` | Case detail/timeline |
| POST | `/api/cases/:id/action` | Manual recovery action |
| GET | `/api/policies` | Policy rules |
| PUT | `/api/policies/:id` | Update policy |
| GET | `/api/audit` | Audit logs |
| GET | `/api/audit/verify` | Verify audit chain |
| GET | `/api/models` | Model registry |
| GET | `/api/metrics` | Recovery metrics |
| POST | `/api/ingestion/batch` | Batch transaction ingestion |
| GET | `/api/stream/dashboard` | Dashboard SSE stream |

---

## ⚠️ Current Prototype Limitations

The following should be understood before calling this system "production-ready":

1. **Razorpay actions are simulated** — `server/integrations/razorpayClient.js` creates local simulated links/orders/retries rather than calling Razorpay REST APIs.
2. **AI is heuristic-based** — `AIDiagnosticAgent` currently uses deterministic JavaScript rules. It does not make a live Gemini/OpenAI API request.
3. **Queue is in-memory** — The event queue uses Node.js `EventEmitter` and an in-memory array. Redis Streams are not currently deployed.
4. **Database is JSON-backed** — The current persistence layer is a custom JSON-backed relational-style store, not PostgreSQL/MySQL/SQLite.
5. **Notifications are simulated** — Email, SMS, WhatsApp, and CRM integrations record/return simulated dispatch results.
6. **Model metrics are seeded** — The model registry displays predefined model metadata and evaluation metrics. The repository does not contain model training or inference for the listed ML algorithms.
7. **Demo authentication** — No-token requests receive a demo identity and the selected role header. Production deployment would require a real authentication provider and server-side identity/tenant enforcement.
8. **Single-process architecture** — The current application is designed for a hackathon/demo environment rather than horizontally scaled production workloads.

---

## 🛠️ Recommended Production Evolution

| Current (Demo) | Production Target |
|---|---|
| JSON Store | PostgreSQL |
| In-memory Queue | Redis Streams / Kafka |
| Heuristic Diagnostic | LLM + validated domain classifier |
| Simulated Razorpay Client | Razorpay REST APIs |
| Demo Authentication | OAuth/OIDC + JWT + tenant isolation |
| Simulated Notifications | WhatsApp / SMS / Email providers |
| Simulated CRM | Zendesk / Freshdesk / CRM API |
| Single Process | Containerized horizontally scalable workers |

---
## License

This project was created as a hackathon prototype.
