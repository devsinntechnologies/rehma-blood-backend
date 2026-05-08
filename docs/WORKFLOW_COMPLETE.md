# Complete Blood Donation Request Workflow

**Last Updated:** May 8, 2026  
**Target Audience:** Non-technical stakeholders, Product managers, Frontend developers

---

## Table of Contents
1. [Workflow Overview](#workflow-overview)
2. [Complete Step-by-Step Flow](#complete-step-by-step-flow)
3. [State Transitions](#state-transitions)
4. [API Endpoints Reference](#api-endpoints-reference)
5. [Frontend Integration Guide](#frontend-integration-guide)
6. [Error Handling](#error-handling)

---

## Workflow Overview

This system connects **blood requesters** (people who need blood) with **blood donors** (people willing to donate) through a structured workflow with clear state transitions and real-time notifications.

### Key Actors
- **Requester/User**: Person who needs blood and creates a request
- **Donor**: Person with available blood who can donate
- **System**: Backend API managing all data and notifications
- **Superadmin**: Oversees all requests and donations

### Core Concept
Instead of matching blood requests to blood donors manually, the system allows:
1. Requesters to broadcast their need to available donors
2. Donors to see incoming requests and accept/decline
3. Automatic tracking of donation status from request through completion

---

## Complete Step-by-Step Flow

### **STAGE 1: REQUESTER CREATES BLOOD REQUEST**

**Who:** User with blood need  
**What:** Creates a new blood request in the system  
**Backend Changes:** New `BloodRequest` record created

```
┌─────────────────────────────────────────────────────────┐
│ STEP 1: CREATE BLOOD REQUEST                            │
├─────────────────────────────────────────────────────────┤
│ Requester fills form:                                   │
│  • Blood Group (O+, AB-, etc.)                          │
│  • Number of Units Needed (1-5)                         │
│  • Urgency Level (regular or urgent)                    │
│  • Hospital Location (latitude, longitude)              │
│  • Additional Notes (patient condition, etc.)           │
│                                                          │
│ Backend creates:                                         │
│  ✓ BloodRequest record                                  │
│    - id: auto-generated                                 │
│    - status: 'active'                                   │
│    - bloodGroup: 'AB+'                                  │
│    - requiredUnits: 2                                   │
│    - urgency: 'urgent'                                  │
│    - requesterUserId: 2                                 │
│    - createdAt: current timestamp                       │
│                                                          │
│ Notifications sent to:                                   │
│  → Superadmins (new request alert)                      │
└─────────────────────────────────────────────────────────┘
```

**Status After Step 1:** `BloodRequest.status = 'active'`

---

### **STAGE 2: REQUESTER CHECKS AVAILABLE DONORS (OPTIONAL)**

**Who:** Same requester  
**What:** Checks if any of their own registered donors have matching blood group  
**Backend Changes:** None (read-only operation)

```
┌─────────────────────────────────────────────────────────┐
│ STEP 2: CHECK MATCHING DONORS (OPTIONAL)               │
├─────────────────────────────────────────────────────────┤
│ Requester can check:                                    │
│  • "Do I have any donors with AB+ blood?"              │
│  • View list of matching available donors               │
│                                                          │
│ Backend checks:                                          │
│  • All requester's registered donors                    │
│  • Filter by blood group match                          │
│  • Check availability (not busy/unavailable)            │
│                                                          │
│ Response shows:                                          │
│  ✓ Yes/No - do matching donors exist                   │
│  ✓ List of matching donor names and contacts           │
│                                                          │
│ NO DATA CHANGES - Just informational                    │
└─────────────────────────────────────────────────────────┘
```

**Status After Step 2:** `BloodRequest.status = 'active'` (unchanged)

---

### **STAGE 3: REQUESTER SENDS REQUEST TO A DONOR**

**Who:** Requester (or system broadcasts to all available donors)  
**What:** Requester selects a donor and requests blood donation  
**Backend Changes:** Request status changes, donor is notified

```
┌─────────────────────────────────────────────────────────┐
│ STEP 3: BROADCAST REQUEST TO DONOR                      │
├─────────────────────────────────────────────────────────┤
│ Action: Requester clicks "Request Donor"                │
│         and selects a specific donor                    │
│                                                          │
│ Backend Updates BloodRequest:                            │
│  ✓ status: 'active' → 'request_pending'                 │
│  ✓ requestedToDonorId: 5 (target donor)                │
│  ✓ requestedToDonorName: 'Ahmed'                        │
│  ✓ requestedAt: current timestamp                       │
│                                                          │
│ IMPORTANT: Now this request is ONLY for that donor      │
│ (Donor Ahmed sees it in their incoming requests)        │
│                                                          │
│ Notifications sent to:                                   │
│  ✓ Donor Ahmed: "Rania needs AB+ blood urgently!"      │
│  ✓ Requester Rania: "Request sent to Ahmed"            │
│                                                          │
│ Expected donor response time: 5-30 minutes              │
└─────────────────────────────────────────────────────────┘
```

**Status After Step 3:**
- `BloodRequest.status = 'request_pending'`
- `requestedToDonorId = 5`
- Donor has been notified

---

### **STAGE 4: DONOR SEES INCOMING REQUESTS**

**Who:** Donor (person who can donate)  
**What:** Donor opens app and sees list of blood requests  
**Backend Changes:** None (read-only)

```
┌─────────────────────────────────────────────────────────┐
│ STEP 4: DONOR VIEWS INCOMING REQUESTS                   │
├─────────────────────────────────────────────────────────┤
│ Donor's interface shows:                                 │
│  📋 Incoming Requests (for their blood types)           │
│                                                          │
│ List includes:                                           │
│  • Blood group needed                                    │
│  • Number of units                                      │
│  • Urgency level (urgent = RED, regular = YELLOW)      │
│  • Hospital location                                    │
│  • Requester name (patient's name usually)              │
│                                                          │
│ Each request is clickable to see more details           │
│                                                          │
│ NO DATA CHANGES - Just reading notifications            │
└─────────────────────────────────────────────────────────┘
```

**Status After Step 4:** `BloodRequest.status = 'request_pending'` (unchanged)

---

### **STAGE 5: DONOR OPENS REQUEST DETAILS**

**Who:** Same donor  
**What:** Donor clicks on a specific request to see full details  
**Backend Changes:** None (read-only)

```
┌─────────────────────────────────────────────────────────┐
│ STEP 5: DONOR REVIEWS REQUEST DETAILS                   │
├─────────────────────────────────────────────────────────┤
│ Donor sees detailed information:                         │
│  • Requester name: "Rania Khan"                         │
│  • Blood group needed: AB+                              │
│  • Units needed: 2                                       │
│  • Urgency: URGENT                                       │
│  • Hospital: Aga Khan Hospital                          │
│  • Hospital Address: (latitude, longitude)              │
│  • Additional notes: "Patient critical condition"       │
│  • Contact info of requester                            │
│                                                          │
│ Donor can now decide:                                    │
│  • Accept - "Yes, I can donate"                         │
│  • Decline - "No, I cannot donate now"                  │
│                                                          │
│ NO DATA CHANGES YET                                      │
└─────────────────────────────────────────────────────────┘
```

**Status After Step 5:** `BloodRequest.status = 'request_pending'` (unchanged)

---

### **STAGE 6: DONOR ACCEPTS REQUEST**

**Who:** Same donor  
**What:** Donor clicks ACCEPT button  
**Backend Changes:** Request status changes, donation record created, requester notified

```
┌─────────────────────────────────────────────────────────┐
│ STEP 6: DONOR ACCEPTS REQUEST                           │
├─────────────────────────────────────────────────────────┤
│ Action: Donor clicks "Accept & Commit to Donate"        │
│                                                          │
│ Backend performs:                                        │
│  1. Update BloodRequest:                                │
│     - status: 'request_pending' → 'request_accepted'   │
│                                                          │
│  2. Create BloodDonation record:                        │
│     - status: 'request_pending'                        │
│     - donorId: 5 (Ahmed)                                │
│     - requestId: 12 (the blood request)                 │
│     - donorName: 'Ahmed'                                │
│     - bloodGroup: 'AB+'                                 │
│     - units: 2                                           │
│     - createdAt: current timestamp                      │
│                                                          │
│ Notifications sent:                                      │
│  ✓ Requester: "Ahmed has accepted! Donation pending"   │
│  ✓ Donor: "You accepted the request"                    │
│  ✓ Superadmin: "Donation accepted - 5→12"              │
│                                                          │
│ Now both parties know:                                   │
│  • Donor Ahmed will donate                              │
│  • Next step: schedule time & date                      │
└─────────────────────────────────────────────────────────┘
```

**Status After Step 6:**
- `BloodRequest.status = 'request_accepted'`
- **NEW:** `BloodDonation.status = 'request_pending'`
- Both donor and requester have been notified

---

### **STAGE 7: REQUESTER SCHEDULES DONATION (OPTIONAL)**

**Who:** Requester (or donor can suggest time)  
**What:** Set specific date and time for donation  
**Backend Changes:** Donation date/time is recorded

```
┌─────────────────────────────────────────────────────────┐
│ STEP 7: SCHEDULE DONATION DATE & TIME                   │
├─────────────────────────────────────────────────────────┤
│ Requester sees: "Donation Accepted!"                    │
│ Can now schedule specific appointment:                  │
│                                                          │
│ Calendar picker shows:                                   │
│  • Available dates (next 7 days by default)             │
│  • Time slots (08:00, 10:00, 14:00, 16:00, etc.)       │
│                                                          │
│ Backend updates BloodRequest:                            │
│  ✓ scheduledDate: "2026-05-10T14:00:00Z"               │
│  ✓ status: 'accepted'                                  │
│                                                          │
│ Notifications sent:                                      │
│  ✓ Donor: "Appointment set for 2026-05-10 at 14:00"   │
│  ✓ Requester: "Appointment confirmed"                   │
│                                                          │
│ This is OPTIONAL - donation can proceed without time   │
└─────────────────────────────────────────────────────────┘
```

**Status After Step 7:**
- `BloodRequest.status = 'accepted'`
- `BloodRequest.scheduledDate = '2026-05-10T14:00:00Z'`
- `BloodDonation` record ready for next step

---

### **STAGE 8: DONATION HAPPENS & COMPLETED**

**Who:** Hospital staff / System administrator  
**What:** Donation physically occurs and is marked as completed  
**Backend Changes:** Both records marked as completed

```
┌─────────────────────────────────────────────────────────┐
│ STEP 8: DONATION COMPLETED                              │
├─────────────────────────────────────────────────────────┤
│ Real-world event: Ahmed arrives at hospital             │
│  1. Donor registers at reception                        │
│  2. Medical screening (health check)                    │
│  3. Blood collection (15-20 minutes)                    │
│  4. Recovery area (10 minutes)                          │
│  5. Staff marks donation as complete in system          │
│                                                          │
│ Backend updates BOTH records:                            │
│  1. BloodRequest:                                       │
│     - status: 'accepted' → 'donation_completed'        │
│                                                          │
│  2. BloodDonation:                                      │
│     - status: 'request_pending' → 'completed'          │
│     - completedAt: current timestamp                    │
│                                                          │
│ Notifications sent to:                                   │
│  ✓ Requester: "Donation completed! Blood ready"        │
│  ✓ Donor: "Thank you for donating!"                     │
│  ✓ Hospital: "Blood available for transfusion"         │
│  ✓ Superadmin: "Donation completed for request #12"    │
│                                                          │
│ System flow complete ✓                                   │
└─────────────────────────────────────────────────────────┘
```

**Status After Step 8:**
- `BloodRequest.status = 'donation_completed'`
- `BloodDonation.status = 'completed'`
- Workflow complete

---

## State Transitions

### Blood Request State Machine

```
┌────────────┐
│   ACTIVE   │  ← Requester creates request
└─────┬──────┘
      │
      │ Requester calls POST /blood-requests/:id/request
      │
      ▼
┌──────────────────┐
│ REQUEST_PENDING  │  ← Waiting for donor to see/accept
└─────┬────────────┘
      │
      │ Donor calls PATCH /donors/incoming-requests/:id/accept
      │
      ▼
┌──────────────────┐
│ REQUEST_ACCEPTED │  ← Donor accepted, donation pending
└─────┬────────────┘
      │
      │ Optional: Requester schedules date (POST /blood-requests/schedule)
      │ Changes to 'accepted' status
      │
      ▼
┌─────────────────┐
│    ACCEPTED     │  ← Appointment scheduled
└─────┬───────────┘
      │
      │ Donation happens, staff marks complete
      │ (PATCH /blood-requests/:id/complete)
      │
      ▼
┌─────────────────────────┐
│  DONATION_COMPLETED     │  ← All done, blood collected
└─────────────────────────┘
```

### Blood Donation State Machine

```
┌──────────────────┐
│ REQUEST_PENDING  │  ← Created when donor accepts
└─────┬────────────┘
      │
      │ Can stay in this state until donation happens
      │ Blood collected and marked complete
      │
      ▼
┌──────────────────┐
│    COMPLETED     │  ← Blood successfully collected
└──────────────────┘
```

---

## API Endpoints Reference

### For Frontend Developers - Call in This Order

#### **REQUESTER WORKFLOW**

**1. Create Blood Request**
```http
POST /blood-requests
Content-Type: application/json
Authorization: Bearer {token}

{
  "bloodGroup": "AB+",
  "requiredUnits": 2,
  "urgency": "urgent",
  "latitude": 24.8607,
  "longitude": 67.0011,
  "notes": "Emergency case"
}

Response: 200 OK
{
  "id": 12,
  "requesterUserId": 2,
  "requesterName": "Rania",
  "bloodGroup": "AB+",
  "requiredUnits": 2,
  "urgency": "urgent",
  "status": "active",
  "latitude": 24.8607,
  "longitude": 67.0011,
  "notes": "Emergency case",
  "createdAt": "2026-05-08T10:00:00Z"
}
```

**2. (OPTIONAL) Check Matching Donors**
```http
GET /blood-requests/12/match
Authorization: Bearer {token}

Response: 200 OK
{
  "hasMatchingAvailableDonor": true,
  "matchingDonors": [
    {
      "id": 5,
      "fullName": "Ahmed",
      "bloodGroup": "AB+",
      "isAvailable": true
    }
  ]
}
```

**3. Request a Donor**
```http
POST /blood-requests/12/request
Content-Type: application/json
Authorization: Bearer {token}

{
  "donorId": 5
}

Response: 200 OK
{
  "bloodRequest": {
    "id": 12,
    "status": "request_pending",
    "requestedToDonorId": 5,
    "requestedToDonorName": "Ahmed",
    "requestedAt": "2026-05-08T10:05:00Z"
  },
  "donor": {
    "id": 5,
    "fullName": "Ahmed",
    "bloodGroup": "AB+",
    "phoneNumber": "+923001234567"
  },
  "requester": {
    "id": 2,
    "fullName": "Rania",
    "phoneNumber": "+923009876543"
  }
}
```

**4. (OPTIONAL) Schedule Donation Date**
```http
POST /blood-requests/schedule
Content-Type: application/json
Authorization: Bearer {token}

{
  "requestId": 12,
  "scheduleDate": "2026-05-10T14:00:00Z"
}

Response: 200 OK
{
  "bloodRequest": {
    "id": 12,
    "status": "accepted",
    "scheduledDate": "2026-05-10T14:00:00Z"
  },
  "donor": { ... },
  "requester": { ... }
}
```

**5. View Your Blood Donations**
```http
GET /blood-donations
Authorization: Bearer {token}

Response: 200 OK
[
  {
    "id": 1,
    "requestId": 12,
    "donorId": 5,
    "donorName": "Ahmed",
    "bloodGroup": "AB+",
    "units": 2,
    "status": "donation_pending",
    "createdAt": "2026-05-08T10:05:30Z"
  }
]
```

---

#### **DONOR WORKFLOW**

**1. Get Incoming Requests**
```http
GET /donors/incoming-requests
Authorization: Bearer {token}

Response: 200 OK
[
  {
    "id": 12,
    "requesterName": "Rania Khan",
    "bloodGroup": "AB+",
    "requiredUnits": 2,
    "urgency": "urgent",
    "status": "request_pending",
    "latitude": 24.8607,
    "longitude": 67.0011,
    "createdAt": "2026-05-08T10:00:00Z"
  }
]
```

**2. Open Request Details**
```http
GET /donors/incoming-requests/12
Authorization: Bearer {token}

Response: 200 OK
{
  "id": 12,
  "requesterName": "Rania Khan",
  "requesterPhoneNumber": "+923009876543",
  "bloodGroup": "AB+",
  "requiredUnits": 2,
  "urgency": "urgent",
  "status": "request_pending",
  "hospital": "Aga Khan Hospital",
  "latitude": 24.8607,
  "longitude": 67.0011,
  "notes": "Emergency case",
  "createdAt": "2026-05-08T10:00:00Z"
}
```

**3. Accept Request**
```http
PATCH /donors/incoming-requests/12/accept
Authorization: Bearer {token}

Response: 200 OK
{
  "bloodRequest": {
    "id": 12,
    "status": "request_accepted",
    "requestedToDonorId": 5,
    "requestedToDonorName": "Ahmed"
  },
  "donation": {
    "id": 1,
    "status": "request_pending",
    "donorId": 5,
    "donorName": "Ahmed",
    "requestId": 12
  }
}
```

**4. Complete Donation (Admin/Hospital Staff)**
```http
PATCH /blood-requests/12/complete
Content-Type: application/json
Authorization: Bearer {token}

{
  "donorId": 5
}

Response: 200 OK
{
  "id": 12,
  "status": "donation_completed",
  "completedAt": "2026-05-10T14:30:00Z"
}
```

---

## Frontend Integration Guide

### Requester Interface Flow

```
1. [Blood Request Form]
   ↓ (POST /blood-requests)
   
2. [Show Confirmation] "Request Created Successfully"
   ↓ Option A: Check matching donors
   
3. [Check My Donors] (GET /blood-requests/:id/match)
   ├─ Show matching donors list
   └─ Let requester select one OR "request any"
   
4. [Send Request] (POST /blood-requests/:id/request)
   ↓
   
5. [Show Status] "Waiting for donor response..."
   ├─ Display donor name
   ├─ Show waiting indicator
   └─ Allow view donations page
   
6. [Donor Accepted!]
   ├─ Show "Schedule appointment" option
   └─ Allow POST /blood-requests/schedule
   
7. [View Scheduled Date]
   └─ Show appointment details to donor
   
8. [View Blood Donations]
   └─ GET /blood-donations shows all requests with status
```

### Donor Interface Flow

```
1. [Notification Alert] "New blood request for AB+"
   ↓
   
2. [Incoming Requests List] (GET /donors/incoming-requests)
   ├─ Show list of pending requests
   ├─ Color code by urgency (red for urgent)
   └─ Show blood group match indicators
   
3. [Click on Request] (GET /donors/incoming-requests/:id)
   ├─ Show requester info
   ├─ Show hospital location
   ├─ Show urgency level
   └─ Display [Accept] or [Decline] buttons
   
4. [Accept Request] (PATCH /donors/incoming-requests/:id/accept)
   ↓
   
5. [Confirmation Screen] 
   ├─ "You have committed to donate"
   ├─ Wait for appointment scheduling
   └─ Show requester's contact info
   
6. [Donation Day] 
   ├─ View scheduled appointment
   ├─ Navigate to hospital
   └─ Complete donation at hospital
```

---

## Error Handling

### Common Error Scenarios

| Scenario | API Response | Frontend Action |
|----------|--------------|-----------------|
| Request blood group not in system | 400 Bad Request | Show dropdown with valid groups |
| Donor blood group mismatch | 400 Bad Request | Show "Donor cannot donate this blood type" |
| Donor already committed to other requests | 409 Conflict | Show "Donor unavailable" |
| Request already accepted by another donor | 409 Conflict | Show "Someone else accepted, refresh" |
| Required units exceeds donor capacity | 400 Bad Request | Show "Cannot donate this many units" |
| No blood donations exist yet | 404 Not Found | Show "No donations tracked yet" |
| Invalid token/Not authenticated | 401 Unauthorized | Redirect to login |
| Superadmin access required | 403 Forbidden | Show "Permission denied" |

### Handling Success vs Pending States

```javascript
// After donor accepts, request is 'request_accepted'
// but donation is 'request_pending' 
// → Show "Donation Accepted - Waiting for confirmation"

// After scheduling
// request is 'accepted'
// → Show appointment date/time to both parties

// After completion
// request is 'donation_completed'
// donation is 'completed'
// → Show "Donation Completed Successfully" with thank you message
```

---

## Summary Timeline

| Time | Event | Status | Who Sees It |
|------|-------|--------|------------|
| T+0 | Rania creates request for AB+ | active | Superadmin |
| T+1 | Rania requests Ahmed | request_pending | Ahmed (notification) |
| T+3 | Ahmed opens request | request_pending | Ahmed (reading) |
| T+5 | Ahmed accepts | request_accepted | Rania (notification) |
| T+6 | Rania schedules date | accepted | Ahmed (notification) |
| T+48h | Ahmed donates at hospital | donation_completed | Rania (notification) |

---

## Data Model Summary

### BloodRequest Table
```
id: number
requesterUserId: number
requesterName: string
bloodGroup: string (O+, O-, A+, A-, B+, B-, AB+, AB-)
requiredUnits: number (1-5)
urgency: string ('regular' | 'urgent')
latitude: number
longitude: number
notes: string
status: 'active' | 'request_pending' | 'request_accepted' | 'accepted' | 'donation_completed'
requestedToDonorId: number (when status = request_pending)
requestedToDonorName: string (when status = request_pending)
requestedAt: timestamp
scheduledDate: timestamp (when scheduled)
createdAt: timestamp
```

### BloodDonation Table
```
id: number
requestId: number (links to blood request)
donorId: number
donorName: string
bloodGroup: string
units: number
status: 'request_pending' | 'completed'
createdAt: timestamp
completedAt: timestamp (when status = completed)
```

### Notification System
- Real-time push notifications when status changes
- SMS/Email notifications for important events
- Notification records stored for audit trail

---

**Document Version:** 1.0  
**Last Updated:** May 8, 2026  
**Next Review:** May 15, 2026
