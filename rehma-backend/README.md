# Blood Bridge Backend

NestJS backend for the Blood Bridge superadmin portal.

## Features

- Superadmin login with JWT
- Donor registration/login with availability and location updates
- Blood request flow with urgent/active/completed lifecycle
- Map endpoints for nearby donor markers and active requests
- Dashboard stats for donors, blood requests, and donations
- Default superadmin seeding from environment variables

## Setup

1. Copy `.env.example` to `.env` and update the values.
2. Install dependencies.
3. Run database migrations later if you add them; for now the app uses TypeORM synchronize in development.
4. Start the app with `npm run start:dev`.

## Endpoints

- `POST /auth/login`
- `POST /donor-auth/register`
- `POST /donor-auth/login`
- `PATCH /donor-auth/availability`
- `PATCH /donor-auth/location`
- `GET /superadmin/stats`
- `GET /blood-requests/active`
- `GET /blood-requests/urgent`
- `PATCH /blood-requests/:id/complete`
- `GET /map/nearby-donors`
- `GET /map/active-requests`
- `GET /map/overview`
- `GET /health`

## User Registration

`POST /user-auth/register` now requires:

- `fullName`
- `email`
- `mobileNumber`
- `dateOfBirth`
- `weight`
- `bloodGroup`
- `lastBloodDonation`
- `password`