# Asset Module Architecture - Complete Analysis

## 1. DATABASE SCHEMA (Asset Model)

### Main Assets Table
File: apps/api/src/database/schema/assets.ts

Key Columns:
- id (uuid, PK, auto-generated)
- assetCode (varchar, unique) - Auto-generated: AST-{CATEGORY}-{SUBCATEGORY}-{SEQUENCE}
- assetName (varchar, required)
- categoryId, subcategoryId (uuid, FKs with CASCADE delete)
- brandId, model, serialNumber, manufacturer, specification
- purchaseDate, purchasePrice, vendorId, invoiceNumber
- warrantyStart, warrantyEnd
- siteId, buildingId, floorId, roomId, departmentId (location hierarchy)
- currentPicId (uuid, FK to users - Person In Charge)
- status (AVAILABLE, ASSIGNED, IN_USE, IN_MAINTENANCE, BROKEN, SPARE, LOST, RETIRED, DISPOSED)
- condition (GOOD, FAIR, NEED_ATTENTION, BROKEN, CRITICAL, RETIRED)
- healthScore, repeatedFailure
- retiredAt, retiredBy, retireReason, retireNote
- qrCode, photoUrl, notes
- createdBy, createdAt, updatedAt, deletedAt (audit trail)

Related Tables:
- assetConditionHistory: Tracks condition changes
- assetAssignments: User/department assignments
- assetMovements: Location transfers
- assetDocuments: Uploaded files

---

## 2. API ROUTES & ENDPOINTS

### Asset CRUD
GET    /assets              - List with pagination/filters
GET    /assets/:id          - Get by ID
GET    /assets/code/:code   - Get by asset code
POST   /assets              - Create (asset.create)
PATCH  /assets/:id          - Update (asset.update)
DELETE /assets/:id          - Delete permanently (asset.delete)

### Condition Management
PATCH  /assets/:id/condition      - Update condition
GET    /assets/:id/condition-history - Condition history

### Retirement
POST   /assets/:id/retire  - Retire asset (reason: BROKEN/LOST/SOLD/DISPOSED)

### Assignment
POST   /assets/:id/assignments         - Assign to user/department
POST   /assets/:id/assignments/return  - Return asset
GET    /assets/:id/assignments         - Assignment history

### Movement
POST   /assets/:id/movements  - Transfer to new location
GET    /assets/:id/movements  - Movement history

### Media
POST   /assets/:id/photo              - Upload photo
POST   /assets/:id/documents          - Upload document
GET    /assets/:id/documents          - List documents
DELETE /assets/:id/documents/:docId   - Delete document

---

## 3. VALIDATION SCHEMAS (Zod)

### createAssetSchema
- assetName (required, 1-200 chars)
- categoryId, subcategoryId (required, uuid)
- brandId, model, serialNumber, manufacturer, specification (optional)
- purchaseDate, purchasePrice, vendorId, invoiceNumber (optional)
- warrantyStart, warrantyEnd (optional)
- siteId, buildingId, floorId, roomId, departmentId, currentPicId (optional)
- condition, status, notes (optional with defaults)

### updateAssetSchema
Same as createAssetSchema but all fields .partial()

### retireAssetSchema
- reason (required enum): BROKEN, LOST, SOLD, DISPOSED
- notes (optional, max 1000 chars)

### listAssetsQuery
- page, limit, search
- sort: assetCode, assetName, category, condition, status, createdAt
- order: asc, desc
- Filters: condition, status, categoryId, subcategoryId, brandId, departmentId, siteId, buildingId, floorId, roomId, picId

---

## 4. AUTHORIZATION & PERMISSIONS

### Permission Model
- authorize(permission) - Requires ALL permissions
- authorizeAny(permission1, permission2) - Requires ANY permission

### Asset Permissions
- asset.read / asset.read.own
- asset.create
- asset.update
- asset.assign
- asset.transfer
- asset.retire
- asset.delete

### Scope Resolution (apps/api/src/middleware/scope.ts)
- SUPER_ADMIN: Unrestricted (empty scope)
- ADMIN / TECHNICIAN: Scoped to asset categories (categoryIds)
- USER: Scoped to own assignments (ownUserId)

Function canAccessAsset() checks scope against asset's categoryId/currentPicId

---

## 5. AUTHENTICATION

Bearer Token JWT in Authorization header
Validates token signature, expiration, and user active status
Attaches user context: id, username, name, roles, permissions, categoryIds

---

## 6. WEB APP - FORM PAGES

### Create/Edit Asset Form (AssetFormPage.tsx)

Form Sections:
1. Basic Information: Asset Name, Model, Serial Number, Manufacturer, Specification
2. Classification: Category, Subcategory, Brand, Department
3. Location: Site → Building → Floor → Room (cascading)
4. Purchase & Warranty: Date, Price, Vendor, Invoice, Warranty dates
5. Status & Notes: Condition, Status, Notes

Features:
- Auto-generated asset code preview (AST-{CAT}-{SUBCAT}-XXXX)
- Cascading dropdowns with dependent queries
- Category-subcategory validation
- Permission checks (asset.create / asset.update)
- TanStack Query for data fetching
- Toast notifications
- Create vs Edit mode detection

Form Component Pattern:
<FormField
  label="fieldLabel"
  name="fieldKey"
  type="text|select|date|number|textarea"
  options={[{value, label}]}
  required={boolean}
  form={formState}
  errors={errorState}
  onChange={handler}
/>

---

## 7. ASSET DETAIL PAGE (AssetDetailPage.tsx)

Sections:
1. Header: Photo, name, code, condition badge, status badge
2. Asset Information: Category, Subcategory, Brand, Model, Serial, Manufacturer, Specification
3. Assignment: Current user/department, Assign/Return/Transfer buttons
4. Purchase & Warranty: Date, price, vendor, invoice, warranty info
5. Location: Site, Building, Floor, Room, Department, PIC
6. Preventive Maintenance: Linked maintenance schedules
7. Condition History: Timeline of condition changes
8. Assignment History: Timeline of user assignments
9. Movement History: Location transfer history
10. Documents: Uploaded files with type categorization

Modal Dialogs:
- Condition Update Modal
- Assign Asset Modal
- Return Asset Modal
- Transfer Asset Modal (with cascading location selectors)
- Retire Dialog
- Delete Dialog (requires typing "DELETE")

Features:
- Permission-based button visibility
- Photo upload with overlay
- Document management
- Cascade loading of location hierarchy
- Status badges with color coding

---

## 8. INVENTORY LIST PAGE (InventoryListPage.tsx)

Features:
- Pagination
- Search by code/name/serial/model/category
- Filter by Condition, Status
- Sort by: Newest First, Asset Code, Asset Name, Category, Condition, Status
- Desktop table view + responsive mobile cards
- Inline actions: View, Edit, Retire, Delete
- Retire/Delete dialogs from list

---

## 9. FORM COMPONENTS & PATTERNS

### Reusable Components

1. FormField (inline in AssetFormPage)
   - Input types: text, select, date, number, textarea
   - Error display
   - Required field indicator

2. ConditionBadge
   - Color-coded condition status
   - Sizes: sm, md, lg
   - Styles: GOOD (green), FAIR (yellow), NEED_ATTENTION (orange), BROKEN (red), CRITICAL (red), RETIRED (slate)

3. RetireDialog
   - Reason selector: BROKEN, LOST, SOLD, DISPOSED
   - Optional notes textarea
   - Loading state

4. DeleteDialog
   - Requires typing "DELETE" to confirm
   - Warning message
   - Optional notes

### Form State Management
- Simple useState for form data (Record<string, string>)
- Separate error state
- onChange handlers update form + cascade dependent fields
- Validation on submit

### Data Fetching
- TanStack Query (React Query)
- useQuery for GET operations
- useMutation for POST/PATCH/DELETE
- Automatic cache invalidation on mutations
- Query key patterns: ['assets'], ['asset', id], ['master', resource]

---

## 10. API CLIENT (apps/web/src/lib/api-client.ts)

Core Functions:
- apiGet<T>(endpoint, params?) - GET with query string
- apiPost<T>(endpoint, body?) - POST JSON
- apiPatch<T>(endpoint, body) - PATCH JSON
- apiDelete<T>(endpoint, body?) - DELETE with optional body
- apiUpload<T>(endpoint, method, formData) - FormData upload

Features:
- Automatic Bearer token attachment
- Query parameter serialization
- Error handling (401/403/404)
- Session expiration handler callback
- Content-Type header management

---

## 11. INVENTORY API CLIENT (apps/web/src/features/inventory/api/inventory.ts)

Asset Functions:
- listAssets(params)
- getAsset(id)
- createAsset(data)
- updateAsset(id, data)
- retireAsset(id, {reason, notes})
- deleteAssetPermanently(id, {notes})
- listMaster(resource, params)

Media Functions:
- uploadPhoto(id, file)
- uploadDocument(id, file, documentType)
- deleteDocument(assetId, docId)
- listDocuments(id)

Assignment Functions:
- assignAsset(id, data)
- returnAsset(id, data)
- getAssignmentHistory(id)

Movement Functions:
- transferAsset(id, data)
- getMovementHistory(id)

---

## 12. SERVICE LAYER (asset.service.ts)

Key Functions:
- list() - Query with filtering, pagination, sorting
- getById() - Single asset with joins
- getByCode() - Lookup by code
- create() - Create with validation
- update() - Update existing
- updateCondition() - Change condition + history
- retire() - Retire asset
- deletePermanently() - Hard delete (WRONG_REGISTRATION)
- getConditionHistory() - Retrieve history

Validations:
- Category-subcategory relationship
- Location hierarchy (Site→Building→Floor→Room)
- Reference validation (brand, vendor, user)
- Condition/status enum
- Scope-based access control

Asset Code Generation:
- Counter table: asset_code_counters
- Format: AST-{CATEGORYCODE}-{SUBCATEGORYCODE}-{4-digit-sequence}

---

## 13. REPOSITORY LAYER (asset.repository.ts)

Queries:
- findAssets() - Complex filtered query with JOINs
- findAssetById() - With all master data
- getById() - Simple lookup
- create() - Insert new
- update() - Update by ID
- getByCode() - Lookup by code

Features:
- LEFT JOINs to all reference tables
- Dynamic WHERE clause building
- Pagination (offset/limit)
- Safe sorting (allowlist)
- Search across multiple fields
- Soft delete support (deletedAt check)

---

## 14. CONTROLLER LAYER (asset.controller.ts)

Controllers:
- listController
- getByIdController
- getByCodeController
- createController + audit logging
- updateController + audit logging
- updateConditionController + audit logging
- retireController + audit logging
- deleteController + audit logging
- getConditionHistoryController

Audit Logging:
- Logs all mutations (CREATE, UPDATE, RETIRE, DELETE)
- Includes module, action, entity type, ID, description, new data

---

## 15. VALIDATION MIDDLEWARE (validate.ts)

- Zod schema validation on request.body
- Returns 422 VALIDATION_ERROR on failure
- Parsed data replaces request.body

---

## 16. UI DESIGN PATTERNS

### Design System
- Colors: Slate, Indigo (primary), Green (good), Yellow (fair), Orange (attention), Red (broken/critical)
- Spacing: Tailwind scale (px-3, py-2, gap-4, etc.)
- Typography: sm/base/lg, normal/medium/semibold/bold
- Components: Rounded-lg borders, focus rings, hover states
- Icons: Lucide React

### Form Styling
- Input/select: "border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
- Error states: "border-red-300" with error text in red-500
- Labels: "block text-sm font-medium text-slate-700"

### Modal Pattern
- Fixed overlay: "fixed inset-0 z-50 bg-black/30 flex items-start justify-center"
- Modal body: "rounded-xl bg-white shadow-xl"
- Header with border-b, footer with border-t
- Dismiss on outside click

---

## 17. AUTHENTICATION CONTEXT

useAuth() hook from AuthProvider:
- id, username, name, roles, permissions, categoryIds
- can(permission) - Check permission

---

## 18. MASTER DATA HIERARCHY

Cascading dropdowns in asset form:
1. Categories (IT, Furniture, etc.)
2. Subcategories (Laptops, Monitors under IT)
3. Brands (Manufacturers)
4. Sites (Head Office, Branch)
5. Buildings (Within each site)
6. Floors (Within each building)
7. Rooms (Within each floor)
8. Departments (Organizational units)
9. Vendors (Suppliers)
10. Users (For PIC/assignment)

---

## 19. KEY DESIGN PATTERNS

Backend:
- MVC Pattern: Controller → Service → Repository → Database
- Zod Validation: Schema-first at route middleware
- Scope-Based Access Control: Permissions + role-based scopes
- Soft Delete: deletedAt field for audit trail
- Audit Logging: Event bus for mutations
- Transaction Support: Atomic operations (code generation)

Frontend:
- Form State Pattern: useState with object state
- React Query Pattern: useQuery + useMutation with invalidation
- Component Composition: Modular dialogs and fields
- Permission Guards: Conditional rendering
- Cascading Selectors: Dependent queries

---

## 20. ERROR HANDLING

Backend:
- AppError class: status, code, message
- Zod failures → 422 VALIDATION_ERROR
- Missing references → 400 VALIDATION_ERROR
- Authorization → 403 FORBIDDEN
- Authentication → 401 UNAUTHORIZED

Frontend:
- Toast notifications for errors (Sonner)
- Form validation errors displayed inline
- Permission denials show message
- Loading/disabled states during mutations

---

## SUMMARY OF KEY FEATURES

1. Complete Asset Lifecycle: Create → Assign → Transfer → Maintain → Retire/Delete
2. Multi-level Hierarchy: Category→Subcategory, Site→Building→Floor→Room
3. Condition Tracking: Full history with reasons
4. Document Management: Upload invoices, warranties, manuals
5. Assignment Tracking: Custody and return dates
6. Location Tracking: Asset movements
7. Role-Based Access: SUPER_ADMIN, ADMIN, TECHNICIAN, USER with category/assignment scopes
8. Audit Trail: All mutations logged with user and timestamp
9. Search & Filter: Multi-field search with advanced filtering
10. Soft Delete: Archive while preserving history

---

## FILE LOCATIONS

Database Schema:
- apps/api/src/database/schema/assets.ts

API Routes:
- apps/api/src/modules/assets/asset.routes.ts

Schemas & Validation:
- apps/api/src/modules/assets/asset.schema.ts

Controllers:
- apps/api/src/modules/assets/asset.controller.ts

Services:
- apps/api/src/modules/assets/asset.service.ts

Repository:
- apps/api/src/modules/assets/asset.repository.ts

Middleware:
- apps/api/src/middleware/authenticate.ts
- apps/api/src/middleware/authorize.ts
- apps/api/src/middleware/scope.ts
- apps/api/src/middleware/validate.ts

Web Pages:
- apps/web/src/features/inventory/pages/AssetFormPage.tsx
- apps/web/src/features/inventory/pages/AssetDetailPage.tsx
- apps/web/src/features/inventory/pages/InventoryListPage.tsx

Web Components:
- apps/web/src/features/inventory/components/RetireDialog.tsx
- apps/web/src/features/inventory/components/DeleteDialog.tsx
- apps/web/src/components/ui/ConditionBadge.tsx

API Clients:
- apps/web/src/lib/api-client.ts
- apps/web/src/features/inventory/api/inventory.ts

Hooks:
- apps/web/src/hooks/useAuth.ts
