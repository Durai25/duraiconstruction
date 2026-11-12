# Civil construction ERP architecture

## Current implementation boundary

The app is a static JavaScript application using Firebase Authentication, Firestore, and Storage. Existing customer portal access, admin claim checks, project payments/activity/media, enquiry follow-up, employee profiles, attendance, and employee payouts remain in place. The admin project master now supports generated `projectCode` values, client UID references, project classification, site team, area/floor data, dates, priority, budget, GPS location, and project filters.

This document is the implementation contract for adding the requested ERP modules. It does not imply that modules without admin screens and CRUD workflows are already implemented. `inquiries`, `employees`, `employeeAttendance`, and `employeePayouts` are legacy collection names retained for compatibility; migrations should be explicit and additive.

## Record conventions

- Use Firestore auto IDs as immutable document IDs. Human-readable IDs such as `projectCode` are display/search identifiers, never authorization keys.
- Store references as document IDs (`projectId`, `clientId`, `vendorId`, `materialId`, `userId`). Use timestamps for `createdAt`/`updatedAt` and UID strings for `createdBy`/`updatedBy`.
- Use ISO `YYYY-MM-DD` for date-only business dates and Firestore `Timestamp` for event times.
- Keep operational events in their own collections. Avoid embedding unbounded BOQ rows, task histories, transactions, attendance, documents, or audit history in project documents.
- Important financial and stock transactions are append-only with stable idempotency keys. Corrections should use reversal/adjustment entries; deletion is soft deletion (`deletedAt`, `deletedBy`, `deletionReason`).
- Derived totals (balances, progress, profitability) must be calculated from source transactions or maintained transactionally, with the source of truth documented per module.

## Collection catalog

| Collection | Primary references and fields | Access / notes |
| --- | --- | --- |
| `users` | `authUid`, `displayName`, `email`, `role`, `active` | Admin maintained; role claims remain server-managed. |
| `clients` | `name`, `mobile`, `email`, `address`, `createdAt`, `updatedAt` | Planned canonical client master. Existing `customers` records are legacy auth-linked profiles. |
| `enquiries` | `enquiryDate`, contact, site/property/area, `requirements`, `estimatedBudget`, `leadSource`, `followUpDate`, `quotationStatus`, `conversionStatus`, `remarks` | Admin-only CRM; legacy public submissions remain in `inquiries`. |
| `projects` | `projectCode`, `projectName`, `clientId`/legacy `customerId`, type/category, site/GPS, areas/floors, manager/engineer/contractor, dates, contract/budget, priority/status | Admin CRUD; customer reads only their assigned project. Existing activity, updates, payments stay in project subcollections. |
| `quotations`, `estimates`, `boqItems` | `projectId`, `version`, approval/status, category, item, unit, quantity, rates, tax and totals | Admin-managed; quotation versions immutable after issue. |
| `projectTasks`, `projectMilestones` | `projectId`, stage/activity, assignment, planned/actual dates, duration, dependency, weight/progress/status | Admin-managed; use indexed project/status/date queries. |
| `materials`, `stockTransactions` | Material master; transaction references project/material, type, quantity, date, supplier, rate, invoice and idempotency key | Ledger entries append-only; balance is a derived sum. |
| `vendors`, `purchaseRequisitions`, `purchaseOrders`, `goodsReceipts` | Vendor, project, item lines, approval, quantities, rates/tax, dates and status | Admin-managed; receipt records support partial delivery. |
| `labour`, `contractors`, `attendance` | Worker/contractor references, category, project/date/hours/wages/overtime/payment status | Admin-managed; legacy employee records remain separate until migration. |
| `dailyReports` | `projectId`, date, weather, stage, planned/completed work, quantities, labour/material/equipment, issues, next plan, engineer, photo paths | Admin create/read; media stored in project-scoped Storage paths. |
| `expenses` | `projectId`, date, category, payee/vendor, mode, invoice, amount/tax/total, approval/payment status | Append-only after approval; corrections by reversal. |
| `invoices`, `payments` | `projectId`, client, milestone, invoice/tax/total/due date/status; payment allocation/receipt | Customer reads assigned project invoices and payments only after rules are expanded explicitly. |
| `inspections`, `safetyIncidents` | Project/date/category/checklist/result, defect/action/assignee/target/status/photo paths | Admin-managed; incidents restricted to authorized staff. |
| `documents` | `projectId`, type, storage path, version, access policy, uploader, timestamps | Metadata in Firestore; binary files in Storage. Never store file contents in a project document. |
| `handovers` | `projectId`, completion/inspection, snags, rectification, final value/cost/received/balance, warranty, feedback, approval/status | Closure is gated by authorized approval. |
| `notifications`, `auditLogs` | Recipient/project, type/message/read state; actor/action/entity/before-after/time | Audit records append-only; server-generated audit is preferred for privileged changes. |

## Query and index plan

Use project-scoped queries first (`projectId` equality plus `status`, business date, or `createdAt` ordering). Add composite indexes only for queries actually introduced by screens, and deploy them with `firebase deploy --only firestore:indexes`. The current screens load project records in an admin-only listener and filter client-side; this is suitable only for a small workspace. Pagination and server-side filters are required before large collections are introduced. `firestore.indexes.json` starts empty because no implemented screen currently requires a composite index.

## Security and deployment

The existing rules enforce the admin boundary and customer access to assigned projects. New ERP collections must get explicit Firestore matches before their UI is enabled; do not add a permissive catch-all. Keep Firebase Web config in `firebase-config.js` (it is public configuration), never place Admin SDK credentials or private API keys in browser code. Use trusted server tooling for custom claims. Validate Storage paths against project membership and content limits. Enable App Check before public traffic.

Deploy Hosting, Firestore rules, indexes, and Storage rules from a trusted environment after reviewing rule tests. Existing `npm run test:rules` tests the current rules suite. Production seeding must use non-sensitive demo data and must not create privileged users from client code.

## Delivery sequence

1. Authentication, roles, record conventions, and project master (implemented incrementally in the existing app).
2. Client/enquiry CRM, estimates/quotation versions, BOQ, WBS/tasks, milestones, and progress automation.
3. Materials/stock ledger, vendors, requisitions, purchase orders, and goods receipts.
4. Labour/contractors/attendance costs, daily reports/media, expenses, billing, receipts, and approvals.
5. Quality/safety, documents, handover/closure, profitability, reports/exports, notifications, and audit coverage.
6. Responsive navigation, pagination, accessibility, empty/error/loading states, dark mode, demo fixtures, automated rule/business tests, and deployment verification.
