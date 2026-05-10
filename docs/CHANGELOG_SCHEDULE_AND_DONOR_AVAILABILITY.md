# Summary of Changes — Scheduling & Donor Availability

**Date:** 2026-05-10

## Scheduling: normalize matching
- File changed: `rehma-backend/src/storage/app-storage.service.ts`
- What: Improved `scheduleBloodRequest` matching logic to normalize blood-group strings and availability checks.
- Details: trims whitespace and compares blood groups case-insensitively; treats `availabilityStatus` case-insensitively when selecting eligible donors.
- Why: avoids missed matches when users have multiple donors with slightly different blood-group formatting.

## Donor availability after donation
- Files changed: `rehma-backend/src/storage/app-storage.service.ts`
- What: When a donation completes the donor is marked as recently donated and made unavailable; the system records `lastDonationDate`.
- Details: `completeBloodRequest` and `updateBloodDonation` now set `lastDonationDate`, `isAvailable = false`, and `availabilityStatus = 'Recently Donated'`.
- Auto-restore: a new helper `restoreAvailabilityIfEligible` refreshes donor availability on reads/lists and restores donors to `Available` after 60 days since `lastDonationDate`.

## Notes & next steps
- This behavior currently restores availability on donor reads; consider adding a background job for explicit periodic restoration.
- I can add a short test or update the README if you want.
