

let currentMode = 'practice';
let currentChapterIndex = 0;
let userAnswers = {};
let randomizedCorrectAnswers = {};

function startMode(mode) {
    currentMode = mode;
    userAnswers = {};
    randomizedCorrectAnswers = {};
    document.getElementById('mode-selection').classList.add('hidden');
    document.getElementById('quiz-container').classList.remove('hidden');
    const submitBtn = document.getElementById('submit-btn');
    if (submitBtn) {
      submitBtn.classList.toggle('hidden', mode === 'practice');
    }
    buildIndexList();
    loadChapter(0);
}

function buildIndexList() {
    const indexList = document.getElementById('indexList');
    if (!indexList) return;
    indexList.innerHTML = '';
    
    polityIndex.forEach((chapter, idx) => {
        const li = document.createElement('li');
        li.className = `index-item ${idx === currentChapterIndex ? 'selected-index' : ''}`;
        li.innerText = chapter;
        li.onclick = () => loadChapter(idx);
        indexList.appendChild(li);
    });
}

function loadChapter(index) {
    currentChapterIndex = index;
    const banner = document.getElementById('chapterBanner');
    if (banner) {
        banner.innerText = `📁 ${polityIndex[index]}`;
    }
    const items = document.querySelectorAll('.index-item');
    items.forEach((item, idx) => {
        item.classList.toggle('selected-index', idx === index);
    });
    renderQuestions();
}

function renderQuestions() {
    const area = document.getElementById('questions-area');
    if (!area) return;
    area.innerHTML = '';

    const currentTopic = polityIndex[currentChapterIndex];
    const chapterQuestions = questions.filter(q => q.topic === currentTopic);

    if (chapterQuestions.length === 0) {
        area.innerHTML = `<p style="text-align: center; color: #777;">इस भाग में अभी कोई प्रश्न नहीं जोड़े गए हैं।</p>`;
        return;
    }

    chapterQuestions.forEach((q, index) => {
        const card = document.createElement('div');
        card.className = 'question-card';
        card.id = `q-card-${q.id}`;

        let optionsWithIndex = q.options.map((opt, idx) => ({ opt, originalIdx: idx }));

        for (let i = optionsWithIndex.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [optionsWithIndex[i], optionsWithIndex[j]] = [optionsWithIndex[j], optionsWithIndex[i]];
        }

        let newCorrectAnswerIdx = optionsWithIndex.findIndex(item => item.originalIdx === q.answer);
        
        randomizedCorrectAnswers[q.id] = newCorrectAnswerIdx;

        let optionsHtml = '';
        optionsWithIndex.forEach((item, optIdx) => {
            let selectedClass = '';
            if (userAnswers[q.id] === optIdx) {
                selectedClass = 'selected-option';
            }

            optionsHtml += `<li class="option-item ${selectedClass}" onclick="selectRandomOption(${q.id}, ${optIdx}, ${newCorrectAnswerIdx})">(${String.fromCharCode(65 + optIdx)}) ${item.opt}</li>`;
        });

        card.innerHTML = `
            <div class="question-title"> प्रश्न ${q.id}: ${q.question}</div>
            <ul class="options-list">${optionsHtml}</ul>
            <div id="exp-${q.id}" class="explanation" style="display: ${currentMode === 'practice' && userAnswers[q.id] !== undefined ? 'block' : 'none'};"><b>स्पष्टीकरण:</b> ${q.explanation}</div>
        `;
        area.appendChild(card);
    });
}

function selectRandomOption(qId, optIdx, correctIdx) {
    userAnswers[qId] = optIdx;

    const card = document.getElementById(`q-card-${qId}`);
    if (!card) return;
    const options = card.querySelectorAll('.option-item');

    if (currentMode === 'practice') {
        options.forEach((el, idx) => {
            el.classList.remove('selected-option', 'correct-option', 'incorrect-option');
            if (idx === correctIdx) {
                el.classList.add('correct-option');
            } else if (idx === optIdx && idx !== correctIdx) {
                el.classList.add('incorrect-option');
            }
        });

        const exp = document.getElementById(`exp-${qId}`);
        if (exp) exp.style.display = 'block';

    } else if (currentMode === 'test') {
        options.forEach((el, idx) => {
            el.classList.remove('selected-option');
            if (idx === optIdx) {
                el.classList.add('selected-option');
            }
        });
    }
}

function submitTest() {
    let correctCount = 0;
    let attemptedCount = 0;
    for (let qId in userAnswers) {
        if (userAnswers.hasOwnProperty(qId)) {
            attemptedCount++;
            if (userAnswers[qId] === randomizedCorrectAnswers[qId]) {
                correctCount++;
            }
        }
    }

    document.getElementById('quiz-container').classList.add('hidden');
    const resSection = document.getElementById('result-section');
    resSection.style.display = 'block';
    document.getElementById('score-text').innerText = `कुल प्रश्न: ${questions.length} | हल किए गए: ${attemptedCount} | आपके सही उत्तर: ${correctCount}`;
    document.getElementById('rank-text').innerText = `प्रदर्शन प्रतिशत: ${((correctCount / questions.length) * 100).toFixed(2)}%`;
}

function resetQuiz() {
    userAnswers = {};
    randomizedCorrectAnswers = {};
    document.getElementById('result-section').style.display = 'none';
    document.getElementById('mode-selection').classList.remove('hidden');
}

function toggleIndex() {
    const list = document.getElementById('indexList');
    if (list) {
        list.style.display = list.style.display === 'none' ? 'block' : 'none';
    }
}

function handleSearchKey(e) {
    if (e.key === 'Enter') {
        filterQuestions();
    }
}

function filterQuestions() {
    const num = document.getElementById('searchInput').value.trim();
    if (!num) return;

    const targetQ = questions.find(q => q.id == num);
    if (targetQ) {
        const chapterIdx = polityIndex.indexOf(targetQ.topic);
        if (chapterIdx !== -1) {
            loadChapter(chapterIdx);
            setTimeout(() => {
                const card = document.getElementById(`q-card-${targetQ.id}`);
                if (card) {
                    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    card.style.borderColor = '#d90429';
                    setTimeout(() => {
                        card.style.borderColor = '';
                    }, 2000);
                }
            }, 100);
        }
    } else {
        alert('इस संख्या का प्रश्न नहीं मिला!');
    }
}