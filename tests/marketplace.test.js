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
  resetDb({ projects: [], sprints: [], tasks: [], runLogs: [], approvals: [], githubRuns: [], qaReports: [], releasePlans: [] });
}

async function createDemoProject() {
  return request('POST', '/api/projects', {
    name: 'Prompt-to-PR System',
    repository: 'gioginanjar2212/belajar-github-actions',
    mainBranch: 'main',
    roughBrief: 'Bangun AI Project Autopilot yang mengubah ide kasar menjadi project brief, sprint plan, task teknis, generated prompt, report, GitHub execution, CI monitor, auto-fix, QA report, release plan, dan approval gate.'
  });
}

test('health endpoint aktif untuk AI Project Autopilot', async () => {
  clearAutopilotDb();

  const res = await request('GET', '/health');

  assert.equal(res.status, 200);
  assert.equal(res.data.status, 'ok');
  assert.equal(res.data.service, 'ai-project-autopilot');
  assert.equal(res.data.sprint, 'AUTO-2-5');
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

test('GitHub plan membuat branchName dan status branch_created', async () => {
  clearAutopilotDb();

  const created = await createDemoProject();
  const task = created.data.tasks[0];
  const planRes = await request('POST', `/api/tasks/${task.id}/github/plan`);

  assert.equal(planRes.status, 201);
  assert.equal(planRes.data.task.status, 'branch_created');
  assert.match(planRes.data.task.branchName, /^autopilot\//);
  assert.equal(planRes.data.githubRun.status, 'branch_created');
});

test('draft PR foundation mengisi pullRequestUrl dan ci_running', async () => {
  clearAutopilotDb();

  const created = await createDemoProject();
  const task = created.data.tasks[0];
  await request('POST', `/api/tasks/${task.id}/github/plan`);
  const prRes = await request('POST', `/api/tasks/${task.id}/github/open-pr`);

  assert.equal(prRes.status, 201);
  assert.equal(prRes.data.task.status, 'pr_opened');
  assert.equal(prRes.data.task.ciStatus, 'ci_running');
  assert.match(prRes.data.task.pullRequestUrl, /github.com\/gioginanjar2212\/belajar-github-actions\/pull\/autopilot-/);
});

test('CI success menjadikan task ready_for_review', async () => {
  clearAutopilotDb();

  const created = await createDemoProject();
  const task = created.data.tasks[0];
  await request('POST', `/api/tasks/${task.id}/github/open-pr`);
  const ciRes = await request('POST', `/api/tasks/${task.id}/ci/result`, { conclusion: 'success' });

  assert.equal(ciRes.status, 200);
  assert.equal(ciRes.data.task.status, 'ready_for_review');
  assert.equal(ciRes.data.task.ciStatus, 'success');
});

test('CI failure dan auto-fix attempt dibatasi maksimal 3 kali', async () => {
  clearAutopilotDb();

  const created = await createDemoProject();
  const task = created.data.tasks[0];
  const failRes = await request('POST', `/api/tasks/${task.id}/ci/result`, {
    conclusion: 'failure',
    errorSummary: 'Simulasi test gagal.'
  });
  assert.equal(failRes.status, 200);
  assert.equal(failRes.data.task.status, 'ci_failed');

  const firstFix = await request('POST', `/api/tasks/${task.id}/auto-fix`, { rawLog: 'Error 1', fixed: false });
  const secondFix = await request('POST', `/api/tasks/${task.id}/auto-fix`, { rawLog: 'Error 2', fixed: false });
  const thirdFix = await request('POST', `/api/tasks/${task.id}/auto-fix`, { rawLog: 'Error 3', fixed: false });
  const fourthFix = await request('POST', `/api/tasks/${task.id}/auto-fix`, { rawLog: 'Error 4', fixed: false });

  assert.equal(firstFix.status, 201);
  assert.equal(secondFix.status, 201);
  assert.equal(thirdFix.status, 201);
  assert.equal(thirdFix.data.task.fixAttemptCount, 3);
  assert.equal(thirdFix.data.task.status, 'failed');
  assert.equal(fourthFix.status, 422);
});

test('QA report dan release plan dapat dibuat', async () => {
  clearAutopilotDb();

  const created = await createDemoProject();
  const task = created.data.tasks[0];
  const qaRes = await request('POST', `/api/tasks/${task.id}/qa-report`);
  const releaseRes = await request('POST', `/api/projects/${created.data.project.id}/release-plan`);

  assert.equal(qaRes.status, 201);
  assert.equal(qaRes.data.qaReport.status, 'passed');
  assert.equal(releaseRes.status, 201);
  assert.equal(releaseRes.data.releasePlan.status, 'waiting_approval');
  assert.equal(releaseRes.data.approval.type, 'deploy_production');
});

test('final report menampilkan maturity AUTO-2 sampai AUTO-5', async () => {
  clearAutopilotDb();

  const created = await createDemoProject();
  const task = created.data.tasks[0];
  await request('POST', `/api/tasks/${task.id}/github/open-pr`);
  await request('POST', `/api/tasks/${task.id}/ci/result`, { conclusion: 'success' });
  await request('POST', `/api/tasks/${task.id}/qa-report`);
  await request('POST', `/api/projects/${created.data.project.id}/release-plan`);

  const reportRes = await request('GET', `/api/projects/${created.data.project.id}/final-report`);

  assert.equal(reportRes.status, 200);
  assert.equal(reportRes.data.report.maturity.level2GitHubAutopilot, 'foundation_active');
  assert.equal(reportRes.data.report.maturity.level4AutoQa, 'foundation_active');
  assert.equal(reportRes.data.report.maturity.level5ReleaseAutopilot, 'waiting_approval_foundation');
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
