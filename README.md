# RecoverAI v2.1 Enterprise

### Autonomous AI Revenue-Recovery Orchestration for Failed Digital Payments

RecoverAI is a hackathon-focused full-stack prototype for **AI Revenue Recovery**.

It detects failed payments, analyzes the failure, recommends a recovery strategy, applies deterministic safety guardrails, executes a controlled recovery action, verifies the payment outcome, and records the complete process in a tamper-evident audit trail.

> **AI recommends → Policy decides → Orchestrator executes → Verification proves the outcome**

---

## 🎯 Problem

Failed payments create immediate revenue leakage for merchants.

A merchant needs to determine:

- Why did the payment fail?
- Is the failure worth attempting to recover automatically?
- Which recovery action is most appropriate?
- Is the action safe to execute?
- When should the customer be contacted?
- Did the recovery actually result in a successful payment?
- Can every decision and action be audited?

RecoverAI turns these questions into a **closed-loop revenue recovery pipeline** instead of treating every failed payment with the same retry strategy.

---

## 💡 Solution

RecoverAI evaluates each failed payment using transaction and customer context, recommends a recovery strategy, subjects that recommendation to deterministic policy checks, executes an appropriate recovery action, and verifies the eventual payment outcome.

### Core Principle

> **AI recommends; deterministic policy decides; the recovery orchestrator executes; payment events verify the outcome.**

The system is designed around the principle that revenue recovery should be **autonomous only when it is safe to be autonomous.**

---

## ⚠️ Important Implementation Note

This repository is a **working hackathon demo/simulation**, not a production Razorpay deployment.

The project contains:

- Razorpay-compatible webhook ingestion
- HMAC-SHA256 signature verification
- Simulated Razorpay recovery actions
- Deterministic diagnostic heuristics
- Deterministic safety policies
- Closed-loop payment verification
- RBAC
- Tamper-evident audit logging
- Recovery metrics and dashboard

### Current implementation

The current `razorpayClient.js` does **not** make live outbound Razorpay REST API calls.

Payment links, recovery orders, subscription retries, and customer payments are simulated locally for the hackathon environment.

Likewise, the AI diagnostic agent currently uses **deterministic JavaScript domain heuristics** rather than making a live Gemini/OpenAI/LLM API request.

The model registry contains seeded model metadata and metrics for dashboard demonstration. It does not train or serve the listed ML models.

These distinctions are intentional and should be preserved when presenting the project.

---

# 🏗️ System Architecture

## Complete End-to-End Flow

```text
                    ┌──────────────────────────┐
                    │ Razorpay / Simulator     │
                    │ Failed Payment Events     │
                    └────────────┬─────────────┘
                                 │
                                 ▼
                    ┌──────────────────────────┐
                    │ 1. Webhook Receiver       │
                    │ HMAC Verification         │
                    │ Event Validation          │
                    │ Deduplication             │
                    └────────────┬─────────────┘
                                 │
                                 ▼
                    ┌──────────────────────────┐
                    │ 2. Event Queue            │
                    │ In-Memory EventEmitter    │
                    │ Async Pipeline Trigger    │
                    └────────────┬─────────────┘
                                 │
                                 ▼
              ┌──────────────────────────────────────┐
              │ 3. Revenue Risk Engine               │
              │ Feature Extraction                   │
              │ Risk Score                           │
              │ Recovery Probability                 │
              └──────────────────┬───────────────────┘
                                 │
                                 ▼
              ┌──────────────────────────────────────┐
              │ 4. AI Diagnostic Agent               │
              │ Case Understanding                   │
              │ Root-Cause Classification             │
              │ Recovery Recommendation               │
              └──────────────────┬───────────────────┘
                                 │
                                 ▼
              ┌──────────────────────────────────────┐
              │ 5. Policy / Safety Engine            │
              │ Amount Limits                        │
              │ Retry Limits                         │
              │ Cooldowns                             │
              │ Confidence Threshold                 │
              │ Contact Limits                       │
              │ Quiet Hours                          │
              │ Allowed Actions                      │
              │ Idempotency                           │
              └──────────────────┬───────────────────┘
                                 │
                  ┌──────────────┼───────────────┐
                  │              │               │
                  ▼              ▼               ▼
              APPROVED       ESCALATED        REJECTED
                  │              │               │
                  ▼              ▼               ▼
        Recovery Orchestrator  CRM Ticket    Action Halted
                  │
        ┌─────────┼──────────┬───────────┐
        ▼         ▼          ▼           ▼
    Subscription Recovery  Payment     Reminder
       Retry      Order      Link
        │         │          │           │
        └─────────┴──────────┴───────────┘
                           │
                           ▼
                Customer Payment Event
                           │
                           ▼
                ┌─────────────────────┐
                │ Verification Engine │
                │ Outcome Analysis    │
                │ Case Update         │
                └──────────┬──────────┘
                           │
                           ▼
                    Revenue Recovered
                           │
                           ▼
                     Audit Hash Chain
