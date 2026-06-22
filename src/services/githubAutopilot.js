import { nanoid } from 'nanoid';

const riskyOperations = [
  'merge_main',
  'deploy_production',
  'major_database_change',
  'delete_file_or_data',
  'payment_or_shipping_provider_change',
  'auth_or_security_change',
  'environment_or_secret_change',
  'user_data_impacting_operation'
];

function now() {
  return new Date().toISOString();
}

function cleanText(value = '') {
  return String(value).replace(/\s+/g, ' ').trim();
}

function slugify(value = '') {
  return cleanText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 56) || 'task';
}

function normalizeRepo(repository = '') {
  const repo = cleanText(repository);
  if (!repo) return 'unknown/repository';
  return repo.replace(/^https:\/\/github.com\//, '').replace(/\.git$/, '');
}

export function buildBranchName(task, prefix = 'autopilot') {
  return `${prefix}/${slugify(task.title)}-${task.id.slice(-6)}`;
}

export function buildDraftPullRequestUrl(project, task) {
  const repo = normalizeRepo(project.repository);
  return `https://github.com/${repo}/pull/autopilot-${task.id.slice(-6)}`;
}

export function createGitHubExecutionPlan({ project, task }) {
  const branchName = task.branchName || buildBranchName(task);
  const pullRequestUrl = task.pullRequestUrl || buildDraftPullRequestUrl(project, task);

  return {
    id: `ghrun_${nanoid(10)}`,
    projectId: project.id,
    taskId: task.id,
    repository: normalizeRepo(project.repository),
    mainBranch: project.mainBranch || 'main',
    branchName,
    pullRequestUrl,
    status: 'planned',
    commitMessage: `AUTO: ${task.title}`,
    plannedFiles: [
      'implementation files based on generatedPrompt',
      'automated tests for acceptanceCriteria',
      'report or documentation updates when needed'
    ],
    safeAutomation: [
      'create_branch',
      'create_or_update_file',
      'commit_changes',
      'open_draft_pull_request',
      'read_ci_status',
      'create_report'
    ],
    approvalRequiredFor: riskyOperations,
    maxAutoFixAttempts: 3,
    createdAt: now(),
    updatedAt: now()
  };
}

export function markBranchCreated({ task, githubRun }) {
  task.branchName = githubRun.branchName;
  task.status = 'branch_created';
  task.ciStatus = 'not_started';
  task.updatedAt = now();
  githubRun.status = 'branch_created';
  githubRun.updatedAt = now();
  return { task, githubRun };
}

export function markDraftPullRequestOpened({ task, githubRun }) {
  task.branchName = githubRun.branchName;
  task.pullRequestUrl = githubRun.pullRequestUrl;
  task.status = 'pr_opened';
  task.ciStatus = 'ci_running';
  task.updatedAt = now();
  githubRun.status = 'pr_opened';
  githubRun.updatedAt = now();
  return { task, githubRun };
}

export function applyCiResult({ task, githubRun, conclusion = 'success', errorSummary = '' }) {
  const success = conclusion === 'success';
  task.ciStatus = success ? 'success' : 'failure';
  task.status = success ? 'ready_for_review' : 'ci_failed';
  task.errorSummary = success ? '' : cleanText(errorSummary || 'CI gagal dan membutuhkan analisis error.');
  task.updatedAt = now();

  githubRun.status = success ? 'ci_success' : 'ci_failed';
  githubRun.ciConclusion = task.ciStatus;
  githubRun.updatedAt = now();

  return { task, githubRun };
}

export function createAutoFixAttempt({ task, rawLog = '', fixed = false }) {
  const nextAttempt = Number(task.fixAttemptCount || 0) + 1;

  if (nextAttempt > 3) {
    const error = new Error('Batas auto-fix maksimal 3 kali sudah tercapai');
    error.statusCode = 422;
    throw error;
  }

  task.fixAttemptCount = nextAttempt;
  task.status = fixed ? 'ci_running' : (nextAttempt >= 3 ? 'failed' : 'auto_fixing');
  task.errorSummary = fixed ? '' : cleanText(rawLog || task.errorSummary || 'Auto-fix belum menyelesaikan error.');
  task.updatedAt = now();

  return {
    id: `fix_${nanoid(10)}`,
    taskId: task.id,
    attempt: nextAttempt,
    fixed: Boolean(fixed),
    summary: fixed ? 'Patch otomatis dibuat dan CI perlu dijalankan ulang.' : task.errorSummary,
    rawLog,
    createdAt: now()
  };
}

export function createQaReport({ project, task }) {
  return {
    id: `qa_${nanoid(10)}`,
    projectId: project.id,
    taskId: task.id,
    status: 'passed',
    runner: 'AUTO-4 foundation smoke model',
    checks: [
      { name: 'API health check', status: 'passed' },
      { name: 'Project dashboard renders', status: 'passed' },
      { name: 'Task prompt visible', status: 'passed' },
      { name: 'GitHub/CI widgets visible', status: 'passed' },
      { name: 'Approval gate visible', status: 'passed' }
    ],
    screenshots: [
      'dashboard-home-placeholder.png',
      'task-detail-placeholder.png'
    ],
    createdAt: now()
  };
}

export function createReleasePlan({ project }) {
  return {
    id: `release_${nanoid(10)}`,
    projectId: project.id,
    status: 'waiting_approval',
    environment: 'production',
    approvalType: 'deploy_production',
    steps: [
      'Deploy staging',
      'Run staging smoke test',
      'Request production approval',
      'Deploy production after approval',
      'Generate release note'
    ],
    releaseNote: `Release plan for ${project.name}. Production deploy requires explicit approval.`,
    createdAt: now(),
    updatedAt: now()
  };
}
