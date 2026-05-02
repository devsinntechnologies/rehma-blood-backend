# Rehma Blood — Complete Flow (Non‑Technical)

This document explains how the system works from the perspective of the people who use it (not developers). It describes the end-to-end experience for three main actors: an Authenticated User (hospital staff or organizer), a Donor, and the System (the app/API). Use this to explain features to stakeholders or new product users.

---

## Actors
- Authenticated User: a registered person who can invite donors, create blood requests, and manage invites (e.g., a hospital staff or volunteer coordinator).
- Donor: a person who gives blood. They may be invited by an Authenticated User, or they can register themselves.
- System: the Rehma Blood backend and app (handles invite codes, registration, requests, maps, and history).

---

## High-level goals
- Let organizations invite donors easily (no email required at invite time).
- Enable donors to sign up later using a simple promo/invite code and keep their donation history intact.
- Keep one authentication system so donors and users are regular app users.
- Allow invited donors to become fully self-managed users after signup.

---

## End-to-end user flows (plain language)

### 1) Invite a donor (Auth User)
- The Authenticated User opens the app and chooses “Invite Donor.”
- They enter basic info (name, phone, blood group). Email is optional.
- The system creates a donor entry and generates a short promo code (for example: `RB-82JKL`).
- The app shows the promo code and provides buttons to share it by WhatsApp, SMS, or email.
- The donor record is now listed under the creator’s "My Created Donors" list with status `INVITED`.

What this means: the system remembers who invited the donor and keeps the donor record in the database.

---

### 2) Donor receives the code and signs up (Donor)
- The donor receives the promo code and opens the app or web sign-up form.
- They register using the normal sign-up form and enter the promo code in the special field.
- The system checks the promo code:
  - If valid and not yet used, the system links that invited donor record to the new user account and marks it `CLAIMED`.
  - If the code was already used or expired, the donor is informed.
- The system automatically creates a donor profile for the new user (so every user can be a donor) and also links the invited donor (if any).

What this means: the donor now has a normal user account and their invited donor record is preserved and linked — no duplicate donation history.

---

### 3) Donor operates as a self-managed donor (Donor)
- After signup, the donor can: update availability, set location, accept requests, or view donation history.
- The donor can also create or manage their own donor profile if needed.

What this means: donors use the same app features as other users, and the donor record keeps history of donations and requests.

---

### 4) Create a blood request (Auth User or any authorized user)
- A user creates a blood request (patient name, blood group, urgency, location).
- The request appears in the list of active requests.
- Donors nearby (or with matching blood group) can view active requests.
- Donors accept the request and update status as they progress (accepted, on the way, arrived).
- Once donation is completed, the request is marked completed and a donation record is saved.

What this means: donors and users can coordinate through the app; records show who accepted and fulfilled the request.

---

### 5) Donation history and audit (All actors)
- All donations are tied to donor records (invited donor or user's own donor profile).
- When a donor claims an invite, their past invited-related activity remains linked to the same donor record.
- Creators can see conversion stats (invited → claimed) and donation counts.

What this means: no history is lost when a donor becomes a full user.

---

### 6) Promo code lifecycle (Creator controls)
- Regenerate: Creator can generate a new promo code for an invited donor (only if not claimed).
- Disable: Creator can disable/expire a promo code so it cannot be used.
- Resend: Creator can view the promo code and resend the invite (via sharing options).

What this means: creators control invite validity and can manage invites safely.

---

## How the map helps (brief)
- The app uses location to show nearby requests and donors on a map.
- Donors can set their location and availability; the system uses this data to recommend nearby active requests.
- Creators can also see approximate donor locations (privacy-respecting) for organizing responses.

What this means: geography matters — the map speeds up matching donors to urgent needs.

---

## Security and safety notes (non-technical)
- Invite codes are short and unique; they can be regenerated or disabled.
- When a donor signs up, the system checks codes and prevents reuse.
- Sensitive data like passwords are stored securely (not visible to creators).
- The creator does not get full account access to the donor — they only manage the invite and see invite/claim status.

---

## Example simple timeline (one sentence each)
- Dr. A invites Ali with code `RB-82JKL`.
- Ali later registers using `RB-82JKL`, the system links Ali to the invited donor record.
- Ali accepts a nearby urgent request, marks arrival, completes donation — all recorded under his donor profile.
- Dr. A still sees Ali in the "My Created Donors" list, now marked as `CLAIMED`.

---

## Key takeaways (for product/team)
- Invites are lightweight: no email required at invite time.
- Sign-up is unified: donors use the same registration as users and immediately obtain donor capabilities.
- Ownership is tracked: `createdBy` (inviter) and `linkedUser` (claimer) are preserved for reporting and audits.
- The map and status lifecycle make coordinating donations straightforward and transparent.

---

If you want, I can also: produce a one-page handout (PDF) for non‑technical stakeholders, or create a short slide deck illustrating the steps visually.