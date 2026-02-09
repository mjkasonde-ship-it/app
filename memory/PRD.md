# Cove - Zambia Legal Tech SaaS Platform

## Original Problem Statement
Build a Zambia legal tech SaaS platform - governance/compliance tool for Lusaka law firm with multi-step onboarding, compliance matrix, AI summaries, and comprehensive super admin console.

## Architecture
- **Frontend**: React with Shadcn/UI, Framer Motion, Recharts
- **Backend**: FastAPI with MongoDB persistence
- **AI Integration**: Claude Sonnet 4.5 via emergentintegrations library
- **Theme**: Financial Times salmon/beige palette with Cove teal/navy branding

## User Personas
1. **Corporate Compliance Officers** - Track obligations, manage deadlines
2. **Legal Administrators** - Oversee multiple company clients
3. **Super Admins** - Full platform management, user/legislation control

## Core Requirements
- Multi-step onboarding (company info, size, sector, sub-sector)
- Compliance matrix with table and Gantt chart views
- AI-powered legislative summaries
- Dashboard with compliance metrics
- Comprehensive super admin console with RBAC
- Virtual Data Room (My Cove) for document management
- Role-based access control with customizable permissions

## What's Been Implemented

### Phase 1 (MVP) - Jan 2026
- [x] Landing page with Cove branding
- [x] 4-step onboarding flow with 6 sectors, 24 sub-sectors
- [x] Corporate dashboard with compliance score, critical items, category navigation
- [x] Compliance matrix (table view with sticky headers, search, filters)
- [x] Gantt chart timeline view with deadline markers
- [x] Obligation detail sheet with AI summary generation
- [x] Claude Sonnet 4.5 integration for legal summaries
- [x] MongoDB persistence for companies, obligations, users
- [x] Zambian legislation mock data (7+ statutes per sector)

### Phase 2 (Super Admin Enhancement) - Jan 2026
- [x] Enhanced Admin Console with 10 main navigation tabs
- [x] Overview dashboard with 6 metric cards + revenue/compliance chart
- [x] Global search (Cmd+K) across users, companies, tickets
- [x] Notification bell with activity notifications
- [x] User management with bulk actions (select, suspend, delete, activate)
- [x] User detail sheet with edit capability
- [x] Organization management with compliance scores and MRR
- [x] Legislation database manager with sector cards
- [x] Analytics dashboard (compliance trends, sector distribution, severity charts)
- [x] Security tab with audit logs and access control settings
- [x] Billing tab with revenue summary, invoices, subscription plans
- [x] Settings tab with general config and integrations status
- [x] Support tickets management
- [x] Documents management placeholder
- [x] Confirmation dialogs for destructive actions
- [x] Role-based permission model (super-admin, legal-admin, corporate-user, viewer)

### Phase 3 (UI Refinement) - Feb 2026
- [x] Corporate Dashboard UI refinement with polished, data-driven design
- [x] Compliance Score hero card with radial chart and trend indicator
- [x] Quick stats grid (Total, Critical, Priority, Completed) with color-coded cards
- [x] 6-month Compliance Trend area chart (recharts)
- [x] Severity Distribution donut chart with legend
- [x] Legislation Categories cards with progress bars and critical badges
- [x] Category Overview horizontal stacked bar chart
- [x] Upcoming Deadlines sticky sidebar with countdown badges
- [x] Interactive tooltips with contextual insights on all charts

### Phase 4 (Compliance Matrix Refactoring) - Feb 2026
- [x] New data model: Legislation, Provision, Action, Consequences, Owner, Status
- [x] Minimalist table design with clean visual hierarchy
- [x] Merged Legislation + Provision column as clickable link to zambialii.org
- [x] Owner column with department icons (Legal, HR, Finance, Operations, Compliance)
- [x] Status dropdown (Pending, In Progress, Completed, Non-Compliant, Overdue)
- [x] Default sort: Non-compliant/Overdue first, then by severity, then by due date
- [x] Status filter and Owner filter dropdowns
- [x] Column visibility toggle dropdown
- [x] Due date countdown badges (Xd overdue, Xd left)
- [x] Timeline/Gantt view with owner badges and status icons
- [x] Detail sheet with Consequences section and AI Summary
- [x] Backend API enhanced with provision, legal_reference_url, owner, consequences fields
- [x] Backend /api/obligations supports status and owner query parameters
- [x] **Batch Status Update Functionality:**
  - Row checkboxes for multi-select
  - Select All checkbox in header
  - Bulk action bar with status buttons (Complete, In Progress, Pending)
  - Dropdown menu for additional statuses (Non-Compliant, Overdue)
  - Backend POST /api/obligations/bulk-status endpoint
  - Selection auto-clears after successful update
  - Toast notifications for update results
- [x] **Mark Overdue Automation:**
  - "Mark Overdue" button in toolbar
  - Backend POST /api/obligations/mark-overdue endpoint
  - Automatically flags obligations past due date as overdue
  - Refreshes list after marking
- [x] **Export Functionality:**
  - Export dropdown with Excel/PDF options
  - Excel export using xlsx library with auto-sized columns
  - PDF export using jspdf + jspdf-autotable with:
    - Cove branding header
    - Summary statistics (completed, pending, overdue, critical)
    - Striped table with color-coded status cells
    - Page numbers and footer
  - Both exports respect current filters
  - Toast notifications on successful download

### Phase 5 (Platform Update) - Feb 2026
- [x] **Visual & Branding Refactor:**
  - Financial Times salmon/beige palette (#FFF1E5 background)
  - New Cove teal/navy logo integrated globally
  - Updated color scheme throughout all pages
  - Playfair Display headings, Inter body text
  
- [x] **VDR "My Cove" Document Repository:**
  - `/vdr` and `/vdr/:companyId` routes
  - 4-folder taxonomy: Corporate, Legal, HR, Operations
  - Drag & drop file upload with react-dropzone
  - File versioning (tracks all versions per file)
  - Auto-complete: Link files to obligations → auto-set status to "Completed"
  - Version history viewing
  - File deletion with confirmation
  - Search across files
  - Backend APIs: GET/POST/DELETE /api/vdr/files, POST /api/vdr/upload
  
- [x] **IAM & RBAC System:**
  - `/settings` and `/settings/:companyId` routes
  - Team management tab with user table
  - User invitation with role assignment
  - 7 roles: Admin, Legal, Corporate, HR, Operations, Finance, Viewer
  - Customizable permissions matrix (15+ permissions)
  - Permission categories: Compliance Matrix, Document Repository, User Management, Settings
  - Toggle permissions per role with checkboxes
  - Role detail dialog for granular permission editing
  - Backend APIs: GET/POST/PUT /api/roles, POST /api/users/invite
  
- [x] **Navigation Deep-Linking:**
  - Legislation links now deep-link to specific provisions
  - URLs include section anchors (e.g., #section-45)
  - Mock URLs point to zambialii.org with proper fragments

## API Endpoints

### Core APIs
- `GET /api/sectors` - Available sectors and sub-sectors
- `POST /api/companies` - Register company
- `GET/PUT/DELETE /api/companies/{id}` - Company CRUD
- `GET /api/obligations` - List obligations with filters (status, owner, category, severity)
- `GET /api/obligations/{id}` - Single obligation details
- `PATCH /api/obligations/{id}/status` - Update single obligation status
- `POST /api/obligations/bulk-status` - Bulk update multiple obligations status
- `POST /api/obligations/mark-overdue` - Auto-mark past due obligations as overdue
- `GET /api/obligations/export` - Export obligations data
- `POST /api/ai/summary` - Generate AI legal summary
- `GET /api/dashboard/stats/{company_id}` - Dashboard stats with charts data
- `GET /api/legislation/{sector}/{sub_sector}` - Get legislation with computed fields

### VDR APIs
- `GET /api/vdr/files` - List files by company/folder
- `POST /api/vdr/upload` - Upload file with optional obligation linking
- `DELETE /api/vdr/files/{file_id}` - Delete file
- `GET /api/vdr/files/{file_id}/versions` - Get file version history
- `POST /api/vdr/files/{file_id}/link` - Link file to obligation

### IAM APIs
- `GET /api/roles` - Get all roles with permissions
- `POST /api/roles` - Create new role
- `PUT /api/roles/{role_id}` - Update role permissions
- `POST /api/users/invite` - Invite user to organization

### Admin APIs
- `GET /api/admin/analytics` - Platform analytics with health metrics
- `GET /api/admin/revenue` - Revenue analytics
- `GET/POST /api/users` - User management
- `PUT/DELETE /api/users/{id}` - User CRUD
- `POST /api/users/bulk-action` - Bulk user operations
- `GET/POST /api/roles` - Role management
- `GET /api/audit-logs` - Audit log viewing
- `GET/POST /api/tickets` - Support tickets
- `GET/POST /api/subscription-plans` - Subscription plans
- `GET /api/invoices` - Invoice management
- `GET/PUT /api/settings/system` - System settings
- `GET /api/activity-notifications` - Activity notifications
- `GET /api/search` - Global search

## Prioritized Backlog

### P0 (Next Sprint)
- [ ] Email notification service implementation
- [ ] User authentication (JWT or Google OAuth)
- [ ] Complete audit log write functionality

### P1 (Near Term)
- [ ] Document upload for compliance evidence
- [ ] Calendar integration for deadline reminders
- [ ] Export compliance reports (PDF/Excel)
- [ ] Custom report builder

### P2 (Future)
- [ ] ZambiaLii.org API integration for real legislation sync
- [ ] Mobile responsive optimizations
- [ ] Multi-tenant support with separate databases
- [ ] SSO/SAML configuration
- [ ] Automated dunning for failed payments

## Tech Stack
- React 19, React Router 7
- FastAPI 0.110, Motor (MongoDB async driver)
- Tailwind CSS, Shadcn/UI components
- emergentintegrations (Claude Sonnet 4.5)
- Framer Motion, Recharts 3.6.0
- Pydantic v2 for data validation
