const CONFIG = {
  scriptUrl: "", // pegar aquí la URL /exec del Apps Script,
  testName: "SAT Reading and Writing Practice Test 11 (Simulacro)",
  storageKey: "sat-rw-practice-test-11",
  questionsPerModule: 27,
  moduleSeconds: 32 * 60,
  submitAttempts: 3,
};

const modules = [
  {
    id: "module1",
    label: "Module 1",
    title: "Reading and Writing",
    imagePath: "./assets/questions/module1/q",
  },
  {
    id: "module2",
    label: "Module 2",
    title: "Reading and Writing",
    imagePath: "./assets/questions/module2/q",
  },
];

const CHOICES = ["A", "B", "C", "D"];

const ANSWER_KEY = {
  module1: [
    "A", "C", "D", "D", "A", "B", "B", "D", "D",
    "C", "B", "D", "A", "D", "B", "A", "D", "D",
    "D", "D", "A", "B", "B", "A", "D", "D", "D",
  ],
  module2: [
    "C", "C", "C", "D", "B", "B", "B", "A", "B",
    "C", "B", "D", "C", "B", "C", "C", "A", "A",
    "B", "B", "B", "B", "B", "B", "A", "B", "D",
  ],
};

function emptyAnswers() {
  return {
    module1: Array(CONFIG.questionsPerModule).fill(""),
    module2: Array(CONFIG.questionsPerModule).fill(""),
  };
}

const state = {
  phase: "start", // start | test | done
  studentName: "",
  studentId: "",
  moduleIndex: 0,
  questionIndex: 0,
  deadline: 0, // epoch ms when the current module ends
  answers: emptyAnswers(),
  startedAt: "",
  submittedAt: "",
  submissionStatus: "", // "" | sending | sent | failed
};

let timerId = null;
let transitioning = false;

const els = {
  startScreen: document.getElementById("startScreen"),
  testScreen: document.getElementById("testScreen"),
  doneScreen: document.getElementById("doneScreen"),
  studentForm: document.getElementById("studentForm"),
  studentName: document.getElementById("studentName"),
  studentId: document.getElementById("studentId"),
  moduleLabel: document.getElementById("moduleLabel"),
  moduleTitle: document.getElementById("moduleTitle"),
  timerText: document.getElementById("timerText"),
  questionCounter: document.getElementById("questionCounter"),
  questionImage: document.getElementById("questionImage"),
  answerButtons: document.getElementById("answerButtons"),
  questionGrid: document.getElementById("questionGrid"),
  prevBtn: document.getElementById("prevBtn"),
  nextBtn: document.getElementById("nextBtn"),
  moduleActionBtn: document.getElementById("moduleActionBtn"),
  submissionMessage: document.getElementById("submissionMessage"),
  retrySubmitBtn: document.getElementById("retrySubmitBtn"),
  newAttemptBtn: document.getElementById("newAttemptBtn"),
  scoreSummary: document.getElementById("scoreSummary"),
  satEstimate: document.getElementById("satEstimate"),
  satEstimateRange: document.getElementById("satEstimateRange"),
  module1Score: document.getElementById("module1Score"),
  module2Score: document.getElementById("module2Score"),
  totalScore: document.getElementById("totalScore"),
};

/* ---------- persistence ---------- */

function saveState() {
  try {
    localStorage.setItem(CONFIG.storageKey, JSON.stringify(state));
  } catch (error) {
    // Storage may be unavailable (private mode); the test still works without it.
  }
}

function loadState() {
  try {
    const raw = localStorage.getItem(CONFIG.storageKey);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    if (!saved || !saved.answers || !Array.isArray(saved.answers.module1)) return null;
    return saved;
  } catch (error) {
    return null;
  }
}

/* ---------- helpers ---------- */

function padQuestion(number) {
  return String(number).padStart(2, "0");
}

function currentModule() {
  return modules[state.moduleIndex];
}

function currentAnswers() {
  return state.answers[currentModule().id];
}

function secondsLeft() {
  return Math.max(0, Math.ceil((state.deadline - Date.now()) / 1000));
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function imageSrc(module, questionNumber) {
  return `${module.imagePath}${padQuestion(questionNumber)}.png`;
}

function preloadModuleImages(module) {
  for (let i = 1; i <= CONFIG.questionsPerModule; i += 1) {
    const img = new Image();
    img.src = imageSrc(module, i);
  }
}

function showScreen(name) {
  els.startScreen.hidden = name !== "start";
  els.testScreen.hidden = name !== "test";
  els.doneScreen.hidden = name !== "done";
}

/* ---------- timer ---------- */

function renderTimer() {
  const left = secondsLeft();
  els.timerText.textContent = formatTime(left);
  els.timerText.classList.toggle("submit-warning", left <= 300);
}

function tick() {
  renderTimer();
  if (state.phase === "test" && secondsLeft() <= 0) {
    handleModuleTimeExpired();
  }
}

function startTimer() {
  clearInterval(timerId);
  tick();
  // Wall-clock based: throttled background tabs or open dialogs cannot pause the clock.
  timerId = setInterval(tick, 500);
}

function stopTimer() {
  clearInterval(timerId);
  timerId = null;
}

/* ---------- rendering ---------- */

function selectAnswer(choice) {
  if (state.phase !== "test" || transitioning) return;
  currentAnswers()[state.questionIndex] = choice;
  saveState();
  renderQuestion();
}

function renderQuestion() {
  const module = currentModule();
  const questionNumber = state.questionIndex + 1;
  const answer = currentAnswers()[state.questionIndex];

  els.moduleLabel.textContent = module.label;
  els.moduleTitle.textContent = module.title;
  els.questionCounter.textContent = `Question ${questionNumber} of ${CONFIG.questionsPerModule}`;
  const src = imageSrc(module, questionNumber);
  if (!els.questionImage.src.endsWith(src.replace("./", ""))) {
    els.questionImage.src = src;
  }
  els.questionImage.alt = `${module.label}, question ${questionNumber}`;
  els.prevBtn.disabled = state.questionIndex === 0;
  els.nextBtn.disabled = state.questionIndex === CONFIG.questionsPerModule - 1;
  els.moduleActionBtn.textContent = state.moduleIndex === 0 ? "Finish Module 1" : "Submit Test";

  els.answerButtons.innerHTML = "";
  CHOICES.forEach((choice) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `choice-button${answer === choice ? " selected" : ""}`;
    button.textContent = choice;
    button.setAttribute("aria-pressed", answer === choice ? "true" : "false");
    button.addEventListener("click", () => selectAnswer(choice));
    els.answerButtons.appendChild(button);
  });

  renderQuestionGrid();
}

function renderQuestionGrid() {
  const answers = currentAnswers();
  els.questionGrid.innerHTML = "";
  answers.forEach((answer, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = [
      "question-tile",
      answer ? "answered" : "",
      index === state.questionIndex ? "current" : "",
    ]
      .filter(Boolean)
      .join(" ");
    button.textContent = `Q ${index + 1}`;
    button.addEventListener("click", () => {
      state.questionIndex = index;
      saveState();
      renderQuestion();
    });
    els.questionGrid.appendChild(button);
  });
}

/* ---------- flow ---------- */

function unansweredCount(moduleId) {
  return state.answers[moduleId].filter((answer) => !answer).length;
}

function goToNextModule() {
  if (state.phase !== "test" || state.moduleIndex !== 0) return;
  state.moduleIndex = 1;
  state.questionIndex = 0;
  state.deadline = Date.now() + CONFIG.moduleSeconds * 1000;
  saveState();
  preloadModuleImages(currentModule());
  renderQuestion();
  startTimer();
}

function handleModuleTimeExpired() {
  if (transitioning || state.phase !== "test") return;
  transitioning = true;
  stopTimer();

  if (state.moduleIndex === 0) {
    window.alert("Time is up for Module 1. Your Module 1 answers are saved. Module 2 starts now.");
    transitioning = false;
    goToNextModule();
    return;
  }

  window.alert("Time is up. Your answers recorded so far will now be submitted.");
  transitioning = false;
  submitTest();
}

function handleModuleAction() {
  if (state.phase !== "test" || transitioning) return;
  const module = currentModule();
  const missing = unansweredCount(module.id);

  if (state.moduleIndex === 0) {
    const message =
      missing > 0
        ? `You have ${missing} unanswered question(s) in Module 1. You cannot return to Module 1 later. Continue to Module 2?`
        : "Finish Module 1 and continue to Module 2? You cannot return to Module 1 later.";
    transitioning = true;
    const ok = window.confirm(message);
    transitioning = false;
    // Time may have run out while the dialog was open.
    if (secondsLeft() <= 0) {
      handleModuleTimeExpired();
      return;
    }
    if (ok) goToNextModule();
    return;
  }

  const message =
    missing > 0
      ? `You have ${missing} unanswered question(s) in Module 2. Submit your test now?`
      : "Submit your test now?";
  transitioning = true;
  const ok = window.confirm(message);
  transitioning = false;
  if (ok || secondsLeft() <= 0) submitTest();
}

/* ---------- scoring ---------- */

function buildPayload() {
  return {
    testName: CONFIG.testName,
    studentName: state.studentName,
    studentId: state.studentId,
    startedAt: state.startedAt,
    submittedAt: state.submittedAt,
    answers: {
      module1: state.answers.module1,
      module2: state.answers.module2,
    },
  };
}

function scoreModule(studentAnswers, answerKey) {
  return answerKey.reduce(
    (score, correctAnswer, index) => score + (studentAnswers[index] === correctAnswer ? 1 : 0),
    0
  );
}

// College Board conversion table for SAT Practice Test #11 (Reading and Writing, raw 0-66).
// This simulacro uses 54 questions, so the raw score is scaled to the 66-question range first.
const RW_LOWER = [200, 210, 210, 210, 210, 210, 220, 220, 220, 230, 230, 240, 250, 250, 260, 270, 270, 290, 300, 310, 320, 330, 340, 340, 350, 360, 360, 370, 380, 390, 390, 400, 410, 420, 430, 440, 450, 450, 460, 470, 470, 480, 490, 500, 510, 520, 530, 540, 560, 570, 580, 590, 600, 620, 630, 640, 660, 680, 690, 700, 710, 720, 730, 740, 760, 780, 800];
const RW_UPPER = [200, 220, 220, 220, 220, 230, 240, 240, 250, 260, 270, 280, 290, 300, 310, 320, 330, 330, 340, 350, 360, 370, 380, 380, 390, 400, 400, 410, 420, 430, 430, 440, 450, 460, 470, 480, 490, 490, 500, 510, 530, 540, 550, 560, 570, 580, 590, 600, 620, 630, 640, 650, 660, 680, 690, 700, 700, 720, 730, 740, 750, 760, 770, 780, 780, 800, 800];

function scaledRaw(totalCorrect) {
  const maxRaw = CONFIG.questionsPerModule * 2;
  const clamped = Math.max(0, Math.min(maxRaw, totalCorrect));
  return Math.round((clamped / maxRaw) * (RW_LOWER.length - 1));
}

function estimateSatScore(totalCorrect) {
  const raw = scaledRaw(totalCorrect);
  return Math.round((RW_LOWER[raw] + RW_UPPER[raw]) / 20) * 10;
}

function estimateSatRange(totalCorrect) {
  const raw = scaledRaw(totalCorrect);
  return `${RW_LOWER[raw]}-${RW_UPPER[raw]}`;
}

function calculateScoreSummary() {
  const module1Correct = scoreModule(state.answers.module1, ANSWER_KEY.module1);
  const module2Correct = scoreModule(state.answers.module2, ANSWER_KEY.module2);
  const totalCorrect = module1Correct + module2Correct;
  const satEstimate = estimateSatScore(totalCorrect);

  return {
    module1Correct,
    module2Correct,
    totalCorrect,
    satEstimate,
    satRange: estimateSatRange(totalCorrect),
  };
}

function renderScoreSummary(summary) {
  els.scoreSummary.hidden = false;
  els.module1Score.textContent = `${summary.module1Correct}/${CONFIG.questionsPerModule}`;
  els.module2Score.textContent = `${summary.module2Correct}/${CONFIG.questionsPerModule}`;
  els.totalScore.textContent = `${summary.totalCorrect}/${CONFIG.questionsPerModule * 2}`;
  els.satEstimate.textContent = summary.satEstimate;
  els.satEstimateRange.textContent = `Estimated range: ${summary.satRange}`;
}

/* ---------- submission ---------- */

function renderSubmissionStatus() {
  const messages = {
    sending: "Sending your answers to your instructor... Do not close this page.",
    sent: "Your answers were submitted. Your instructor will review your results.",
    failed:
      "Your answers could not be sent. Check your internet connection and press \"Try again\". Do not close this page.",
  };
  if (!CONFIG.scriptUrl) {
    els.submissionMessage.textContent =
      "Submission is not connected yet. Add your Google Apps Script web app URL in app.js before sharing this test.";
  } else {
    els.submissionMessage.textContent = messages[state.submissionStatus] || messages.sending;
  }
  els.retrySubmitBtn.hidden = state.submissionStatus !== "failed";
  els.newAttemptBtn.hidden = state.submissionStatus !== "sent";
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendPayload() {
  if (!CONFIG.scriptUrl) return;
  state.submissionStatus = "sending";
  saveState();
  renderSubmissionStatus();

  const body = JSON.stringify(buildPayload());
  for (let attempt = 1; attempt <= CONFIG.submitAttempts; attempt += 1) {
    try {
      // no-cors: the response is opaque, so a resolved fetch only confirms the request left the browser.
      await fetch(CONFIG.scriptUrl, {
        method: "POST",
        mode: "no-cors",
        keepalive: true,
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body,
      });
      state.submissionStatus = "sent";
      saveState();
      renderSubmissionStatus();
      return;
    } catch (error) {
      if (attempt < CONFIG.submitAttempts) await sleep(1500 * attempt);
    }
  }
  state.submissionStatus = "failed";
  saveState();
  renderSubmissionStatus();
}

function showDoneScreen() {
  showScreen("done");
  renderScoreSummary(calculateScoreSummary());
  renderSubmissionStatus();
}

function submitTest() {
  if (state.phase === "done") return;
  stopTimer();
  state.phase = "done";
  state.submittedAt = new Date().toISOString();
  saveState();
  showDoneScreen();
  sendPayload();
}

/* ---------- events ---------- */

els.studentForm.addEventListener("submit", (event) => {
  event.preventDefault();
  state.phase = "test";
  state.studentName = els.studentName.value.trim();
  state.studentId = els.studentId.value.trim();
  state.startedAt = new Date().toISOString();
  state.moduleIndex = 0;
  state.questionIndex = 0;
  state.answers = emptyAnswers();
  state.deadline = Date.now() + CONFIG.moduleSeconds * 1000;
  saveState();
  showScreen("test");
  preloadModuleImages(currentModule());
  renderQuestion();
  startTimer();
});

els.prevBtn.addEventListener("click", () => {
  state.questionIndex = Math.max(0, state.questionIndex - 1);
  saveState();
  renderQuestion();
});

els.nextBtn.addEventListener("click", () => {
  state.questionIndex = Math.min(CONFIG.questionsPerModule - 1, state.questionIndex + 1);
  saveState();
  renderQuestion();
});

els.moduleActionBtn.addEventListener("click", handleModuleAction);

els.retrySubmitBtn.addEventListener("click", () => {
  if (state.submissionStatus === "sending") return;
  sendPayload();
});

els.newAttemptBtn.addEventListener("click", () => {
  if (!window.confirm("Clear this result from this device so another student can start the test?")) return;
  try {
    localStorage.removeItem(CONFIG.storageKey);
  } catch (error) {
    // ignore
  }
  window.location.reload();
});

els.questionImage.addEventListener("error", () => {
  els.questionImage.alt = "This question could not load. Check your connection; it will retry when you return to it.";
  els.questionImage.removeAttribute("src");
});

document.addEventListener("keydown", (event) => {
  if (state.phase !== "test") return;
  if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
  if (event.target instanceof HTMLInputElement) return;
  const key = event.key.toUpperCase();
  if (CHOICES.includes(key)) {
    selectAnswer(key);
  } else if (event.key === "ArrowRight" && !els.nextBtn.disabled) {
    els.nextBtn.click();
  } else if (event.key === "ArrowLeft" && !els.prevBtn.disabled) {
    els.prevBtn.click();
  }
});

window.addEventListener("beforeunload", (event) => {
  const unsent = state.phase === "done" && state.submissionStatus !== "sent";
  if (state.phase === "test" || unsent) {
    event.preventDefault();
    event.returnValue = "";
  }
});

/* ---------- resume after reload ---------- */

(function resume() {
  const saved = loadState();
  if (!saved || saved.phase === "start") return;
  Object.assign(state, saved);

  if (state.phase === "test") {
    showScreen("test");
    preloadModuleImages(currentModule());
    renderQuestion();
    startTimer(); // if the deadline passed while the page was closed, this advances/submits immediately
    return;
  }

  if (state.phase === "done") {
    showDoneScreen();
    if (state.submissionStatus !== "sent") sendPayload();
  }
})();
