# Smart Payment Wallet Core Module Spec

## 1. Summary
A programmable, multi-tenant smart wallet hosted by a payment aggregator enabling businesses to receive funds via bank rails (ACH/SEPA/local), hold balances, and execute payouts. Supports real-time balance tracking, webhooks for event-driven integrations, and full PCI-DSS/KYC compliance.

---

## 2. High-Level Architecture

```
┌─────────────┐    ┌──────────────┐    ┌─────────────────┐
│  Client App │───▶│   API GW     │───▶│  Wallet Service │
└─────────────┘    │  (Auth/Rate) │    │  (Core Logic)   │
                   └──────────────┘    └────────┬────────┘
                                                │
        ┌───────────────────────────────────────┼───────────────────┐
        ▼                   ▼                   ▼                   ▼
┌──────────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│ Ledger DB    │   │ Bank Adapter │   │ Webhook Svc  │   │ KYC/AML Svc  │
│ (PostgreSQL) │   │ (ACH/SEPA)   │   │ (Events)     │   │ (Compliance) │
└──────────────┘   └──────────────┘   └──────────────┘   └──────────────┘
```

**Data Flows:**
- `Fund`: Client Bank → Bank Adapter → Ledger → Webhook
- `Payout`: Wallet → Ledger → Bank Adapter → Recipient Bank
- `Balance`: Ledger → API Response

---

## 3. API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v1/wallets/{id}/fund` | POST | Initiate bank funding |
| `/v1/wallets/{id}/payout` | POST | Execute payout |
| `/v1/wallets/{id}/balance` | GET | Get current balance |
| `/v1/webhooks` | POST | Configure webhook URL |

### Request/Response Examples

```json
// POST /v1/wallets/wal_123/fund
{
  "amount": 10000,
  "currency": "USD",
  "source_bank": "ba_456",
  "idempotency_key": "idem_abc123",
  "reference": "INV-2024-001"
}

// Response 202
{
  "id": "txn_789",
  "status": "pending",
  "estimated_arrival": "2024-02-18T10:00:00Z"
}
```

```json
// POST /v1/wallets/wal_123/payout
{
  "amount": 5000,
  "currency": "USD",
  "destination": "ba_ext_789",
  "idempotency_key": "idem_xyz456"
}

// Response 202
{
  "id": "pay_012",
  "status": "processing",
  "fee": 25
}
```

```json
// GET /v1/wallets/wal_123/balance
// Response 200
{
  "available": 95000,
  "pending": 10000,
  "currency": "USD",
  "updated_at": "2024-02-16T15:30:00Z"
}
```

---

## 4. Bank Funding Flow (ACH/SEPA)

```
1. Client initiates POST /fund with bank_account_id
2. Validate: KYC status, daily limits, account verification
3. Create PENDING ledger entry (double-entry: Receivable ↔ Client)
4. Submit to Bank Adapter:
   - ACH: NACHA file → Originating Bank → Fed
   - SEPA: pain.001 XML → SEPA Gateway
   - ISO20022: camt.053 for statements
5. Await bank webhook (T+1 ACH, T+0 SEPA Instant)
6. On success: Flip ledger to SETTLED, emit wallet.funded event
7. On failure: Reverse ledger, emit wallet.fund_failed event
```

---

## 5. Security & Compliance

| Area | Implementation |
|------|----------------|
| **PCI-DSS** | Tokenized bank refs, no raw account storage |
| **KYC/AML** | Pre-fund verification, OFAC/sanctions screening |
| **Encryption** | TLS 1.3 in-transit, AES-256-GCM at-rest |
| **Key Mgmt** | AWS KMS / HashiCorp Vault, auto-rotation |
| **Audit Log** | Immutable append-only, 7-year retention |
| **Auth** | OAuth 2.0 + API keys, scoped permissions |

---

## 6. Data Model

```sql
-- Core Entities
Wallet: id, tenant_id, currency, status, created_at
BankAccount: id, wallet_id, routing, masked_account, verified, kyc_status
Transaction: id, wallet_id, type(FUND|PAYOUT), amount, status, idempotency_key, created_at
LedgerEntry: id, txn_id, account_type, debit, credit, balance_after, timestamp
WebhookConfig: id, tenant_id, url, secret, events[], active
AuditLog: id, actor, action, resource, payload_hash, ip, timestamp
```

---

## 7. Error Handling & Idempotency

| Rule | Implementation |
|------|----------------|
| **Idempotency** | SHA256(key) lookup, 24hr TTL, return cached response |
| **Retries** | Exponential backoff: 1s, 2s, 4s, 8s, max 5 attempts |
| **Timeouts** | API: 30s, Bank calls: 120s |
| **Circuit Breaker** | Open after 5 failures, half-open after 60s |

```json
// Error Response Format
{
  "error": {
    "code": "INSUFFICIENT_FUNDS",
    "message": "Available balance 5000 < requested 10000",
    "retry_after": null
  }
}
```

**Error Codes:** `INVALID_BANK`, `KYC_REQUIRED`, `LIMIT_EXCEEDED`, `BANK_TIMEOUT`, `DUPLICATE_REQUEST`

---

## 8. Test Cases

| Type | Scenarios |
|------|-----------|
| **Unit** | Ledger balance calc, idempotency dedup, limit validation |
| **Integration** | Bank adapter mock, webhook delivery, KYC service |
| **E2E** | Full fund→settle→payout cycle, multi-currency |
| **Failure** | Bank timeout recovery, partial settlement, webhook retry exhaustion |

```python
# Example: test_idempotency
def test_duplicate_fund_returns_same_txn():
    key = "idem_test_001"
    r1 = client.post("/fund", json={"amount": 100, "idempotency_key": key})
    r2 = client.post("/fund", json={"amount": 100, "idempotency_key": key})
    assert r1.json()["id"] == r2.json()["id"]
```

---

## 9. Deployment & Monitoring

```yaml
Infrastructure:
  - K8s: 3 replicas, HPA (CPU 70%)
  - DB: PostgreSQL 15, read replicas, daily backups
  - Cache: Redis cluster (idempotency, rate limits)

SLOs:
  - Availability: 99.95%
  - API p99 latency: <200ms
  - Fund settlement: <T+1 (ACH), <10min (SEPA Instant)
  - Webhook delivery: <5s, 99.9% success

Monitoring:
  - Metrics: Prometheus + Grafana
  - Logs: ELK stack, structured JSON
  - Alerts: PagerDuty (P1: settlement failures, P2: latency spikes)
```

---

## 10. Implementation Estimate

| Phase | Scope | Estimate |
|-------|-------|----------|
| **P1: Core** | Wallet CRUD, ledger, balance API | 4 person-weeks |
| **P2: Banking** | ACH adapter, fund/payout flows | 6 person-weeks |
| **P3: Compliance** | KYC integration, audit logging | 3 person-weeks |
| **P4: Webhooks** | Event system, retry logic | 2 person-weeks |
| **P5: Hardening** | Security audit, load testing | 3 person-weeks |
| **Total** | | **18 person-weeks** |

---

*Version: 1.0 | Last Updated: Feb 2026*
