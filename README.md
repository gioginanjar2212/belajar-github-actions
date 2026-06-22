# AI Project Autopilot / Prompt-to-PR System

Repository ini sekarang diarahkan menjadi fondasi **AI Project Autopilot**, bukan marketplace manual.

Tujuan produk adalah membuat command center untuk proyek software yang bisa mengubah ide kasar menjadi:

- project brief
- sprint plan
- task teknis
- generated execution prompt
- report sederhana
- approval gate untuk keputusan berisiko

Sprint saat ini: **AUTO-1: Planning Autopilot Foundation**.

## Fokus Sprint AUTO-1

Sprint AUTO-1 membangun otak perencana dan prompt generator terlebih dahulu.

Yang sudah menjadi scope:

1. Create project dari brief kasar.
2. Simpan data project.
3. Generate project brief.
4. Generate sprint plan dari brief.
5. Generate task list dari sprint.
6. Generate execution prompt untuk tiap task.
7. Dashboard sederhana untuk melihat project, sprint, task, dan prompt.
8. Status task.
9. Report sederhana.
10. Automated test.
11. GitHub Actions CI.

Yang belum masuk AUTO-1:

- auto coding ke repository target
- create branch target repo secara otomatis dari dashboard
- open PR otomatis dari dashboard
- auto-fix CI
- Playwright UI smoke test
- deploy staging/production
- merge ke main otomatis

## Stack

Stack mengikuti repository yang sudah ada:

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

`npm run ci` akan menjalankan seed lalu automated test.

## Data Model Awal

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

## Status Task

Status yang dikenali sistem:

- draft
- planned
- prompt_ready
- branch_created
- coding
- pr_opened
- ci_running
- ci_failed
- auto_fixing
- ready_for_review
- waiting_approval
- merged
- blocked
- failed

Untuk Sprint AUTO-1, status yang paling aktif adalah:

- draft
- planned
- prompt_ready
- ready_for_review
- blocked
- failed

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

Pada Sprint AUTO-1, approval masih dipakai sebagai fondasi data dan tombol placeholder di dashboard. Sistem belum melakukan auto-merge, deploy, atau operasi berisiko.

## API Ringkas

### Create Project

```http
POST /api/projects
Content-Type: application/json
```

Body:

```json
{
  "name": "AI Project Autopilot",
  "repository": "gioginanjar2212/belajar-github-actions",
  "mainBranch": "main",
  "roughBrief": "Buat command center untuk mengubah ide kasar menjadi project brief, sprint plan, task, prompt, report, dan approval gate."
}
```

Response berisi project, sprint, task, generated prompt, dan URL report.

### List Projects

```http
GET /api/projects
```

### Project Detail

```http
GET /api/projects/:projectId
```

### Task Prompt

```http
GET /api/tasks/:taskId/prompt
```

### Update Task Status

```http
PATCH /api/tasks/:taskId/status
```

Body:

```json
{
  "status": "blocked",
  "errorSummary": "Menunggu approval scope."
}
```

### Request Approval

```http
POST /api/tasks/:taskId/approvals
```

Body:

```json
{
  "type": "merge_main",
  "requestedReason": "Merge ke main wajib approval user."
}
```

### Project Report

```http
GET /api/projects/:projectId/report
```

## Dashboard Minimal

Dashboard menampilkan 11 bagian minimal:

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

Untuk Sprint AUTO-1, GitHub Branch, Pull Request, CI Status, Error Log, dan Auto Fix Attempt masih placeholder karena eksekusi GitHub masuk Sprint AUTO-2.

## Roadmap Lanjut

### AUTO-2: GitHub Autopilot

- create branch
- create/update file
- commit
- open draft PR
- trigger/read GitHub Actions

### AUTO-3: Auto Fix CI

- ambil log CI gagal
- analisis error
- patch otomatis
- commit ulang
- maksimal 3 kali auto-fix
- stop dan report jika masih gagal

### AUTO-4: Auto QA

- API test
- UI smoke test
- Playwright
- screenshot
- QA report

### AUTO-5: Release Autopilot

- deploy staging
- test staging
- approval production
- deploy production
- release note
