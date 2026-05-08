# Complete Blood Donation Workflow Diagram

## Interactive Flowchart

```mermaid
graph TD
    Start([Blood Need Identified]) --> CreateReq["<b>STEP 1: CREATE REQUEST</b><br/>Requester fills form<br/>bloodGroup, units, urgency, location"]
    CreateReq --> ReqActive["✓ BloodRequest created<br/>status: 'active'<br/>Notification → Superadmin"]
    
    ReqActive --> Decision1{Requester checks<br/>own donors first?}
    Decision1 -->|Yes| CheckMatch["<b>STEP 2: CHECK MATCH</b><br/>GET /blood-requests/:id/match<br/>View compatible donors"]
    CheckMatch --> MatchResult["✓ See list of matching donors<br/>OR no matches found<br/>status: 'active' (unchanged)"]
    Decision1 -->|No| SendReq["<b>STEP 3: REQUEST DONOR</b><br/>POST /blood-requests/:id/request<br/>Select specific donor to request"]
    MatchResult --> SendReq
    
    SendReq --> ReqPending["✓ BloodRequest updated<br/>status: 'request_pending'<br/>requestedToDonorId: 5<br/>Notification → Donor Ahmed<br/>Notification → Requester"]
    
    ReqPending --> DonorSees["<b>STEP 4: DONOR SEES REQUEST</b><br/>GET /donors/incoming-requests<br/>Shows pending requests for donor's blood types"]
    DonorSees --> DonorNotif["✓ Donor sees incoming requests list<br/>status: 'request_pending' (unchanged)"]
    
    DonorNotif --> DonorOpen["<b>STEP 5: DONOR OPENS DETAILS</b><br/>GET /donors/incoming-requests/:id<br/>View full request information"]
    DonorOpen --> DonorRead["✓ Donor reads:<br/>• Requester name<br/>• Blood needed<br/>• Hospital location<br/>• Urgency<br/>status: 'request_pending' (unchanged)"]
    
    DonorRead --> Decision2{Donor decision}
    Decision2 -->|Decline| Declined["Request stays 'request_pending'<br/>Donor dismisses notification"]
    Decision2 -->|Accept| DonorAccept["<b>STEP 6: DONOR ACCEPTS</b><br/>PATCH /donors/incoming-requests/:id/accept<br/>Donor commits to donate"]
    Declined --> End1([Request Expires])
    
    DonorAccept --> Accepted["✓ BloodRequest updated<br/>status: 'request_accepted'<br/><br/>✓ BloodDonation CREATED<br/>status: 'request_pending'<br/>donorId: 5<br/>requestId: 12<br/><br/>Notification → Requester<br/>Notification → Donor"]
    
    Accepted --> Decision3{Schedule<br/>appointment?}
    Decision3 -->|No| PendingWait["Request ready for donation<br/>status: 'request_accepted'<br/>Donation status: 'request_pending'"]
    Decision3 -->|Yes| Schedule["<b>STEP 7: SCHEDULE DONATION</b><br/>POST /blood-requests/schedule<br/>Set date & time"]
    
    Schedule --> Scheduled["✓ BloodRequest updated<br/>status: 'accepted'<br/>scheduledDate: 2026-05-10T14:00Z<br/><br/>Notification → Both parties"]
    PendingWait --> DonationDay
    Scheduled --> DonationDay["<b>STEP 8: DONATION DAY</b><br/>Donor arrives at hospital<br/>Medical screening<br/>Blood collection (15-20 min)<br/>Recovery & discharge"]
    
    DonationDay --> Complete["<b>MARK COMPLETE</b><br/>PATCH /blood-requests/:id/complete<br/>Hospital staff marks in system"]
    
    Complete --> Completed["✓ BloodRequest updated<br/>status: 'donation_completed'<br/><br/>✓ BloodDonation updated<br/>status: 'completed'<br/>completedAt: timestamp<br/><br/>Notification → Both parties<br/>Notification → Hospital<br/>Notification → Superadmin"]
    
    Completed --> End2(["✅ Workflow Complete<br/>Blood successfully donated"])
    
    style Start fill:#e1f5ff
    style CreateReq fill:#fff3e0
    style ReqActive fill:#f3e5f5
    style CheckMatch fill:#fff3e0
    style SendReq fill:#fff3e0
    style ReqPending fill:#f3e5f5
    style DonorSees fill:#fff3e0
    style DonorOpen fill:#fff3e0
    style DonorAccept fill:#fff3e0
    style Accepted fill:#f3e5f5
    style Schedule fill:#fff3e0
    style Scheduled fill:#f3e5f5
    style DonationDay fill:#fff3e0
    style Complete fill:#fff3e0
    style Completed fill:#c8e6c9
    style End2 fill:#c8e6c9
    style End1 fill:#ffccbc
```

---

## State Transition Diagram

```mermaid
stateDiagram-v2
    [*] --> Active: POST /blood-requests

    Active --> RequestPending: POST /blood-requests/:id/request
    
    RequestPending --> RequestAccepted: PATCH /donors/incoming-requests/:id/accept
    
    RequestAccepted --> Accepted: POST /blood-requests/schedule (optional)
    RequestAccepted --> DonationCompleted: PATCH /blood-requests/:id/complete (without scheduling)
    
    Accepted --> DonationCompleted: PATCH /blood-requests/:id/complete
    
    DonationCompleted --> [*]

    note right of Active
        Waiting for requester 
        to select a donor
    end note

    note right of RequestPending
        Donor has been notified,
        waiting for response
    end note

    note right of RequestAccepted
        Donor accepted,
        waiting for donation
    end note

    note right of Accepted
        Appointment scheduled,
        ready for donation
    end note

    note right of DonationCompleted
        Blood successfully collected,
        workflow complete
    end note
```

---

## Parallel Actor Timeline

```mermaid
sequenceDiagram
    participant Req as Requester/User
    participant Sys as System Backend
    participant Don as Donor
    participant SA as Superadmin
    
    rect rgb(200, 150, 255)
    Note over Req,SA: STEP 1-3: Request Creation & Broadcasting
    Req->>Sys: POST /blood-requests (create)
    Sys->>Sys: Create BloodRequest<br/>status='active'
    Sys->>SA: Notify: New request for AB+
    Req->>Sys: POST /blood-requests/:id/request
    Sys->>Sys: Update status='request_pending'<br/>Set requestedToDonorId=5
    Sys->>Don: Notify: Blood needed for AB+!
    Sys->>Req: Confirm: Request sent to Ahmed
    end
    
    rect rgb(255, 200, 150)
    Note over Req,SA: STEP 4-6: Donor Review & Decision
    Don->>Sys: GET /donors/incoming-requests
    Sys->>Don: Return pending requests list
    Don->>Sys: GET /donors/incoming-requests/:id
    Sys->>Don: Return request details
    Don->>Sys: PATCH /donors/incoming-requests/:id/accept
    Sys->>Sys: Update status='request_accepted'<br/>Create BloodDonation
    Sys->>Req: Notify: Ahmed accepted!
    Sys->>Don: Confirm: You accepted the request
    Sys->>SA: Notify: Donation accepted 5→12
    end
    
    rect rgb(150, 200, 255)
    Note over Req,SA: STEP 7: Scheduling (Optional)
    Req->>Sys: POST /blood-requests/schedule
    Sys->>Sys: Update status='accepted'<br/>Set scheduledDate
    Sys->>Don: Notify: Appointment on May 10
    Sys->>Req: Confirm: Appointment set
    end
    
    rect rgb(150, 255, 150)
    Note over Req,SA: STEP 8: Donation & Completion
    Don->>Don: Arrive at hospital<br/>Medical screening<br/>Blood donation
    SA->>Sys: PATCH /blood-requests/:id/complete
    Sys->>Sys: Update status='donation_completed'<br/>BloodDonation.status='completed'
    Sys->>Req: Notify: Donation complete!
    Sys->>Don: Notify: Thank you for donating!
    Sys->>SA: Notify: Donation completed
    end
```

---

## Data State Changes at Each Step

```mermaid
graph LR
    S1["<b>STEP 1</b><br/>CREATE<br/>----<br/>BloodRequest<br/>status: active"] 
    
    S2["<b>STEP 3</b><br/>REQUEST<br/>----<br/>BloodRequest<br/>status: request_pending<br/>requestedToDonorId: 5<br/>requestedAt: now"] 
    
    S3["<b>STEP 6</b><br/>ACCEPT<br/>----<br/>BloodRequest<br/>status: request_accepted<br/>+<br/>BloodDonation<br/>status: request_pending"] 
    
    S4["<b>STEP 7</b><br/>SCHEDULE<br/>----<br/>BloodRequest<br/>status: accepted<br/>scheduledDate: 2026-05-10<br/>BloodDonation<br/>(unchanged)"] 
    
    S5["<b>STEP 8</b><br/>COMPLETE<br/>----<br/>BloodRequest<br/>status: donation_completed<br/>BloodDonation<br/>status: completed<br/>completedAt: now"]
    
    S1 -->|POST /blood-requests/:id/request| S2
    S2 -->|PATCH /donors/incoming-requests/:id/accept| S3
    S3 -->|POST /blood-requests/schedule| S4
    S4 -->|PATCH /blood-requests/:id/complete| S5
    S3 -.->|Direct to completion| S5
    
    style S1 fill:#fff3e0
    style S2 fill:#ffe0b2
    style S3 fill:#ffcc80
    style S4 fill:#ffb74d
    style S5 fill:#c8e6c9
```

---

## Role-Based Access Matrix

```mermaid
graph TD
    A["<b>REQUESTER/USER</b><br/>(Person who needs blood)"] 
    B["<b>DONOR</b><br/>(Person who donates blood)"]
    C["<b>SUPERADMIN</b><br/>(System administrator)"]
    
    A1["Can:"] --> A2["✓ Create blood requests<br/>✓ Request specific donors<br/>✓ Check matching donors<br/>✓ Schedule donations<br/>✓ View own donations<br/>✓ View all blood requests except own"]
    A1 --> A3["Cannot:"]
    A3 --> A4["✗ View own blood requests<br/>✗ Accept incoming requests<br/>✗ Complete donations<br/>✗ View admin data"]
    
    B1["Can:"] --> B2["✓ View incoming requests<br/>✓ Open request details<br/>✓ Accept/Decline requests<br/>✓ View own donations<br/>✓ View all donors except own"]
    B1 --> B3["Cannot:"]
    B3 --> B4["✗ View own registered donors<br/>✗ Create blood requests<br/>✗ Complete donations<br/>✗ View other users' data"]
    
    C1["Can:"] --> C2["✓ View ALL requests<br/>✓ View ALL donations<br/>✓ View ALL donors<br/>✓ Mark donations complete<br/>✓ View activity logs<br/>✓ Access all system data"]
    C1 --> C3["Cannot:"]
    C3 --> C4["✗ Make donations<br/>✗ Create blood requests<br/>✗ Accept incoming requests"]
    
    style A fill:#fff3e0
    style B fill:#fff3e0
    style C fill:#ffe0b2
    style A1 fill:#ffeb3b
    style B1 fill:#ffeb3b
    style C1 fill:#ffeb3b
    style A3 fill:#ffccbc
    style B3 fill:#ffccbc
    style C3 fill:#ffccbc
```

---

## Notification Flow

```mermaid
graph TD
    Step1["STEP 1: Request Created"] -->|Notify| SA1["Superadmin:<br/>New blood request<br/>Blood Group: AB+<br/>Units: 2"]
    
    Step3["STEP 3: Request Sent to Donor"] -->|Notify| Don1["Donor Ahmed:<br/>Blood needed for AB+<br/>Urgent case<br/>Location: Hospital X"]
    Step3 -->|Notify| Req1["Requester Rania:<br/>Request sent to Ahmed<br/>Awaiting response"]
    
    Step6["STEP 6: Donor Accepts"] -->|Notify| Req2["Requester Rania:<br/>Ahmed accepted!<br/>Donation pending"]
    Step6 -->|Notify| Don2["Donor Ahmed:<br/>You accepted<br/>Donation pending"]
    Step6 -->|Notify| SA2["Superadmin:<br/>Donation accepted<br/>Donor 5 → Request 12"]
    
    Step7["STEP 7: Scheduled"] -->|Notify| Don3["Donor Ahmed:<br/>Appointment set<br/>Date: May 10, 2pm"]
    Step7 -->|Notify| Req3["Requester Rania:<br/>Appointment confirmed<br/>Date: May 10, 2pm"]
    
    Step8["STEP 8: Completed"] -->|Notify| Req4["Requester Rania:<br/>Donation complete!<br/>Blood ready"]
    Step8 -->|Notify| Don4["Donor Ahmed:<br/>Thank you for donating!<br/>Next donation: 8 weeks"]
    Step8 -->|Notify| Hosp["Hospital:<br/>Blood available<br/>For transfusion"]
    Step8 -->|Notify| SA3["Superadmin:<br/>Donation completed<br/>Request 12 fulfilled"]
    
    style Step1 fill:#fff3e0
    style Step3 fill:#ffe0b2
    style Step6 fill:#ffcc80
    style Step7 fill:#ffb74d
    style Step8 fill:#c8e6c9
```

---

## API Call Sequence Diagram for Frontend Developer

```mermaid
graph LR
    Start(["👤 User Opens App"])
    
    Start --> L1["📋 View Blood Requests<br/>GET /blood-requests<br/>(excludes own requests)"]
    L1 --> L2["Select one request"]
    
    L2 --> L3["🔍 Check Match<br/>GET /blood-requests/:id/match<br/>(optional)"]
    L3 --> L4{Has compatible<br/>donors?}
    
    L4 -->|Yes| L5["📤 Request Specific Donor<br/>POST /blood-requests/:id/request<br/>Body: donorId"]
    L4 -->|No| L6["📤 Request Any Donor<br/>POST /blood-requests/:id/request<br/>Body: any available"]
    
    L5 --> L7["⏰ Schedule Donation<br/>POST /blood-requests/schedule<br/>Body: requestId, scheduleDate<br/>(optional)"]
    L6 --> L7
    
    L7 --> L8["📊 View Donations<br/>GET /blood-donations<br/>(role-based filtering)"]
    L8 --> L9["✅ Monitor Status"]
    
    style Start fill:#e1f5ff
    style L1 fill:#fff3e0
    style L3 fill:#fff3e0
    style L5 fill:#ffe0b2
    style L6 fill:#ffe0b2
    style L7 fill:#ffcc80
    style L8 fill:#c8e6c9
    style L9 fill:#c8e6c9
```

---

## Summary Table

| Phase | Step | Actor | Endpoint | Method | Status Before | Status After |
|-------|------|-------|----------|--------|---|---|
| 1 | Create Request | Requester | `/blood-requests` | POST | - | `active` |
| 2 | Check Match | Requester | `/blood-requests/:id/match` | GET | `active` | `active` |
| 3 | Request Donor | Requester | `/blood-requests/:id/request` | POST | `active` | `request_pending` |
| 4 | View Incoming | Donor | `/donors/incoming-requests` | GET | `request_pending` | `request_pending` |
| 5 | Open Request | Donor | `/donors/incoming-requests/:id` | GET | `request_pending` | `request_pending` |
| 6 | Accept Request | Donor | `/donors/incoming-requests/:id/accept` | PATCH | `request_pending` | `request_accepted` |
| 7 | Schedule Date | Requester | `/blood-requests/schedule` | POST | `request_accepted` | `accepted` |
| 8 | Complete | Admin | `/blood-requests/:id/complete` | PATCH | `accepted` | `donation_completed` |
