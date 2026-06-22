import { nanoid } from 'nanoid';

export const TASK_STATUSES = [
  'draft',
  'planned',
  'prompt_ready',
  'branch_created',
  'coding',
  'pr_opened',
  'ci_running',
  'ci_failed',
  'auto_fixing',
  'ready_for_review',
  'waiting_approval',
  'merged',
  'blocked',
  'failed'
];

export const APPROVAL_GATE_TYPES = [
  'merge_main',
  'deploy_production',
  'major_database_change',
  'delete_file_or_data',
  'payment_or_shipping_provider_change',
  'auth_or_security_change',
  'environment_or_secret_change',
  'user_data_impacting_operation'
];

export const AUTO_1_ACTIVE_STATUSES = [
  'draft',
  'planned',
  'prompt_ready',
  'ready_for_review',
  'blocked',
  'failed'
];

const approvalPolicy = [
  'Merge ke main',
  'Deploy production',
  'Mengubah struktur database besar',
  'Menghapus file/data',
  'Mengubah payment/shipping provider',
  'Mengubah auth/security',
  'Mengubah environment/secrets',
  'Operasi yang bisa memengaruhi data user'
];

function now() {
  return new Date().toISOString();
}

function cleanText(value = '') {
  return String(value).replace(/\s+/g, ' ').trim();
}

function makeProjectName(rawName, roughBrief) {
  const name = cleanText(rawName);
  if (name) return name;

  const firstSentence = cleanText(roughBrief).split(/[.!?]/)[0];
  if (firstSentence.length >= 8) return firstSentence.slice(0, 72);
  return 'AI Project Autopilot';
}

function createProjectBrief({ name, roughBrief, repository, mainBranch }) {
  const safeRepository = cleanText(repository) || 'belum ditentukan';
  const safeMainBranch = cleanText(mainBranch) || 'main';

  return [
    `# ${name}`,
    '',
    '## Product Intent',
    'Membangun command center untuk proyek software yang mengubah ide kasar menjadi requirement, sprint plan, task teknis, generated prompt, report, dan approval gate.',
    '',
    '## Raw User Brief',
    cleanText(roughBrief),
    '',
    '## Sprint AUTO-1 Goal',
    'Membuat Planning Autopilot Foundation: project creation, generated brief, sprint plan, task list, execution prompt, dashboard, status task, report, automated test, dan GitHub Actions CI.',
    '',
    '## Repository Context',
    `- Repository: ${safeRepository}`,
    `- Main branch: ${safeMainBranch}`,
    '- Sprint AUTO-1 tidak melakukan auto-merge, deploy production, auto-fix CI, atau perubahan berisiko.',
    '',
    '## Approval Gate',
    ...approvalPolicy.map((item) => `- Wajib approval: ${item}`)
  ].join('\n');
}

function taskTemplate(project, sprint, title, description, acceptanceCriteria) {
  const id = `task_${nanoid(10)}`;

  const generatedPrompt = [
    `TASK ID: ${id}`,
    `PROJECT: ${project.name}`,
    `SPRINT: ${sprint.title}`,
    `TASK: ${title}`,
    '',
    'CONTEXT:',
    project.brief,
    '',
    'GOAL:',
    description,
    '',
    'ACCEPTANCE CRITERIA:',
    ...acceptanceCriteria.map((criteria, index) => `${index + 1}. ${criteria}`),
    '',
    'EXECUTION RULES:',
    '- Audit repository sebelum patch.',
    '- Buat perubahan kecil dan terukur.',
    '- Tambahkan/ubah automated test yang relevan.',
    '- Jalankan npm run ci sebelum PR dianggap siap.',
    '- Jangan merge ke main tanpa approval user.',
    '- Jangan deploy production tanpa approval user.',
    '- Jangan mengubah auth/security, secrets, payment, shipping, database besar, atau data user tanpa approval.',
    '',
    'EXPECTED REPORT:',
    '- File yang diubah.',
    '- Test yang dijalankan.',
    '- Status CI.',
    '- Risiko dan langkah berikutnya.'
  ].join('\n');

  return {
    id,
    projectId: project.id,
    sprintId: sprint.id,
    title,
    description,
    acceptanceCriteria,
    generatedPrompt,
    status: 'prompt_ready',
    branchName: '',
    pullRequestUrl: '',
    ciStatus: 'not_started',
    errorSummary: '',
    fixAttemptCount: 0,
    createdAt: now(),
    updatedAt: now()
  };
}

function createAuto1Tasks(project, sprint) {
  return [
    taskTemplate(
      project,
      sprint,
      'Create project from rough brief',
      'Bangun endpoint dan flow dashboard agar user bisa memasukkan ide kasar lalu sistem menyimpan project dengan brief terstruktur.',
      [
        'Project bisa dibuat dari roughBrief minimal.',
        'Project tersimpan dengan id, name, brief, status, repository, mainBranch, createdAt, dan updatedAt.',
        'Validasi error muncul saat roughBrief kosong.'
      ]
    ),
    taskTemplate(
      project,
      sprint,
      'Generate sprint plan and task list',
      'Ubah project brief menjadi sprint AUTO-1 dan daftar task teknis yang siap dieksekusi.',
      [
        'Sprint memiliki projectId, title, goal, order, status, createdAt, dan updatedAt.',
        'Task memiliki acceptanceCriteria dan status prompt_ready.',
        'Field placeholder GitHub Branch, PR, CI, Error Log, dan Auto Fix Attempt tersedia.'
      ]
    ),
    taskTemplate(
      project,
      sprint,
      'Generate execution prompt per task',
      'Buat generated prompt yang bisa dipakai untuk menjalankan task teknis secara konsisten.',
      [
        'Setiap task memiliki generatedPrompt.',
        'Prompt berisi context, goal, acceptance criteria, execution rules, dan expected report.',
        'Prompt menyebut approval gate untuk operasi berisiko.'
      ]
    ),
    taskTemplate(
      project,
      sprint,
      'Build minimal command center dashboard',
      'Tampilkan project, sprint, task, generated prompt, placeholder GitHub/CI, report, dan approval button di dashboard sederhana.',
      [
        'Dashboard menampilkan daftar project.',
        'Dashboard menampilkan sprint dan task terpilih.',
        'Dashboard menampilkan report sederhana dan tombol approval placeholder.'
      ]
    ),
    taskTemplate(
      project,
      sprint,
      'Add automated tests and CI documentation',
      'Pastikan flow utama Sprint AUTO-1 punya automated test dan dokumentasi cara menjalankan sistem.',
      [
        'Test membuat project dari rough brief.',
        'Test memeriksa generated prompt dan report.',
        'README menjelaskan API, dashboard, test, dan CI.'
      ]
    )
  ];
}

export function createPlanningAutopilotProject({ roughBrief, name = '', repository = '', mainBranch = 'main' }) {
  const cleanedBrief = cleanText(roughBrief);
  if (!cleanedBrief) {
    const error = new Error('roughBrief wajib diisi');
    error.statusCode = 422;
    throw error;
  }

  const projectName = makeProjectName(name, roughBrief);
  const timestamp = now();
  const project = {
    id: `project_${nanoid(10)}`,
    name: projectName,
    brief: '',
    status: 'planned',
    repository: cleanText(repository),
    mainBranch: cleanText(mainBranch) || 'main',
    createdAt: timestamp,
    updatedAt: timestamp
  };

  project.brief = createProjectBrief({
    name: project.name,
    roughBrief: cleanedBrief,
    repository: project.repository,
    mainBranch: project.mainBranch
  });

  const sprint = {
    id: `sprint_${nanoid(10)}`,
    projectId: project.id,
    title: 'AUTO-1: Planning Autopilot Foundation',
    goal: 'Membangun otak perencana dan prompt generator sebelum eksekusi GitHub otomatis.',
    order: 1,
    status: 'planned',
    createdAt: timestamp,
    updatedAt: timestamp
  };

  const tasks = createAuto1Tasks(project, sprint);

  const runLog = {
    id: `log_${nanoid(10)}`,
    taskId: tasks[0].id,
    type: 'planning_generated',
    message: 'Project brief, sprint plan, task list, dan execution prompt berhasil dibuat.',
    rawLog: '',
    createdAt: timestamp
  };

  return { project, sprints: [sprint], tasks, runLogs: [runLog] };
}

export function buildProjectReport({ project, sprints, tasks, runLogs, approvals }) {
  const taskStatusCounts = tasks.reduce((acc, task) => {
    acc[task.status] = (acc[task.status] || 0) + 1;
    return acc;
  }, {});

  return {
    project: {
      id: project.id,
      name: project.name,
      status: project.status,
      repository: project.repository,
      mainBranch: project.mainBranch
    },
    sprintCount: sprints.length,
    taskCount: tasks.length,
    taskStatusCounts,
    promptReadyCount: tasks.filter((task) => Boolean(task.generatedPrompt)).length,
    githubPlaceholders: tasks.map((task) => ({
      taskId: task.id,
      branchName: task.branchName,
      pullRequestUrl: task.pullRequestUrl,
      ciStatus: task.ciStatus,
      errorSummary: task.errorSummary,
      fixAttemptCount: task.fixAttemptCount
    })),
    approvalPolicy,
    approvals,
    recentLogs: runLogs.slice(-10),
    doneCriteria: [
      'Project bisa dibuat dari brief kasar',
      'Project brief otomatis tersedia',
      'Sprint plan otomatis tersedia',
      'Task list otomatis tersedia',
      'Execution prompt tersedia untuk tiap task',
      'Dashboard minimal tersedia',
      'Status task terlihat',
      'Report sederhana tersedia',
      'Automated test tersedia',
      'CI disiapkan melalui GitHub Actions'
    ]
  };
}
