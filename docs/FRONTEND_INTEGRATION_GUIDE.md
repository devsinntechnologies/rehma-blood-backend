# Frontend Developer Integration Guide

**Target Audience:** Frontend React/React Native/Vue developers  
**Language:** JavaScript/TypeScript  
**Framework-Agnostic:** Code examples work with fetch, axios, or any HTTP client

---

## Table of Contents
1. [Setup & Authentication](#setup--authentication)
2. [API Base URL Configuration](#api-base-url-configuration)
3. [Complete Requester Flow](#complete-requester-flow)
4. [Complete Donor Flow](#complete-donor-flow)
5. [Error Handling & Validation](#error-handling--validation)
6. [State Management Patterns](#state-management-patterns)
7. [UI Components Checklist](#ui-components-checklist)
8. [Testing Scenarios](#testing-scenarios)

---

## Setup & Authentication

### JWT Token Management

```typescript
// utils/auth.ts
export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
}

class AuthManager {
  private tokens: AuthTokens | null = null;

  // Store tokens after login
  setTokens(tokens: AuthTokens) {
    this.tokens = tokens;
    localStorage.setItem('authTokens', JSON.stringify(tokens));
  }

  // Retrieve tokens
  getTokens(): AuthTokens | null {
    if (this.tokens) return this.tokens;
    const stored = localStorage.getItem('authTokens');
    return stored ? JSON.parse(stored) : null;
  }

  // Clear tokens on logout
  clearTokens() {
    this.tokens = null;
    localStorage.removeItem('authTokens');
  }

  // Get authorization header
  getAuthHeader(): { Authorization: string } {
    const tokens = this.getTokens();
    if (!tokens) throw new Error('Not authenticated');
    return {
      Authorization: `Bearer ${tokens.accessToken}`
    };
  }
}

export const authManager = new AuthManager();
```

---

## API Base URL Configuration

```typescript
// config/api.ts
export const API_CONFIG = {
  // Development
  development: {
    baseURL: 'http://localhost:3000/api',
    timeout: 10000,
  },
  // Production
  production: {
    baseURL: 'https://api.rehma.app/api',
    timeout: 30000,
  }
};

export const getApiConfig = () => {
  const env = process.env.NODE_ENV || 'development';
  return API_CONFIG[env as keyof typeof API_CONFIG];
};
```

### HTTP Client Setup (Axios Example)

```typescript
// services/httpClient.ts
import axios, { AxiosInstance } from 'axios';
import { getApiConfig } from '../config/api';
import { authManager } from '../utils/auth';

class HttpClient {
  private client: AxiosInstance;

  constructor() {
    const config = getApiConfig();
    this.client = axios.create(config);

    // Add authorization header to all requests
    this.client.interceptors.request.use((config) => {
      try {
        const headers = authManager.getAuthHeader();
        config.headers = { ...config.headers, ...headers };
      } catch (e) {
        // Not authenticated, continue without header
      }
      return config;
    });

    // Handle 401 errors (token expired)
    this.client.interceptors.response.use(
      response => response,
      error => {
        if (error.response?.status === 401) {
          authManager.clearTokens();
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  async get<T>(url: string) {
    return this.client.get<T>(url);
  }

  async post<T>(url: string, data: any) {
    return this.client.post<T>(url, data);
  }

  async patch<T>(url: string, data: any) {
    return this.client.patch<T>(url, data);
  }

  async delete<T>(url: string) {
    return this.client.delete<T>(url);
  }
}

export const httpClient = new HttpClient();
```

---

## Complete Requester Flow

### TypeScript Types

```typescript
// types/blood-request.ts
export interface BloodRequest {
  id: number;
  requesterUserId: number;
  requesterName: string;
  bloodGroup: 'O+' | 'O-' | 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-';
  requiredUnits: number;
  urgency: 'regular' | 'urgent';
  latitude: number;
  longitude: number;
  notes?: string;
  status: 'active' | 'request_pending' | 'request_accepted' | 'accepted' | 'donation_completed';
  requestedToDonorId?: number;
  requestedToDonorName?: string;
  requestedAt?: string;
  scheduledDate?: string;
  createdAt: string;
}

export interface CreateBloodRequestDto {
  bloodGroup: string;
  requiredUnits: number;
  urgency: 'regular' | 'urgent';
  latitude: number;
  longitude: number;
  notes?: string;
}

export interface ScheduleBloodRequestDto {
  requestId: number;
  scheduleDate: string; // ISO 8601 format
}

export interface BloodDonation {
  id: number;
  requestId: number;
  donorId: number;
  donorName: string;
  bloodGroup: string;
  units: number;
  status: 'request_pending' | 'completed';
  createdAt: string;
  completedAt?: string;
}

export interface Donor {
  id: number;
  fullName: string;
  bloodGroup: string;
  phoneNumber: string;
  isAvailable?: boolean;
}

export interface MatchingDonorsResponse {
  hasMatchingAvailableDonor: boolean;
  matchingDonors: Donor[];
}

export interface RequestDonorResponse {
  bloodRequest: BloodRequest;
  donor: Donor;
  requester: Donor;
}
```

### Requester Service

```typescript
// services/requesterService.ts
import { httpClient } from './httpClient';
import {
  BloodRequest,
  CreateBloodRequestDto,
  ScheduleBloodRequestDto,
  BloodDonation,
  MatchingDonorsResponse,
  RequestDonorResponse,
} from '../types/blood-request';

class RequesterService {
  // STEP 1: Create blood request
  async createBloodRequest(data: CreateBloodRequestDto): Promise<BloodRequest> {
    try {
      const response = await httpClient.post<BloodRequest>(
        '/blood-requests',
        data
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Get all blood requests (excluding user's own)
  async getAllBloodRequests(): Promise<BloodRequest[]> {
    try {
      const response = await httpClient.get<BloodRequest[]>('/blood-requests');
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Get single blood request
  async getBloodRequest(requestId: number): Promise<BloodRequest> {
    try {
      const response = await httpClient.get<BloodRequest>(
        `/blood-requests/${requestId}`
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // STEP 2: Check if user has matching donors for this request
  async checkMatchingDonors(requestId: number): Promise<MatchingDonorsResponse> {
    try {
      const response = await httpClient.get<MatchingDonorsResponse>(
        `/blood-requests/${requestId}/match`
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // STEP 3: Request a donor for blood request
  async requestDonor(
    requestId: number,
    donorId: number
  ): Promise<RequestDonorResponse> {
    try {
      const response = await httpClient.post<RequestDonorResponse>(
        `/blood-requests/${requestId}/request`,
        { donorId }
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // STEP 4: Schedule donation (optional)
  async scheduleBloodRequest(
    data: ScheduleBloodRequestDto
  ): Promise<RequestDonorResponse> {
    try {
      const response = await httpClient.post<RequestDonorResponse>(
        '/blood-requests/schedule',
        data
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Get user's blood donations
  async getBloodDonations(): Promise<BloodDonation[]> {
    try {
      const response = await httpClient.get<BloodDonation[]>('/blood-donations');
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  private handleError(error: any) {
    if (error.response?.status === 400) {
      return new Error(error.response.data?.message || 'Bad request');
    }
    if (error.response?.status === 409) {
      return new Error('Request already accepted or conflict occurred');
    }
    if (error.response?.status === 404) {
      return new Error('Request not found');
    }
    return error;
  }
}

export const requesterService = new RequesterService();
```

### Requester Component Example (React)

```typescript
// components/BloodRequestFlow.tsx
import React, { useState, useEffect } from 'react';
import { requesterService } from '../services/requesterService';
import { BloodRequest, BloodDonation } from '../types/blood-request';

export const BloodRequestFlow: React.FC = () => {
  const [step, setStep] = useState<'list' | 'create' | 'match' | 'schedule' | 'view'>('list');
  const [requests, setRequests] = useState<BloodRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<BloodRequest | null>(null);
  const [donations, setDonations] = useState<BloodDonation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // STEP 1: Load all blood requests
  useEffect(() => {
    if (step === 'list') {
      loadRequests();
    }
  }, [step]);

  const loadRequests = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await requesterService.getAllBloodRequests();
      setRequests(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load requests');
    } finally {
      setLoading(false);
    }
  };

  // STEP 2: Check matching donors
  const handleCheckMatch = async (request: BloodRequest) => {
    setSelectedRequest(request);
    setLoading(true);
    setError(null);
    try {
      const match = await requesterService.checkMatchingDonors(request.id);
      if (match.hasMatchingAvailableDonor) {
        alert(`Found ${match.matchingDonors.length} matching donors`);
      } else {
        alert('No matching donors available. Need to request from system.');
      }
      setStep('match');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check match');
    } finally {
      setLoading(false);
    }
  };

  // STEP 3: Request a donor
  const handleRequestDonor = async (donorId: number) => {
    if (!selectedRequest) return;
    setLoading(true);
    setError(null);
    try {
      const response = await requesterService.requestDonor(
        selectedRequest.id,
        donorId
      );
      alert(
        `Request sent to ${response.donor.fullName}!\nWaiting for acceptance...`
      );
      setStep('view');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to request donor');
    } finally {
      setLoading(false);
    }
  };

  // STEP 4: Schedule donation
  const handleSchedule = async (scheduleDate: string) => {
    if (!selectedRequest) return;
    setLoading(true);
    setError(null);
    try {
      await requesterService.scheduleBloodRequest({
        requestId: selectedRequest.id,
        scheduleDate,
      });
      alert('Donation scheduled successfully!');
      setStep('view');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to schedule');
    } finally {
      setLoading(false);
    }
  };

  // Load donations
  const loadDonations = async () => {
    setLoading(true);
    try {
      const data = await requesterService.getBloodDonations();
      setDonations(data);
      setStep('view');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load donations');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div style={{ color: 'red' }}>Error: {error}</div>;

  switch (step) {
    case 'list':
      return (
        <div>
          <h2>Blood Requests</h2>
          {requests.map(req => (
            <div key={req.id} style={{ border: '1px solid #ccc', padding: '10px', margin: '10px 0' }}>
              <p><strong>{req.bloodGroup}</strong> - {req.requiredUnits} units</p>
              <p>Urgency: {req.urgency}</p>
              <p>Status: {req.status}</p>
              <button onClick={() => handleCheckMatch(req)}>Request This Blood</button>
            </div>
          ))}
          <button onClick={loadDonations}>View My Donations</button>
        </div>
      );

    case 'match':
      return (
        <div>
          <h2>Request for {selectedRequest?.bloodGroup}</h2>
          <p>Do you have a compatible donor? (Check match results above)</p>
          <button onClick={() => selectedRequest && handleRequestDonor(0)}>
            Send to Matching Donor
          </button>
          <button onClick={() => setStep('list')}>Back</button>
        </div>
      );

    case 'view':
      return (
        <div>
          <h2>My Blood Donations</h2>
          {donations.length === 0 ? (
            <p>No donations yet</p>
          ) : (
            donations.map(d => (
              <div key={d.id} style={{ border: '1px solid #ccc', padding: '10px', margin: '10px 0' }}>
                <p><strong>Donor:</strong> {d.donorName}</p>
                <p><strong>Blood Group:</strong> {d.bloodGroup}</p>
                <p><strong>Units:</strong> {d.units}</p>
                <p><strong>Status:</strong> {d.status}</p>
                <p><strong>Created:</strong> {new Date(d.createdAt).toLocaleString()}</p>
                {d.status === 'completed' && (
                  <p><strong>Completed:</strong> {new Date(d.completedAt!).toLocaleString()}</p>
                )}
              </div>
            ))
          )}
          <button onClick={() => setStep('list')}>Back to Requests</button>
        </div>
      );

    default:
      return null;
  }
};
```

---

## Complete Donor Flow

### Donor Service

```typescript
// services/donorService.ts
import { httpClient } from './httpClient';
import { BloodRequest } from '../types/blood-request';

export interface DonorAcceptResponse {
  bloodRequest: BloodRequest;
  donation: {
    id: number;
    status: string;
    donorId: number;
    requestId: number;
  };
}

class DonorService {
  // STEP 1: Get incoming requests
  async getIncomingRequests(): Promise<BloodRequest[]> {
    try {
      const response = await httpClient.get<BloodRequest[]>(
        '/donors/incoming-requests'
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // STEP 2: Get request details
  async getIncomingRequestDetails(requestId: number): Promise<BloodRequest> {
    try {
      const response = await httpClient.get<BloodRequest>(
        `/donors/incoming-requests/${requestId}`
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // STEP 3: Accept request
  async acceptRequest(requestId: number): Promise<DonorAcceptResponse> {
    try {
      const response = await httpClient.patch<DonorAcceptResponse>(
        `/donors/incoming-requests/${requestId}/accept`,
        {}
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  private handleError(error: any) {
    if (error.response?.status === 400) {
      return new Error(error.response.data?.message || 'Bad request');
    }
    if (error.response?.status === 404) {
      return new Error('Request not found');
    }
    if (error.response?.status === 409) {
      return new Error('Request already accepted by someone else');
    }
    return error;
  }
}

export const donorService = new DonorService();
```

### Donor Component Example (React)

```typescript
// components/IncomingRequestsFlow.tsx
import React, { useState, useEffect } from 'react';
import { donorService } from '../services/donorService';
import { BloodRequest } from '../types/blood-request';

export const IncomingRequestsFlow: React.FC = () => {
  const [step, setStep] = useState<'list' | 'details' | 'accepted'>('list');
  const [requests, setRequests] = useState<BloodRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<BloodRequest | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // STEP 1: Load incoming requests
  useEffect(() => {
    if (step === 'list') {
      loadIncomingRequests();
    }
  }, [step]);

  const loadIncomingRequests = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await donorService.getIncomingRequests();
      setRequests(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load requests');
    } finally {
      setLoading(false);
    }
  };

  // STEP 2: View request details
  const handleViewDetails = async (request: BloodRequest) => {
    setLoading(true);
    setError(null);
    try {
      const details = await donorService.getIncomingRequestDetails(request.id);
      setSelectedRequest(details);
      setStep('details');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load details');
    } finally {
      setLoading(false);
    }
  };

  // STEP 3: Accept request
  const handleAccept = async () => {
    if (!selectedRequest) return;
    setLoading(true);
    setError(null);
    try {
      const response = await donorService.acceptRequest(selectedRequest.id);
      alert(`You accepted the request! Donation status: ${response.donation.status}`);
      setStep('accepted');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept request');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div style={{ color: 'red' }}>Error: {error}</div>;

  switch (step) {
    case 'list':
      return (
        <div>
          <h2>Incoming Requests for Your Blood Type</h2>
          {requests.length === 0 ? (
            <p>No incoming requests</p>
          ) : (
            requests.map(req => (
              <div
                key={req.id}
                style={{
                  border: req.urgency === 'urgent' ? '3px solid red' : '1px solid gray',
                  padding: '10px',
                  margin: '10px 0',
                  backgroundColor: req.urgency === 'urgent' ? '#fff3cd' : '#fff'
                }}
              >
                <h3>{req.bloodGroup} - {req.requiredUnits} units</h3>
                <p>
                  <strong>Urgency:</strong>{' '}
                  <span style={{ color: req.urgency === 'urgent' ? 'red' : 'green' }}>
                    {req.urgency.toUpperCase()}
                  </span>
                </p>
                <p><strong>Status:</strong> {req.status}</p>
                <p><strong>Created:</strong> {new Date(req.createdAt).toLocaleString()}</p>
                <button
                  onClick={() => handleViewDetails(req)}
                  style={{ padding: '10px 20px', marginRight: '10px' }}
                >
                  View Details
                </button>
              </div>
            ))
          )}
        </div>
      );

    case 'details':
      return (
        <div>
          <h2>Request Details</h2>
          {selectedRequest && (
            <div style={{ border: '1px solid #ccc', padding: '15px' }}>
              <p><strong>Requester:</strong> {selectedRequest.requesterName}</p>
              <p><strong>Blood Group Needed:</strong> {selectedRequest.bloodGroup}</p>
              <p><strong>Units:</strong> {selectedRequest.requiredUnits}</p>
              <p><strong>Urgency:</strong> {selectedRequest.urgency.toUpperCase()}</p>
              <p><strong>Hospital:</strong> (latitude: {selectedRequest.latitude}, longitude: {selectedRequest.longitude})</p>
              <p><strong>Notes:</strong> {selectedRequest.notes || 'None'}</p>
              <p><strong>Status:</strong> {selectedRequest.status}</p>

              <div style={{ marginTop: '20px' }}>
                <button
                  onClick={handleAccept}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: 'green',
                    color: 'white',
                    marginRight: '10px'
                  }}
                >
                  Accept & Commit to Donate
                </button>
                <button
                  onClick={() => setStep('list')}
                  style={{ padding: '10px 20px' }}
                >
                  Back
                </button>
              </div>
            </div>
          )}
        </div>
      );

    case 'accepted':
      return (
        <div style={{ backgroundColor: '#d4edda', padding: '20px', borderRadius: '5px' }}>
          <h2>✅ Thank You!</h2>
          <p>You have committed to donate blood.</p>
          <p>The requester will schedule an appointment time with you.</p>
          <p>Please wait for contact information or check the app for appointment details.</p>
          <button
            onClick={() => setStep('list')}
            style={{ padding: '10px 20px', marginTop: '20px' }}
          >
            Back to Requests
          </button>
        </div>
      );

    default:
      return null;
  }
};
```

---

## Error Handling & Validation

### Custom Error Classes

```typescript
// errors/ApiErrors.ts
export class BloodDonationError extends Error {
  constructor(
    public code: string,
    public statusCode: number,
    message: string
  ) {
    super(message);
    this.name = 'BloodDonationError';
  }
}

export class ValidationError extends BloodDonationError {
  constructor(message: string) {
    super('VALIDATION_ERROR', 400, message);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends BloodDonationError {
  constructor(resource: string) {
    super('NOT_FOUND', 404, `${resource} not found`);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends BloodDonationError {
  constructor(message: string) {
    super('CONFLICT', 409, message);
    this.name = 'ConflictError';
  }
}

export class UnauthorizedError extends BloodDonationError {
  constructor() {
    super('UNAUTHORIZED', 401, 'Please login again');
    this.name = 'UnauthorizedError';
  }
}
```

### Input Validation

```typescript
// validators/bloodRequestValidator.ts
export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

export class BloodRequestValidator {
  static validateBloodGroup(bloodGroup: string): boolean {
    const validGroups = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];
    return validGroups.includes(bloodGroup);
  }

  static validateUnits(units: number): boolean {
    return units >= 1 && units <= 5 && Number.isInteger(units);
  }

  static validateLocation(latitude: number, longitude: number): boolean {
    return (
      !isNaN(latitude) &&
      !isNaN(longitude) &&
      latitude >= -90 &&
      latitude <= 90 &&
      longitude >= -180 &&
      longitude <= 180
    );
  }

  static validateCreateRequest(data: any): ValidationResult {
    const errors: Record<string, string> = {};

    if (!data.bloodGroup) {
      errors.bloodGroup = 'Blood group is required';
    } else if (!this.validateBloodGroup(data.bloodGroup)) {
      errors.bloodGroup = 'Invalid blood group';
    }

    if (!data.requiredUnits) {
      errors.requiredUnits = 'Units required';
    } else if (!this.validateUnits(data.requiredUnits)) {
      errors.requiredUnits = 'Units must be 1-5';
    }

    if (!data.latitude || !data.longitude) {
      errors.location = 'Location is required';
    } else if (!this.validateLocation(data.latitude, data.longitude)) {
      errors.location = 'Invalid location coordinates';
    }

    if (data.urgency && !['regular', 'urgent'].includes(data.urgency)) {
      errors.urgency = 'Invalid urgency level';
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  }

  static validateScheduleDate(dateString: string): ValidationResult {
    const errors: Record<string, string> = {};
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        errors.scheduleDate = 'Invalid date format';
      } else if (date < new Date()) {
        errors.scheduleDate = 'Cannot schedule in the past';
      }
    } catch {
      errors.scheduleDate = 'Invalid date';
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  }
}
```

### Error Handling Middleware

```typescript
// middleware/errorHandler.ts
import { useCallback } from 'react';
import { BloodDonationError } from '../errors/ApiErrors';

export const useErrorHandler = () => {
  return useCallback((error: any): { message: string; userFriendly: string } => {
    let userFriendlyMessage = 'Something went wrong. Please try again.';

    if (error instanceof BloodDonationError) {
      switch (error.code) {
        case 'VALIDATION_ERROR':
          userFriendlyMessage = 'Please check your input and try again';
          break;
        case 'NOT_FOUND':
          userFriendlyMessage = 'The request was not found';
          break;
        case 'CONFLICT':
          userFriendlyMessage = 'This request was already accepted by someone else';
          break;
        case 'UNAUTHORIZED':
          userFriendlyMessage = 'Your session has expired. Please login again';
          break;
      }
    }

    return {
      message: error.message,
      userFriendly: userFriendlyMessage
    };
  }, []);
};
```

---

## State Management Patterns

### React Context Pattern

```typescript
// context/BloodRequestContext.tsx
import React, { createContext, useReducer, ReactNode } from 'react';
import { BloodRequest, BloodDonation } from '../types/blood-request';

interface State {
  requests: BloodRequest[];
  selectedRequest: BloodRequest | null;
  donations: BloodDonation[];
  loading: boolean;
  error: string | null;
  currentStep: 'list' | 'details' | 'schedule' | 'view';
}

type Action =
  | { type: 'SET_REQUESTS'; payload: BloodRequest[] }
  | { type: 'SET_SELECTED_REQUEST'; payload: BloodRequest | null }
  | { type: 'SET_DONATIONS'; payload: BloodDonation[] }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_STEP'; payload: State['currentStep'] }
  | { type: 'RESET' };

const initialState: State = {
  requests: [],
  selectedRequest: null,
  donations: [],
  loading: false,
  error: null,
  currentStep: 'list'
};

const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case 'SET_REQUESTS':
      return { ...state, requests: action.payload };
    case 'SET_SELECTED_REQUEST':
      return { ...state, selectedRequest: action.payload };
    case 'SET_DONATIONS':
      return { ...state, donations: action.payload };
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'SET_STEP':
      return { ...state, currentStep: action.payload };
    case 'RESET':
      return initialState;
    default:
      return state;
  }
};

export const BloodRequestContext = createContext<{
  state: State;
  dispatch: React.Dispatch<Action>;
} | null>(null);

export const BloodRequestProvider: React.FC<{ children: ReactNode }> = ({
  children
}) => {
  const [state, dispatch] = useReducer(reducer, initialState);
  return (
    <BloodRequestContext.Provider value={{ state, dispatch }}>
      {children}
    </BloodRequestContext.Provider>
  );
};

export const useBloodRequest = () => {
  const context = React.useContext(BloodRequestContext);
  if (!context) {
    throw new Error('useBloodRequest must be used within BloodRequestProvider');
  }
  return context;
};
```

---

## UI Components Checklist

Create these components for complete integration:

```markdown
## Requester Components
- [ ] BloodRequestForm
  - Form with: bloodGroup, requiredUnits, urgency, location picker, notes
  - Validation feedback
  - Submit button with loading state
  
- [ ] BloodRequestsList
  - Card view of all requests
  - Filter by urgency
  - Search functionality
  - Click to request donor

- [ ] MatchingDonorsView
  - Show list of compatible donors
  - Allow selection or "request any"
  - Donor contact info display

- [ ] ScheduleAppointment
  - Date/time picker
  - Available slots display
  - Confirmation view

- [ ] DonationsTracker
  - List of all your blood donations
  - Status indicators with colors
  - Timeline view of donation history

## Donor Components
- [ ] IncomingRequestsList
  - Urgent requests highlighted
  - Blood group match indicator
  - Quick view button
  - Accept/Decline actions

- [ ] RequestDetailsModal
  - Full request information
  - Requester details
  - Hospital location map
  - Accept button with confirmation

- [ ] AcceptanceConfirmation
  - Thank you message
  - Next steps
  - Appointment details when scheduled
  - Donor contact info

## Common Components
- [ ] LoadingSpinner
- [ ] ErrorAlert with retry
- [ ] SuccessToast
- [ ] ConfirmationDialog
- [ ] NotificationBadge
```

---

## Testing Scenarios

### Unit Test Examples

```typescript
// __tests__/requesterService.test.ts
import { requesterService } from '../services/requesterService';
import * as httpClient from '../services/httpClient';

jest.mock('../services/httpClient');

describe('RequesterService', () => {
  it('should create a blood request', async () => {
    const mockRequest = { id: 1, status: 'active', /* ... */ };
    (httpClient.httpClient.post as jest.Mock).mockResolvedValue({
      data: mockRequest
    });

    const result = await requesterService.createBloodRequest({
      bloodGroup: 'AB+',
      requiredUnits: 2,
      urgency: 'urgent',
      latitude: 24.8607,
      longitude: 67.0011
    });

    expect(result).toEqual(mockRequest);
    expect(httpClient.httpClient.post).toHaveBeenCalledWith(
      '/blood-requests',
      expect.any(Object)
    );
  });

  it('should handle 400 error when creating request', async () => {
    (httpClient.httpClient.post as jest.Mock).mockRejectedValue({
      response: { status: 400, data: { message: 'Bad request' } }
    });

    await expect(
      requesterService.createBloodRequest({
        bloodGroup: 'INVALID',
        requiredUnits: 10,
        urgency: 'urgent',
        latitude: 24.8607,
        longitude: 67.0011
      })
    ).rejects.toThrow('Bad request');
  });
});
```

### Integration Test Example

```typescript
// __tests__/bloodRequestFlow.integration.test.ts
describe('Complete Blood Request Flow', () => {
  it('should complete full workflow from request to donation', async () => {
    // 1. Create request
    const request = await requesterService.createBloodRequest({
      bloodGroup: 'AB+',
      requiredUnits: 2,
      urgency: 'urgent',
      latitude: 24.8607,
      longitude: 67.0011
    });
    expect(request.status).toBe('active');

    // 2. Check matching donors
    const match = await requesterService.checkMatchingDonors(request.id);
    expect(match.hasMatchingAvailableDonor).toBe(true);

    // 3. Request a donor
    const donor = match.matchingDonors[0];
    const response = await requesterService.requestDonor(request.id, donor.id);
    expect(response.bloodRequest.status).toBe('request_pending');

    // 4. Donor accepts
    const accepted = await donorService.acceptRequest(request.id);
    expect(accepted.donation.status).toBe('request_pending');

    // 5. Schedule donation
    const scheduled = await requesterService.scheduleBloodRequest({
      requestId: request.id,
      scheduleDate: new Date(Date.now() + 86400000).toISOString() // Tomorrow
    });
    expect(scheduled.bloodRequest.status).toBe('accepted');
  });
});
```

---

## Quick Reference Checklist

```
BEFORE STARTING:
- [ ] Set up API_CONFIG with correct base URL
- [ ] Set up JWT token management
- [ ] Configure HTTP client with interceptors
- [ ] Define TypeScript interfaces

REQUESTER FLOW:
- [ ] Create BloodRequestForm component
- [ ] Create BloodRequestsList component
- [ ] Add check matching donors functionality
- [ ] Add request donor functionality
- [ ] Add schedule appointment feature
- [ ] Add donations tracker view

DONOR FLOW:
- [ ] Create IncomingRequestsList component
- [ ] Create RequestDetails modal
- [ ] Add accept request functionality
- [ ] Add confirmation screen

ERROR HANDLING:
- [ ] Implement validation before API calls
- [ ] Handle 400 (bad request) errors
- [ ] Handle 404 (not found) errors
- [ ] Handle 409 (conflict) errors
- [ ] Handle 401 (unauthorized) errors
- [ ] Show user-friendly error messages
- [ ] Implement retry logic

NOTIFICATIONS:
- [ ] Connect WebSocket for real-time updates
- [ ] Show notifications when status changes
- [ ] Display push notifications
- [ ] Update UI when notified

TESTING:
- [ ] Unit tests for services
- [ ] Integration tests for workflows
- [ ] Component tests for UI
- [ ] End-to-end tests for complete flows

DEPLOYMENT:
- [ ] Test with production API URL
- [ ] Configure environment variables
- [ ] Test all error scenarios
- [ ] Load test high concurrency
- [ ] Security audit JWT handling
```

---

**Document Version:** 1.0  
**Last Updated:** May 8, 2026  
**Framework:** Framework-agnostic (works with React, React Native, Vue, Angular, etc.)
