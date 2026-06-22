# AI Project Autopilot / Prompt-to-PR System

Repository ini adalah fondasi **AI Project Autopilot**, yaitu command center untuk proyek software.

Produk ini membantu mengubah ide kasar menjadi:

- project brief
- sprint plan
- task teknis
- generated execution prompt
- GitHub branch plan
- draft PR plan
- CI status
- auto-fix attempt maksimal 3 kali
- QA report
- release plan
- approval gate untuk keputusan berisiko

## Status Saat Ini

Sprint yang sudah dibuat dalam foundation ini:

### AUTO-1: Planning Autopilot Foundation

- Create project dari brief kasar.
- Simpan data project.
- Generate project brief.
- Generate sprint plan.
- Generate task list.
- Generate execution prompt.
- Dashboard awal.
- Status task.
- Report sederhana.
- Automated test.
- GitHub Actions CI.

### AUTO-2: GitHub Autopilot Foundation

- Generate branch name dari task.
- Simpan branch plan ke task.
- Generate draft pull request URL foundation.
- Simpan PR status ke task.
- Simpan CI status dasar.

Catatan: AUTO-2 di dalam app masih berupa orchestration foundation. Eksekusi nyata GitHub dari dashboard membutuhkan connector yang aman dan belum ditanam ke app.

### AUTO-3: Auto Fix CI Foundation

- CI failure bisa dicatat.
- Error summary bisa disimpan.
- Auto-fix attempt bisa dibuat.
- Batas auto-fix maksimal 3 kali.
- Jika masih gagal setelah 3 kali, task menjadi failed.

### AUTO-4: Auto QA Foundation

- QA report bisa dibuat dari task.
- Report menyimpan API health check, dashboard render check, task prompt check, GitHub/CI widget check, dan approval gate check.
- Screenshot masih placeholder sampai Playwright ditambahkan.

### AUTO-5: Release Autopilot Foundation

- Release plan bisa dibuat dari project.
- Production deploy selalu masuk approval gate.
- Release note foundation tersedia.
- Deploy production nyata belum dijalankan dari app.

## Stack

- Node.js
- Express
- JSON file storage
- HTML dashboard sederhana
- Node test runner
- GitHub Actions

## Jalankan Lokal

```bash
npm install
npm run seed
npm start
```

Buka dashboard:

```text
http://localhost:3000
```

Health check:

```text
http://localhost:3000/health
```

## Script Penting

```bash
npm test
npm run ci
```

`npm run ci` menjalankan seed lalu automated test.

## Dashboard

Dashboard memiliki bagian:

1. Project
2. Sprint
3. Task
4. Generated Prompt
5. GitHub Branch
6. Pull Request
7. CI Status
8. Error Log
9. Auto Fix Attempt
10. Report
11. Approval Button

Dashboard juga punya tombol:

- AUTO-2 Plan Branch
- AUTO-2 Open Draft PR
- AUTO-2 Mark CI Success
- AUTO-3 Mark CI Failed
- AUTO-3 Auto Fix Attempt
- AUTO-4 QA Report
- AUTO-5 Release Plan
- Final Report

## API Ringkas

### Planning

```http
POST /api/projects
GET /api/projects
GET /api/projects/:projectId
GET /api/projects/:projectId/report
GET /api/projects/:projectId/final-report
GET /api/tasks/:taskId/prompt
PATCH /api/tasks/:taskId/status
```

### GitHub Autopilot Foundation

```http
POST /api/tasks/:taskId/github/plan
POST /api/tasks/:taskId/github/open-pr
```

### CI Monitor dan Auto Fix

```http
POST /api/tasks/:taskId/ci/result
POST /api/tasks/:taskId/auto-fix
```

### QA dan Release

```http
POST /api/tasks/:taskId/qa-report
POST /api/projects/:projectId/release-plan
```

### Approval

```http
POST /api/tasks/:taskId/approvals
PATCH /api/approvals/:approvalId
```

## Data Model

### Project

- id
- name
- brief
- status
- repository
- mainBranch
- createdAt
- updatedAt

### Sprint

- id
- projectId
- title
- goal
- order
- status
- createdAt
- updatedAt

### Task

- id
- projectId
- sprintId
- title
- description
- acceptanceCriteria
- generatedPrompt
- status
- branchName
- pullRequestUrl
- ciStatus
- errorSummary
- fixAttemptCount
- createdAt
- updatedAt

### Run Log

- id
- taskId
- type
- message
- rawLog
- createdAt

### Approval

- id
- projectId
- taskId
- type
- status
- requestedReason
- approvedAt
- rejectedAt

### GitHub Run

- id
- projectId
- taskId
- repository
- mainBranch
- branchName
- pullRequestUrl
- status
- commitMessage
- plannedFiles
- safeAutomation
- approvalRequiredFor
- maxAutoFixAttempts
- createdAt
- updatedAt

### QA Report

- id
- projectId
- taskId
- status
- runner
- checks
- screenshots
- createdAt

### Release Plan

- id
- projectId
- status
- environment
- approvalType
- steps
- releaseNote
- createdAt
- updatedAt

## Approval Gate

Sistem wajib meminta approval user sebelum:

1. Merge ke main.
2. Deploy production.
3. Mengubah struktur database besar.
4. Menghapus file/data.
5. Mengubah payment/shipping provider.
6. Mengubah auth/security.
7. Mengubah environment/secrets.
8. Menjalankan operasi yang bisa memengaruhi data user.

## Batasan Saat Ini

- App belum melakukan commit/PR nyata langsung dari dashboard.
- Auto-fix masih foundation model, belum patch file otomatis dari error log nyata.
- QA screenshot masih placeholder sampai Playwright ditambahkan.
- Production release hanya dibuat sebagai plan dan approval gate, belum deploy nyata.

## Langkah Berikutnya

Tahap berikutnya adalah menyambungkan dashboard ke connector yang aman, lalu membuat eksekusi nyata:

1. Create branch nyata.
2. Create/update file nyata.
3. Commit nyata.
4. Open draft PR nyata.
5. Read GitHub Actions status nyata.
6. Ambil log CI gagal.
7. Patch otomatis maksimal 3 kali.
8. Jalankan Playwright smoke test.
9. Buat release note final.
