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

  return { project, sprints, tasks, runLogs, approvals };
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

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'ai-project-autopilot', sprint: 'AUTO-1' });
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
      promptReadyCount: tasks.filter((task) => task.status === 'prompt_ready').length
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
