# Quick Reference Guide - Blood Donation Workflow

**Print this page or keep it handy for quick reference!**

---

## 🩸 THE 8-STEP WORKFLOW

```
┌───────────────────────────────────────────────────────────────── ┐
│                    REQUESTER SIDE (Left)                         │
│                                                                  │
│  1. Create Blood Request                                         │ 
│     POST /blood-requests                                         │
│     Body: bloodGroup, units, urgency, location                   │
│     Result: status = 'active'                                    │
│                                                                  │
│  2. (Optional) Check Matching Donors                             │
│     GET /blood-requests/:id/match                                │
│     Shows: list of compatible donors                             │
│                                                                  │
│  3. Request a Donor                                              │
│     POST /blood-requests/:id/request                             │
│     Body: donorId                                                │
│     Result: status = 'request_pending'                           │
│                                                                  │
│  ⏳ WAITING... Donor has been notified                           │
│                                                                  │
│  5. (Optional) Schedule Donation                                 │
│     POST /blood-requests/schedule                                │
│     Body: requestId, scheduleDate                                │
│     Result: status = 'accepted'                                  │
│                                                                  │
│  7. View Blood Donations                                         │
│     GET /blood-donations                                         │
│     Shows: all your donation records                             │
│                                                                  │
├────────────────────────────────────────────────────────────── ───┤
│                      DONOR SIDE (Right)                          │
│                                                                  │
│  ⏭️ RECEIVES NOTIFICATION: Blood needed for AB+                  │
│                                                                  │
│  4. See Incoming Requests                                        │
│     GET /donors/incoming-requests                                │
│     Shows: pending requests for donor's blood type               │
│                                                                  │
│  5. Open Request Details                                         │
│     GET /donors/incoming-requests/:id                            │
│     Shows: requester info, hospital, urgency                     │
│                                                                  │
│  6. Accept Request                                               │
│     PATCH /donors/incoming-requests/:id/accept                   │
│     Result: status = 'request_accepted'                          │
│             BloodDonation created                                │
│                                                                  │
│  ⏳ WAITING... For scheduling or donation day                    │
│                                                                  │
│  8. Donation Complete (Hospital Staff)                           │
│     PATCH /blood-requests/:id/complete                           │
│     Result: status = 'donation_completed'                        │
│                                                                  │
└─────────────────────────────────────────────────────────── ──────┘
```

---

## 📊 STATUS AT EACH STEP

| Step | BloodRequest Status | BloodDonation Status | What Happens |
|------|---|---|---|
| 1 | `active` | - | Request created |
| 2 | `active` | - | (Read-only) |
| 3 | `request_pending` | - | Request sent to donor |
| 4 | `request_pending` | - | Donor sees notification |
| 5 | `request_pending` | - | Donor views details |
| 6 | `request_accepted` | `request_pending` | **Donor accepts, donation record created** |
| 7 | `accepted` | `request_pending` | Appointment scheduled |
| 8 | `donation_completed` | `completed` | Donation complete ✅ |

---

## 🔄 STATE MACHINE SIMPLIFIED

```
REQUESTER'S REQUEST STATUS:
active → request_pending → request_accepted → (schedule) → accepted → donation_completed

DONOR'S DONATION STATUS:
(created when donor accepts)
request_pending → completed
```

---

## 🛠️ BLOOD GROUP COMPATIBILITY

All blood groups can receive from specific donors:

```
O+ → Can donate to everyone (UNIVERSAL DONOR)
O- → Can donate to everyone (UNIVERSAL DONOR)
A+ → Can donate to A+, AB+
A- → Can donate to A+, A-, AB+, AB-
B+ → Can donate to B+, AB+
B- → Can donate to B+, B-, AB+, AB-
AB+ → Can donate to AB+ only
AB- → Can donate to AB+, AB-
```

---

## 📱 API ENDPOINTS CHEAT SHEET

### FOR REQUESTER:
```
POST   /blood-requests                  Create request
GET    /blood-requests                  List all requests (except own)
GET    /blood-requests/my-requests      List only your own blood requests
GET    /blood-requests/:id              Get single request
GET    /blood-requests/:id/match        Check matching donors
POST   /blood-requests/:id/request      Request a donor
POST   /blood-requests/schedule         Schedule donation
GET    /blood-donations                 View all your donations
```

### FOR DONOR:
```
GET    /donors/incoming-requests         Get incoming requests
GET    /donors/incoming-requests/:id     View request details
PATCH  /donors/incoming-requests/:id/accept    Accept request
```

### FOR ADMIN:
```
PATCH  /blood-requests/:id/complete     Mark donation as complete
```

---

## ✅ SUCCESS RESPONSE EXAMPLES

### Creating Request:
```json
{
  "id": 12,
  "status": "active",
  "bloodGroup": "AB+",
  "requiredUnits": 2,
  "urgency": "urgent",
  "requesterName": "Rania",
  "createdAt": "2026-05-08T10:00:00Z"
}
```

### Requesting Donor:
```json
{
  "bloodRequest": {
    "id": 12,
    "status": "request_pending",
    "requestedToDonorId": 5,
    "requestedToDonorName": "Ahmed"
  },
  "donor": { "id": 5, "fullName": "Ahmed", "bloodGroup": "AB+" },
  "requester": { "id": 2, "fullName": "Rania", "phoneNumber": "..." }
}
```

### Accepting Request:
```json
{
  "bloodRequest": {
    "id": 12,
    "status": "request_accepted"
  },
  "donation": {
    "id": 1,
    "status": "request_pending",
    "donorId": 5,
    "requestId": 12
  }
}
```

---

## ❌ ERROR CODES & SOLUTIONS

| Status | Error | Solution |
|--------|-------|----------|
| 400 | Invalid blood group | Use: O+, O-, A+, A-, B+, B-, AB+, AB- |
| 400 | Units out of range | Enter 1-5 units |
| 400 | Invalid location | Check latitude (-90 to 90) and longitude (-180 to 180) |
| 404 | Request not found | Request ID doesn't exist or was deleted |
| 409 | Conflict | Request already accepted by another donor |
| 401 | Unauthorized | Login again, your token expired |
| 403 | Forbidden | You don't have permission |

---

## 📲 KEY NOTIFICATIONS SENT

```
REQUESTER RECEIVES:
✓ After requesting: "Request sent to Ahmed"
✓ After donor accepts: "Ahmed has accepted! Donation pending"
✓ After scheduling: "Appointment confirmed for May 10, 2pm"
✓ After completion: "Donation completed! Blood ready"

DONOR RECEIVES:
✓ After requester requests: "Blood needed for AB+ - URGENT"
✓ After own acceptance: "You accepted the request"
✓ After scheduling: "Appointment set for May 10, 2pm"
✓ After completion: "Thank you for donating!"

SUPERADMIN RECEIVES:
✓ New request created
✓ Donation accepted
✓ Donation completed
```

---

## 🎯 FLOW FOR DIFFERENT SCENARIOS

### Scenario 1: Requester Has Compatible Donor
```
1. Create request                    status: active
2. Check matching donors             (sees own donor)
3. Request that specific donor       status: request_pending
4. Donor accepts                     status: request_accepted
5. (Optional) Schedule               status: accepted
6. Donate and mark complete          status: donation_completed
```

### Scenario 2: No Compatible Donor
```
1. Create request                    status: active
2. Check matching (no match)
3. Request any available donor       status: request_pending
4. System finds eligible donor       (donor gets notification)
5. Donor accepts                     status: request_accepted
6. (Optional) Schedule               status: accepted
7. Donate and mark complete          status: donation_completed
```

### Scenario 3: Donor Declines
```
1-3. Same as scenario 1
4. Donor sees notification
   [Donor chooses NOT to accept]
   → Request stays 'request_pending'
   → Can be sent to another donor
```

---

## 🔐 AUTHENTICATION HEADER

All requests except login need:
```
Authorization: Bearer {your_jwt_token}
```

Example with curl:
```bash
curl -H "Authorization: Bearer eyJhbGc..." \
  https://api.rehma.app/api/blood-requests
```

---

## 📋 DATA PERSISTENCE RULES

### What Stays (Even If Deleted):
- Completed donations
- Activity logs
- Notification history

### What Can Be Deleted:
- Active blood requests (before being requested)
- Donors (won't delete past donations)

### What Updates Automatically:
- Request status (based on actions)
- Donation status (based on actions)
- LastModified timestamps

---

## 🎓 COMMON MISTAKES TO AVOID

| ❌ Wrong | ✅ Correct |
|---------|-----------|
| POST to `/blood-requests/schedule` with requestId in URL | POST with requestId in body |
| GET `/blood-requests` returns own requests | GET filters out own requests |
| Expecting instant donor notification | Push notification happens via WebSocket |
| Status `request_complete` | Status is `donation_completed` |
| Creating donation manually | Donation auto-created when donor accepts |
| Scheduling before donor accepts | Schedule AFTER donor accepts |
| Blood group `AB` | Use `AB+` or `AB-` |

---

## 📞 REQUESTER → DONOR COMMUNICATION

The system provides:
- Donor name & phone number to requester
- Requester name & phone number to donor (when accepting)
- Hospital location to both parties
- Scheduled appointment time (if set)

Direct communication happens outside the app for final confirmations.

---

## 🚀 DEPLOYMENT CHECKLIST

- [ ] All endpoints tested with valid data
- [ ] All endpoints tested with invalid data
- [ ] Error messages are user-friendly
- [ ] Notifications trigger correctly
- [ ] Frontend validates before API call
- [ ] Backend validates all inputs
- [ ] JWT tokens working correctly
- [ ] CORS configured properly
- [ ] Database backups scheduled
- [ ] Load testing done (100+ concurrent users)
- [ ] Security audit passed
- [ ] Production API URL updated in frontend config

---

## 📚 DOCUMENTS REFERENCE

| Document | Purpose | Audience |
|----------|---------|----------|
| WORKFLOW_COMPLETE.md | Full details with examples | Everyone |
| WORKFLOW_DIAGRAMS.md | Visual flowcharts & state machines | Everyone |
| FRONTEND_INTEGRATION_GUIDE.md | Code examples & implementation | Frontend Developers |
| QUICK_REFERENCE.md | This document | Everyone (Quick lookup) |

---

## 💡 TIPS FOR DEVELOPERS

1. **Always validate input** before sending to API
2. **Handle 409 Conflict** - another action might have changed status
3. **Store user role** - access varies by role (requester/donor/admin)
4. **Listen for notifications** - UI should update in real-time
5. **Implement retry logic** - network errors happen
6. **Clear tokens on 401** - redirect user to login
7. **Show loading states** - especially for multi-step flows
8. **Test status changes** - blood request status is complex

---

## 🆘 DEBUG TIPS

**Request not appearing in GET /blood-requests?**
→ Check if it's your own request (filtered out by system)

**Donor not seeing the request?**
→ Check donor has matching blood group to the request

**Can't schedule appointment?**
→ Make sure donor accepted first (status = 'request_accepted')

**Donation status stuck on 'request_pending'?**
→ Need to call PATCH /blood-requests/:id/complete

**Not receiving notifications?**
→ Check WebSocket connection is active
→ Check browser permissions for push notifications

---

**Version:** 1.0  
**Last Updated:** May 8, 2026  
**Print Date:** ___________



The system also supports additional flows and features not previously listed in this quick reference. Add these items when expanding the documentation or implementing frontend behavior.

- **Nearby Donors (Geolocation / Map Search):** Find and request donors by proximity with map/list view, routing, and privacy-safe location display.
- **Donor Profile & Availability:** Donor availability windows, `lastDonationAt`, automatic cooldown enforcement, and availability toggles.
- **Donor Verification & Trust:** Phone/ID/blood-test verification flags, badges, and fraud-handling rules.
- **Multi-donor & Split Requests:** Allow splitting multi-unit requests across multiple donors and tracking partial fulfilments.
- **Donation Center Scheduling & Capacity:** Donation centers expose time slots and capacity; the system books slots and enforces capacity.
- **Urgency Escalation / Broadcasts:** Escalate urgent requests by broadcasting to many donors or notifying admins; configurable escalation rules.
- **Hospital Staff Workflow:** Check-in, donor verification on arrival, bag ID assignment, and completion workflow for staff users.
- **Blood Inventory & Bag Tracking:** Track blood unit lifecycle, storage location, expiration, and transfusion links for inventory management.
- **Privacy / Consent & Opt-in Controls:** Donor opt-in for appearing in nearby searches, consent for contact-sharing, and location-precision controls.
- **Matching Algorithm Details:** Combine proximity, blood-group compatibility, recent donations, and donor priority to rank candidates.
- **Offline / Retry / SMS Fallback:** Use SMS when push/WebSocket notifications fail for critical alerts (configurable fallback policies).
- **Activity Logs & Audit Trail:** Immutable logs for requests, donations, notifications, and admin actions for auditing.
- **Rate-limiting & Abuse Controls:** Throttle nearby-search and request actions; maintain blacklists and abuse-detection rules.
- **Localization & Accessibility:** Multi-language support for UI strings and accessible map interactions.
- **Reporting & Analytics:** Dashboards and metrics for response times, accept rates, inventory levels, and fulfillment sources.

---

## 🗺️ NEARBY DONORS — MAP FLOW (Compact Reference)

Goal: show donors within a configurable radius, score and sort them by distance/availability/verification, and allow requester to request or contact a donor while preserving donor privacy.

Triggers:
- Requester creates a blood request with location OR taps "Find nearby donors" in request details.
- Donor toggles `isAvailable` -> becomes discoverable.

UI components:
- Map view with donor pins (clustered at zoom-out).
- List view sorted by distance / suitability.
- Donor card modal: `name, bloodGroup, lastDonationDate, availability, distance, contact CTA, request CTA`.
- Filters: radius slider, blood-group, availability, verification badges.

Suggested API endpoints:
```
GET    /donors/nearby?lat={lat}&lng={lng}&radius={km}&bloodGroup={}
GET    /donors/:id
POST   /blood-requests/:id/request   (existing - request a specific donor)
GET    /donors/nearby/centers?lat={lat}&lng={lng}&radius={km}
```

Server-side notes:
- Use a geospatial index (PostGIS or DB-specific) for radius queries.
- Store donor fields: `location {lat,lng}`, `isAvailable`, `availableFrom`, `availableTo`, `lastDonationAt`, `verifiedFlags`.
- Compute score = f(distance, availability window, lastDonationAge, verification).
- Cache hot queries for busy areas.

Map-style step-by-step:
1. Client requests `GET /donors/nearby` with requester location and request blood group.
2. Server returns donors where `isAvailable = true`, blood-group compatible, and `distance <= radius` ordered by score.
3. Client displays pins and list; user opens donor card and can `Request Donor`, `Call`, `Message`, or `Get Directions`.
4. `Request Donor` triggers `POST /blood-requests/:id/request` with `requestedToDonorId` (existing API); donor receives notification.
5. Donor acceptance continues standard scheduling and donation flows.
6. If no donors found, client shows fallbacks: expand radius, broadcast request, or show nearest donation centers.

Real-time & notifications:
- WebSocket topic(s) for availability updates in an area (e.g., `donors.nearby.{region}`) to update map pins.
- Notification types: `NearbyRequestSent`, `NearbyNoDonorsFound`.
- SMS fallback for urgent broadcasts when push fails.

Edge cases & privacy:
- Respect donor privacy: show approximate location (distance bucket or blurred coords) until donor accepts.
- Require donor consent (opt-in) to appear in nearby results.
- If donor location is stale (> configurable TTL), prompt a location refresh on accept.
- Enforce single outstanding `request_pending` per donor per urgent request; auto-advance to next candidate after TTL.

Security & limits:
- Rate-limit `GET /donors/nearby` per user/IP to prevent scraping.
- Only return contact details after donor accepts or per privacy policy.

Metrics to collect:
- `nearby_query_count`, `donor_accept_rate_by_distance`, `time_to_accept`, `requests_fulfilled_via_nearby`.

Add this compact flow here for quick reference; extract to a dedicated `docs/NEARBY_DONORS.md` if you want a longer design doc.
