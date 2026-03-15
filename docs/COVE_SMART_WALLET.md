# CoveSmartWallet - Programmable Payment Wallet Module

## Overview
Multi-tenant smart payment wallet for Cove platform with master wallet + sub-accounts structure.

### Payment Aggregators
- **Primary**: cGrate (Zambia-licensed, Bank of Zambia designated)
- **Fallback 1**: DPO Pay (Pan-African)
- **Fallback 2**: Flutterwave (Global)

### Subscription Tiers
| Tier | Features |
|------|----------|
| **Basic** | View balance, transaction history, receive payments |
| **Premium** | Full wallet: payouts, scheduled payments, multi-currency, API access |

## Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                    COVE MASTER WALLET                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ Company A   │  │ Company B   │  │ Company C   │  ...    │
│  │ Sub-Account │  │ Sub-Account │  │ Sub-Account │         │
│  │ (Basic)     │  │ (Premium)   │  │ (Premium)   │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   cGrate     │    │   DPO Pay    │    │ Flutterwave  │
│   Adapter    │    │   Adapter    │    │   Adapter    │
│  (Primary)   │    │  (Fallback)  │    │  (Fallback)  │
└──────────────┘    └──────────────┘    └──────────────┘
```

## API Endpoints
- `POST /api/wallet/fund` - Receive funds
- `POST /api/wallet/payout` - Execute payment (Premium)
- `GET /api/wallet/balance` - Get balance
- `GET /api/wallet/transactions` - Transaction history
- `POST /api/wallet/link-bank` - Link bank account via aggregator
- `GET /api/wallet/subscription` - Get tier status
