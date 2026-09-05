# RecoverAI — AI-Powered Revenue Recovery Agent

> **Razorpay AI Buildathon 2026 — Track 03: AI Revenue Recovery**

RecoverAI is an AI-powered revenue recovery platform that detects payment failures, diagnoses their likely causes, recommends the best recovery strategy, and orchestrates safe recovery actions.

The system combines **AI reasoning, deterministic business policies, automated recovery orchestration, outcome verification, and analytics** to help merchants recover revenue that would otherwise be lost due to failed or at-risk payments.

---

## 🚀 Problem

Payment failures are a major source of revenue leakage for digital businesses.

A failed payment does not always mean a lost customer. The failure may be caused by:

* Temporary bank/network issues
* Insufficient balance
* Expired cards
* Authentication failures
* Risk or fraud signals
* Customer inactivity
* Repeated payment failures

Traditional systems often use fixed retry rules that treat every failure similarly.

RecoverAI takes a different approach:

> **Understand the failure → determine the best recovery strategy → execute safely → verify the outcome → learn from the result.**

---

# 💡 Solution

RecoverAI continuously processes payment events and creates a recovery decision for each revenue-risk case.

### Core pipeline

```text
Payment Event
     │
     ▼
Webhook Receiver
     │
     ▼
Revenue Risk Detection
     │
     ▼
AI Diagnostic Agent
     │
     ▼
Policy Safety Engine
     │
     ▼
Recovery Orchestrator
     │
     ├── Retry Payment
     ├── Send Notification
     ├── Escalate to Support
     └── Stop Recovery
     │
     ▼
Outcome Verification
     │
     ▼
Revenue & Recovery Analytics
```

### Design principle

> **AI recommends. Policy controls. Orchestrator executes. Verification measures.**

The AI is intentionally not given unrestricted control over payment operations.

---

# 🤖 AI Diagnostic Agent

The AI Diagnostic Agent is the reasoning layer of RecoverAI.

It analyzes transaction and customer context and determines:

* Probable root cause
* Recommended recovery action
* Communication channel
* Priority
* Recommended delay
* Confidence score
* Reasoning

The current implementation integrates with **Google Gemini** through the Google GenAI SDK.

When `GEMINI_API_KEY` is configured, RecoverAI can send the diagnostic context to the configured Gemini model.

The default model is:

```text
gemini-2.5-flash
```

If Gemini is unavailable, disabled, times out, or produces invalid output, RecoverAI uses a deterministic fallback strategy instead of allowing the recovery pipeline to fail.

---

# 🧠 AI + Safety Architecture

RecoverAI follows a layered AI safety architecture.

```text
                    ┌─────────────────────┐
                    │   Payment Event     │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │  Revenue Risk       │
                    │  Detection          │
                    └──────────┬──────────┘
                               │
                               ▼
              ┌─────────────────────────────────┐
              │      AI Diagnostic Agent        │
              │                                 │
              │  Gemini Reasoning               │
              │  Root Cause Analysis            │
              │  Recovery Recommendation        │
              └───────────────┬─────────────────┘
                              │
                              ▼
              ┌─────────────────────────────────┐
              │      Policy Safety Engine       │
              │                                 │
              │  Action Validation              │
              │  Risk Limits                    │
              │  Business Rules                 │
              │  AI Override / Guardrails       │
              └───────────────┬─────────────────┘
                              │
                              ▼
              ┌─────────────────────────────────┐
              │      Recovery Orchestrator      │
              │                                 │
              │  Retry                          │
              │  Notification                   │
              │  Escalation                     │
              │  Stop Recovery                  │
              └───────────────┬─────────────────┘
                              │
                              ▼
              ┌─────────────────────────────────┐
              │       Verification Layer        │
              │                                 │
              │  Payment Outcome                │
              │  Recovery Success               │
              │  Revenue Recovered              │
              └───────────────┬─────────────────┘
                              │
                              ▼
                    ┌─────────────────────┐
                    │ Analytics & Audit   │
                    └─────────────────────┘
```

---

# 🛡️ Security Architecture

RecoverAI includes multiple security layers around the AI and payment workflow.

### Authentication

Production APIs require JWT authentication.

Demo authentication is restricted to:

```text
NODE_ENV != production
AND
DEMO_MODE = true
```

The demo token-generation endpoint is disabled in production.

### Role-Based Access Control

RecoverAI supports:

| Role                | Purpose                      |
| ------------------- | ---------------------------- |
| `SUPER_ADMIN`       | Full platform administration |
| `RISK_OFFICER`      | Risk and recovery oversight  |
| `MERCHANT_OPERATOR` | Merchant operations          |
| `SUPPORT_AGENT`     | Customer/recovery support    |

Permissions are enforced through the RBAC layer before sensitive operations are executed.

### Webhook Security

Razorpay webhook requests are protected using:

```text
HMAC-SHA256
```

The system:

1. Receives the raw webhook body.
2. Computes the expected HMAC signature.
3. Compares signatures using a timing-safe comparison.
4. Rejects invalid or missing signatures.
5. Uses event IDs for duplicate-event protection.

Demo webhook signatures are only accepted outside production demo environments.

### Rate Limiting

Rate limiting is applied to:

* General API traffic
* Razorpay webhooks
* Simulation endpoints

This helps reduce abuse and accidental request floods.

### AI Output Validation

AI output is never trusted directly.

RecoverAI validates:

* Allowed actions
* Allowed communication channels
* Priority values
* Confidence range
* Recovery delay
* Root-cause length
* Reasoning length

Invalid AI responses are rejected or replaced with deterministic fallback decisions.

---

# 🔐 AI Prompt-Injection Protection

Payment and customer information is treated as **untrusted data**.

The AI system prompt explicitly instructs the model that transaction/customer fields are data rather than instructions.

Input sanitization is also applied to reduce common prompt-injection patterns.

Most importantly:

> Even if the AI produces an unsafe recommendation, the Policy Safety Engine remains between the AI and the recovery executor.

Therefore:

```text
Untrusted Input
      ↓
AI
      ↓
Validation
      ↓
Policy Safety Engine
      ↓
Execution
```

rather than:

```text
Untrusted Input
      ↓
AI
      ↓
Direct Payment Execution ❌
```

---

# 💳 Revenue Recovery Strategies

RecoverAI can recommend different recovery strategies depending on the detected situation.

Examples include:

### Retry

Used when a temporary payment failure may recover through another attempt.

### Customer Notification

Used when customer action is required.

Possible channels include:

* Email
* WhatsApp
* SMS

### Support Escalation

Used for high-value or complex cases requiring human intervention.

### Stop Recovery

Used when additional automated attempts are unlikely to be useful or may increase risk.

---

# ⚙️ Technology Stack

## Backend

* Node.js
* Express.js
* SQLite / better-sqlite3
* JWT
* REST APIs

## AI

* Google Gemini
* `@google/genai`
* Structured AI output validation
* Deterministic fallback reasoning

## Frontend

* React
* Vite
* JavaScript
* CSS

## Security

* JWT Authentication
* RBAC
* HMAC-SHA256 webhook verification
* Rate limiting
* Input sanitization
* AI output validation
* Environment-based secret management

## Payment Integration

* Razorpay APIs / webhook simulation
* Designed for Razorpay test-mode integration

---

# 📁 Project Structure

```text
RecoverAI/
│
├── client/
│   └── src/
│       ├── components/
│       ├── views/
│       └── App.jsx
│
├── server/
│   ├── engines/
│   │   ├── aiDiagnosticAgent.js
│   │   ├── pipeline.js
│   │   ├── policySafetyEngine.js
│   │   └── recoveryOrchestrator.js
│   │
│   ├── ingestion/
│   │   └── webhookReceiver.js
│   │
│   ├── routes/
│   │   ├── webhooks.js
│   │   ├── metrics.js
│   │   └── stream.js
│   │
│   ├── security/
│   │   ├── auth.js
│   │   ├── rbac.js
│   │   ├── rateLimiter.js
│   │   └── secretsManager.js
│   │
│   ├── verification/
│   │   └── outcomeAnalyzer.js
│   │
│   ├── db/
│   │   └── database.js
│   │
│   ├── test/
│   │   ├── engines.test.js
│   │   └── security.test.js
│   │
│   ├── bootstrap.js
│   ├── start.js
│   └── index.js
│
├── package.json
├── package-lock.json
├── .env.example
└── README.md
```

---

# 🔄 End-to-End Workflow

### 1. Payment Event

A payment failure is received through the webhook interface.

### 2. Event Verification

The webhook signature is verified and duplicate events are detected.

### 3. Risk Detection

RecoverAI evaluates the transaction and determines the revenue-recovery context.

### 4. AI Diagnosis

The AI Diagnostic Agent analyzes the available context and produces a structured recovery recommendation.

### 5. Safety Validation

The Policy Safety Engine checks whether the recommendation is allowed.

The AI cannot bypass these policies.

### 6. Recovery Execution

The Recovery Orchestrator performs the approved action.

### 7. Verification

RecoverAI determines whether the recovery attempt succeeded.

### 8. Analytics

Recovery outcomes are recorded for:

* Revenue recovered
* Recovery attempts
* Success rate
* Failure rate
* Recovery strategy performance
* AI diagnostic performance

---

# 🧪 Testing

Install dependencies:

```bash
npm install
```

Run the existing engine tests:

```bash
npm test
```

Run security tests:

```bash
npm run test:security
```

The security test suite covers areas including:

* JWT authentication
* Expired tokens
* Invalid tokens
* Demo authentication restrictions
* Production token-generation protection
* RBAC-related access control
* Webhook HMAC verification
* Invalid webhook signatures
* Webhook tampering
* Duplicate event handling
* Prompt-injection sanitization
* Invalid AI output
* Invalid recovery actions
* Confidence validation
* Delay validation
* STOP_RECOVERY normalization
* Deterministic fallback
* Rate limiting
* Production simulation restrictions
* Policy safety overrides
* Recovery orchestration

---

# 🔑 Environment Configuration

Create a local `.env` file based on `.env.example`.

Example:

```env
NODE_ENV=development
DEMO_MODE=true

PORT=5000

JWT_SECRET=your-local-jwt-secret

AI_DIAGNOSTIC_ENABLED=true

GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-2.5-flash
GEMINI_TIMEOUT_MS=8000

RAZORPAY_KEY_ID=your-razorpay-key-id
RAZORPAY_KEY_SECRET=your-razorpay-key-secret
RAZORPAY_WEBHOOK_SECRET=your-webhook-secret

FRONTEND_ORIGIN=http://localhost:5173,http://localhost:3000
```

### ⚠️ Security

Never commit your actual `.env` file or API keys to GitHub.

Only `.env.example` should be committed.

---

# ▶️ Running the Project

Install dependencies:

```bash
npm install
```

Start the backend:

```bash
npm start
```

The backend starts using:

```text
server/start.js
```

The frontend can be started from the `client` directory using the configured frontend development command.

---

# 🧑‍💻 Demo Mode

RecoverAI includes a controlled demo mode for hackathon demonstrations.

Demo mode can provide:

* Simulated payment failures
* Simulated successful payments
* Demo recovery workflows
* Demonstration authentication

Demo authentication is intentionally restricted to non-production environments.

Production environments require proper authentication.

---

# 🏗️ Current Prototype Scope

This project is a hackathon prototype.

The current implementation demonstrates the complete revenue-recovery decision workflow, while some external actions remain simulated/test-mode operations.

| Component                  | Current Status                      |
| -------------------------- | ----------------------------------- |
| Payment event ingestion    | ✅ Implemented                       |
| Webhook verification       | ✅ Implemented                       |
| Duplicate event protection | ✅ Implemented                       |
| Revenue-risk processing    | ✅ Implemented                       |
| Gemini AI diagnosis        | ✅ Implemented                       |
| Deterministic AI fallback  | ✅ Implemented                       |
| AI output validation       | ✅ Implemented                       |
| Policy safety engine       | ✅ Implemented                       |
| Recovery orchestration     | ✅ Implemented                       |
| Outcome verification       | ✅ Implemented                       |
| RBAC                       | ✅ Implemented                       |
| JWT authentication         | ✅ Implemented                       |
| API rate limiting          | ✅ Implemented                       |
| Security test suite        | ✅ Implemented                       |
| Razorpay integration       | 🧪 Test/simulation focused          |
| External notifications     | 🧪 Demonstration/simulation focused |

---

# 📊 Why RecoverAI?

RecoverAI is not simply a chatbot attached to a payment dashboard.

It creates an **agentic revenue-recovery loop**:

```text
OBSERVE
   ↓
Diagnose the revenue risk
   ↓
REASON
   ↓
Select recovery strategy
   ↓
VALIDATE
   ↓
Apply deterministic safety policies
   ↓
ACT
   ↓
Execute recovery
   ↓
VERIFY
   ↓
Measure outcome
   ↓
LEARN
```

This allows AI to contribute where it is strongest — **reasoning and decision support** — while deterministic software controls sensitive payment operations.

---

# 🎯 Hackathon Track

**Razorpay AI Buildathon 2026**

### Track 03 — AI Revenue Recovery

RecoverAI focuses on recovering revenue from failed or at-risk payments using an AI-driven diagnosis and recovery orchestration system.

---

# 🔮 Future Improvements

Potential production extensions include:

* Direct Razorpay test-mode payment recovery
* Production-grade distributed job queues
* Persistent event store
* Redis-based distributed rate limiting
* Real email/WhatsApp/SMS integrations
* Advanced fraud/risk models
* Merchant-specific recovery policies
* Reinforcement/feedback-based strategy optimization
* AI evaluation and monitoring
* Human-in-the-loop approval for high-risk actions
* Multi-tenant merchant isolation
* Cloud deployment with autoscaling
* Comprehensive observability and audit logging

---

## 🎥 Demo Video

▶️ **[Watch the RecoverAI Demo](https://drive.google.com/file/d/15h13bU_9vfMR8X-KpSxShjpwoXtVZjdK/view?usp=drive_link)**

The demo showcases AI diagnosis, Safety Guardrails, Recovery Orchestration,
Verification, Audit Trail, RBAC, and security controls.

---

# 👨‍💻 Author

**Chakka Gowtham Teja**

Computer Science & Engineering

GitHub:
https://github.com/GowthamTeja09

---

## 📜 License

This project is developed as a hackathon prototype for demonstration and evaluation purposes.
