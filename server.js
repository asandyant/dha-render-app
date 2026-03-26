const express = require('express');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');

const app = express();
const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const DB_PATH = path.join(__dirname, 'data', 'db.json');

const permitOptions = [
  'Confined Space',
  'Cranes',
  'Environmental',
  'Excavations',
  'Hot Work',
  'MEWP / Forklifts',
  'Tools / Equipment',
  'Traffic / Public Controls',
  'Scaffolds / Ladders',
  'Rigging',
  'Other'
];

const trainingOptions = [
  'Confined Space',
  'Crane Operator',
  'Emergency Response',
  'Fall Protection',
  'Flagging',
  'Lift Director',
  'MEWP / Forklifts',
  'Rigging / Signaling',
  'Scaffold',
  'Silica / Lead',
  'Other'
];

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

function readDb() {
  if (!fs.existsSync(DB_PATH)) {
    return { dhas: [] };
  }
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}

function writeDb(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

function normalizeArray(input) {
  if (!input) return [];
  return Array.isArray(input) ? input.filter(Boolean) : [input].filter(Boolean);
}

function normalizeRows(body) {
  const steps = normalizeArray(body.taskStep);
  const hazards = normalizeArray(body.hazard);
  const controls = normalizeArray(body.control);
  const maxLen = Math.max(steps.length, hazards.length, controls.length, 1);
  const rows = [];

  for (let i = 0; i < maxLen; i += 1) {
    const row = {
      taskStep: steps[i] || '',
      hazard: hazards[i] || '',
      control: controls[i] || ''
    };
    if (row.taskStep || row.hazard || row.control) {
      rows.push(row);
    }
  }

  return rows.length ? rows : [{ taskStep: '', hazard: '', control: '' }];
}

function buildHazardSummary(rows) {
  const hazardText = rows.map((row) => row.hazard).filter(Boolean).join('; ');
  const controlText = rows.map((row) => row.control).filter(Boolean).join('; ');
  return { hazardText, controlText };
}

app.get('/', (req, res) => {
  res.redirect('/dashboard');
});

app.get('/dashboard', (req, res) => {
  const db = readDb();
  const dhas = [...db.dhas].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.render('dashboard', { dhas });
});

app.get('/foreman/new', (req, res) => {
  res.render('new', {
    permitOptions,
    trainingOptions
  });
});

app.post('/foreman/new', async (req, res) => {
  const rows = normalizeRows(req.body);
  const selectedPermits = normalizeArray(req.body.permits);
  const selectedTraining = normalizeArray(req.body.training);

  const dha = {
    id: uuidv4(),
    signToken: uuidv4(),
    projectName: req.body.projectName || '',
    projectNumber: req.body.projectNumber || '',
    date: req.body.date || '',
    time: req.body.time || '',
    superintendent: req.body.superintendent || '',
    foreman: req.body.foreman || '',
    weather: req.body.weather || '',
    workAreaLocation: req.body.workAreaLocation || '',
    workAreaSurveyed: req.body.workAreaSurveyed || '',
    jhaReviewed: req.body.jhaReviewed || '',
    taskDescription: req.body.taskDescription || '',
    coordinatedWithOthers: req.body.coordinatedWithOthers || '',
    coordinatedExplanation: req.body.coordinatedExplanation || '',
    incidentsOrNearMisses: req.body.incidentsOrNearMisses || '',
    incidentsExplanation: req.body.incidentsExplanation || '',
    toolsEquipment: req.body.toolsEquipment || '',
    safetyEquipment: req.body.safetyEquipment || '',
    permits: selectedPermits,
    permitsOther: req.body.permitsOther || '',
    training: selectedTraining,
    trainingOther: req.body.trainingOther || '',
    taskRows: rows,
    crewSignatures: [],
    foremanSignature: req.body.foremanSignature || '',
    foremanSignatureName: req.body.foremanSignatureName || req.body.foreman || '',
    createdAt: new Date().toISOString(),
    status: 'open'
  };

  const db = readDb();
  db.dhas.push(dha);
  writeDb(db);

  res.redirect(`/dhas/${dha.id}`);
});

app.get('/dhas/:id', async (req, res) => {
  const db = readDb();
  const dha = db.dhas.find((item) => item.id === req.params.id);
  if (!dha) {
    return res.status(404).send('DHA not found');
  }

  const signUrl = `${BASE_URL}/sign/${dha.signToken}`;
  const qrCodeDataUrl = await QRCode.toDataURL(signUrl, { width: 240, margin: 1 });
  const summaries = buildHazardSummary(dha.taskRows || []);

  res.render('show', {
    dha,
    signUrl,
    qrCodeDataUrl,
    summaries
  });
});

app.get('/sign/:token', (req, res) => {
  const db = readDb();
  const dha = db.dhas.find((item) => item.signToken === req.params.token);
  if (!dha) {
    return res.status(404).send('Signature page not found');
  }

  const summaries = buildHazardSummary(dha.taskRows || []);
  res.render('sign', { dha, summaries, error: null });
});

app.post('/sign/:token', (req, res) => {
  const db = readDb();
  const dha = db.dhas.find((item) => item.signToken === req.params.token);
  if (!dha) {
    return res.status(404).send('Signature page not found');
  }

  if (!req.body.signerName || !req.body.signatureData) {
    const summaries = buildHazardSummary(dha.taskRows || []);
    return res.status(400).render('sign', {
      dha,
      summaries,
      error: 'Name and signature are required.'
    });
  }

  dha.crewSignatures.push({
    id: uuidv4(),
    signerName: req.body.signerName,
    role: req.body.role || 'Crew Member',
    signatureData: req.body.signatureData,
    signedAt: new Date().toISOString()
  });

  writeDb(db);
  res.render('sign-success', { dha, signerName: req.body.signerName });
});

app.post('/dhas/:id/close', (req, res) => {
  const db = readDb();
  const dha = db.dhas.find((item) => item.id === req.params.id);
  if (!dha) {
    return res.status(404).send('DHA not found');
  }

  dha.status = 'completed';
  dha.closedAt = new Date().toISOString();
  writeDb(db);
  res.redirect(`/dhas/${dha.id}`);
});

app.listen(PORT, () => {
  console.log(`DHA app listening on port ${PORT}`);
});
