# Unified Donor Referral Flow — Complete Example

## Scenario: Auth User Creates 2 Donors, One Claims

### Step 1: User Registers (Existing Flow)

**Request:**
```http
POST /user-auth/register
Content-Type: application/json

{
  "fullName": "Dr. Ahmed Hassan",
  "email": "ahmed@hospital.com",
  "password": "SecurePass123!",
  "mobileNumber": "+923001234567",
  "dateOfBirth": "1985-05-15",
  "weight": 75,
  "bloodGroup": "O+",
  "lastBloodDonation": "2025-01-10"
}
```

**Response:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "fullName": "Dr. Ahmed Hassan",
    "email": "ahmed@hospital.com",
    "bloodGroup": "O+"
  }
}
```

---

## Step 2: Auth User Creates Donor #1 (No Email)

**Request:**
```http
POST /donors
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "fullName": "Ali Khan",
  "phone": "+923009876543",
  "bloodGroup": "AB+",
  "latitude": 31.5204,
  "longitude": 74.3587
}
```

**Response:**
```json
{
  "donor": {
    "id": 1,
    "fullName": "Ali Khan",
    "email": null,
    "phone": "+923009876543",
    "bloodGroup": "AB+",
    "isActive": true,
    "isAvailable": true,
    "latitude": 31.5204,
    "longitude": 74.3587,
    "promoCode": "RB-K8JQL",
    "isClaimed": false,
    "createdByUserId": 1,
    "createdAt": "2026-05-02T10:00:00Z"
  },
  "promoCode": "RB-K8JQL"
}
```

**Backend Action:**
- Generated unique promo code: `RB-K8JQL`
- Set `createdByUserId: 1` (Dr. Ahmed)
- Set `isClaimed: false`, `claimStatus: INVITED`
- Stored in in-memory store + (optionally) TypeORM

---

## Step 3: Auth User Creates Donor #2 (With Email for Reference)

**Request:**
```http
POST /donors
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "fullName": "Fatima Sheikh",
  "email": "fatima.optional@example.com",
  "phone": "+923005551111",
  "bloodGroup": "A-",
  "latitude": 31.5300,
  "longitude": 74.3600
}
```

**Response:**
```json
{
  "donor": {
    "id": 2,
    "fullName": "Fatima Sheikh",
    "email": "fatima.optional@example.com",
    "promoCode": "RB-P9XWZ",
    "isClaimed": false,
    "createdByUserId": 1,
    "claimStatus": "INVITED"
  },
  "promoCode": "RB-P9XWZ"
}
```

---

## Step 4: Auth User Views Created Donors

**Request:**
```http
GET /donors/my-created
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response:**
```json
[
  {
    "id": 1,
    "fullName": "Ali Khan",
    "phone": "+923009876543",
    "bloodGroup": "AB+",
    "promoCode": "RB-K8JQL",
    "isClaimed": false,
    "claimStatus": "INVITED",
    "createdAt": "2026-05-02T10:00:00Z"
  },
  {
    "id": 2,
    "fullName": "Fatima Sheikh",
    "phone": "+923005551111",
    "bloodGroup": "A-",
    "promoCode": "RB-P9XWZ",
    "isClaimed": false,
    "claimStatus": "INVITED",
    "createdAt": "2026-05-02T10:05:00Z"
  }
]
```

---

## Step 5: Donor #1 (Ali) Signs Up with Promo Code

**Request:**
```http
POST /user-auth/register
Content-Type: application/json

{
  "fullName": "Ali Khan",
  "email": "ali@example.com",
  "password": "AliPassword456!",
  "mobileNumber": "+923009876543",
  "dateOfBirth": "1990-03-20",
  "weight": 80,
  "bloodGroup": "AB+",
  "lastBloodDonation": "2025-06-01",
  "promoCode": "RB-K8JQL"
}
```

**Backend Processing:**
1. Hash password
2. Create user record: `User(id=2, email="ali@example.com", ...)`
3. Validate promo code exists: ✅ Found `Donor(id=1, promoCode="RB-K8JQL")`
4. Verify donor not claimed: ✅ `isClaimed=false`
5. Mark donor claimed:
   ```
   Donor(id=1).isClaimed = true
   Donor(id=1).claimedAt = "2026-05-02T10:15:00Z"
   Donor(id=1).linkedUserId = 2  // Link to new User
   Donor(id=1).claimedByUserId = 2
   Donor(id=1).claimStatus = "CLAIMED"
   ```
6. Issue JWT with `role: 'donor'`

**Response:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 2,
    "fullName": "Ali Khan",
    "email": "ali@example.com",
    "bloodGroup": "AB+"
  },
  "donorProfile": {
    "id": 1,
    "fullName": "Ali Khan",
    "bloodGroup": "AB+",
    "isClaimed": true,
    "linkedUserId": 2,
    "createdByUserId": 1,
    "claimedAt": "2026-05-02T10:15:00Z"
  }
}
```

---

## Step 6: Claimed Donor Views Own Profile

**Request:**
```http
GET /user-auth/me/donor-profile
Authorization: Bearer <Ali's JWT>
```

**Response:**
```json
{
  "id": 1,
  "fullName": "Ali Khan",
  "bloodGroup": "AB+",
  "isActive": true,
  "isAvailable": true,
  "latitude": 31.5204,
  "longitude": 74.3587,
  "isClaimed": true,
  "linkedUserId": 2,
  "createdByUserId": 1,
  "claimedAt": "2026-05-02T10:15:00Z",
  "donationHistory": []
}
```

---

## Step 7: Creator Checks Status of Both Donors

**Request:**
```http
GET /donors/my-created
Authorization: Bearer <Dr. Ahmed's JWT>
```

**Response:**
```json
[
  {
    "id": 1,
    "fullName": "Ali Khan",
    "promoCode": "RB-K8JQL",
    "isClaimed": true,
    "claimStatus": "CLAIMED",
    "claimedByUserId": 2,
    "claimedAt": "2026-05-02T10:15:00Z"
  },
  {
    "id": 2,
    "fullName": "Fatima Sheikh",
    "promoCode": "RB-P9XWZ",
    "isClaimed": false,
    "claimStatus": "INVITED",
    "claimedAt": null
  }
]
```

---

## Step 8: Creator Regenerates Fatima's Promo (Resend Invite)

**Request:**
```http
PATCH /donors/2/regenerate-promo
Authorization: Bearer <Dr. Ahmed's JWT>
```

**Response:**
```json
{
  "donor": {
    "id": 2,
    "fullName": "Fatima Sheikh",
    "promoCode": "RB-M3YKL",  // NEW code
    "isClaimed": false,
    "claimStatus": "INVITED"
  },
  "newPromoCode": "RB-M3YKL"
}
```

**Backend Action:**
- Verified Donor #2 not claimed (isClaimed=false) ✅
- Generated new collision-safe code: `RB-M3YKL`
- Updated donor record
- Old code `RB-P9XWZ` is overwritten (no longer valid)

---

## Step 9: Creator Disables Donor #2 Invite (Changed Mind)

**Request:**
```http
PATCH /donors/2/disable-promo
Authorization: Bearer <Dr. Ahmed's JWT>
```

**Response:**
```json
{
  "donor": {
    "id": 2,
    "fullName": "Fatima Sheikh",
    "promoCode": null,  // DISABLED
    "isClaimed": false,
    "claimStatus": "EXPIRED"
  },
  "message": "Promo code disabled"
}
```

**Backend Action:**
- Set `promoCode = null`
- Set `claimStatus = 'EXPIRED'`
- Invitation is now invalid

---

## Step 10: Ali (Donor) Can Accept Blood Requests

After signup, Ali has full donor capabilities:

**Request:**
```http
GET /blood-requests/active
Authorization: Bearer <Ali's JWT>
```

Ali sees all active blood requests and can respond as a self-managed donor.

---

## Summary: Full Lifecycle

| Actor | Action | Endpoint | Result |
|-------|--------|----------|--------|
| Dr. Ahmed (Creator) | Create Ali | `POST /donors` | Donor #1 + promo `RB-K8JQL` |
| Dr. Ahmed (Creator) | Create Fatima | `POST /donors` | Donor #2 + promo `RB-P9XWZ` |
| Dr. Ahmed (Creator) | View created | `GET /donors/my-created` | [Ali (INVITED), Fatima (INVITED)] |
| Ali (Donor) | Sign up with promo | `POST /user-auth/register` + `RB-K8JQL` | User #2 created, Donor #1 claimed |
| Ali (Self-Managed) | View own profile | `GET /user-auth/me/donor-profile` | Donor profile linked to User #2 |
| Dr. Ahmed (Creator) | Check status | `GET /donors/my-created` | [Ali (CLAIMED), Fatima (INVITED)] |
| Dr. Ahmed (Creator) | Regenerate Fatima | `PATCH /donors/2/regenerate-promo` | New promo `RB-M3YKL` |
| Dr. Ahmed (Creator) | Disable Fatima | `PATCH /donors/2/disable-promo` | Promo deleted, status EXPIRED |
| Ali (Self-Managed) | Accept request | `PATCH /blood-requests/:id/status` | Donation flow begins |

---

## Key Features ✅

✅ **No Email Required at Create** — Create donors with just name, phone, blood group  
✅ **Unified Auth** — Donors use standard `/user-auth/register` flow  
✅ **Promo Tracking** — Unique, collision-safe codes with lifecycle management  
✅ **Creator Visibility** — Query all created donors, track claim status  
✅ **Donor Autonomy** — Self-managed profiles, own JWT, full platform access  
✅ **Ownership Separation** — `createdByUserId` tracks creator, `linkedUserId` tracks self-managed account  
✅ **Production-Ready** — Clear relationships, audit fields, state management  

---

## Error Scenarios

### Invalid Promo Code
```json
POST /user-auth/register with promoCode="INVALID-123"
→ 400 Bad Request
{
  "message": "Invalid promo code"
}
```

### Promo Already Claimed
```json
POST /user-auth/register with promoCode="RB-K8JQL" (already claimed by Ali)
→ 400 Bad Request
{
  "message": "Promo code has already been claimed"
}
```

### Cannot Regenerate Claimed Donor
```json
PATCH /donors/1/regenerate-promo (Donor #1 already claimed)
→ 400 Bad Request
{
  "message": "Cannot regenerate promo code for a claimed donor"
}
```

### Unauthorized Access
```json
GET /donors/1 with wrong user's JWT
→ 403 Forbidden (if role-based access control added)
```

