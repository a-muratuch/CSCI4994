# Project

## Purpose

MoveFlow helps a moving company coordinate a move from the customer's request through completion. The capstone should demonstrate a clear interface, relational data, role-based access, and an understandable end-to-end workflow.

This is planned product scope. The fresh repository currently contains only the frontend starter and shared UI primitives. Earlier project screenshots, routes, and examples do not establish what exists in this restart.

## Users and MVP responsibilities

| User | Core capabilities |
| --- | --- |
| Customer | Request a move, review and accept/reject an estimate, view their moves and progress, manage basic profile information |
| Worker | View assigned jobs and schedule, report availability, update assigned job progress, view job history |
| Admin | Review requests, prepare estimates, manage jobs/customers/workers/trucks, schedule moves, assign workers and trucks, monitor progress |

Public registration creates customers only. Worker and admin privileges must come from a trusted administrative process when the backend is implemented.

## Main workflow

1. Customer submits pickup/destination, requested date, property and item details, and notes.
2. Admin reviews the request and prepares a manual estimate.
3. Customer accepts or rejects the estimate. Rejected estimates return to admin review; they do not automatically become jobs.
4. Admin creates and schedules a job after acceptance, then assigns available workers and a truck.
5. Assigned workers report progress; the customer sees the move's current status.
6. The job is completed and remains available in history.

Example job progress: scheduled → in progress → completed. More detailed steps such as loading, in transit, and unloading are candidates, not a finalized state model. Define allowed transitions and who can perform them before implementing persistence.

## MVP scope

- Public homepage explaining the service and leading to a move request.
- Login/registration UI, followed later by real authentication.
- Customer, worker, and admin interfaces supporting the workflow above.
- Manual estimates, scheduling, worker/truck assignments, and status history.
- Supabase persistence and role/ownership checks in the backend stage.
- Loading, empty, validation, error, and success states; responsive and keyboard-accessible interactions.

Start with clearly labeled fictional fixtures. Mock interactions must not imply that an account was created or a request was saved remotely.

## Non-goals for the MVP

Payments, automatic pricing/distance calculations, GPS/live maps, chat, email automation, invoices/PDF exports, advanced analytics, public reviews, file uploads, and realtime notifications. Aceternity and other UI libraries are not part of the fresh setup.

## Success and open questions

Success means demonstrating the entire main workflow with persistent data, correct role boundaries, and no cross-customer data access. The student should be able to explain the implementation.

Before backend work, settle estimate revisions, cancellation rules, job transitions, scheduling/time zones and conflicts, pricing fields, and initial admin provisioning. Track decisions in [DECISIONS.md](DECISIONS.md); do not invent business rules while coding.
