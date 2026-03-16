# Cove - Corporate Compliance Management Platform

## Original Problem Statement
Build a full-featured corporate compliance management platform named "Cove" for Zambian businesses. The platform manages compliance obligations, regulatory filings, virtual data rooms, and payments through a smart wallet system.

## Core Modules

### 1. Compliance Matrix
- Interactive table of compliance obligations per sector/sub-sector
- LLM-powered data transformation (Claude Sonnet 4.5) with 5-section plain language summaries
- "Magic Circle" legal summaries
- Precise deep-links to legislation sections
- Status tracking: pending, in_progress, completed, non_compliant, overdue

### 2. Dashboard
- Overview metrics, compliance scores, upcoming deadlines
- FT-inspired visual theme

### 3. Virtual Data Room (VDR)
- Folder-based file management (corporate, legal, hr, operations)
- File upload, download, version tracking (basic)

### 4. CoveSmartWallet
- Two-tier wallet (Basic/Premium) with sub-accounts per company
- Adapter-based payment gateway integration (cGrate, DPO, Flutterwave)
- Fund, Payout, Transaction History, Bank Account Linking
- **Pull Orders (Direct Debit)**: Request funds from client bank accounts with approval workflow
- **Real-time WebSocket Notifications**: Live updates for pull order events (created, approved, rejected, executed, cancelled)

### 5. CoveRegFiling
- Automated regulatory filing lifecycle management
- Payment order generation and execution via wallet
- Priority-based payment when funds are low

### 6. Settings & RBAC
- Role management, user management
- Audit logging

## Architecture
- **Frontend**: React, Tailwind CSS, shadcn/ui, Recharts, lucide-react, sonner
- **Backend**: Python FastAPI, Pydantic models
- **Database**: MongoDB (core data), In-memory (wallet/regfiling - NEEDS MIGRATION)
- **LLM**: Claude Sonnet 4.5 via Emergent Integrations

## What's Been Implemented

### Completed (as of 2026-03-15)
- [x] Compliance Matrix with LLM rewrite, legal summaries, deep-linking
- [x] Dashboard with FT-inspired theme
- [x] VDR with file management
- [x] Calendar, Forms Repository, Report Builder
- [x] CoveSmartWallet - Full wallet UI and backend
- [x] CoveRegFiling - Automated filing module
- [x] **Pull Order Frontend UI** - Create, Approve, Reject, Execute, Cancel pull orders
- [x] **API prefix fix** - All wallet API calls now correctly use /api/wallet/ prefix
- [x] **WebSocket Real-time Notifications** - Live push events for all pull order actions with auto-refresh and toast notifications

## Prioritized Backlog

### P0 - Critical
- [ ] **Migrate In-Memory Storage to MongoDB**: Wallet and RegFiling modules use volatile in-memory dicts. All data (SubAccounts, Transactions, PullOrders, Filings, PaymentOrders) must be persisted to MongoDB.

### P1 - High Priority
- [ ] **Backend RBAC Enforcement**: Role permissions are frontend-only. Backend API routes need auth middleware.
- [ ] **VDR File Versioning**: Track and manage file versions in the Virtual Data Room.

### P2 - Medium Priority
- [ ] **Refactor monolithic server.py**: Move remaining routes to /backend/routes/ modules.
- [ ] **Centralize Logo Component**: DRY up hardcoded logo styling across components.
- [ ] **Clean up unused backend/app.py**

### P3 - Backlog
- [ ] Email Notifications (blocked: needs email service API key)
- [ ] Live payment gateway integration (needs user API keys for cGrate/DPO/Flutterwave)

## Known Issues
- **Data Persistence**: Wallet and RegFiling data stored in-memory - lost on restart
- **RBAC**: No backend enforcement of role permissions
- **Payment Gateways**: Using simulated/mocked responses (no live API keys)

## Tech Stack
- React 18, Tailwind CSS, shadcn/ui, Recharts, lucide-react, framer-motion
- FastAPI, Pydantic, Motor (MongoDB async driver)
- MongoDB
- emergentintegrations (Claude Sonnet 4.5), httpx

## Key API Endpoints
- `/api/obligations/*` - Compliance obligation CRUD and LLM operations
- `/api/wallet/sub-accounts/*` - Wallet sub-account management
- `/api/wallet/pull-orders/*` - Pull order lifecycle (create, approve, reject, execute, cancel)
- `/api/wallet/fund/*`, `/api/wallet/payout/*` - Funding and payouts
- `/api/wallet/bank-accounts/*` - Linked bank accounts
- `/api/regfiling/*` - Regulatory filing management
