# New Backend API Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align the frontend with the new PNUD-aligned backend API — adding new enum types, new participant fields, `accidentCauseId2`, road free-text fields, a generate-report endpoint, and user-list filters.

**Architecture:** Changes are layered bottom-up: TypeScript types first, then the API service, then the Redux slice, then the UI components. Each layer depends only on the layer below it, so tasks can be reviewed independently. The `AddIncidentDrawer` is the largest surface area; its tasks are split by concern (constants → state → UI per step → payload) to keep each diff small and reviewable.

**Tech Stack:** React 18, TypeScript, Redux Toolkit, MUI v7, Axios, Vitest

---

## File Map

| File | What changes |
|---|---|
| `src/types/accident.ts` | New enum types + new fields on participant and damagesReport |
| `src/services/api.ts` | Add `generateReport` endpoint; add filter params to `users.list` |
| `src/features/incidents/slices/incidentsSlice.ts` | Add `generateReport` thunk; add new field defaults in `toAccidentCreatePayload` |
| `src/features/incidents/components/AddIncidentDrawer.tsx` | New option arrays, form state, UI fields across all 3 steps, submit payload |
| `src/features/incidents/pages/IncidentsPage.tsx` | Add Generate Report button wired to the new thunk |
| `src/features/settings/pages/AdminAccountsPage.tsx` | Pass `center`/`role`/`isValid`/`isFrozen` filter params to `users.list` |

---

## Task 1: Add new enum types to `src/types/accident.ts`

**Files:**
- Modify: `src/types/accident.ts`

- [ ] **Step 1: Add the six new enum types after the existing `InfractionCode` type**

Open `src/types/accident.ts` and add the following after the `InfractionCode` block (around line 262):

```typescript
export type GenderCode = 'MALE' | 'FEMALE' | 'UNKNOWN'

export type LicenseStatusCode =
  | 'VALID'
  | 'EXPIRED'
  | 'SUSPENDED'
  | 'DRIVING_SCHOOL'
  | 'INVALID_CATEGORY'
  | 'NO_LICENSE'
  | 'ACCOMPANIED_DRIVING'

export type SpeedInfractionCode =
  | 'INAPPROPRIATE_SPEED'
  | 'EXCEEDING_LIMIT'
  | 'SLOW_OBSTRUCTING'
  | 'NONE'
  | 'UNKNOWN'

export type AdminInfractionCode =
  | 'NO_ADEQUATE_LICENSE'
  | 'EXPIRED_LICENSE'
  | 'EXCESS_LOAD'
  | 'NO_TECHNICAL_INSPECTION'
  | 'TACHOGRAPH_NOT_CHECKED'
  | 'NONE'
  | 'UNKNOWN'

export type OtherInfractionCode =
  | 'DISTRACTED_DRIVING'
  | 'IMPROPER_LIGHTING'
  | 'WRONG_WAY'
  | 'PARTIAL_WRONG_WAY'
  | 'IMPROPER_TURN'
  | 'ILLEGAL_OVERTAKING'
  | 'ZIGZAG_DRIVING'
  | 'INSUFFICIENT_DISTANCE'
  | 'UNJUSTIFIED_BRAKING'
  | 'FAILURE_TO_YIELD'
  | 'DISREGARD_TRAFFIC_LIGHTS'
  | 'DISREGARD_STOP_SIGN'
  | 'DISREGARD_YIELD_SIGN'
  | 'DISREGARD_PEDESTRIAN_CROSSING'
  | 'DISREGARD_OTHER_SIGNAL'
  | 'IMPROPER_SIGNALING'
  | 'UNSAFE_ENTRY'
  | 'DANGEROUS_PARKING'
  | 'UNSAFE_DOOR_OPENING'
  | 'OTHER'
  | 'NONE'

export type PedestrianInfractionCode =
  | 'DISREGARD_PEDESTRIAN_SIGNAL'
  | 'NOT_USING_CROSSWALK'
  | 'DISREGARD_AGENT_SIGNAL'
  | 'ILLEGAL_CROSSING'
  | 'IMPROPER_ON_ROADWAY'
  | 'IMPROPER_ON_SHOULDER'
  | 'IMPROPER_BOARDING'
  | 'OTHER'
  | 'NONE'

export type ContinuousDrivingHoursCode =
  | 'UNDER_20MIN'
  | 'FROM_20MIN_TO_1H'
  | 'FROM_1H_TO_3H'
  | 'FROM_3H_TO_5H'
  | 'OVER_5H'
  | 'UNKNOWN'

export type ReferenceCode = 'NATIONAL_GUARD' | 'POLICE'
```

- [ ] **Step 2: Add new fields to `ParticipantInfo` interface**

In the same file, find the `ParticipantInfo` interface (around line 397) and add these fields at the end, before the closing `}`:

```typescript
  age?: number | null
  gender?: GenderCode | null
  driverNationality?: string
  licenseStatus?: LicenseStatusCode | null
  licenseIssueDate?: string | null
  speedInfraction?: SpeedInfractionCode | null
  adminInfraction?: AdminInfractionCode | null
  otherInfraction?: OtherInfractionCode | null
  pedestrianInfraction?: PedestrianInfractionCode | null
  continuousDrivingHoursId?: ContinuousDrivingHoursCode | null
```

- [ ] **Step 3: Add `accidentCauseId2` to `AccidentDetails` interface**

Find the `AccidentDetails` interface (around line 417) and add after `causes`:

```typescript
  accidentCauseId2?: AccidentCauseCode | null
```

- [ ] **Step 4: Add `reference` to `InfoDetails` — create a new interface**

After the `LocationInfo` interface (around line 353), add:

```typescript
export interface InfoDetails {
  accidentTime: string
  reference?: ReferenceCode | null
  governorate: string
  delegation: string
  municipality: string
  sector: string
  summary: string
  dayTypeId: string
  accidentSituationId: string
  schoolPoint: boolean
  zoneId: string
  urbanityId: string
}
```

- [ ] **Step 5: Add `locality`, `roadNature`, `pk` to `RoadInfo` interface**

Find the `RoadInfo` interface (around line 355) and add these optional fields:

```typescript
  locality?: string
  roadNature?: string
  pk?: string
```

- [ ] **Step 6: Add `GenerateReportRequest` type at the bottom of the file**

```typescript
export interface GenerateReportRequest {
  documentType: 'PDF' | 'DOCX'
}

export interface GenerateReportResponse {
  url: string
  filename: string
  expiresAt: string
}
```

- [ ] **Step 7: Verify TypeScript compiles with no new errors**

```
npm run build 2>&1 | grep "error TS"
```
Expected: no new errors (only existing ones if any)

- [ ] **Step 8: Commit**

```bash
git add src/types/accident.ts
git commit -m "feat: add new PNUD enum types and participant fields to accident types"
```

---

## Task 2: Add `generateReport` endpoint and user filter params to `src/services/api.ts`

**Files:**
- Modify: `src/services/api.ts`

- [ ] **Step 1: Add import for the new types at the top of `api.ts`**

Find the existing import from `@/types/accident` (line 1) and add `GenerateReportRequest`, `GenerateReportResponse`:

```typescript
import {
  AccidentReport,
  CreateAccidentResponse,
  CreateAccidentErrorResponse,
  AttachmentFileTypeCode,
  IncidentDocumentUploadConfirmRequest,
  IncidentDocumentUploadRequest,
  IncidentDocumentUpdateRequest,
  GenerateReportRequest,
  GenerateReportResponse,
} from '@/types/accident'
```

- [ ] **Step 2: Add `generateReport` to the `incidents` service block**

Find the `incidents` block (around line 180) and add after `update`:

```typescript
    generateReport: (id: string, data: GenerateReportRequest) =>
      api.post<GenerateReportResponse>(`/accidents/${id}/generate-report`, data),
```

- [ ] **Step 3: Update `users.list` to accept all filter params**

Find the `users.list` method (around line 223) and replace it:

```typescript
    list: (params?: {
      search?: string
      center?: string
      role?: 'officer' | 'supervisor' | 'admin'
      isValid?: boolean
      isFrozen?: boolean
      page?: number
      limit?: number
    }) =>
      api.get('/users/', { params }),
```

- [ ] **Step 4: Verify TypeScript compiles**

```
npm run build 2>&1 | grep "error TS"
```
Expected: no new errors

- [ ] **Step 5: Commit**

```bash
git add src/services/api.ts
git commit -m "feat: add generateReport endpoint and full user filter params to API service"
```

---

## Task 3: Add `generateReport` thunk and new field defaults to `incidentsSlice.ts`

**Files:**
- Modify: `src/features/incidents/slices/incidentsSlice.ts`

- [ ] **Step 1: Add `generateReport` async thunk after `updateIncident`**

Find the `updateIncident` thunk (around line 339) and add after it:

```typescript
export const generateIncidentReport = createAsyncThunk(
  'incidents/generateReport',
  async ({ id, documentType }: { id: string; documentType: 'PDF' | 'DOCX' }, { rejectWithValue }) => {
    try {
      const response = await apiService.incidents.generateReport(id, { documentType })
      return response.data
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message || 'Failed to generate report'
      )
    }
  }
)
```

- [ ] **Step 2: Add `generateReport` state to `IncidentsState`**

Find the `IncidentsState` interface (around line 27) and add:

```typescript
  reportGenerating: boolean
  reportError: string | null
```

- [ ] **Step 3: Initialize new state fields**

Find `initialState` (around line 37) and add:

```typescript
  reportGenerating: false,
  reportError: null,
```

- [ ] **Step 4: Add `generateReport` reducers**

Find the `extraReducers` builder (around line 373) and add at the end before the closing `}`  of `extraReducers`:

```typescript
    builder.addCase(generateIncidentReport.pending, (state) => {
      state.reportGenerating = true
      state.reportError = null
    })
    builder.addCase(generateIncidentReport.fulfilled, (state) => {
      state.reportGenerating = false
    })
    builder.addCase(generateIncidentReport.rejected, (state, action) => {
      state.reportGenerating = false
      state.reportError = action.payload as string
    })
```

- [ ] **Step 5: Add new participant field defaults in `toAccidentCreatePayload`**

Find the `participants` array inside `toAccidentCreatePayload` (around line 232). The existing participant object already has most fields. Add the missing new fields inside the `.map()` callback, after `infraction: 'NONE'`:

```typescript
      gender: null,
      age: null,
      driverNationality: '',
      licenseStatus: null,
      licenseIssueDate: null,
      speedInfraction: 'NONE',
      adminInfraction: 'NONE',
      otherInfraction: 'NONE',
      pedestrianInfraction: 'NONE',
      continuousDrivingHoursId: 'UNKNOWN',
```

- [ ] **Step 6: Add `accidentCauseId2` to `damagesReport` defaults in `toAccidentCreatePayload`**

Find the `damagesReport` object inside `toAccidentCreatePayload` (around line 281) and add after `accidentCauseId`:

```typescript
      accidentCauseId2: null,
```

- [ ] **Step 7: Export the new action**

Find the exports line at the bottom of the file (around line 455) and add `generateIncidentReport`:

```typescript
export { generateIncidentReport }
```

- [ ] **Step 8: Verify TypeScript compiles**

```
npm run build 2>&1 | grep "error TS"
```
Expected: no new errors

- [ ] **Step 9: Commit**

```bash
git add src/features/incidents/slices/incidentsSlice.ts
git commit -m "feat: add generateReport thunk and new PNUD field defaults to incidents slice"
```

---

## Task 4: Update `AddIncidentDrawer` — new option arrays and form state

**Files:**
- Modify: `src/features/incidents/components/AddIncidentDrawer.tsx`

- [ ] **Step 1: Add the six new option constant arrays after the existing `INFRACTION_OPTIONS` constant (around line 93)**

```typescript
const GENDER_OPTIONS = ['MALE', 'FEMALE', 'UNKNOWN']
const LICENSE_STATUS_OPTIONS = ['VALID', 'EXPIRED', 'SUSPENDED', 'DRIVING_SCHOOL', 'INVALID_CATEGORY', 'NO_LICENSE', 'ACCOMPANIED_DRIVING']
const SPEED_INFRACTION_OPTIONS = ['INAPPROPRIATE_SPEED', 'EXCEEDING_LIMIT', 'SLOW_OBSTRUCTING', 'NONE', 'UNKNOWN']
const ADMIN_INFRACTION_OPTIONS = ['NO_ADEQUATE_LICENSE', 'EXPIRED_LICENSE', 'EXCESS_LOAD', 'NO_TECHNICAL_INSPECTION', 'TACHOGRAPH_NOT_CHECKED', 'NONE', 'UNKNOWN']
const OTHER_INFRACTION_OPTIONS = ['DISTRACTED_DRIVING', 'IMPROPER_LIGHTING', 'WRONG_WAY', 'PARTIAL_WRONG_WAY', 'IMPROPER_TURN', 'ILLEGAL_OVERTAKING', 'ZIGZAG_DRIVING', 'INSUFFICIENT_DISTANCE', 'UNJUSTIFIED_BRAKING', 'FAILURE_TO_YIELD', 'DISREGARD_TRAFFIC_LIGHTS', 'DISREGARD_STOP_SIGN', 'DISREGARD_YIELD_SIGN', 'DISREGARD_PEDESTRIAN_CROSSING', 'DISREGARD_OTHER_SIGNAL', 'IMPROPER_SIGNALING', 'UNSAFE_ENTRY', 'DANGEROUS_PARKING', 'UNSAFE_DOOR_OPENING', 'OTHER', 'NONE']
const PEDESTRIAN_INFRACTION_OPTIONS = ['DISREGARD_PEDESTRIAN_SIGNAL', 'NOT_USING_CROSSWALK', 'DISREGARD_AGENT_SIGNAL', 'ILLEGAL_CROSSING', 'IMPROPER_ON_ROADWAY', 'IMPROPER_ON_SHOULDER', 'IMPROPER_BOARDING', 'OTHER', 'NONE']
const CONTINUOUS_DRIVING_OPTIONS = ['UNDER_20MIN', 'FROM_20MIN_TO_1H', 'FROM_1H_TO_3H', 'FROM_3H_TO_5H', 'OVER_5H', 'UNKNOWN']
const REFERENCE_OPTIONS = ['NATIONAL_GUARD', 'POLICE']
```

- [ ] **Step 2: Add new fields to `makeInitialForm()`**

Find `makeInitialForm` (around line 111). Add `reference` to `infoDetails`:

```typescript
    reference: 'POLICE' as string,
```

Add `locality`, `roadNature`, `pk` to `roadConditions`:

```typescript
    locality: '',
    roadNature: '',
    pk: '',
```

Add new fields to `participant`:

```typescript
    gender: '' as string,
    age: '' as string,
    driverNationality: '',
    licenseStatus: '' as string,
    licenseIssueDate: '',
    speedInfraction: 'NONE',
    adminInfraction: 'NONE',
    otherInfraction: 'NONE',
    pedestrianInfraction: 'NONE',
    continuousDrivingHoursId: 'UNKNOWN',
```

Add `accidentCauseId2` to `damagesReport`:

```typescript
    accidentCauseId2: '' as string,
```

- [ ] **Step 3: Add new fields to `mapAccidentToForm()`**

Find the `mapAccidentToForm` function (around line 285). Add `reference` mapping inside the `infoDetails` block:

```typescript
        reference: ensureEnumStr(info.reference, REFERENCE_OPTIONS, 'POLICE'),
```

Add road free-text fields inside the `roadConditions` block:

```typescript
        locality: String(road.locality ?? ''),
        roadNature: String(road.roadNature ?? ''),
        pk: String(road.pk ?? ''),
```

Add new participant fields inside the `participant` block:

```typescript
        gender: ensureEnumStr(participant.gender, GENDER_OPTIONS, ''),
        age: participant.age != null ? String(participant.age) : '',
        driverNationality: String(participant.driverNationality ?? ''),
        licenseStatus: ensureEnumStr(participant.licenseStatus, LICENSE_STATUS_OPTIONS, ''),
        licenseIssueDate: String(participant.licenseIssueDate ?? ''),
        speedInfraction: ensureEnumStr(participant.speedInfraction, SPEED_INFRACTION_OPTIONS, 'NONE'),
        adminInfraction: ensureEnumStr(participant.adminInfraction, ADMIN_INFRACTION_OPTIONS, 'NONE'),
        otherInfraction: ensureEnumStr(participant.otherInfraction, OTHER_INFRACTION_OPTIONS, 'NONE'),
        pedestrianInfraction: ensureEnumStr(participant.pedestrianInfraction, PEDESTRIAN_INFRACTION_OPTIONS, 'NONE'),
        continuousDrivingHoursId: ensureEnumStr(participant.continuousDrivingHoursId, CONTINUOUS_DRIVING_OPTIONS, 'UNKNOWN'),
```

Add `accidentCauseId2` inside the `damagesReport` block:

```typescript
        accidentCauseId2: ensureEnumStr(damages.accidentCauseId2, ACCIDENT_CAUSE_OPTIONS, ''),
```

- [ ] **Step 4: Verify TypeScript compiles**

```
npm run build 2>&1 | grep "error TS"
```
Expected: no new errors

- [ ] **Step 5: Commit**

```bash
git add src/features/incidents/components/AddIncidentDrawer.tsx
git commit -m "feat: add new PNUD option arrays and form state to AddIncidentDrawer"
```

---

## Task 5: Update `AddIncidentDrawer` — Step 0 UI (reference field)

**Files:**
- Modify: `src/features/incidents/components/AddIncidentDrawer.tsx`

- [ ] **Step 1: Add `reference` select field in Step 0, Context section**

Find the Step 0 Context section (around line 967 — look for `renderEnum('infoDetails.dayTypeId'`). Add the reference field as the first item in that `Stack`:

```tsx
{renderEnum('infoDetails.reference', t('add_incident.reference'), REFERENCE_OPTIONS)}
```

Insert it before the `dayTypeId` row so the Context section reads:
1. Reference (NATIONAL_GUARD / POLICE)
2. Day Type
3. Situation
4. Zone / Urbanity
5. School Point switch

- [ ] **Step 2: Add translation keys for `reference`**

Open `src/locales/en.ts` and add inside the `add_incident` object:

```typescript
reference: 'Reporting Source',
```

Open `src/locales/fr.ts` and add:

```typescript
reference: 'Source de signalement',
```

Open `src/locales/ar.ts` and add:

```typescript
reference: 'مصدر البلاغ',
```

- [ ] **Step 3: Run the dev server and verify Step 0 shows the Reporting Source select**

```
npm run dev
```

Open the browser at `http://localhost:5273`, open the Add Incident drawer, and confirm "Reporting Source" appears in the Context section with NATIONAL_GUARD / POLICE options.

- [ ] **Step 4: Commit**

```bash
git add src/features/incidents/components/AddIncidentDrawer.tsx src/locales/en.ts src/locales/fr.ts src/locales/ar.ts
git commit -m "feat: add reference (reporting source) field to incident Step 0"
```

---

## Task 6: Update `AddIncidentDrawer` — Step 1 UI (locality, road nature, PK fields)

**Files:**
- Modify: `src/features/incidents/components/AddIncidentDrawer.tsx`

- [ ] **Step 1: Add `locality`, `roadNature`, `pk` text fields in the Road Conditions section**

Find the Road Conditions section in Step 1 (around line 1004 — look for the `Stack` containing `roadConditions.roadName` TextField). After the `roadName` field, add:

```tsx
<Grid container spacing={2}>
  <Grid item xs={12} sm={6} md={4}>
    <TextField
      size="small"
      label={t('add_incident.locality')}
      value={form.roadConditions.locality}
      onChange={(e) => setValue('roadConditions.locality', e.target.value)}
      fullWidth
    />
  </Grid>
  <Grid item xs={12} sm={6} md={4}>
    <TextField
      size="small"
      label={t('add_incident.road_nature')}
      value={form.roadConditions.roadNature}
      onChange={(e) => setValue('roadConditions.roadNature', e.target.value)}
      fullWidth
    />
  </Grid>
  <Grid item xs={12} sm={6} md={4}>
    <TextField
      size="small"
      label={t('add_incident.pk')}
      placeholder="e.g. 12+500"
      value={form.roadConditions.pk}
      onChange={(e) => setValue('roadConditions.pk', e.target.value)}
      fullWidth
    />
  </Grid>
</Grid>
```

- [ ] **Step 2: Add translation keys**

`src/locales/en.ts`:
```typescript
locality: 'Locality',
road_nature: 'Road Nature',
pk: 'Kilometre Marker (PK)',
```

`src/locales/fr.ts`:
```typescript
locality: 'Localité',
road_nature: 'Nature de la voie',
pk: 'Point kilométrique (PK)',
```

`src/locales/ar.ts`:
```typescript
locality: 'المحلية',
road_nature: 'طبيعة الطريق',
pk: 'نقطة كيلومترية (PK)',
```

- [ ] **Step 3: Run dev server and verify**

```
npm run dev
```

Navigate to Step 1 of the incident form and confirm "Locality", "Road Nature", and "Kilometre Marker" fields appear after the road name field.

- [ ] **Step 4: Commit**

```bash
git add src/features/incidents/components/AddIncidentDrawer.tsx src/locales/en.ts src/locales/fr.ts src/locales/ar.ts
git commit -m "feat: add locality, road nature, PK fields to incident Step 1"
```

---

## Task 7: Update `AddIncidentDrawer` — Step 2 UI (new participant fields + accidentCauseId2)

**Files:**
- Modify: `src/features/incidents/components/AddIncidentDrawer.tsx`

- [ ] **Step 1: Add identity/demographics fields to the Identity section in Step 2**

Find the Identity section (around line 1052 — look for `SectionHeader label={t('add_incident.section_participant')}`). After the existing `Grid` with firstName/lastName/cin/registrationNumber/participantType, add a new `Grid`:

```tsx
<Grid container spacing={2}>
  <Grid item xs={12} sm={6} md={3}>
    <TextField
      size="small"
      type="number"
      label={t('add_incident.age')}
      value={form.participant.age}
      onChange={(e) => setValue('participant.age', e.target.value)}
      fullWidth
      inputProps={{ min: 0, max: 120 }}
    />
  </Grid>
  <Grid item xs={12} sm={6} md={3}>
    {renderEnum('participant.gender', t('add_incident.gender'), GENDER_OPTIONS)}
  </Grid>
  <Grid item xs={12} sm={6} md={3}>
    <TextField
      size="small"
      label={t('add_incident.driver_nationality')}
      value={form.participant.driverNationality}
      onChange={(e) => setValue('participant.driverNationality', e.target.value)}
      fullWidth
    />
  </Grid>
  <Grid item xs={12} sm={6} md={3}>
    {renderEnum('participant.licenseStatus', t('add_incident.license_status'), LICENSE_STATUS_OPTIONS)}
  </Grid>
  <Grid item xs={12} sm={6} md={3}>
    <TextField
      size="small"
      type="date"
      label={t('add_incident.license_issue_date')}
      value={form.participant.licenseIssueDate}
      onChange={(e) => setValue('participant.licenseIssueDate', e.target.value)}
      InputLabelProps={{ shrink: true }}
      fullWidth
    />
  </Grid>
  <Grid item xs={12} sm={6} md={3}>
    {renderEnum('participant.continuousDrivingHoursId', t('add_incident.continuous_driving'), CONTINUOUS_DRIVING_OPTIONS)}
  </Grid>
</Grid>
```

- [ ] **Step 2: Add infraction fields to the Behavior & Tests section in Step 2**

Find the Behavior & Tests section (around line 1078). After the existing `infraction` row, add:

```tsx
<Grid item xs={12} sm={6} md={4}>{renderEnum('participant.speedInfraction', t('add_incident.speed_infraction'), SPEED_INFRACTION_OPTIONS)}</Grid>
<Grid item xs={12} sm={6} md={4}>{renderEnum('participant.adminInfraction', t('add_incident.admin_infraction'), ADMIN_INFRACTION_OPTIONS)}</Grid>
<Grid item xs={12} sm={6} md={4}>{renderEnum('participant.otherInfraction', t('add_incident.other_infraction'), OTHER_INFRACTION_OPTIONS)}</Grid>
<Grid item xs={12} sm={6} md={4}>{renderEnum('participant.pedestrianInfraction', t('add_incident.pedestrian_infraction'), PEDESTRIAN_INFRACTION_OPTIONS)}</Grid>
```

- [ ] **Step 3: Add `accidentCauseId2` select to the Accident Outcome section in Step 2**

Find the cause row (around line 1099 — look for `renderEnum('damagesReport.accidentCauseId'`). After that field, add in the same `Grid`:

```tsx
<Grid item xs={12} sm={6} md={4}>
  {renderEnum('damagesReport.accidentCauseId2', t('add_incident.accident_cause_2'), ACCIDENT_CAUSE_OPTIONS)}
</Grid>
```

- [ ] **Step 4: Add translation keys**

`src/locales/en.ts`:
```typescript
age: 'Age',
gender: 'Gender',
driver_nationality: 'Driver Nationality',
license_status: 'License Status',
license_issue_date: 'License Issue Date',
continuous_driving: 'Continuous Driving Duration',
speed_infraction: 'Speed Infraction',
admin_infraction: 'Administrative Infraction',
other_infraction: 'Other Infraction',
pedestrian_infraction: 'Pedestrian Infraction',
accident_cause_2: 'Second Cause (optional)',
```

`src/locales/fr.ts`:
```typescript
age: 'Âge',
gender: 'Genre',
driver_nationality: 'Nationalité du conducteur',
license_status: 'Statut du permis',
license_issue_date: 'Date délivrance permis',
continuous_driving: 'Durée conduite continue',
speed_infraction: 'Infraction vitesse',
admin_infraction: 'Infraction administrative',
other_infraction: 'Autre infraction',
pedestrian_infraction: 'Infraction piéton',
accident_cause_2: 'Deuxième cause (facultatif)',
```

`src/locales/ar.ts`:
```typescript
age: 'العمر',
gender: 'الجنس',
driver_nationality: 'جنسية السائق',
license_status: 'حالة رخصة القيادة',
license_issue_date: 'تاريخ إصدار الرخصة',
continuous_driving: 'مدة القيادة المتواصلة',
speed_infraction: 'مخالفة السرعة',
admin_infraction: 'المخالفة الإدارية',
other_infraction: 'مخالفة أخرى',
pedestrian_infraction: 'مخالفة المشاة',
accident_cause_2: 'السبب الثاني (اختياري)',
```

- [ ] **Step 5: Run dev server and verify Step 2 shows all new fields**

```
npm run dev
```

Navigate to Step 2 of the incident form and confirm:
- Age, Gender, Driver Nationality, License Status, License Issue Date, Continuous Driving fields appear in the Identity section
- Speed/Admin/Other/Pedestrian Infraction fields appear in Behavior section
- Second Cause select appears next to the first cause in Outcome section

- [ ] **Step 6: Commit**

```bash
git add src/features/incidents/components/AddIncidentDrawer.tsx src/locales/en.ts src/locales/fr.ts src/locales/ar.ts
git commit -m "feat: add new participant fields and accidentCauseId2 to incident Step 2"
```

---

## Task 8: Update `AddIncidentDrawer` — include new fields in submit payload

**Files:**
- Modify: `src/features/incidents/components/AddIncidentDrawer.tsx`

- [ ] **Step 1: Update `handleSubmit` to pass new participant and road fields**

Find the `handleSubmit` function (around line 484). The current payload builds `participants` from `form.participant` with hardcoded empty strings for some fields. Replace the participants array to include all new fields:

```typescript
participants: [{
  ...form.participant,
  id: participantId,
  // existing hardcoded empties stay — add new fields:
  age: form.participant.age !== '' ? Number(form.participant.age) : null,
  gender: form.participant.gender || null,
  driverNationality: form.participant.driverNationality || '',
  licenseStatus: form.participant.licenseStatus || null,
  licenseIssueDate: form.participant.licenseIssueDate || null,
  speedInfraction: form.participant.speedInfraction || 'NONE',
  adminInfraction: form.participant.adminInfraction || 'NONE',
  otherInfraction: form.participant.otherInfraction || 'NONE',
  pedestrianInfraction: form.participant.pedestrianInfraction || 'NONE',
  continuousDrivingHoursId: form.participant.continuousDrivingHoursId || 'UNKNOWN',
  // existing hardcoded empties:
  taxId: '', passportNumber: '', eHouwiya: '', commercialType: '', usageType: '',
  vehicleNationality: '', registrationCardNumber: '', chassisNumber: '',
  insuranceContractNumber: '', insuranceContractDate: '', orangeCardNumber: '',
  insurerCompanyName: '', insurerAddress: '', insurerPhoneNumber: '', insurerFax: '',
  insurerEmail: '', insuredPersonName: '', insuredPersonAddress: '', insuredPhoneNumber: '',
  validityStartDate: '', validityEndDate: '', territorialValidity: '', cardDate: '',
  engineNumber: '', vehicleDamageMarkers: [], continuousDrivingHours: '',
}],
```

Also update the `infoDetails` spread to include `reference`:

```typescript
infoDetails: {
  ...form.infoDetails,
  reference: form.infoDetails.reference || null,
},
```

Update `roadConditions` spread to include new free-text fields:

```typescript
roadConditions: {
  ...form.roadConditions,
  locality: form.roadConditions.locality || '',
  roadNature: form.roadConditions.roadNature || '',
  pk: form.roadConditions.pk || '',
},
```

Update `damagesReport` to include `accidentCauseId2`:

```typescript
damagesReport: {
  responsiblePartyIds: [],
  ...form.damagesReport,
  accidentCauseId2: form.damagesReport.accidentCauseId2 || null,
  attachments: [],
},
```

- [ ] **Step 2: Verify TypeScript compiles with no errors**

```
npm run build 2>&1 | grep "error TS"
```
Expected: no new errors

- [ ] **Step 3: Manual end-to-end test**

```
npm run dev
```

1. Open the Add Incident drawer
2. Fill Step 0: set date, time, summary, pick a location, set Reference = "POLICE"
3. Fill Step 1: set road name, add a locality, add PK value
4. Fill Step 2: set age=30, gender=MALE, licenseStatus=VALID, speedInfraction=NONE, accidentCauseId2=FATIGUE
5. Submit — check the browser Network tab and confirm the POST `/api/v2/accidents/` payload contains all new fields

- [ ] **Step 4: Commit**

```bash
git add src/features/incidents/components/AddIncidentDrawer.tsx
git commit -m "feat: include all new PNUD fields in AddIncidentDrawer submit payload"
```

---

## Task 9: Add Generate Report button to `IncidentsPage`

**Files:**
- Modify: `src/features/incidents/pages/IncidentsPage.tsx`

- [ ] **Step 1: Import the new thunk and report state**

Find the Redux imports at the top of `IncidentsPage.tsx` and add:

```typescript
import { generateIncidentReport } from '../slices/incidentsSlice'
```

- [ ] **Step 2: Add dispatch call and state selectors inside the component**

Inside the component, add after the existing `dispatch` declaration:

```typescript
const reportGenerating = useAppSelector((state) => state.incidents.reportGenerating)
const reportError = useAppSelector((state) => state.incidents.reportError)

const handleGenerateReport = async (incidentId: string) => {
  const result = await dispatch(generateIncidentReport({ id: incidentId, documentType: 'PDF' }))
  if (generateIncidentReport.fulfilled.match(result)) {
    const { url, filename } = result.payload as { url: string; filename: string }
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
  }
}
```

- [ ] **Step 3: Add Generate Report button to the incident row/detail actions**

Find the location where incident action buttons are rendered (look for the edit/update button in the incidents table or card). Add a Generate Report button next to it:

```tsx
import PictureAsPdfRoundedIcon from '@mui/icons-material/PictureAsPdfRounded'

// Inside the render, in the actions column/area:
<Button
  size="small"
  variant="outlined"
  startIcon={<PictureAsPdfRoundedIcon />}
  onClick={() => handleGenerateReport(incident.id)}
  disabled={reportGenerating}
  sx={{ borderRadius: 100, textTransform: 'none', fontWeight: 600, fontSize: '0.75rem' }}
>
  {t('incidents.generate_report')}
</Button>
```

- [ ] **Step 4: Add translation keys**

`src/locales/en.ts` — inside the `incidents` block:
```typescript
generate_report: 'PDF Report',
```

`src/locales/fr.ts`:
```typescript
generate_report: 'Rapport PDF',
```

`src/locales/ar.ts`:
```typescript
generate_report: 'تقرير PDF',
```

- [ ] **Step 5: Run dev server and verify**

```
npm run dev
```

Navigate to the Incidents page. Confirm a "PDF Report" button appears per incident. Click it and verify a network request goes to `POST /api/v2/accidents/{id}/generate-report`.

- [ ] **Step 6: Commit**

```bash
git add src/features/incidents/pages/IncidentsPage.tsx src/locales/en.ts src/locales/fr.ts src/locales/ar.ts
git commit -m "feat: add Generate PDF Report button to incidents page"
```

---

## Task 10: Update user list to send filter params in `AdminAccountsPage`

**Files:**
- Modify: `src/features/settings/pages/AdminAccountsPage.tsx`

- [ ] **Step 1: Find where `users.list` is called in `AdminAccountsPage`**

Search for `apiService.users.list` or `users/` calls in the file. Identify the existing filter state variables (search, page, limit).

- [ ] **Step 2: Add filter state variables if not already present**

Inside the component, ensure these state variables exist (add any that are missing):

```typescript
const [filterCenter, setFilterCenter] = useState('')
const [filterRole, setFilterRole] = useState<'officer' | 'supervisor' | 'admin' | ''>('')
const [filterIsValid, setFilterIsValid] = useState<boolean | undefined>(undefined)
const [filterIsFrozen, setFilterIsFrozen] = useState<boolean | undefined>(undefined)
```

- [ ] **Step 3: Pass new filters to `users.list` call**

Find the existing `apiService.users.list(...)` call and update to pass all filters:

```typescript
apiService.users.list({
  search: searchQuery || undefined,
  center: filterCenter || undefined,
  role: filterRole || undefined,
  isValid: filterIsValid,
  isFrozen: filterIsFrozen,
  page: currentPage,
  limit: pageSize,
})
```

- [ ] **Step 4: Add filter UI controls for center and role**

Find the search bar / filter row in `AdminAccountsPage`. Add two more filter controls after the existing search field:

```tsx
<TextField
  size="small"
  label={t('admin_accounts.filter_center')}
  value={filterCenter}
  onChange={(e) => setFilterCenter(e.target.value)}
  sx={{ minWidth: 160 }}
/>
<TextField
  select
  size="small"
  label={t('admin_accounts.filter_role')}
  value={filterRole}
  onChange={(e) => setFilterRole(e.target.value as any)}
  sx={{ minWidth: 140 }}
>
  <MenuItem value="">{t('admin_accounts.all_roles')}</MenuItem>
  <MenuItem value="officer">{t('admin_accounts.role_officer')}</MenuItem>
  <MenuItem value="supervisor">{t('admin_accounts.role_supervisor')}</MenuItem>
  <MenuItem value="admin">{t('admin_accounts.role_admin')}</MenuItem>
</TextField>
```

- [ ] **Step 5: Add translation keys**

`src/locales/en.ts` — inside the `admin_accounts` block:
```typescript
filter_center: 'Filter by center',
filter_role: 'Filter by role',
all_roles: 'All roles',
```

`src/locales/fr.ts`:
```typescript
filter_center: 'Filtrer par centre',
filter_role: 'Filtrer par rôle',
all_roles: 'Tous les rôles',
```

`src/locales/ar.ts`:
```typescript
filter_center: 'تصفية حسب المركز',
filter_role: 'تصفية حسب الدور',
all_roles: 'كل الأدوار',
```

- [ ] **Step 6: Run dev server and verify**

```
npm run dev
```

Navigate to Settings → Admin Accounts. Confirm filter by center and filter by role controls appear and that selecting a role updates the network request to include `?role=officer` (or similar) in the URL.

- [ ] **Step 7: Build the final production bundle**

```
npm run build
```

Expected: build succeeds with no TypeScript errors.

- [ ] **Step 8: Commit**

```bash
git add src/features/settings/pages/AdminAccountsPage.tsx src/locales/en.ts src/locales/fr.ts src/locales/ar.ts
git commit -m "feat: add center and role filter params to admin accounts user list"
```

---

## Final Step: Deploy

Once all tasks pass:

```bash
npm run build
```

Then create the archive and upload (replacing previous archive):

```
scp -P 22 dist-<timestamp>.tar.gz osboui@159.89.6.57:/tmp/
```

SSH in and extract to `/var/www/web.micladevops.com/`.
