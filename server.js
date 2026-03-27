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

const hazardExamples = [
  'Limited Access / Egress', 'Excessive Noise', 'Improper / Damaged Rigging',
  'Awkward Work Position', 'Falls', 'Slippery Surfaces',
  'Caught Between', 'Fire / Burn / Welding', 'Improper / Damaged PPE',
  'Infectious Diseases', 'Flammable Material', 'Stored Energy',
  'Improper Crane / Equipment Use', 'Hazardous Chemical Exposure', 'Struck By',
  'Sharp Objects / Edges', 'Heat / Cold Exposure', 'Unsecured Loads',
  'Dropped Objects', 'Manual Lifting', 'Vehicle / Equipment Traffic',
  'Excessive Dust / Debris', 'Overexertion', 'Water / Drowning',
  'Exposed / Defective Electrical', 'Pinch Points', 'Poor Housekeeping',
  'Entanglement', 'Improper Use of Hand / Power Tools', 'Changing Weather / Environment'
];

const controlExamples = [
  'Associated Permit(s)', 'Housekeeping', 'Shields / Sloping / Etc.',
  'Communication / Coordination', 'Hearing Protection', 'Signage / Barricades',
  'Controlled Access / Egress', 'Lock Out / Tag Out', 'Spotter / Fire Watch',
  'Environmental / BMP’s', 'Lighting', 'Stretch and Flex',
  'Equipment Inspection', 'PPE', 'Tag Lines',
  'Equipment Guards', 'PFD(s) / Life Rings / Skiff', 'Tool Inspection',
  'Fall Protection', 'Proper Lifting Techniques', 'Tool Tethering',
  'Fire Extinguisher', 'Secured / Stored Cylinders', 'Whip Checks'
];

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

function readDb() {
  if (!fs.existsSync(DB_PATH)) return { dhas: [] };
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
      taskStep: (steps[i] || '').trim(),
      hazard: (hazards[i] || '').trim(),
      control: (controls[i] || '').trim()
    };
    if (row.taskStep || row.hazard || row.control) rows.push(row);
  }

  while (rows.length < 8) {
    rows.push({ taskStep: '', hazard: '', control: '' });
  }

  return rows;
}

function buildHazardSummary(rows) {
  return {
    hazardText: rows.map((row) => row.hazard).filter(Boolean).join('; '),
    controlText: rows.map((row) => row.control).filter(Boolean).join('; ')
  };
}

function buildCrewGrid(signatures) {
  const padded = [...signatures];
  while (padded.length < 10) {
    padded.push({ signerName: '', signatureData: '', signedAt: '' });
  }
  const left = [];
  const right = [];
  for (let i = 0; i < 5; i += 1) {
    left.push(padded[i]);
    right.push(padded[i + 5]);
  }
  return { left, right };
}

app.get('/', (req, res) => res.redirect('/dashboard'));

app.get('/dashboard', (req, res) => {
  const db = readDb();
  const dhas = [...db.dhas].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.render('dashboard', { dhas });
});

app.get('/foreman/new', (req, res) => {
  res.render('new', { permitOptions, trainingOptions, hazardExamples, controlExamples });
});

app.post('/foreman/new', (req, res) => {
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
    workAreaSurveyed: req.body.workAreaSurveyed || 'N/A',
    jhaReviewed: req.body.jhaReviewed || 'N/A',
    taskDescription: req.body.taskDescription || '',
    othersWorking: req.body.othersWorking || 'N/A',
    coordinatedWithOthers: req.body.coordinatedWithOthers || 'N/A',
    incidentsOrNearMisses: req.body.incidentsOrNearMisses || 'No',
    incidentsExplanation: req.body.incidentsExplanation || '',
    toolsEquipment: req.body.toolsEquipment || '',
    permits: normalizeArray(req.body.permits),
    permitsOther: req.body.permitsOther || '',
    training: normalizeArray(req.body.training),
    trainingOther: req.body.trainingOther || '',
    taskRows: normalizeRows(req.body),
    crewSignatures: [],
    foremanSignature: req.body.foremanSignature || '',
    foremanSignatureName: req.body.foremanSignatureName || req.body.foreman || '',
    reviewerSignature: req.body.reviewerSignature || '',
    reviewerSignatureName: req.body.reviewerSignatureName || '',
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
  if (!dha) return res.status(404).send('DHA not found');

  const signUrl = `${BASE_URL}/sign/${dha.signToken}`;
  const qrCodeDataUrl = await QRCode.toDataURL(signUrl, { width: 220, margin: 1 });
  const summaries = buildHazardSummary(dha.taskRows || []);
  const crewGrid = buildCrewGrid(dha.crewSignatures || []);

  res.render('show', { dha, signUrl, qrCodeDataUrl, summaries, crewGrid, hazardExamples, controlExamples });
});

app.get('/sign/:token', (req, res) => {
  const db = readDb();
  const dha = db.dhas.find((item) => item.signToken === req.params.token);
  if (!dha) return res.status(404).send('Signature page not found');
  const summaries = buildHazardSummary(dha.taskRows || []);
  res.render('sign', { dha, summaries, error: null });
});

app.post('/sign/:token', (req, res) => {
  const db = readDb();
  const dha = db.dhas.find((item) => item.signToken === req.params.token);
  if (!dha) return res.status(404).send('Signature page not found');

  if (!req.body.signerName || !req.body.signatureData) {
    const summaries = buildHazardSummary(dha.taskRows || []);
    return res.status(400).render('sign', { dha, summaries, error: 'Name and signature are required.' });
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
  if (!dha) return res.status(404).send('DHA not found');
  dha.status = 'completed';
  dha.closedAt = new Date().toISOString();
  writeDb(db);
  res.redirect(`/dhas/${dha.id}`);
});

app.listen(PORT, () => {
  console.log(`DHA app listening on port ${PORT}`);
});
