const express = require('express');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');

const app = express();
const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || '';
const DB_PATH = path.join(__dirname, 'data', 'db.json');
const DEFAULT_CREW_COUNT = 9;

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

const defaultDhaTemplate = {
  projectName: 'RK19-A',
  projectNumber: '',
  superintendent: 'Anthony Lovich',
  foreman: 'Shane Young',
  weather: '',
  workAreaLocation: 'Bridge work area / Safespan access area',
  workAreaSurveyed: 'Yes',
  jhaReviewed: 'Yes',
  taskDescription: 'Safespan installation',
  othersWorking: 'Yes',
  coordinatedWithOthers: 'Yes',
  incidentsOrNearMisses: 'No',
  incidentsExplanation: '',
  expectedCrewCount: DEFAULT_CREW_COUNT,
  toolsEquipment: 'Safespan components, chain falls, slings, shackles, spreader bars as needed, tag lines, swing stages, hand tools, impact guns, radios, harnesses, lanyards, hard hats, safety glasses, gloves, high-visibility vests, barricades, and required PPE.',
  permits: ['Tools / Equipment', 'Rigging'],
  training: ['Fall Protection', 'Flagging', 'Rigging / Signaling'],
  taskRows: [
    {
      taskStep: 'Hoisting Safespan pieces',
      hazard: 'Suspended loads, falling objects, struck-by hazards, shifting loads, improper or damaged rigging',
      control: 'Inspect rigging before use, use rated slings and shackles, use tag lines, keep workers clear of suspended loads, maintain clear communication between signal person, operator, and crew'
    },
    {
      taskStep: 'Staging material',
      hazard: 'Pinch points, caught-between hazards, unstable stored material, trips in the work area',
      control: 'Stage material on stable surfaces, keep hands clear while setting material, secure stored pieces, maintain housekeeping, keep walk paths open'
    },
    {
      taskStep: 'Working from elevation',
      hazard: 'Falls from elevation, dropped tools or materials, loss of footing',
      control: '100% fall protection as required, all tools tethered, secure materials, maintain three points of contact where applicable, stay aware of surroundings'
    },
    {
      taskStep: 'Working from swing stages',
      hazard: 'Falls, swing stage movement or instability, dropped objects, entanglement, improper loading',
      control: 'Inspect swing stage and fall arrest equipment before use, stay tied off, do not overload platform, secure tools and material, keep platform organized, maintain communication with crew'
    },
    {
      taskStep: 'Keeping the drop zone clear',
      hazard: 'Workers or public entering hazard area, falling objects, struck-by hazards below',
      control: 'Barricade and mark the drop zone, use flagging and signage, maintain controlled access, assign spotter when needed, stop work if zone is compromised'
    },
    {
      taskStep: 'Communication between signal person, operator, and crew',
      hazard: 'Miscommunication during lifts, unexpected movement, struck-by or pinch-point injuries',
      control: 'Use one designated signal person, review signals before work starts, maintain radio or visual communication, stop the lift if communication is lost, confirm crew is clear before moving material'
    }
  ]
};

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

function isRenderableBaseUrl(value) {
  return value && !value.includes('localhost') && !value.includes('127.0.0.1');
}

function getBaseUrl(req) {
  if (isRenderableBaseUrl(BASE_URL)) return BASE_URL.replace(/\/$/, '');
  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
  const host = req.get('host');
  return `${protocol}://${host}`;
}

function getTodayDateString() {
  const now = new Date();
  const offsetMs = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 10);
}

function makeDefaultDha(overrides = {}) {
  const now = new Date();
  const defaults = {
    ...defaultDhaTemplate,
    date: getTodayDateString(),
    time: now.toTimeString().slice(0, 5)
  };
  const baseRows = defaultDhaTemplate.taskRows.map((row) => ({ ...row }));
  return {
    ...defaults,
    ...overrides,
    taskRows: (overrides.taskRows || baseRows).map((row) => ({ ...row }))
  };
}

function createDhaRecord(payload = {}) {
  const template = makeDefaultDha(payload);
  return {
    id: uuidv4(),
    signToken: uuidv4(),
    projectName: template.projectName || '',
    projectNumber: template.projectNumber || '',
    date: template.date || '',
    time: template.time || '',
    superintendent: template.superintendent || '',
    foreman: template.foreman || '',
    weather: template.weather || '',
    workAreaLocation: template.workAreaLocation || '',
    workAreaSurveyed: template.workAreaSurveyed || 'N/A',
    jhaReviewed: template.jhaReviewed || 'N/A',
    taskDescription: template.taskDescription || '',
    othersWorking: template.othersWorking || 'N/A',
    coordinatedWithOthers: template.coordinatedWithOthers || 'N/A',
    incidentsOrNearMisses: template.incidentsOrNearMisses || 'No',
    incidentsExplanation: template.incidentsExplanation || '',
    expectedCrewCount: Number(template.expectedCrewCount) || DEFAULT_CREW_COUNT,
    toolsEquipment: template.toolsEquipment || '',
    permits: normalizeArray(template.permits),
    permitsOther: template.permitsOther || '',
    training: normalizeArray(template.training),
    trainingOther: template.trainingOther || '',
    taskRows: template.taskRows || normalizeRows(template),
    crewSignatures: template.crewSignatures || [],
    foremanSignature: template.foremanSignature || '',
    foremanSignatureName: template.foremanSignatureName || template.foreman || '',
    reviewerSignature: template.reviewerSignature || '',
    reviewerSignatureName: template.reviewerSignatureName || '',
    createdAt: new Date().toISOString(),
    status: template.status || 'open'
  };
}

function getSignatureProgress(dha) {
  const signedCount = (dha.crewSignatures || []).length;
  const expectedCrewCount = Number(dha.expectedCrewCount) || DEFAULT_CREW_COUNT;
  return {
    signedCount,
    expectedCrewCount,
    progressText: `${signedCount} of ${expectedCrewCount} workers signed`,
    allSigned: signedCount >= expectedCrewCount
  };
}

function findTodayDha(db) {
  const today = getTodayDateString();
  return db.dhas.find((item) => item.date === today && item.projectName === defaultDhaTemplate.projectName && item.foreman === defaultDhaTemplate.foreman && item.status !== 'completed');
}

app.get('/', (req, res) => res.redirect('/dashboard'));

app.get('/dashboard', (req, res) => {
  const db = readDb();
  const dhas = [...db.dhas].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.render('dashboard', { dhas, todayDate: getTodayDateString(), defaultCrewCount: DEFAULT_CREW_COUNT });
});

app.get('/foreman/start-today', (req, res) => {
  const db = readDb();
  const existing = findTodayDha(db);
  if (existing) return res.redirect(`/dhas/${existing.id}`);

  const dha = createDhaRecord();
  db.dhas.push(dha);
  writeDb(db);
  res.redirect(`/dhas/${dha.id}`);
});

app.get('/foreman/new', (req, res) => {
  const defaults = makeDefaultDha();
  res.render('new', { permitOptions, trainingOptions, hazardExamples, controlExamples, defaults, defaultCrewCount: DEFAULT_CREW_COUNT });
});

app.post('/foreman/new', (req, res) => {
  const dha = createDhaRecord({
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
    expectedCrewCount: req.body.expectedCrewCount || DEFAULT_CREW_COUNT,
    toolsEquipment: req.body.toolsEquipment || '',
    permits: normalizeArray(req.body.permits),
    permitsOther: req.body.permitsOther || '',
    training: normalizeArray(req.body.training),
    trainingOther: req.body.trainingOther || '',
    taskRows: normalizeRows(req.body),
    foremanSignature: req.body.foremanSignature || '',
    foremanSignatureName: req.body.foremanSignatureName || req.body.foreman || '',
    reviewerSignature: req.body.reviewerSignature || '',
    reviewerSignatureName: req.body.reviewerSignatureName || ''
  });

  const db = readDb();
  db.dhas.push(dha);
  writeDb(db);
  res.redirect(`/dhas/${dha.id}`);
});

app.get('/dhas/:id', async (req, res) => {
  const db = readDb();
  const dha = db.dhas.find((item) => item.id === req.params.id);
  if (!dha) return res.status(404).send('DHA not found');

  const signUrl = `${getBaseUrl(req)}/sign/${dha.signToken}`;
  const qrCodeDataUrl = await QRCode.toDataURL(signUrl, { width: 220, margin: 1 });
  const summaries = buildHazardSummary(dha.taskRows || []);
  const crewGrid = buildCrewGrid(dha.crewSignatures || []);
  const progress = getSignatureProgress(dha);

  res.render('show', {
    dha,
    signUrl,
    qrCodeDataUrl,
    summaries,
    crewGrid,
    hazardExamples,
    controlExamples,
    progress,
    printMode: req.query.print === '1'
  });
});

app.get('/dhas/:id/pdf', (req, res) => {
  res.redirect(`/dhas/${req.params.id}?print=1`);
});

app.get('/sign/:token', (req, res) => {
  const db = readDb();
  const dha = db.dhas.find((item) => item.signToken === req.params.token);
  if (!dha) return res.status(404).send('Signature page not found');
  const summaries = buildHazardSummary(dha.taskRows || []);
  const progress = getSignatureProgress(dha);
  res.render('sign', { dha, summaries, error: null, progress });
});

app.post('/sign/:token', (req, res) => {
  const db = readDb();
  const dha = db.dhas.find((item) => item.signToken === req.params.token);
  if (!dha) return res.status(404).send('Signature page not found');

  const summaries = buildHazardSummary(dha.taskRows || []);
  const progress = getSignatureProgress(dha);
  const signerName = (req.body.signerName || '').trim();
  const signatureData = req.body.signatureData || '';

  if (!signerName || !signatureData) {
    return res.status(400).render('sign', { dha, summaries, error: 'Name and signature are required.', progress });
  }

  const duplicate = (dha.crewSignatures || []).find((item) => item.signerName.trim().toLowerCase() === signerName.toLowerCase());
  if (duplicate) {
    return res.status(400).render('sign', { dha, summaries, error: 'That worker already signed this DHA.', progress });
  }

  dha.crewSignatures.push({
    id: uuidv4(),
    signerName,
    role: req.body.role || 'Crew Member',
    signatureData,
    signedAt: new Date().toISOString()
  });

  const updatedProgress = getSignatureProgress(dha);
  if (updatedProgress.allSigned && dha.status !== 'completed') {
    dha.status = 'completed';
    dha.closedAt = new Date().toISOString();
  }

  writeDb(db);
  res.render('sign-success', { dha, signerName, progress: updatedProgress });
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
