# Donor Ownership Transfer & Notification Flow

## Overview
When a donor profile is created by one user (User 1) for another person, and that person later registers with the portal (User 2), the ownership of the donor profile automatically transfers to User 2. User 1 is notified about this ownership transfer via the notification system.

## Flow

### Scenario 1: Transfer via Phone Number Match
1. **User 1** creates a donor profile for User 2 (who is not yet registered)
   - The donor record is created with `createdByUserId: User 1's ID`
   - A promo code is generated for this donor
   
2. **User 2** registers with the portal using their phone number (same as the donor profile)
   - The registration process checks for existing donor profiles with the same phone number
   - If found and not yet verified, ownership is transferred:
     - `linkedUserId: User 2's ID`
     - `userId: User 2's ID`
     - `claimedByUserId: User 2's ID`
     - `isVerifiedAccount: true`
   
3. **Notification sent to User 1**
   - Type: `donor_ownership_transferred`
   - Title: "Donor Profile Claimed"
   - Message: "The donor profile for [Name] that you created has been claimed and verified by the registered user."
   - Metadata includes:
     - `originalCreatorId`: User 1's ID
     - `newOwnerId`: User 2's ID
     - `donorId`: The donor's ID
     - `transferReason`: `phone_match`

### Scenario 2: Transfer via Promo Code
1. **User 1** creates a donor profile for User 2 (generates promo code)
2. **User 2** registers with the portal and provides the promo code
   - If the promo code matches an unclaimed donor profile, ownership is transferred
   - Same transfer flags are applied as in Scenario 1
   
3. **Notification sent to User 1**
   - Type: `donor_ownership_transferred`
   - Title: "Donor Profile Claimed via Promo Code"
   - Message: "The donor profile for [Name] that you created has been claimed via promo code and verified by the registered user."
   - Metadata includes:
     - `originalCreatorId`: User 1's ID
     - `newOwnerId`: User 2's ID
     - `donorId`: The donor's ID
     - `transferReason`: `promo_code`
     - `promoCode`: The promo code used

## Technical Implementation

### Files Modified
1. **src/user-auth/user-auth.service.ts**
   - Added `NotificationsService` dependency injection
   - Added notification logic after each `transferDonorOwnership` call
   - Notifies the original creator when ownership is transferred

2. **src/storage/app-storage.service.ts**
   - Added new notification type `donor_ownership_transferred` to the `NotificationRecord` type union

### Notification Type
```typescript
type: 'donor_ownership_transferred'
```

## Client/Portal Integration
The superadmin portal can listen for these notifications via WebSocket:
- Event: `notification:new`
- Event: `notification:updated`
- Event: `notification:unread-count`

Users can also retrieve notifications via REST API:
- `GET /notifications` - Get all notifications
- `PATCH /notifications/:id/read` - Mark a notification as read
- `PATCH /notifications/read-all` - Mark all notifications as read

## Testing Steps
1. Create a donor profile as User 1 with phone number `+923001234567`
2. Register User 2 with the same phone number
3. User 1 should receive a notification about the ownership transfer
4. The donor profile should now be fully owned by User 2 (verified account)

## Data Model
The notification metadata contains all relevant information for the portal to:
- Identify which donor was transferred
- Identify which user created it originally
- Identify the new owner
- Display appropriate UI/actions based on the transfer reason
