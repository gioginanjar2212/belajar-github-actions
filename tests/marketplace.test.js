import assert from 'node:assert/strict';
import test from 'node:test';
import app from '../src/server.js';
import { resetDb } from '../src/store.js';

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, async () => {
      const port = server.address().port;
      try {
        const response = await fetch(`http://127.0.0.1:${port}${path}`, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: body ? JSON.stringify(body) : undefined
        });
        const data = await response.json();
        server.close(() => resolve({ status: response.status, data }));
      } catch (error) {
        server.close(() => reject(error));
      }
    });
  });
}

function clearAutopilotDb() {
  resetDb({ projects: [], sprints: [], tasks: [], runLogs: [], approvals: [] });
}

async function createDemoProject() {
  return request('POST', '/api/projects', {
    name: 'Prompt-to-PR System',
    repository: 'gioginanjar2212/belajar-github-actions',
    mainBranch: 'main',
    roughBrief: 'Bangun AI Project Autopilot yang mengubah ide kasar menjadi project brief, sprint plan, task teknis, generated prompt, report, dan approval gate.'
  });
}

test('health endpoint aktif untuk AI Project Autopilot', async () => {
  clearAutopilotDb();

  const res = await request('GET', '/health');

  assert.equal(res.status, 200);
  assert.equal(res.data.status, 'ok');
  assert.equal(res.data.service, 'ai-project-autopilot');
  assert.equal(res.data.sprint, 'AUTO-1');
});

test('project bisa dibuat dari rough brief dan menghasilkan sprint serta task', async () => {
  clearAutopilotDb();

  const res = await createDemoProject();

  assert.equal(res.status, 201);
  assert.equal(res.data.project.status, 'planned');
  assert.match(res.data.project.brief, /Product Intent/);
  assert.equal(res.data.sprints.length, 1);
  assert.equal(res.data.sprints[0].title, 'AUTO-1: Planning Autopilot Foundation');
  assert.equal(res.data.tasks.length, 5);
  assert.ok(res.data.tasks.every((task) => task.status === 'prompt_ready'));
});

test('generated prompt tersedia untuk setiap task dengan approval gate', async () => {
  clearAutopilotDb();

  const created = await createDemoProject();
  const task = created.data.tasks[0];
  const promptRes = await request('GET', `/api/tasks/${task.id}/prompt`);

  assert.equal(promptRes.status, 200);
  assert.match(promptRes.data.generatedPrompt, /TASK ID:/);
  assert.match(promptRes.data.generatedPrompt, /ACCEPTANCE CRITERIA:/);
  assert.match(promptRes.data.generatedPrompt, /Jangan merge ke main tanpa approval user/);
  assert.match(promptRes.data.generatedPrompt, /EXPECTED REPORT:/);
});

test('project detail menampilkan project sprint task logs dan approval kosong', async () => {
  clearAutopilotDb();

  const created = await createDemoProject();
  const detailRes = await request('GET', `/api/projects/${created.data.project.id}`);

  assert.equal(detailRes.status, 200);
  assert.equal(detailRes.data.project.id, created.data.project.id);
  assert.equal(detailRes.data.sprints.length, 1);
  assert.equal(detailRes.data.tasks.length, 5);
  assert.equal(detailRes.data.approvals.length, 0);
  assert.ok(detailRes.data.runLogs.length >= 1);
});

test('report sederhana menghitung status task dan placeholder GitHub CI', async () => {
  clearAutopilotDb();

  const created = await createDemoProject();
  const reportRes = await request('GET', `/api/projects/${created.data.project.id}/report`);

  assert.equal(reportRes.status, 200);
  assert.equal(reportRes.data.report.project.name, 'Prompt-to-PR System');
  assert.equal(reportRes.data.report.sprintCount, 1);
  assert.equal(reportRes.data.report.taskCount, 5);
  assert.equal(reportRes.data.report.taskStatusCounts.prompt_ready, 5);
  assert.equal(reportRes.data.report.githubPlaceholders.length, 5);
  assert.equal(reportRes.data.report.githubPlaceholders[0].ciStatus, 'not_started');
});

test('status task bisa diperbarui dan errorSummary tersimpan', async () => {
  clearAutopilotDb();

  const created = await createDemoProject();
  const task = created.data.tasks[0];
  const statusRes = await request('PATCH', `/api/tasks/${task.id}/status`, {
    status: 'blocked',
    errorSummary: 'Menunggu approval scope.'
  });

  assert.equal(statusRes.status, 200);
  assert.equal(statusRes.data.task.status, 'blocked');
  assert.equal(statusRes.data.task.errorSummary, 'Menunggu approval scope.');
  assert.equal(statusRes.data.runLog.type, 'status_changed');
});

test('approval gate bisa dibuat dari task dan task menjadi waiting_approval', async () => {
  clearAutopilotDb();

  const created = await createDemoProject();
  const task = created.data.tasks[0];
  const approvalRes = await request('POST', `/api/tasks/${task.id}/approvals`, {
    type: 'merge_main',
    requestedReason: 'Merge ke main wajib approval user.'
  });

  assert.equal(approvalRes.status, 201);
  assert.equal(approvalRes.data.approval.status, 'pending');
  assert.equal(approvalRes.data.approval.type, 'merge_main');
  assert.equal(approvalRes.data.task.status, 'waiting_approval');

  const approveRes = await request('PATCH', `/api/approvals/${approvalRes.data.approval.id}`, {
    status: 'approved'
  });

  assert.equal(approveRes.status, 200);
  assert.equal(approveRes.data.approval.status, 'approved');
  assert.ok(approveRes.data.approval.approvedAt);
});

test('roughBrief kosong ditolak dengan status 422', async () => {
  clearAutopilotDb();

  const res = await request('POST', '/api/projects', { roughBrief: '' });

  assert.equal(res.status, 422);
  assert.match(res.data.message, /roughBrief wajib diisi/);
});
