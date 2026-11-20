(function () {
    const ALLOWED_DOMAINS = ['ebpro.vercel.app'];
    const currentHost = (window.location.hostname || '').toLowerCase();
    const isAllowedDomain = ALLOWED_DOMAINS.some(
        (domain) => currentHost === domain || currentHost.endsWith('.' + domain)
    );

    if (!isAllowedDomain) {
        try {
            window.stop();
        } catch (e) {}
        if (document.documentElement) {
            document.documentElement.innerHTML = '';
        }
        if (document.body) {
            document.body.innerHTML = '';
            document.body.style.backgroundColor = '#ffffff';
        }
        throw new Error('Unauthorized domain');
    }
})();

const STORAGE_KEY = 'uppcs_gs_timer_quiz_state_v1';

let currentMode = 'practice'; // 'practice' या 'test'
let currentChapter = 0;
let userTestAnswers = {};
let isTestSubmitted = false;
let isQuizActive = false;

// 120 मिनट (2 घंटे = 7200 सेकंड) का टाइमर
const TOTAL_TEST_SECONDS = 120 * 60;
let remainingSeconds = TOTAL_TEST_SECONDS;
let timerInterval = null;
let isTimerPaused = false;

// टाइमर की जगह और किनारे के पीछे छिपाने की स्थिति
let timerPos = { left: null, top: 12 };
let dockSide = 'none'; // 'none' | 'right' | 'left'
let isDragging = false;
let dragMoved = false;
let dragStartX = 0;
let dragStartY = 0;
let initialLeft = 0;
let initialTop = 0;

document.addEventListener('DOMContentLoaded', () => {
    buildIndexList();
    if (typeof quizData !== 'undefined') {
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.max = quizData.length;
            searchInput.placeholder = `प्रश्न संख्या डालें (1-${quizData.length})...`;
        }
    }

    setupDraggableTimer();
    restoreSavedState();
});

function applyTimerPositionAndDock() {
    const timerBox = document.getElementById('exam-timer');
    const controlsRow = document.getElementById('timer-controls-row');
    if (!timerBox) return;

    timerBox.classList.remove('docked-right', 'docked-left');

    const boxWidth = timerBox.offsetWidth || 116;
    const boxHeight = timerBox.offsetHeight || 74;
    const vw = window.innerWidth || 360;
    const vh = window.innerHeight || 640;

    let topVal = (typeof timerPos.top === 'number') ? timerPos.top : 12;
    topVal = Math.max(8, Math.min(topVal, vh - boxHeight - 8));
    timerPos.top = topVal;
    timerBox.style.top = topVal + 'px';

    if (dockSide === 'right') {
        timerBox.style.left = (vw - boxWidth) + 'px';
        timerBox.style.right = 'auto';
        timerBox.classList.add('docked-right');
        if (controlsRow) controlsRow.style.visibility = 'hidden';
    } else if (dockSide === 'left') {
        timerBox.style.left = '0px';
        timerBox.style.right = 'auto';
        timerBox.classList.add('docked-left');
        if (controlsRow) controlsRow.style.visibility = 'hidden';
    } else {
        if (controlsRow) controlsRow.style.visibility = 'visible';
        if (typeof timerPos.left === 'number') {
            const clampedLeft = Math.max(8, Math.min(timerPos.left, vw - boxWidth - 8));
            timerPos.left = clampedLeft;
            timerBox.style.left = clampedLeft + 'px';
            timerBox.style.right = 'auto';
        } else {
            timerBox.style.left = 'auto';
            timerBox.style.right = '12px';
        }
    }
}

function dockTimerToEdge() {
    const timerBox = document.getElementById('exam-timer');
    if (!timerBox) return;

    const rect = timerBox.getBoundingClientRect();
    const vw = window.innerWidth || 360;
    const centerX = rect.left + rect.width / 2;

    dockSide = (centerX < vw / 2) ? 'left' : 'right';
    applyTimerPositionAndDock();
    saveStateToStorage();
}

function undockTimer() {
    if (dockSide === 'none') return;
    const timerBox = document.getElementById('exam-timer');
    const vw = window.innerWidth || 360;
    const boxWidth = timerBox ? (timerBox.offsetWidth || 116) : 116;

    if (dockSide === 'right') {
        timerPos.left = vw - boxWidth - 12;
    } else if (dockSide === 'left') {
        timerPos.left = 12;
    }
    dockSide = 'none';
    applyTimerPositionAndDock();
    saveStateToStorage();
}

function setupDraggableTimer() {
    const timerBox = document.getElementById('exam-timer');
    if (!timerBox) return;

    timerBox.addEventListener('pointerdown', (e) => {
        if (e.target.closest('button')) return;

        // यदि टाइमर किनारे के पीछे छिपा है, तो टैप/खींचने पर बाहर आ जाए
        if (dockSide !== 'none') {
            undockTimer();
            return;
        }

        const rect = timerBox.getBoundingClientRect();
        isDragging = true;
        dragMoved = false;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        initialLeft = rect.left;
        initialTop = rect.top;

        timerBox.style.left = initialLeft + 'px';
        timerBox.style.top = initialTop + 'px';
        timerBox.style.right = 'auto';
        timerBox.classList.add('dragging');
        timerBox.setPointerCapture(e.pointerId);
    });

    timerBox.addEventListener('pointermove', (e) => {
        if (!isDragging) return;

        const dx = e.clientX - dragStartX;
        const dy = e.clientY - dragStartY;
        if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
            dragMoved = true;
        }

        const vw = window.innerWidth || 360;
        const vh = window.innerHeight || 640;
        const boxWidth = timerBox.offsetWidth || 116;
        const boxHeight = timerBox.offsetHeight || 74;

        // बाएँ और दाएँ किनारे के थोड़ा पीछे ले जाने की अनुमति ताकि ज़रूरत पड़ने पर लकीर/कोना दिखे
        const minLeft = -(boxWidth - 16);
        const maxLeft = vw - 16;
        const minTop = 6;
        const maxTop = vh - boxHeight - 6;

        const nextLeft = Math.max(minLeft, Math.min(initialLeft + dx, maxLeft));
        const nextTop = Math.max(minTop, Math.min(initialTop + dy, maxTop));

        timerBox.style.left = nextLeft + 'px';
        timerBox.style.top = nextTop + 'px';
    });

    timerBox.addEventListener('pointerup', (e) => {
        if (!isDragging) return;
        isDragging = false;
        timerBox.classList.remove('dragging');
        if (timerBox.hasPointerCapture(e.pointerId)) {
            timerBox.releasePointerCapture(e.pointerId);
        }

        if (!dragMoved) return;

        const rect = timerBox.getBoundingClientRect();
        const vw = window.innerWidth || 360;
        timerPos.top = rect.top;

        // यदि काफी हद तक दाएँ या बाएँ किनारे के पीछे खिसका दिया गया है तो उसे किनारे पर डॉक कर दें
        if (rect.right > vw + 18) {
            dockSide = 'right';
        } else if (rect.left < -18) {
            dockSide = 'left';
        } else {
            dockSide = 'none';
            timerPos.left = Math.max(8, Math.min(rect.left, vw - rect.width - 8));
        }

        applyTimerPositionAndDock();
        saveStateToStorage();
    });

    window.addEventListener('resize', () => {
        if (!timerBox.classList.contains('hidden')) {
            applyTimerPositionAndDock();
        }
    });
}

function saveStateToStorage() {
    try {
        const stateObj = {
            isQuizActive: isQuizActive,
            currentMode: currentMode,
            currentChapter: currentChapter,
            userTestAnswers: userTestAnswers,
            isTestSubmitted: isTestSubmitted,
            remainingSeconds: remainingSeconds,
            isTimerPaused: isTimerPaused,
            timerPos: timerPos,
            dockSide: dockSide,
            scrollY: window.scrollY || 0
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stateObj));
    } catch (e) {
        // स्टोरेज अनुपलब्ध होने पर अनदेखा करें
    }
}

function clearSavedStorage() {
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
        // अनदेखा करें
    }
}

function restoreSavedState() {
    let savedRaw = null;
    try {
        savedRaw = localStorage.getItem(STORAGE_KEY);
    } catch (e) {
        savedRaw = null;
    }

    if (!savedRaw) {
        updateTimerDisplay();
        return;
    }

    try {
        const saved = JSON.parse(savedRaw);
        if (!saved || !saved.isQuizActive) {
            updateTimerDisplay();
            return;
        }

        if (typeof quizData === 'undefined' || !Array.isArray(quizData) || quizData.length === 0) {
            updateTimerDisplay();
            return;
        }

        isQuizActive = true;
        currentMode = (saved.currentMode === 'test') ? 'test' : 'practice';
        currentChapter = (typeof saved.currentChapter === 'number') ? saved.currentChapter : 0;
        userTestAnswers = (saved.userTestAnswers && typeof saved.userTestAnswers === 'object') ? saved.userTestAnswers : {};
        isTestSubmitted = Boolean(saved.isTestSubmitted);
        remainingSeconds = (typeof saved.remainingSeconds === 'number' && saved.remainingSeconds >= 0)
            ? saved.remainingSeconds
            : TOTAL_TEST_SECONDS;
        isTimerPaused = Boolean(saved.isTimerPaused);

        if (saved.timerPos && typeof saved.timerPos === 'object') {
            timerPos = {
                left: (typeof saved.timerPos.left === 'number') ? saved.timerPos.left : null,
                top: (typeof saved.timerPos.top === 'number') ? saved.timerPos.top : 12
            };
        }
        dockSide = (saved.dockSide === 'right' || saved.dockSide === 'left') ? saved.dockSide : 'none';

        document.getElementById('home-screen').classList.add('hidden');
        document.getElementById('quiz-screen').classList.remove('hidden');

        buildIndexList();
        updateModeUI();
        renderQuestions();
        updateTimerDisplay();

        if (isTestSubmitted && currentMode === 'test') {
            populateScorecardUI();
            document.getElementById('scorecard').style.display = 'block';
            document.getElementById('test-submit-area').classList.add('hidden');
            document.getElementById('exam-timer').classList.remove('hidden');
            const pauseBtn = document.getElementById('pause-resume-btn');
            if (pauseBtn) pauseBtn.classList.add('hidden');
            applyTimerPositionAndDock();
        } else if (currentMode === 'test') {
            document.getElementById('exam-timer').classList.remove('hidden');
            const pauseBtn = document.getElementById('pause-resume-btn');
            if (pauseBtn) pauseBtn.classList.remove('hidden');
            applyTimerPositionAndDock();
            if (!isTimerPaused) {
                runTimerInterval();
            }
        } else {
            document.getElementById('exam-timer').classList.add('hidden');
        }

        if (typeof saved.scrollY === 'number' && saved.scrollY > 0) {
            setTimeout(() => {
                window.scrollTo(0, saved.scrollY);
            }, 80);
        }
    } catch (e) {
        updateTimerDisplay();
    }
}

document.addEventListener('visibilitychange', () => {
    if (document.hidden && isQuizActive) {
        saveStateToStorage();
    }
});

window.addEventListener('pagehide', () => {
    if (isQuizActive) {
        saveStateToStorage();
    }
});

window.addEventListener('scroll', () => {
    if (isQuizActive) {
        saveStateToStorage();
    }
}, { passive: true });

function formatTime(sec) {
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const secs = sec % 60;
    return [
        String(hrs).padStart(2, '0'),
        String(mins).padStart(2, '0'),
        String(secs).padStart(2, '0')
    ].join(':');
}

function updateTimerDisplay() {
    const timerBox = document.getElementById('exam-timer');
    const displayEl = document.getElementById('timer-display');
    const statusLabel = document.getElementById('timer-status-label');
    const pauseBtn = document.getElementById('pause-resume-btn');
    if (!timerBox || !displayEl) return;

    displayEl.innerText = formatTime(remainingSeconds);

    timerBox.classList.remove('warning', 'paused');

    if (isTimerPaused && !isTestSubmitted) {
        timerBox.classList.add('paused');
        if (statusLabel) statusLabel.innerText = "टाइमर रुका हुआ है";
        if (pauseBtn) pauseBtn.innerText = "▶ जारी रखें";
    } else {
        if (statusLabel) statusLabel.innerText = "शेष समय (2 घंटे)";
        if (pauseBtn) pauseBtn.innerText = "⏸ रोकें";
        if (remainingSeconds <= 600) {
            timerBox.classList.add('warning');
        }
    }
}

function toggleTimerPause() {
    if (isTestSubmitted || currentMode !== 'test') return;

    if (!isTimerPaused) {
        isTimerPaused = true;
        stopTimer();
        updateTimerDisplay();
        saveStateToStorage();
    } else {
        isTimerPaused = false;
        updateTimerDisplay();
        runTimerInterval();
        saveStateToStorage();
    }
}

function runTimerInterval() {
    stopTimer();
    timerInterval = setInterval(() => {
        if (isTestSubmitted || currentMode !== 'test' || isTimerPaused) {
            stopTimer();
            return;
        }

        remainingSeconds--;
        updateTimerDisplay();
        saveStateToStorage();

        if (remainingSeconds <= 0) {
            remainingSeconds = 0;
            updateTimerDisplay();
            stopTimer();
            saveStateToStorage();
            alert("निर्धारित 2 घंटे (120 मिनट) का समय समाप्त हो गया है। आपका टेस्ट स्वतः सबमिट किया जा रहा है।");
            submitTest();
        }
    }, 1000);
}

function startTimer() {
    isTimerPaused = false;
    const timerBox = document.getElementById('exam-timer');
    const pauseBtn = document.getElementById('pause-resume-btn');
    if (timerBox) {
        timerBox.classList.remove('hidden');
    }
    if (pauseBtn) {
        pauseBtn.classList.remove('hidden');
    }
    updateTimerDisplay();
    applyTimerPositionAndDock();
    runTimerInterval();
}

function stopTimer() {
    if (timerInterval !== null) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

function resetTimer() {
    stopTimer();
    isTimerPaused = false;
    remainingSeconds = TOTAL_TEST_SECONDS;
    updateTimerDisplay();
}

function buildIndexList() {
    const listEl = document.getElementById('index-list');
    if (!listEl || typeof chapters === 'undefined') return;

    listEl.innerHTML = '';
    chapters.forEach((chapName, idx) => {
        const li = document.createElement('li');
        li.className = 'index-item' + (idx === currentChapter ? ' active' : '');
        li.textContent = '📖 ' + chapName;
        li.onclick = function () {
            selectChapter(idx, this);
        };
        listEl.appendChild(li);
    });
}

function startQuiz(mode) {
    if (typeof quizData === 'undefined' || !Array.isArray(quizData) || quizData.length === 0) {
        alert("कृपया पहले questions.js फाइल में प्रश्न जोड़ें।");
        return;
    }

    isQuizActive = true;
    currentMode = mode;
    document.getElementById('home-screen').classList.add('hidden');
    document.getElementById('quiz-screen').classList.remove('hidden');
    buildIndexList();
    updateModeUI();
    renderQuestions();

    if (currentMode === 'test' && !isTestSubmitted) {
        startTimer();
    } else {
        document.getElementById('exam-timer').classList.add('hidden');
    }

    saveStateToStorage();
}

function goHome() {
    resetTimer();
    isQuizActive = false;
    dockSide = 'none';
    timerPos = { left: null, top: 12 };
    clearSavedStorage();
    document.getElementById('exam-timer').classList.add('hidden');
    document.getElementById('quiz-screen').classList.add('hidden');
    document.getElementById('home-screen').classList.remove('hidden');
    resetTestState();
}

function confirmFullReset() {
    const ok = confirm("क्या आप वर्तमान टेस्ट/प्रगति को पूरी तरह रीसेट करके शुरू से (02:00:00 और बिना चुने उत्तरों के) शुरू करना चाहते हैं?");
    if (!ok) return;

    resetTestState();
    resetTimer();
    clearSavedStorage();
    updateModeUI();
    renderQuestions();

    if (currentMode === 'test') {
        const pauseBtn = document.getElementById('pause-resume-btn');
        if (pauseBtn) pauseBtn.classList.remove('hidden');
        startTimer();
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
    saveStateToStorage();
}

function toggleMode() {
    currentMode = (currentMode === 'practice') ? 'test' : 'practice';
    resetTestState();
    resetTimer();
    updateModeUI();
    renderQuestions();

    if (currentMode === 'test') {
        const pauseBtn = document.getElementById('pause-resume-btn');
        if (pauseBtn) pauseBtn.classList.remove('hidden');
        startTimer();
    } else {
        document.getElementById('exam-timer').classList.add('hidden');
    }

    saveStateToStorage();
}

function resetTestState() {
    userTestAnswers = {};
    isTestSubmitted = false;
    document.getElementById('scorecard').style.display = 'none';
}

function updateModeUI() {
    const label = document.getElementById('current-mode-label');
    const submitArea = document.getElementById('test-submit-area');
    const totalQ = (typeof quizData !== 'undefined') ? quizData.length : 0;

    if (currentMode === 'practice') {
        label.innerText = "मोड: अभ्यास (Practice)";
        submitArea.classList.add('hidden');
    } else {
        label.innerText = `मोड: टेस्ट (Test - सभी ${totalQ} प्रश्न)`;
        if (!isTestSubmitted) {
            submitArea.classList.remove('hidden');
        }
    }
}

function toggleIndex() {
    const list = document.getElementById('index-list');
    const arrow = document.getElementById('index-arrow');
    if (list.style.display === 'none') {
        list.style.display = 'block';
        arrow.innerText = '▼ क्लिक करके देखें';
    } else {
        list.style.display = 'none';
        arrow.innerText = '▶ क्लिक करके खोलें';
    }
}

function selectChapter(chapterIdx, element) {
    currentChapter = chapterIdx;
    document.querySelectorAll('.index-item').forEach(item => item.classList.remove('active'));
    if (element) element.classList.add('active');

    const chapHeading = (typeof chapters !== 'undefined' && chapters[chapterIdx])
        ? chapters[chapterIdx]
        : `भाग ${chapterIdx + 1}`;
    document.getElementById('chapter-title').innerText = "📂 " + chapHeading;
    renderQuestions();
    saveStateToStorage();
}

function renderQuestions() {
    const container = document.getElementById('questions-container');
    container.innerHTML = '';

    const filteredQuestions = (currentMode === 'test')
        ? quizData
        : quizData.filter(item => item.chapter === currentChapter);

    if (currentMode === 'test') {
        document.getElementById('chapter-title').innerText = `📝 पूर्ण टेस्ट पेपर (कुल ${quizData.length} प्रश्न)`;
    } else {
        const chapHeading = (typeof chapters !== 'undefined' && chapters[currentChapter])
            ? chapters[currentChapter]
            : `भाग ${currentChapter + 1}`;
        document.getElementById('chapter-title').innerText = "📂 " + chapHeading;
    }

    if (filteredQuestions.length === 0) {
        container.innerHTML = `<div class="info-box">इस भाग में अभी प्रश्न उपलब्ध नहीं हैं।</div>`;
        return;
    }

    filteredQuestions.forEach((qObj) => {
        const card = document.createElement('div');
        card.className = 'question-card';
        card.id = 'q-card-' + qObj.id;

        let optionsHTML = '';
        qObj.options.forEach((opt, idx) => {
            let extraClass = '';
            let disabledAttr = '';

            if (currentMode === 'test') {
                if (!isTestSubmitted) {
                    if (userTestAnswers[qObj.id] === idx) {
                        extraClass = 'selected-test';
                    }
                } else {
                    disabledAttr = 'disabled';
                    if (idx === qObj.ans) {
                        extraClass = 'correct';
                    } else if (userTestAnswers[qObj.id] === idx && idx !== qObj.ans) {
                        extraClass = 'wrong';
                    }
                }
            }

            optionsHTML += `
                <button class="option-btn ${extraClass}"
                        id="opt-${qObj.id}-${idx}"
                        onclick="handleOptionClick(${qObj.id}, ${idx})"
                        ${disabledAttr}>
                    ${opt}
                </button>
            `;
        });

        const expDisplay = (currentMode === 'test' && isTestSubmitted) ? 'block' : 'none';

        card.innerHTML = `
            <div class="question-text">प्रश्न ${qObj.id}: ${qObj.q}</div>
            <div class="options-list" id="opts-${qObj.id}">
                ${optionsHTML}
            </div>
            <div class="explanation-box" id="exp-${qObj.id}" style="display: ${expDisplay};">
                <strong>विस्तृत विवरण:</strong> ${qObj.exp}
            </div>
        `;

        container.appendChild(card);
    });
}

function handleOptionClick(qId, selectedIdx) {
    const question = quizData.find(item => item.id === qId);
    if (!question) return;

    if (currentMode === 'practice') {
        const optsContainer = document.getElementById('opts-' + qId);
        const buttons = optsContainer.querySelectorAll('.option-btn');

        buttons.forEach((btn, idx) => {
            btn.disabled = true;
            if (idx === question.ans) {
                btn.classList.add('correct');
            } else if (idx === selectedIdx && selectedIdx !== question.ans) {
                btn.classList.add('wrong');
            }
        });

        document.getElementById('exp-' + qId).style.display = 'block';

    } else if (currentMode === 'test' && !isTestSubmitted) {
        if (isTimerPaused) {
            alert("टाइमर अभी रुका हुआ है। उत्तर चुनने या बदलने के लिए पहले '▶ जारी रखें' पर क्लिक करें।");
            return;
        }

        userTestAnswers[qId] = selectedIdx;
        const optsContainer = document.getElementById('opts-' + qId);
        const buttons = optsContainer.querySelectorAll('.option-btn');

        buttons.forEach((btn, idx) => {
            btn.classList.remove('selected-test');
            if (idx === selectedIdx) {
                btn.classList.add('selected-test');
            }
        });

        saveStateToStorage();
    }
}

function populateScorecardUI() {
    let correct = 0;
    let wrong = 0;
    let unattempted = 0;

    quizData.forEach(q => {
        if (userTestAnswers[q.id] === undefined) {
            unattempted++;
        } else if (userTestAnswers[q.id] === q.ans) {
            correct++;
        } else {
            wrong++;
        }
    });

    const total = quizData.length;
    document.getElementById('total-q-count').innerText = total;
    document.getElementById('correct-count').innerText = correct;
    document.getElementById('wrong-count').innerText = wrong;
    document.getElementById('unattempted-count').innerText = unattempted;

    const percent = total > 0 ? ((correct / total) * 100).toFixed(1) : 0;
    const elapsedSec = Math.max(0, TOTAL_TEST_SECONDS - remainingSeconds);
    document.getElementById('score-message').innerText =
        `आपने ${total} में से ${correct} प्रश्न सही किए (${percent}%) | लिया गया समय: ${formatTime(elapsedSec)}`;
}

function submitTest() {
    isTestSubmitted = true;
    isTimerPaused = false;
    undockTimer();
    stopTimer();
    const pauseBtn = document.getElementById('pause-resume-btn');
    if (pauseBtn) pauseBtn.classList.add('hidden');
    updateTimerDisplay();

    populateScorecardUI();

    document.getElementById('scorecard').style.display = 'block';
    document.getElementById('test-submit-area').classList.add('hidden');

    renderQuestions();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    saveStateToStorage();
}

function resetTest() {
    resetTestState();
    resetTimer();
    clearSavedStorage();
    updateModeUI();
    renderQuestions();
    if (currentMode === 'test') {
        const pauseBtn = document.getElementById('pause-resume-btn');
        if (pauseBtn) pauseBtn.classList.remove('hidden');
        startTimer();
    }
    saveStateToStorage();
}

function searchQuestion() {
    const inputVal = parseInt(document.getElementById('search-input').value);
    if (!inputVal || inputVal < 1 || inputVal > quizData.length) {
        alert(`कृपया 1 से ${quizData.length} के बीच की सही प्रश्न संख्या डालें।`);
        return;
    }

    const targetQuestion = quizData.find(q => q.id === inputVal);
    if (!targetQuestion) return;

    if (currentMode === 'practice' && targetQuestion.chapter !== currentChapter) {
        const indexItems = document.querySelectorAll('.index-item');
        selectChapter(targetQuestion.chapter, indexItems[targetQuestion.chapter]);
    }

    setTimeout(() => {
        const targetCard = document.getElementById('q-card-' + inputVal);
        if (targetCard) {
            targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
            targetCard.style.border = "2px solid #08428c";
            setTimeout(() => {
                targetCard.style.border = "1px solid #e2e8f0";
            }, 1800);
        }
    }, 100);
}
