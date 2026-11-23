const SPREADSHEET_ID = '1m_tK4B6kZuzNbcST1wj7vHpGBvioR0a8yCaYo9lcrdE';
const SHEET_NAME = 'Responses';
const TEST_NAME = 'SAT Reading and Writing - Simulacro 3 (Practice Test 11)';

const ANSWER_KEY = {
  module1: [
    'A', 'C', 'D', 'D', 'A', 'B', 'B', 'D', 'D',
    'C', 'B', 'D', 'A', 'D', 'B', 'A', 'D', 'D',
    'D', 'D', 'A', 'B', 'B', 'A', 'D', 'D', 'D'
  ],
  module2: [
    'C', 'C', 'C', 'D', 'B', 'B', 'B', 'A', 'B',
    'C', 'B', 'D', 'C', 'B', 'C', 'C', 'A', 'A',
    'B', 'B', 'B', 'B', 'B', 'B', 'A', 'B', 'D'
  ]
};

function doPost(e) {
  // Serialize submissions so simultaneous students cannot corrupt headers or rows.
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch (err) {
    return jsonOutput({ ok: false, error: 'busy' });
  }

  try {
    const payload = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const module1Answers = normalizeAnswers(payload.answers && payload.answers.module1);
    const module2Answers = normalizeAnswers(payload.answers && payload.answers.module2);
    const module1Score = scoreModule(module1Answers, ANSWER_KEY.module1);
    const module2Score = scoreModule(module2Answers, ANSWER_KEY.module2);
    const totalScore = module1Score + module2Score;
    const satEstimate = estimateRwScore(totalScore);
    const satEstimateRange = estimateRwScoreRange(totalScore);

    const sheet = getResponseSheet();
    const headersAdded = ensureHeadersFast(sheet);

    const rowValues = {
      'Timestamp': new Date(),
      'Test Name': payload.testName || TEST_NAME,
      'Student Name': payload.studentName || '',
      'Student Email or ID': payload.studentId || '',
      'Started At': payload.startedAt || '',
      'Submitted At': payload.submittedAt || '',
      'Module 1 Score': `${module1Score}/27`,
      'Module 2 Score': `${module2Score}/27`,
      'Total Score': `${totalScore}/54`,
      'SAT Estimate': satEstimate,
      'SAT Estimate Range': satEstimateRange
    };

    for (let i = 1; i <= 27; i += 1) {
      rowValues[`M1_Q${i}`] = module1Answers[i - 1];
      rowValues[`M1_Q${i}_CORRECT`] = ANSWER_KEY.module1[i - 1];
      rowValues[`M2_Q${i}`] = module2Answers[i - 1];
      rowValues[`M2_Q${i}_CORRECT`] = ANSWER_KEY.module2[i - 1];
    }

    appendRowByHeader(sheet, rowValues);
    if (headersAdded) formatCorrectAnswerColumns(sheet);

    return jsonOutput({ ok: true });
  } catch (err) {
    console.error(err);
    return jsonOutput({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function jsonOutput(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// Cheap check on every submission; the full migration (ensureHeaders) only runs
// when columns are missing, instead of rewriting/reformatting every row each time.
function ensureHeadersFast(sheet) {
  const headers = getHeaders(sheet);
  const expected = buildHeaders();
  const missing = expected.some(h => headers.indexOf(h) === -1);
  if (!missing) return false;
  ensureHeaders(sheet);
  return true;
}

function doGet() {
  return ContentService
    .createTextOutput('SAT Reading and Writing response endpoint is active.')
    .setMimeType(ContentService.MimeType.TEXT);
}

function getResponseSheet() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  return ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
}

function ensureHeaders(sheet) {
  if (sheet.getLastRow() === 0) {
    const headers = buildHeaders();
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    fillExistingCorrectAnswers(sheet);
    formatCorrectAnswerColumns(sheet);
    return;
  }

  ensureSatEstimateColumns(sheet);
  ensureCorrectAnswerColumns(sheet);
  fillExistingCorrectAnswers(sheet);
  formatCorrectAnswerColumns(sheet);
  sheet.setFrozenRows(1);
}

function buildHeaders() {
  const headers = [
    'Timestamp',
    'Test Name',
    'Student Name',
    'Student Email or ID',
    'Started At',
    'Submitted At',
    'Module 1 Score',
    'Module 2 Score',
    'Total Score',
    'SAT Estimate',
    'SAT Estimate Range'
  ];

  for (let i = 1; i <= 27; i += 1) {
    headers.push(`M1_Q${i}`);
    headers.push(`M1_Q${i}_CORRECT`);
  }

  for (let i = 1; i <= 27; i += 1) {
    headers.push(`M2_Q${i}`);
    headers.push(`M2_Q${i}_CORRECT`);
  }

  return headers;
}

function getHeaders(sheet) {
  const lastColumn = sheet.getLastColumn();
  if (lastColumn === 0) return [];
  return sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
}

function ensureSatEstimateColumns(sheet) {
  const headers = getHeaders(sheet);
  const hasSatEstimate = headers.indexOf('SAT Estimate') !== -1;
  const hasSatEstimateRange = headers.indexOf('SAT Estimate Range') !== -1;

  if (!hasSatEstimate && !hasSatEstimateRange) {
    const m1Q1Index = headers.indexOf('M1_Q1');
    const insertBeforeColumn = m1Q1Index === -1 ? 10 : m1Q1Index + 1;
    sheet.insertColumnsBefore(insertBeforeColumn, 2);
    sheet.getRange(1, insertBeforeColumn, 1, 2).setValues([[
      'SAT Estimate',
      'SAT Estimate Range'
    ]]);
  }
}

function ensureCorrectAnswerColumns(sheet) {
  for (let i = 27; i >= 1; i -= 1) {
    ensureCorrectAnswerColumn(sheet, `M2_Q${i}`, `M2_Q${i}_CORRECT`);
  }

  for (let i = 27; i >= 1; i -= 1) {
    ensureCorrectAnswerColumn(sheet, `M1_Q${i}`, `M1_Q${i}_CORRECT`);
  }
}

function ensureCorrectAnswerColumn(sheet, answerHeader, correctHeader) {
  const headers = getHeaders(sheet);
  const answerIndex = headers.indexOf(answerHeader);
  const correctIndex = headers.indexOf(correctHeader);

  if (answerIndex === -1 || correctIndex !== -1) return;

  const answerColumn = answerIndex + 1;
  sheet.insertColumnAfter(answerColumn);
  sheet.getRange(1, answerColumn + 1).setValue(correctHeader);
}

function fillExistingCorrectAnswers(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  for (let i = 1; i <= 27; i += 1) {
    fillCorrectAnswerColumn(sheet, `M1_Q${i}_CORRECT`, ANSWER_KEY.module1[i - 1]);
    fillCorrectAnswerColumn(sheet, `M2_Q${i}_CORRECT`, ANSWER_KEY.module2[i - 1]);
  }
}

function fillCorrectAnswerColumn(sheet, header, correctAnswer) {
  const headers = getHeaders(sheet);
  const columnIndex = headers.indexOf(header);
  if (columnIndex === -1) return;

  const column = columnIndex + 1;
  const rowCount = sheet.getLastRow() - 1;
  sheet.getRange(2, column, rowCount, 1).setValue(correctAnswer);
}

function formatCorrectAnswerColumns(sheet) {
  const headers = getHeaders(sheet);

  headers.forEach((header, index) => {
    if (!String(header).endsWith('_CORRECT')) return;

    const column = index + 1;
    sheet.setColumnWidth(column, 56);
    sheet.getRange(1, column, sheet.getMaxRows(), 1)
      .setBackground('#d9ead3')
      .setFontColor('#000000')
      .setHorizontalAlignment('center');
    sheet.getRange(1, column)
      .setBackground('#93c47d')
      .setFontWeight('bold');
  });
}

function appendRowByHeader(sheet, rowValues) {
  const headers = getHeaders(sheet);
  const row = headers.map(header => {
    return Object.prototype.hasOwnProperty.call(rowValues, header) ? rowValues[header] : '';
  });

  sheet.appendRow(row);
}

function setupSheet() {
  ensureHeaders(getResponseSheet());
}

function normalizeAnswers(answers) {
  const normalized = Array.isArray(answers) ? answers.slice(0, 27) : [];
  while (normalized.length < 27) normalized.push('');
  return normalized.map(answer => String(answer || '').trim().toUpperCase());
}

function scoreModule(studentAnswers, key) {
  return key.reduce((total, correct, index) => {
    return total + (studentAnswers[index] === correct ? 1 : 0);
  }, 0);
}

const RW_LOWER = [200, 210, 210, 210, 210, 210, 220, 220, 220, 230, 230, 240, 250, 250, 260, 270, 270, 290, 300, 310, 320, 330, 340, 340, 350, 360, 360, 370, 380, 390, 390, 400, 410, 420, 430, 440, 450, 450, 460, 470, 470, 480, 490, 500, 510, 520, 530, 540, 560, 570, 580, 590, 600, 620, 630, 640, 660, 680, 690, 700, 710, 720, 730, 740, 760, 780, 800];
const RW_UPPER = [200, 220, 220, 220, 220, 230, 240, 240, 250, 260, 270, 280, 290, 300, 310, 320, 330, 330, 340, 350, 360, 370, 380, 380, 390, 400, 400, 410, 420, 430, 430, 440, 450, 460, 470, 480, 490, 490, 500, 510, 530, 540, 550, 560, 570, 580, 590, 600, 620, 630, 640, 650, 660, 680, 690, 700, 700, 720, 730, 740, 750, 760, 770, 780, 780, 800, 800];

function scaledRaw(rawScore) {
  const clamped = Math.max(0, Math.min(54, Number(rawScore) || 0));
  return Math.round((clamped / 54) * 66);
}

function estimateRwScore(rawScore) {
  const raw = scaledRaw(rawScore);
  return Math.round((RW_LOWER[raw] + RW_UPPER[raw]) / 20) * 10;
}

function estimateRwScoreRange(rawScore) {
  const raw = scaledRaw(rawScore);
  return `${RW_LOWER[raw]}-${RW_UPPER[raw]}`;
}
