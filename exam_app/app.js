/**
 * 法律考試刷題寶典 v2 — Subject-based, cross-year random practice
 * EXAM_DATA structure:
 *   { "科目名稱": { code, questions: [{number, question, options, year, answer}], totalByYear, answeredYears } }
 */

// ============================================================
// State
// ============================================================
const subjects = Object.keys(EXAM_DATA);
let state = loadState() || defaultState();

function defaultState() {
    // Prefer a subject with answers
    const withAns = subjects.find(s => EXAM_DATA[s].answeredYears && EXAM_DATA[s].answeredYears.length > 0);
    return {
        subject: withAns || subjects[0],
        filterYear: null,        // null = all years, or specific year
        onlyWithAnswer: true,    // default: only show questions with answers
        pool: [],                // filtered question indices
        poolIndex: 0,
        answered: 0,
        correct: 0,
        wrong: 0,
        isLocked: false,
        wrongList: [],
    };
}

// ============================================================
// DOM
// ============================================================
const $ = id => document.getElementById(id);
const $badge = $('exam-badge');
const $progressFill = $('progress-fill');
const $progressLabel = $('progress-label');
const $accuracyLabel = $('accuracy-label');
const $qCard = $('q-card');
const $qNumber = $('q-number');
const $qSource = $('q-source');
const $qText = $('q-text');
const $optionsList = $('options-list');
const $answerInfo = $('answer-info');
const $resultCard = $('result-card');
const $btnNext = $('btn-next');
const $modalOverlay = $('modal-overlay');
const $examList = $('exam-list');

// ============================================================
// Pool builder — filters questions by year & answer availability
// ============================================================
function buildPool() {
    const exam = EXAM_DATA[state.subject];
    if (!exam) return;

    let indices = [];
    exam.questions.forEach((q, i) => {
        if (state.filterYear && q.year !== state.filterYear) return;
        if (state.onlyWithAnswer && !q.answer) return;
        indices.push(i);
    });
    state.pool = indices;
    state.poolIndex = 0;
}

function currentQuestion() {
    const exam = EXAM_DATA[state.subject];
    if (!exam || state.poolIndex >= state.pool.length) return null;
    return exam.questions[state.pool[state.poolIndex]];
}

// ============================================================
// Init
// ============================================================
function init() {
    if (!state.subject || !EXAM_DATA[state.subject]) {
        state.subject = subjects[0];
    }
    if (state.pool.length === 0) buildPool();
    renderQuestion();
    updateProgress();

    // Events
    $btnNext.onclick = nextQuestion;
    $('btn-select').onclick = openModal;
    $badge.onclick = openModal;
    $('modal-close').onclick = closeModal;
    $modalOverlay.onclick = e => { if (e.target === $modalOverlay) closeModal(); };
    $('btn-shuffle').onclick = shufflePool;
    $('btn-reset').onclick = resetExam;
}

// ============================================================
// Render
// ============================================================
function renderQuestion() {
    const q = currentQuestion();
    if (!q) {
        showResult();
        return;
    }

    $qCard.style.display = '';
    $resultCard.style.display = 'none';

    // Animate card
    $qCard.style.animation = 'none';
    $qCard.offsetHeight;
    $qCard.style.animation = '';

    // Badge — short subject name
    $badge.textContent = state.subject;

    // Header
    $qNumber.textContent = `Q${q.number}`;
    $qSource.textContent = `${q.year}年` + (q.answer ? ' ✦ 含答案' : '');

    // Question text
    $qText.textContent = q.question;

    // Options
    $optionsList.innerHTML = '';
    state.isLocked = false;
    $btnNext.disabled = true;
    $answerInfo.classList.remove('show');

    const labels = Object.keys(q.options).sort();
    labels.forEach(label => {
        const btn = document.createElement('button');
        btn.className = 'opt-btn';
        btn.innerHTML = `
      <span class="opt-letter">${label}</span>
      <span>${q.options[label]}</span>
    `;
        btn.onclick = () => selectOption(label, btn, q);
        $optionsList.appendChild(btn);
    });
}

function selectOption(label, btn, q) {
    if (state.isLocked) return;
    state.isLocked = true;
    state.answered++;

    const allBtns = $optionsList.querySelectorAll('.opt-btn');
    allBtns.forEach(b => b.classList.add('disabled'));

    if (!q.answer) {
        btn.style.borderColor = 'var(--secondary)';
        btn.querySelector('.opt-letter').style.background = 'var(--secondary)';
        btn.querySelector('.opt-letter').style.color = 'var(--bg)';
        $answerInfo.innerHTML = '⚠️ 此題無官方答案，無法判斷正誤';
        $answerInfo.classList.add('show');
    } else if (label === q.answer) {
        state.correct++;
        btn.classList.add('correct');
        $answerInfo.innerHTML = `✅ 正確！答案是 <strong>(${q.answer})</strong>　<span style="opacity:0.6">${q.year}年 第${q.number}題</span>`;
        $answerInfo.classList.add('show');
    } else {
        state.wrong++;
        btn.classList.add('wrong');
        allBtns.forEach(b => {
            if (b.querySelector('.opt-letter').textContent === q.answer) {
                b.classList.add('correct');
            }
        });
        $answerInfo.innerHTML = `❌ 正確答案是 <strong>(${q.answer})</strong>　<span style="opacity:0.6">${q.year}年 第${q.number}題</span>`;
        $answerInfo.classList.add('show');
        state.wrongList.push({ subject: state.subject, year: q.year, number: q.number, yours: label, correct: q.answer });
    }

    $btnNext.disabled = false;
    updateProgress();
    saveState();
}

function nextQuestion() {
    state.poolIndex++;
    renderQuestion();
    updateProgress();
    saveState();
}

function updateProgress() {
    const total = state.pool.length;
    const done = Math.min(state.poolIndex + (state.poolIndex < total ? 1 : 0), total);
    const pct = total > 0 ? Math.round((state.poolIndex / total) * 100) : 0;
    $progressFill.style.width = `${pct}%`;
    $progressLabel.textContent = `第 ${done} / ${total} 題`;

    if (state.answered > 0) {
        $accuracyLabel.textContent = `正確率 ${Math.round((state.correct / state.answered) * 100)}%`;
    } else {
        $accuracyLabel.textContent = '正確率 --';
    }
}

// ============================================================
// Result
// ============================================================
function showResult() {
    $qCard.style.display = 'none';
    $resultCard.style.display = '';
    $btnNext.disabled = true;

    const pct = state.answered > 0 ? Math.round((state.correct / state.answered) * 100) : 0;
    $('result-score').textContent = `${pct}%`;
    $('stat-total').textContent = state.answered;
    $('stat-correct').textContent = state.correct;
    $('stat-wrong').textContent = state.wrong;

    let msg = '';
    if (pct >= 80) msg = '太強了！上榜近在咫尺 🏆';
    else if (pct >= 60) msg = '穩步前進，繼續加油！💪';
    else msg = '多練幾輪就熟了 📖';
    $('result-subtitle').textContent = msg;
}

// ============================================================
// Modal — Subject selector with year filters
// ============================================================
function openModal() {
    buildExamList();
    $modalOverlay.classList.add('open');
}
function closeModal() { $modalOverlay.classList.remove('open'); }

function buildExamList() {
    $examList.innerHTML = '';

    subjects.forEach(name => {
        const data = EXAM_DATA[name];
        const totalQ = data.questions.length;
        const ansQ = data.questions.filter(q => q.answer).length;
        const years = Object.keys(data.totalByYear).sort((a, b) => b - a);
        const ansYears = data.answeredYears || [];

        // Subject card
        const card = document.createElement('div');
        card.className = 'subject-card';

        // Header
        const header = document.createElement('div');
        header.className = 'subject-header';
        header.innerHTML = `
      <div>
        <div class="exam-item-name">${name}</div>
        <div class="exam-item-meta">${totalQ} 題｜${ansQ} 題含答案｜${years.length} 個年度</div>
      </div>
    `;

        // Year chips
        const chips = document.createElement('div');
        chips.className = 'year-chips';

        // "All years" chip
        const allChip = document.createElement('button');
        allChip.className = 'year-chip' + (state.subject === name && !state.filterYear ? ' active' : '');
        allChip.textContent = `全部年度 (${totalQ})`;
        allChip.onclick = () => switchSubject(name, null, true);
        chips.appendChild(allChip);

        // "All years with answers" chip
        const ansChip = document.createElement('button');
        ansChip.className = 'year-chip ans' + (state.subject === name && !state.filterYear && state.onlyWithAnswer ? ' active' : '');
        ansChip.textContent = `僅含答案 (${ansQ})`;
        ansChip.onclick = () => switchSubject(name, null, true);
        chips.appendChild(ansChip);

        // Individual year chips
        years.forEach(yr => {
            const chip = document.createElement('button');
            const hasAns = ansYears.includes(Number(yr));
            const cnt = data.totalByYear[yr];
            chip.className = 'year-chip' + (hasAns ? ' has-ans' : '') +
                (state.subject === name && state.filterYear === Number(yr) ? ' active' : '');
            chip.textContent = `${yr}年 (${cnt})`;
            chip.onclick = () => switchSubject(name, Number(yr), false);
            chips.appendChild(chip);
        });

        card.appendChild(header);
        card.appendChild(chips);
        $examList.appendChild(card);
    });
}

function switchSubject(name, year, onlyAns) {
    state.subject = name;
    state.filterYear = year;
    state.onlyWithAnswer = onlyAns;
    state.poolIndex = 0;
    state.answered = 0;
    state.correct = 0;
    state.wrong = 0;
    state.isLocked = false;
    state.wrongList = [];
    buildPool();
    $qCard.style.display = '';
    $resultCard.style.display = 'none';
    closeModal();
    renderQuestion();
    updateProgress();
    saveState();
}

// ============================================================
// Shuffle (Fisher-Yates on the pool indices)
// ============================================================
function shufflePool() {
    const arr = state.pool;
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    state.poolIndex = 0;
    state.answered = 0;
    state.correct = 0;
    state.wrong = 0;
    state.isLocked = false;
    renderQuestion();
    updateProgress();
}

function resetExam() {
    buildPool();
    state.answered = 0;
    state.correct = 0;
    state.wrong = 0;
    state.isLocked = false;
    state.wrongList = [];
    $qCard.style.display = '';
    $resultCard.style.display = 'none';
    renderQuestion();
    updateProgress();
    saveState();
}

// ============================================================
// LocalStorage
// ============================================================
function saveState() {
    try {
        localStorage.setItem('examAppState', JSON.stringify({
            subject: state.subject,
            filterYear: state.filterYear,
            onlyWithAnswer: state.onlyWithAnswer,
            pool: state.pool,
            poolIndex: state.poolIndex,
            answered: state.answered,
            correct: state.correct,
            wrong: state.wrong,
            wrongList: state.wrongList,
        }));
    } catch (e) { }
}

function loadState() {
    try {
        const raw = localStorage.getItem('examAppState');
        if (!raw) return null;
        const saved = JSON.parse(raw);
        if (saved.subject && EXAM_DATA[saved.subject]) {
            return { ...saved, isLocked: false };
        }
    } catch (e) { }
    return null;
}

// ============================================================
// Boot
// ============================================================
init();
