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
---

## Delegation Endpoints

### 1. Create Delegation
Assign a task to a doer.

- **URL**: `/api/delegations`
- **Method**: `POST`
- **Access**: Private (Admin/SuperAdmin/Employee)
- **Headers**: `Authorization: Bearer <your_token>`

#### Request Body
```json
{
  "delegation_name": "Quarterly Audit",
  "description": "Perform internal audit of inventory",
  "delegator_id": 1,
  "delegator_name": "Admin Name",
  "doer_id": 5,
  "doer_name": "john.doe@enterprise.com",
  "department": "Finance",
  "priority": "high",
  "due_date": "2024-03-31",
  "evidence_required": true
}
```

---

### 2. List Delegations
Fetch delegations based on role.

- **URL**: `/api/delegations`
- **Method**: `GET`
- **Access**: Private
- **Headers**: `Authorization: Bearer <your_token>`

> [!NOTE]
> - **Admins/SuperAdmins** will see all delegations.
> - **Employees/Doers** will see only tasks assigned to them.

---

### 3. Add Remark
Add a comment or update to a delegation.

- **URL**: `/api/delegations/:id/remarks`
- **Method**: `POST`
- **Access**: Private
- **Headers**: `Authorization: Bearer <your_token>`

#### Request Body
```json
{
  "remark": "Audit is 50% complete. Found some discrepancies in warehouse B."
}
```

---

### 4. Get Delegation Detail
Fetch full details including remarks and history.

- **URL**: `/api/delegations/:id`
- **Method**: `GET`
- **Access**: Private
- **Headers**: `Authorization: Bearer <your_token>`

---

## Checklist Management Endpoints

### 1. Create Checklist Template (Master)
Define a recurring task template.

- **URL**: `/api/checklist/master`
- **Method**: `POST`
- **Access**: Private
- **Headers**: `Authorization: Bearer <your_token>`

#### Request Body
```json
{
  "question": "Daily Server Health Check",
  "assignee_id": 1,
  "doer_id": 2,
  "priority": "high",
  "department": "IT",
  "verification_required": true,
  "verifier_id": 1,
  "attachment_required": false,
  "frequency": "daily",
  "from_date": "2024-01-01",
  "due_date": "2024-12-31",
  "weekly_days": ["Monday", "Wednesday", "Friday"],
  "selected_dates": [1, 15]
}
```

> [!NOTE]
> - `frequency` can be: `daily`, `weekly`, `monthly`, `custom`.
> - `weekly_days` is only used if frequency is `weekly`.
> - `selected_dates` is only used if frequency is `monthly`.

---

### 2. Update Checklist Template
Update the details of an existing master template.

- **URL**: `/api/checklist/master/:id`
- **Method**: `PUT`
- **Access**: Private

---

### 3. Delete Checklist Template
Remove a master template. This will also delete all generated task instances.

- **URL**: `/api/checklist/master/:id`
- **Method**: `DELETE`
- **Access**: Private

---

### 4. Update Task Status
Update the status of a specific generated task instance.

- **URL**: `/api/checklist/task/:id`
- **Method**: `PATCH`
- **Access**: Private

#### Request Body
```json
{
  "status": "Completed"
}
```

> [!NOTE]
> Allowed status values: `Pending`, `In Progress`, `Completed`, `Verified`.

---

### 5. Delete Task Instance
Remove a specific task instance from the system.

- **URL**: `/api/checklist/task/:id`
- **Method**: `DELETE`
- **Access**: Private
