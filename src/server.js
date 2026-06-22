import express from 'express';
import cors from 'cors';
import { nanoid } from 'nanoid';
import { ensureDb, readDb, writeDb } from './store.js';
import {
  APPROVAL_GATE_TYPES,
  TASK_STATUSES,
  buildProjectReport,
  createPlanningAutopilotProject
} from './services/planner.js';
import {
  applyCiResult,
  createAutoFixAttempt,
  createGitHubExecutionPlan,
  createQaReport,
  createReleasePlan,
  markBranchCreated,
  markDraftPullRequestOpened
} from './services/githubAutopilot.js';

ensureDb();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

function now() {
  return new Date().toISOString();
}

function findProjectBundle(db, projectId) {
  const project = db.projects.find((item) => item.id === projectId);
  if (!project) return null;

  const sprints = db.sprints
    .filter((item) => item.projectId === project.id)
    .sort((a, b) => a.order - b.order);
  const tasks = db.tasks.filter((item) => item.projectId === project.id);
  const taskIds = new Set(tasks.map((task) => task.id));
  const runLogs = db.runLogs.filter((item) => taskIds.has(item.taskId));
  const approvals = db.approvals.filter((item) => item.projectId === project.id);
  const githubRuns = db.githubRuns.filter((item) => item.projectId === project.id);
  const qaReports = db.qaReports.filter((item) => item.projectId === project.id);
  const releasePlans = db.releasePlans.filter((item) => item.projectId === project.id);

  return { project, sprints, tasks, runLogs, approvals, githubRuns, qaReports, releasePlans };
}

function findTaskContext(db, taskId) {
  const task = db.tasks.find((item) => item.id === taskId);
  if (!task) return null;

  const project = db.projects.find((item) => item.id === task.projectId);
  if (!project) return null;

  let githubRun = db.githubRuns.find((item) => item.taskId === task.id);
  return { task, project, githubRun };
}

function pushRunLog(db, { taskId, type, message, rawLog = '' }) {
  const runLog = {
    id: `log_${nanoid(10)}`,
    taskId,
    type,
    message,
    rawLog,
    createdAt: now()
  };

  db.runLogs.push(runLog);
  return runLog;
}

function getOrCreateGithubRun(db, project, task) {
  let githubRun = db.githubRuns.find((item) => item.taskId === task.id);
  if (!githubRun) {
    githubRun = createGitHubExecutionPlan({ project, task });
    db.githubRuns.push(githubRun);
  }
  return githubRun;
}

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'ai-project-autopilot', sprint: 'AUTO-2-5' });
});

app.post('/api/projects', (req, res) => {
  try {
    const { roughBrief, name = '', repository = '', mainBranch = 'main' } = req.body;
    const db = readDb();
    const plan = createPlanningAutopilotProject({ roughBrief, name, repository, mainBranch });

    db.projects.push(plan.project);
    db.sprints.push(...plan.sprints);
    db.tasks.push(...plan.tasks);
    db.runLogs.push(...plan.runLogs);
    writeDb(db);

    res.status(201).json({
      project: plan.project,
      sprints: plan.sprints,
      tasks: plan.tasks,
      reportUrl: `/api/projects/${plan.project.id}/report`
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
});

app.get('/api/projects', (req, res) => {
  const db = readDb();
  const projects = db.projects.map((project) => {
    const tasks = db.tasks.filter((task) => task.projectId === project.id);
    const sprints = db.sprints.filter((sprint) => sprint.projectId === project.id);

    return {
      ...project,
      sprintCount: sprints.length,
      taskCount: tasks.length,
      promptReadyCount: tasks.filter((task) => task.status === 'prompt_ready').length,
      prOpenedCount: tasks.filter((task) => task.status === 'pr_opened').length,
      readyForReviewCount: tasks.filter((task) => task.status === 'ready_for_review').length
    };
  });

  res.json({ projects });
});

app.get('/api/projects/:projectId', (req, res) => {
  const db = readDb();
  const bundle = findProjectBundle(db, req.params.projectId);

  if (!bundle) {
    return res.status(404).json({ message: 'Project tidak ditemukan' });
  }

  res.json(bundle);
});

app.get('/api/projects/:projectId/report', (req, res) => {
  const db = readDb();
  const bundle = findProjectBundle(db, req.params.projectId);

  if (!bundle) {
    return res.status(404).json({ message: 'Project tidak ditemukan' });
  }

  res.json({ report: buildProjectReport(bundle) });
});

app.get('/api/projects/:projectId/final-report', (req, res) => {
  const db = readDb();
  const bundle = findProjectBundle(db, req.params.projectId);

  if (!bundle) {
    return res.status(404).json({ message: 'Project tidak ditemukan' });
  }

  res.json({
    report: {
      ...buildProjectReport(bundle),
      maturity: {
        level1PlanningAutopilot: 'active',
        level2GitHubAutopilot: bundle.githubRuns.length > 0 ? 'foundation_active' : 'not_started',
        level3AutoFixCi: bundle.tasks.some((task) => task.fixAttemptCount > 0) ? 'foundation_active' : 'not_started',
        level4AutoQa: bundle.qaReports.length > 0 ? 'foundation_active' : 'not_started',
        level5ReleaseAutopilot: bundle.releasePlans.length > 0 ? 'waiting_approval_foundation' : 'not_started'
      },
      githubRuns: bundle.githubRuns,
      qaReports: bundle.qaReports,
      releasePlans: bundle.releasePlans
    }
  });
});

app.get('/api/tasks/:taskId/prompt', (req, res) => {
  const db = readDb();
  const task = db.tasks.find((item) => item.id === req.params.taskId);

  if (!task) {
    return res.status(404).json({ message: 'Task tidak ditemukan' });
  }

  res.json({ taskId: task.id, title: task.title, generatedPrompt: task.generatedPrompt });
});

app.patch('/api/tasks/:taskId/status', (req, res) => {
  const { status, errorSummary = '' } = req.body;

  if (!TASK_STATUSES.includes(status)) {
    return res.status(422).json({ message: 'Status task tidak valid' });
  }

  const db = readDb();
  const task = db.tasks.find((item) => item.id === req.params.taskId);

  if (!task) {
    return res.status(404).json({ message: 'Task tidak ditemukan' });
  }

  task.status = status;
  task.errorSummary = errorSummary || task.errorSummary;
  task.updatedAt = now();
  const runLog = pushRunLog(db, {
    taskId: task.id,
    type: 'status_changed',
    message: `Task status berubah menjadi ${status}`,
    rawLog: errorSummary
  });

  writeDb(db);
  res.json({ task, runLog });
});

app.post('/api/tasks/:taskId/github/plan', (req, res) => {
  const db = readDb();
  const context = findTaskContext(db, req.params.taskId);

  if (!context) {
    return res.status(404).json({ message: 'Task tidak ditemukan' });
  }

  const { project, task } = context;
  const githubRun = getOrCreateGithubRun(db, project, task);
  markBranchCreated({ task, githubRun });
  const runLog = pushRunLog(db, {
    taskId: task.id,
    type: 'github_branch_planned',
    message: `Branch disiapkan: ${githubRun.branchName}`,
    rawLog: JSON.stringify(githubRun, null, 2)
  });

  writeDb(db);
  res.status(201).json({ task, githubRun, runLog });
});

app.post('/api/tasks/:taskId/github/open-pr', (req, res) => {
  const db = readDb();
  const context = findTaskContext(db, req.params.taskId);

  if (!context) {
    return res.status(404).json({ message: 'Task tidak ditemukan' });
  }

  const { project, task } = context;
  const githubRun = getOrCreateGithubRun(db, project, task);
  markDraftPullRequestOpened({ task, githubRun });
  const runLog = pushRunLog(db, {
    taskId: task.id,
    type: 'draft_pr_opened',
    message: `Draft PR disiapkan: ${githubRun.pullRequestUrl}`,
    rawLog: JSON.stringify(githubRun, null, 2)
  });

  writeDb(db);
  res.status(201).json({ task, githubRun, runLog });
});

app.post('/api/tasks/:taskId/ci/result', (req, res) => {
  const { conclusion = 'success', errorSummary = '' } = req.body;

  if (!['success', 'failure'].includes(conclusion)) {
    return res.status(422).json({ message: 'conclusion harus success atau failure' });
  }

  const db = readDb();
  const context = findTaskContext(db, req.params.taskId);

  if (!context) {
    return res.status(404).json({ message: 'Task tidak ditemukan' });
  }

  const { project, task } = context;
  const githubRun = getOrCreateGithubRun(db, project, task);
  applyCiResult({ task, githubRun, conclusion, errorSummary });
  const runLog = pushRunLog(db, {
    taskId: task.id,
    type: conclusion === 'success' ? 'ci_success' : 'ci_failed',
    message: conclusion === 'success' ? 'CI hijau dan task siap review.' : 'CI merah dan butuh auto-fix.',
    rawLog: errorSummary
  });

  writeDb(db);
  res.json({ task, githubRun, runLog });
});

app.post('/api/tasks/:taskId/auto-fix', (req, res) => {
  try {
    const { rawLog = '', fixed = false } = req.body;
    const db = readDb();
    const context = findTaskContext(db, req.params.taskId);

    if (!context) {
      return res.status(404).json({ message: 'Task tidak ditemukan' });
    }

    const fixAttempt = createAutoFixAttempt({ task: context.task, rawLog, fixed });
    const runLog = pushRunLog(db, {
      taskId: context.task.id,
      type: 'auto_fix_attempt',
      message: `Auto-fix attempt ${fixAttempt.attempt}/3: ${fixAttempt.summary}`,
      rawLog
    });

    writeDb(db);
    res.status(201).json({ task: context.task, fixAttempt, runLog });
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
});

app.post('/api/tasks/:taskId/qa-report', (req, res) => {
  const db = readDb();
  const context = findTaskContext(db, req.params.taskId);

  if (!context) {
    return res.status(404).json({ message: 'Task tidak ditemukan' });
  }

  const qaReport = createQaReport({ project: context.project, task: context.task });
  db.qaReports.push(qaReport);
  const runLog = pushRunLog(db, {
    taskId: context.task.id,
    type: 'qa_report_generated',
    message: `QA report dibuat: ${qaReport.status}`,
    rawLog: JSON.stringify(qaReport, null, 2)
  });

  writeDb(db);
  res.status(201).json({ qaReport, runLog });
});

app.post('/api/projects/:projectId/release-plan', (req, res) => {
  const db = readDb();
  const bundle = findProjectBundle(db, req.params.projectId);

  if (!bundle) {
    return res.status(404).json({ message: 'Project tidak ditemukan' });
  }

  const releasePlan = createReleasePlan({ project: bundle.project });
  db.releasePlans.push(releasePlan);

  const firstTask = bundle.tasks[0];
  const approval = {
    id: `approval_${nanoid(10)}`,
    projectId: bundle.project.id,
    taskId: firstTask?.id || null,
    type: 'deploy_production',
    status: 'pending',
    requestedReason: 'Deploy production wajib approval user.',
    approvedAt: null,
    rejectedAt: null,
    createdAt: now()
  };
  db.approvals.push(approval);

  if (firstTask) {
    pushRunLog(db, {
      taskId: firstTask.id,
      type: 'release_plan_created',
      message: 'Release plan dibuat dan menunggu approval production.',
      rawLog: JSON.stringify(releasePlan, null, 2)
    });
  }

  writeDb(db);
  res.status(201).json({ releasePlan, approval });
});

app.post('/api/tasks/:taskId/approvals', (req, res) => {
  const { type = 'merge_main', requestedReason = '' } = req.body;

  if (!APPROVAL_GATE_TYPES.includes(type)) {
    return res.status(422).json({ message: 'Tipe approval tidak valid' });
  }

  const db = readDb();
  const task = db.tasks.find((item) => item.id === req.params.taskId);

  if (!task) {
    return res.status(404).json({ message: 'Task tidak ditemukan' });
  }

  const approval = {
    id: `approval_${nanoid(10)}`,
    projectId: task.projectId,
    taskId: task.id,
    type,
    status: 'pending',
    requestedReason: requestedReason || 'Approval dibutuhkan sebelum operasi berisiko dijalankan.',
    approvedAt: null,
    rejectedAt: null,
    createdAt: now()
  };

  task.status = 'waiting_approval';
  task.updatedAt = now();
  db.approvals.push(approval);
  pushRunLog(db, {
    taskId: task.id,
    type: 'approval_requested',
    message: `Approval diminta: ${type}`,
    rawLog: approval.requestedReason
  });

  writeDb(db);
  res.status(201).json({ approval, task });
});

app.patch('/api/approvals/:approvalId', (req, res) => {
  const { status } = req.body;

  if (!['approved', 'rejected'].includes(status)) {
    return res.status(422).json({ message: 'Status approval harus approved atau rejected' });
  }

  const db = readDb();
  const approval = db.approvals.find((item) => item.id === req.params.approvalId);

  if (!approval) {
    return res.status(404).json({ message: 'Approval tidak ditemukan' });
  }

  approval.status = status;
  approval.approvedAt = status === 'approved' ? now() : null;
  approval.rejectedAt = status === 'rejected' ? now() : null;

  pushRunLog(db, {
    taskId: approval.taskId,
    type: `approval_${status}`,
    message: `Approval ${status}: ${approval.type}`
  });

  writeDb(db);
  res.json({ approval });
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => {
    console.log(`AI Project Autopilot berjalan di http://localhost:${port}`);
  });
}

export default app;
