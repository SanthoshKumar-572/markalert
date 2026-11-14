# MarkAlert — REST API Specification (v1)

Base URL: `/api/v1`

All requests expecting or providing JSON must specify `Content-Type: application/json`.
Protected routes require the `Authorization: Bearer <token>` header.

---

## 1. Authentication (`/api/v1/auth`)

### `POST /auth/login`
Authenticates a user and returns an access token and refresh token.
- **Request Body**:
  ```json
  {
    "email": "faculty@markalert.edu",
    "password": "Password@123"
  }
  ```
- **Response** (`200 OK`):
  ```json
  {
    "success": true,
    "data": {
      "user": {
        "id": "uuid",
        "full_name": "Dr. Sarah Jenkins",
        "email": "faculty@markalert.edu",
        "role": "FACULTY",
        "department": "Information Technology"
      },
      "accessToken": "jwt-token-string",
      "refreshToken": "refresh-token-string"
    }
  }
  ```

### `POST /auth/refresh`
Exchanges a valid refresh token for a fresh access token.
- **Request Body**:
  ```json
  {
    "refreshToken": "refresh-token-string"
  }
  ```

### `POST /auth/logout`
Revokes the refresh token and clears active session.
- **Request Body**:
  ```json
  {
    "refreshToken": "refresh-token-string"
  }
  ```

### `GET /auth/me`
Retrieves currently authenticated user profile.
- **Auth**: Required (`ADMIN` or `FACULTY`)

---

## 2. Admin Faculty Management (`/api/v1/admin/faculty`)
All routes require `role === 'ADMIN'`.

### `GET /admin/faculty`
Lists all registered faculty members with search, pagination, and status filters.

### `POST /admin/faculty`
Creates a new faculty account with generated or specified temporary credentials.
- **Request Body**:
  ```json
  {
    "full_name": "Prof. R. Anand",
    "employee_id": "EMP1042",
    "email": "anand.r@college.edu",
    "department": "Computer Science & Engineering",
    "designation": "Assistant Professor",
    "mobile_number": "9876543210",
    "password": "InitialPassword@123"
  }
  ```

### `PATCH /admin/faculty/:id`
Updates faculty profile details.

### `PATCH /admin/faculty/:id/status`
Toggles `is_active` (`true`/`false`).

### `POST /admin/faculty/:id/reset-password`
Admin securely resets faculty password.

---

## 3. Batches & Excel Ingestion (`/api/v1/batches`)

### `POST /batches`
Initializes a new notification batch draft with metadata.
- **Request Body**:
  ```json
  {
    "exam_name": "Internal Assessment - II",
    "department": "Information Technology",
    "class_name": "3rd Year Sec B",
    "academic_year": "2026-2027"
  }
  ```

### `POST /batches/:id/upload`
Uploads `.xlsx` / `.xls` file (multipart form data, field `file`).
- **Response**:
  Returns sheet names, total rows detected, detected columns, and intelligent column mapping suggestions.

### `POST /batches/:id/validate`
Applies column mapping and selected worksheet, runs comprehensive validation, categorizes records, and populates `batch_recipients`.
- **Request Body**:
  ```json
  {
    "sheet_name": "Sheet1",
    "mapping": {
      "register_number": "Register No",
      "student_name": "Student Name",
      "parent_name": "Parent Name",
      "parent_mobile": "Mobile Number",
      "subjects": {
        "Data Structures": "DS_Marks",
        "Operating Systems": "OS_Marks"
      }
    },
    "max_marks": {
      "Data Structures": 100,
      "Operating Systems": 100
    }
  }
  ```

### `GET /batches/:id/preview`
Returns paginated preview rows (`VALID`, `WARNING`, `ERROR`) with masked phone numbers.

### `GET /batches/:id/errors`
Downloads the CSV Error Report for any invalid/warning records in this batch.

---

## 4. Messages & Confirmation (`/api/v1/batches/:id/messages`)

### `GET /batches/:id/messages`
Generates personalized message previews for all valid recipients using selected or default templates.

### `PATCH /batches/:id/messages`
Allows faculty to customize or adjust template text before sending.

### `POST /batches/:id/send`
Faculty explicitly confirms notification dispatch.
- **Request Body**:
  ```json
  {
    "channel": "BOTH",
    "template_id": "optional-template-id",
    "custom_message": "optional-edited-template"
  }
  ```
- Creates individual `notifications` records and enqueues jobs in BullMQ.

---

## 5. Progress & Delivery Tracking (`/api/v1/batches/:id/status`)

### `GET /batches/:id/status`
Returns live batch delivery status counters (`queued`, `sent`, `delivered`, `failed`). Supports Server-Sent Events (SSE) via `Accept: text/event-stream`.

### `POST /notifications/:id/retry`
Retries a specific failed notification (SMS or WhatsApp).

### `POST /batches/:id/retry-failed`
Retries all failed notifications in this batch for a specific channel (e.g. retry failed SMS only).

---

## 6. Webhooks (`/api/v1/webhooks`)

### `POST /webhooks/whatsapp`
Meta WhatsApp Cloud API delivery status callback endpoint with HMAC verification.

### `POST /webhooks/sms`
DLT SMS Gateway delivery receipt webhook.

---

## 7. Reports & Analytics (`/api/v1/reports`)

### `GET /reports/overview`
Dashboard metric cards: Total Batches, WhatsApp Sent, SMS Sent, Delivered, Failed, and recent batch activity. (Scoped to faculty's own batches, or system-wide if Admin).
