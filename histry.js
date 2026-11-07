function shuffleOptionsAndAnswers() {
  questions.forEach(q => {
    let combined = q.options.map((opt, index) => {
      return { optionText: opt, originalIndex: index };
    });

    for (let i = combined.length - 1; i > 0; i--) {
      let j = Math.floor(Math.random() * (i + 1));
      [combined[i], combined[j]] = [combined[j], combined[i]];
    }

    q.options = combined.map(item => item.optionText);
    q.answer = combined.findIndex(item => item.originalIndex === q.answer);
  });
}
    shuffleOptionsAndAnswers();

        let currentMode = '';
    let userAnswers = {};
    let selectedTopic = "";

    function loadIndexUI() {
        const listEl = document.getElementById('indexList');
        listEl.innerHTML = '';
        historyIndex.forEach((item) => {
            let isSelected = (selectedTopic === item) ? 'selected-index' : '';
            listEl.innerHTML += `<li class="index-item ${isSelected}" onclick="selectTopicFromIndex('${item}')">📖 ${item}</li>`;
        });
    }

    function toggleIndex() {
        const list = document.getElementById('indexList');
        list.style.display = list.style.display === 'none' ? 'block' : 'none';
    }

    function selectTopicFromIndex(topicName) {
        selectedTopic = topicName;
        loadIndexUI();
        
        document.getElementById('chapterBanner').innerText = "📂 " + selectedTopic;
        document.getElementById('searchInput').value = "";
        
        let chapterQuestions = questions.filter(q => q.topic.toLowerCase() === selectedTopic.toLowerCase());
        renderQuestions(chapterQuestions);
        window.scrollTo({ top: 150, behavior: 'smooth' });
    }

    function startMode(mode) {
        currentMode = mode;
        userAnswers = {};
        document.getElementById('mode-selection').style.display = 'none';
        document.getElementById('quiz-container').classList.remove('hidden');
        document.getElementById('result-section').style.display = 'none';
        document.getElementById('searchInput').value = '';
        
        selectedTopic = historyIndex[0]; 
        loadIndexUI();

        if (mode === 'test') {
            document.getElementById('submit-btn').classList.remove('hidden');
        } else {
            document.getElementById('submit-btn').classList.add('hidden');
        }

        document.getElementById('chapterBanner').innerText = "📂 " + selectedTopic;
        let chapterQuestions = questions.filter(q => q.topic.toLowerCase() === selectedTopic.toLowerCase());
        renderQuestions(chapterQuestions);
    }

    function renderQuestions(dataToRender) {
        const area = document.getElementById('questions-area');
        area.innerHTML = '';

        if(dataToRender.length === 0) {
            area.innerHTML = '<p style="text-align:center; color:#666; font-size:16px;">इस संख्या से संबंधित कोई प्रश्न नहीं मिला। कृपया सही प्रश्न संख्या डालें।</p>';
            return;
        }

        let displayIndex = 1;
        dataToRender.forEach((q) => {
            const qIndex = questions.findIndex(item => item === q);
            
                        let optionsHTML = '';
            const letters = ["A", "B", "C", "D"]; // A, B, C, D का एरे
            q.options.forEach((opt, oIndex) => {
                let extraClass = '';
                if (userAnswers[qIndex] === oIndex) {
                    extraClass = 'selected-option';
                }
                // यहाँ हमने विकल्प के आगे अपने आप (A), (B) आदि जोड़ दिया है
                optionsHTML += `<li class="option-item ${extraClass}" id="q${qIndex}_opt${oIndex}" onclick="handleOptionClick(${qIndex}, ${oIndex})">(${letters[oIndex]}) ${opt}</li>`;
            });


            area.innerHTML += `
                <div class="question-card" id="q-card-${qIndex}">
                    <div class="question-title">प्रश्न ${q.localNum || displayIndex}: ${q.question}</div>
                    <ul class="options-list">${optionsHTML}</ul>
                    <div class="explanation" id="exp-${qIndex}"><strong>विस्तृत विवरण:</strong> ${q.explanation}</div>
                </div>
            `;
            displayIndex++;
        });
    }

    function filterQuestions() {
        if (!selectedTopic) {
            alert("कृपया पहले ऊपर सूची (इंडेक्स) से कोई भाग (चैप्टर) चुनें!");
            return;
        }

        let qNumStr = document.getElementById('searchInput').value.trim();
        let chapterQuestions = questions.filter(q => q.topic.toLowerCase() === selectedTopic.toLowerCase());

        if (qNumStr === "") {
            renderQuestions(chapterQuestions);
            return;
        }

        let qNum = parseInt(qNumStr);

        if (isNaN(qNum) || qNum < 1 || qNum > chapterQuestions.length) {
            document.getElementById('questions-area').innerHTML = `<p style="text-align:center; color:#d90429; font-size:16px;">अमान्य प्रश्न संख्या! इस भाग में कुल ${chapterQuestions.length} प्रश्न हैं। कृपया 1 से ${chapterQuestions.length} के बीच की संख्या डालें।</p>`;
            return;
        }

        let targetQuestion = chapterQuestions[qNum - 1];
        targetQuestion.localNum = qNum;

        renderQuestions([targetQuestion]);
        window.scrollTo({ top: 300, behavior: 'smooth' });
    }

    function handleSearchKey(event) {
        if (event.key === 'Enter') {
            filterQuestions();
        }
    }

    function handleOptionClick(qIndex, oIndex) {
        userAnswers[qIndex] = oIndex;

        if (currentMode === 'practice') {
            const q = questions[qIndex];
            const options = document.querySelectorAll(`#q-card-${qIndex} .option-item`);
            
            options.forEach((opt, idx) => {
                opt.style.pointerEvents = 'none';
                if (idx === q.answer) {
                    opt.classList.add('correct-option');
                } else if (idx === oIndex) {
                    opt.classList.add('incorrect-option');
                }
            });

            document.getElementById(`exp-${qIndex}`).style.display = 'block';
        } else {
            const options = document.querySelectorAll(`#q-card-${qIndex} .option-item`);
            options.forEach((opt, idx) => {
                if (idx === oIndex) {
                    opt.classList.add('selected-option');
                } else {
                    opt.classList.remove('selected-option');
                }
            });
        }
    }

    function submitTest() {
        let score = 0;
        document.getElementById('submit-btn').classList.add('hidden');

        questions.forEach((q, qIndex) => {
            const card = document.getElementById(`q-card-${qIndex}`);
            if (!card) return;
            
            const options = document.querySelectorAll(`#q-card-${qIndex} .option-item`);
            const userAns = userAnswers[qIndex];
            const explanationDiv = document.getElementById(`exp-${qIndex}`);

            explanationDiv.style.display = 'block';
            options.forEach(opt => opt.style.pointerEvents = 'none');

            if (userAns === q.answer) {
                score++;
                options[q.answer].classList.add('correct-option');
            } else {
                card.classList.add('incorrect-question-card');
                if (userAns !== undefined) {
                    options[userAns].classList.add('incorrect-option');
                }
                options[q.answer].classList.add('correct-option');
            }
        });

        document.getElementById('result-section').style.display = 'block';
        let percentage = (score / questions.length) * 100;
        let mockRank = percentage >= 80 ? "1 (टॉपर्स में)" : percentage >= 50 ? "3" : "5+";

        document.getElementById('score-text').innerText = `आपका कुल स्कोर: ${score} / ${questions.length}`;
     document.getElementById('result-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
 }

    function resetQuiz() {
        document.getElementById('mode-selection').style.display = 'flex';
        document.getElementById('quiz-container').classList.add('hidden');
        document.getElementById('result-section').style.display = 'none';
    }
