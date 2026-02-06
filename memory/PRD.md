# Cove - Zambia Legal Tech SaaS Platform

## Original Problem Statement
Build a Zambia legal tech SaaS platform - governance/compliance tool for Lusaka law firm with multi-step onboarding, compliance matrix, AI summaries, and super admin console.

## Architecture
- **Frontend**: React with Shadcn/UI, Framer Motion, Recharts
- **Backend**: FastAPI with MongoDB persistence
- **AI Integration**: Claude Sonnet 4.5 via emergentintegrations library

## User Personas
1. **Corporate Compliance Officers** - Track obligations, manage deadlines
2. **Legal Administrators** - Oversee multiple company clients
3. **Super Admins** - Full platform management, user/legislation control

## Core Requirements
- Multi-step onboarding (company info, size, sector, sub-sector)
- Compliance matrix with table and Gantt chart views
- AI-powered legislative summaries
- Dashboard with compliance metrics
- Super admin console with RBAC

## What's Been Implemented (Jan 2026)
- [x] Landing page with Cove branding
- [x] 4-step onboarding flow with 6 sectors, 24 sub-sectors
- [x] Corporate dashboard with compliance score, critical items, category navigation
- [x] Compliance matrix (table view with sticky headers, search, filters)
- [x] Gantt chart timeline view with deadline markers
- [x] Obligation detail sheet with AI summary generation
- [x] Claude Sonnet 4.5 integration for legal summaries
- [x] Super admin console (overview, users, legislation, analytics tabs)
- [x] User management (add/delete users)
- [x] Analytics dashboard with charts (Recharts)
- [x] MongoDB persistence for companies, obligations, users
- [x] Zambian legislation mock data (7+ statutes per sector)

## API Endpoints
- `GET /api/sectors` - Available sectors and sub-sectors
- `POST /api/companies` - Register company
- `GET /api/obligations` - List obligations with filters
- `POST /api/ai/summary` - Generate AI legal summary
- `GET /api/dashboard/stats/{company_id}` - Dashboard metrics
- `GET /api/admin/analytics` - Admin analytics data
- `POST/GET/DELETE /api/users` - User management

## Prioritized Backlog
### P0 (Next Sprint)
- [ ] Email notification service implementation (backend scaffolded)
- [ ] User authentication (JWT or Google OAuth)

### P1 (Near Term)
- [ ] Document upload for compliance evidence
- [ ] Calendar integration for deadline reminders
- [ ] Export compliance reports (PDF/Excel)

### P2 (Future)
- [ ] ZambiaLii.org API integration for real legislation sync
- [ ] Mobile responsive optimizations
- [ ] Multi-tenant support with separate databases

## Tech Stack
- React 19, React Router 7
- FastAPI 0.110, Motor (MongoDB async driver)
- Tailwind CSS, Shadcn/UI components
- emergentintegrations (Claude Sonnet 4.5)
- Framer Motion, Recharts
