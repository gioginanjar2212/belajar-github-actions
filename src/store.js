import fs from 'fs';
import path from 'path';

const dataDir = path.join(process.cwd(), 'data');
const dbPath = path.join(dataDir, 'autopilot.json');

const emptyDb = {
  projects: [],
  sprints: [],
  tasks: [],
  runLogs: [],
  approvals: [],
  githubRuns: [],
  qaReports: [],
  releasePlans: []
};

function normalizeDb(db = {}) {
  return {
    ...emptyDb,
    ...db,
    projects: db.projects || [],
    sprints: db.sprints || [],
    tasks: db.tasks || [],
    runLogs: db.runLogs || [],
    approvals: db.approvals || [],
    githubRuns: db.githubRuns || [],
    qaReports: db.qaReports || [],
    releasePlans: db.releasePlans || []
  };
}

export function ensureDb() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, JSON.stringify(emptyDb, null, 2));
  }
}

export function readDb() {
  ensureDb();
  return normalizeDb(JSON.parse(fs.readFileSync(dbPath, 'utf8')));
}

export function writeDb(db) {
  ensureDb();
  fs.writeFileSync(dbPath, JSON.stringify(normalizeDb(db), null, 2));
  return normalizeDb(db);
}

export function resetDb(seedData = emptyDb) {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const normalized = normalizeDb(seedData);
  fs.writeFileSync(dbPath, JSON.stringify(normalized, null, 2));
  return normalized;
}

export { emptyDb };
