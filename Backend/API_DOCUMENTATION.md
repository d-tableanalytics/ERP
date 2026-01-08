# ERP API Documentation

This document provides details for the authentication and employee management API endpoints.

**Base URL**: `http://localhost:5000`

---

## Authentication Endpoints

### 1. Register Employee
Create a new employee record.

- **URL**: `/api/auth/register`
- **Method**: `POST`
- **Access**: Public (Admin only in production)

#### Request Body
```json
{
  "First_Name": "John",
  "Last_Name": "Doe",
  "Work_Email": "john.doe@enterprise.com",
  "Password": "securePassword123",
  "Role": "Employee",
  "Designation": "Software Engineer",
  "Department": "IT",
  "Joining_Date": "2024-01-01"
}
```

> [!NOTE]
> `Joining_Date` is now required by the database. If not provided, it will default to the current date.

#### Success Response
**Code**: `201 Created`
```json
{
  "message": "Employee registered successfully",
  "user": {
    "id": 1,
    "email": "john.doe@enterprise.com",
    "role": "Employee"
  }
}
```

#### Error Response
**Code**: `400 Bad Request` (If email exists)
```json
{
  "message": "Employee with this email already exists"
}
```

---

### 2. Login Employee
Authenticate and receive a JWT token.

- **URL**: `/api/auth/login`
- **Method**: `POST`
- **Access**: Public

#### Request Body
```json
{
  "Work_Email": "john.doe@enterprise.com",
  "Password": "securePassword123"
}
```

#### Success Response
**Code**: `200 OK`
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "john.doe@enterprise.com",
    "role": "Employee",
    "name": "John Doe"
  }
}
```

#### Error Response
**Code**: `400 Bad Request` (Invalid credentials)
```json
{
  "message": "Invalid credentials"
}
```

---

### 3. Get Current Profile
Fetch details of the currently logged-in user.

- **URL**: `/api/auth/me`
- **Method**: `GET`
- **Access**: Private (JWT Required)
- **Headers**: `Authorization: Bearer <your_token>`

#### Success Response
**Code**: `200 OK`
```json
{
  "id": 1,
  "email": "john.doe@enterprise.com",
  "role": "Employee",
  "iat": 1704712345,
  "exp": 1704798745
}
```

#### Error Response
**Code**: `401 Unauthorized` (Missing or invalid token)
```json
{
  "message": "No token, authorization denied"
}
```

---

## Database Schema (Employee Table)
For reference, these are the headers available in the `employees` table:

| Field | Type | Description |
| :--- | :--- | :--- |
| `User_Id` | SERIAL | Primary Key |
| `Work_Email` | VARCHAR | Unique Identifier |
| `Password` | VARCHAR | Hashed Password |
| `Role` | VARCHAR | User category (Admin/Employee/etc) |
| `First_Name` | VARCHAR | |
| `Last_Name` | VARCHAR | |
| `Mobile_Number`| VARCHAR | |
| `Department` | VARCHAR | |
| ... | ... | (29 fields in total) |
