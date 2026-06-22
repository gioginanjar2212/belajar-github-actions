import { resetDb } from './store.js';
import { createPlanningAutopilotProject } from './services/planner.js';

const demoPlan = createPlanningAutopilotProject({
  name: 'AI Project Autopilot Demo',
  repository: 'gioginanjar2212/belajar-github-actions',
  mainBranch: 'main',
  roughBrief: 'Buat command center yang mengubah ide kasar menjadi project brief, sprint plan, task teknis, generated prompt, report, dan approval gate. Sprint pertama fokus Planning Autopilot Foundation sebelum GitHub Autopilot.'
});

resetDb({
  projects: [demoPlan.project],
  sprints: demoPlan.sprints,
  tasks: demoPlan.tasks,
  runLogs: demoPlan.runLogs,
  approvals: []
});

console.log('Seed selesai: data AI Project Autopilot demo dibuat.');
