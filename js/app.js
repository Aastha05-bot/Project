/* =========================================================
   APP STATE — populated once topics.json has loaded (see boot() below)
========================================================= */
let TOPICS = [];
const progress = {};

/* =========================================================
   TYPEWRITER ENGINE
========================================================= */
function wait(ms) { return new Promise(r => setTimeout(r, ms)); }
function typeWords(el, text, speed) {
    speed = speed || 80;
    return new Promise(resolve => {
        el.textContent = '';
        el.classList.add('typing-cursor');
        const words = text.split(' ');
        let i = 0;
        (function step() {
            el.textContent += (i > 0 ? ' ' : '') + words[i];
            i++;
            if (i < words.length) { setTimeout(step, speed); }
            else { el.classList.remove('typing-cursor'); resolve(); }
        })();
    });
}

/* =========================================================
   MAP VIEW
========================================================= */
const topicGrid = document.getElementById('topicGrid');

function renderMap() {
    topicGrid.innerHTML = '';
    TOPICS.forEach((topic, i) => {
        const state = progress[topic.id];
        const row = document.createElement('div');
        row.className = 'lesson-row';
        row.style.background = topic.color;
        row.innerHTML = `
      <span class="row-name">${i + 1}. ${topic.title}</span>
      <span class="row-status ${state === 'done' ? 'done' : ''}">${state === 'done' ? 'Completed' : '0%'}</span>
    `;
        row.addEventListener('click', () => openTopic(topic.id));
        topicGrid.appendChild(row);
    });
}

/* =========================================================
   TOPIC VIEW
========================================================= */
const mapView = document.getElementById('mapView');
const topicView = document.getElementById('topicView');
const topicContent = document.getElementById('topicContent');
document.getElementById('backBtn').addEventListener('click', () => {
    topicView.hidden = true;
    mapView.hidden = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
});

function openTopic(id) {
    const topic = TOPICS.find(t => t.id === id);
    mapView.hidden = true;
    topicView.hidden = false;
    window.scrollTo(0, 0);

    topicContent.innerHTML = `
    <div class="topic-intro">
      <h2>${topic.title}</h2>
      <p class="story-title">${topic.storyTitle}</p>
      <p class="topic-intro-tagline">${topic.tagline}</p>
      <button class="primary-btn" id="startLessonBtn" style="background:${topic.color}">Start Lesson</button>
    </div>
  `;
    document.getElementById('startLessonBtn').addEventListener('click', () => startStory(topic));
}

function startStory(topic) {
    topicContent.innerHTML = `
    <div id="storyShell" class="story-shell">
      <div class="scene-stage" id="sceneStage"></div>
      <div class="scene-nav" id="sceneNav">
        <button class="scene-arrow" id="prevArrow" aria-label="Previous scene" disabled>←</button>
        <div class="scene-dots" id="sceneDots"></div>
        <button class="scene-arrow" id="nextArrow" aria-label="Next scene" disabled>→</button>
      </div>
    </div>
    <div class="activity-shell" id="activityShell" hidden></div>
    <div id="completeSlot" class="complete-slot"></div>
  `;
    window.scrollTo({ top: 0, behavior: 'smooth' });

    const stage = document.getElementById('sceneStage');
    const prevArrow = document.getElementById('prevArrow');
    const nextArrow = document.getElementById('nextArrow');
    const sceneNav = document.getElementById('sceneNav');
    const dotsEl = document.getElementById('sceneDots');
    dotsEl.innerHTML = topic.scenes.map((_, i) => `<span class="scene-dot${i === 0 ? ' active' : ''}"></span>`).join('');
    const dots = [...dotsEl.querySelectorAll('.scene-dot')];

    const played = new Set();
    let current = 0;
    let activityStarted = false;

    function buildSceneEl(scene) {
        const el = document.createElement('div');
        el.className = 'story-scene';
        el.innerHTML = `
      <p class="narration"></p>
      <div class="convo">
        ${scene.convo.map(line => `
          <div class="line ${line.who === 'b' ? 'reverse' : ''}">
            <div class="speaker">
              <span class="speaker-name">${topic.chars[line.who] ? CHAR_INFO[topic.chars[line.who]].name : ''}</span>
              ${avatarHTML(topic.chars[line.who])}
            </div>
            <div class="bubble"></div>
          </div>
        `).join('')}
      </div>
    `;
        el.querySelector('.narration').dataset.text = scene.narration;
        const bubbles = el.querySelectorAll('.bubble');
        bubbles.forEach((b, j) => { b.dataset.text = scene.convo[j].text; });
        return el;
    }

    // dir: 1 = advancing (new scene slides in from the right), -1 = going back (from the left), 0 = first paint
    function showScene(index, dir) {
        const outgoing = stage.firstElementChild;
        const el = buildSceneEl(topic.scenes[index]);

        if (outgoing) {
            if (dir !== 0) {
                outgoing.classList.add(dir > 0 ? 'scene-exit-left' : 'scene-exit-right');
                setTimeout(() => outgoing.remove(), 320);
            } else {
                outgoing.remove();
            }
        }

        stage.appendChild(el);
        if (dir !== 0) {
            el.classList.add(dir > 0 ? 'scene-enter-right' : 'scene-enter-left');
            requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('scene-enter-active')));
        }

        dots.forEach((d, i) => d.classList.toggle('active', i === index));
        prevArrow.disabled = index === 0;

        if (played.has(index)) {
            // already seen this one: show it fully right away, no retyping
            const narration = el.querySelector('.narration');
            narration.textContent = narration.dataset.text;
            narration.classList.add('visible');
            el.querySelectorAll('.line').forEach(line => {
                line.classList.add('visible');
                line.querySelector('.bubble').textContent = line.querySelector('.bubble').dataset.text;
            });
            nextArrow.disabled = false;
            return;
        }

        played.add(index);
        nextArrow.disabled = true;
        playSceneContent(el).then(() => {
            if (!activityStarted && !sceneNav.hidden) {
                nextArrow.disabled = false;
                nextArrow.style.visibility = 'visible';
            }
        });
    }

    prevArrow.addEventListener('click', () => { if (current > 0) { current--; showScene(current, -1); } });
    nextArrow.addEventListener('click', () => {
        if (activityStarted) return;

        if (current < topic.scenes.length - 1) {
            current++;
            showScene(current, 1);
            return;
        }

        activityStarted = true;
        nextArrow.disabled = true;
        sceneNav.hidden = true;
        const storyShell = document.getElementById('storyShell');
        if (storyShell) storyShell.hidden = true;
        buildActivity(topic);
    });

    showScene(0, 0);
}

function playSceneContent(sceneEl) {
    const narration = sceneEl.querySelector('.narration');
    const lines = [...sceneEl.querySelectorAll('.line')];
    return (async () => {
        if (narration && narration.dataset.text) {
            narration.textContent = narration.dataset.text;
            void narration.offsetWidth; // force layout so the fade-in transition plays
            narration.classList.add('visible');
            await wait(300);
        }
        for (const line of lines) {
            line.classList.add('visible');
            const bubble = line.querySelector('.bubble');
            await wait(100);
            await typeWords(bubble, bubble.dataset.text, 55);
            await wait(200);
        }
    })();
}

/* =========================================================
   ACTIVITIES
========================================================= */
function buildActivity(topic) {
    const shell = document.getElementById('activityShell');
    const a = topic.activity;
    const counter = a.type === 'quiz' ? `<span class="quiz-counter" id="quizCounter">0/${a.questions.length}</span>` : '';
    shell.innerHTML = `<div class="a-head"><h3>${a.title}</h3>${counter}</div><p class="a-sub">${a.sub}</p><div id="aBody"></div>`;
    shell.hidden = false;
    shell.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const body = document.getElementById('aBody');

    if (a.type === 'quiz') buildQuiz(body, topic);
    else if (a.type === 'password-builder') buildPasswordBuilder(body, topic);
    else if (a.type === 'fill-blank') buildFillBlank(body, topic);
}

function markComplete(topic) {
    progress[topic.id] = 'done';
    const idx = TOPICS.findIndex(t => t.id === topic.id);
    const next = TOPICS[idx + 1];

    const shell = document.getElementById('activityShell');
    if (shell) shell.hidden = true;

    fireConfetti();

    const slot = document.getElementById('completeSlot');
    slot.classList.add('complete-slot');
    slot.innerHTML = `
    <div class="complete-card">
      <div class="badge">🎉</div>
      <h3>Congratulations!</h3>
      <p>You have completed your lesson${next ? '' : ' and the whole course'}! Keep going and keep learning safe habits online.</p>
      <button class="primary-btn" id="nextLessonBtn" style="background:${topic.color}">
        ${next ? 'Start next lesson' : 'Back to Map'}
      </button>
    </div>
  `;
    document.getElementById('nextLessonBtn').addEventListener('click', () => {
        renderMap();
        if (next) openTopic(next.id);
        else { topicView.hidden = true; mapView.hidden = false; window.scrollTo({ top: 0, behavior: 'smooth' }); }
    });
    renderMap();
    slot.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/* ---- confetti ---- */
function fireConfetti() {
    const colors = ['#E8604A', '#F0B94A', '#8FC9A0', '#82BEDD', '#9B6FB5'];
    for (let i = 0; i < 140; i++) {
        const piece = document.createElement('div');
        piece.className = 'confetti-piece';
        const size = 6 + Math.random() * 8;
        piece.style.width = size + 'px';
        piece.style.height = (size * 0.42) + 'px';
        piece.style.left = Math.random() * 100 + 'vw';
        piece.style.background = colors[Math.floor(Math.random() * colors.length)];
        const duration = 2.4 + Math.random() * 1.8;
        piece.style.animationDuration = duration + 's';
        piece.style.animationDelay = (Math.random() * 0.35) + 's';
        document.body.appendChild(piece);
        setTimeout(() => piece.remove(), (duration + 0.8) * 1000);
    }
}

/* ---- quiz: one question revealed at a time ---- */
function buildQuiz(body, topic) {
    const a = topic.activity;
    let score = 0;
    let qi = 0;

    body.innerHTML = `<div class="quiz-stage" id="quizStage"></div><div class="action-row"><span class="a-feedback" id="quizFeedback"></span></div>`;
    const stage = document.getElementById('quizStage');

    function renderQuestion(animate) {
        const q = a.questions[qi];
        const outgoing = stage.querySelector('.quiz-q');
        if (outgoing) outgoing.remove();

        const qEl = document.createElement('div');
        qEl.className = 'quiz-q';
        qEl.innerHTML = `
      <p>${qi + 1}. ${q.q}</p>
      <div class="quiz-opts">
        ${q.options.map((opt, oi) => `<button class="quiz-opt" data-opt="${oi}">${opt}</button>`).join('')}
      </div>
    `;
        if (animate) qEl.classList.add('quiz-q-enter');
        stage.appendChild(qEl);
        if (animate) {
            requestAnimationFrame(() => requestAnimationFrame(() => qEl.classList.add('quiz-q-enter-active')));
        }

        qEl.querySelectorAll('.quiz-opt').forEach(btn => {
            btn.addEventListener('click', () => {
                const oi = parseInt(btn.dataset.opt, 10);
                const allOpts = qEl.querySelectorAll('.quiz-opt');
                allOpts.forEach(b => b.disabled = true);
                if (oi === q.correct) {
                    btn.classList.add('correct');
                    score++;
                } else {
                    btn.classList.add('incorrect');
                    allOpts[q.correct].classList.add('correct');
                }
                setTimeout(() => {
                    qi++;
                    const counter = document.getElementById('quizCounter');
                    if (counter) counter.textContent = `${qi}/${a.questions.length}`;
                    if (qi < a.questions.length) {
                        renderQuestion(true);
                    } else {
                        const fb = document.getElementById('quizFeedback');
                        fb.textContent = `You scored ${score}/${a.questions.length}.`;
                        fb.className = 'a-feedback good';
                        markComplete(topic);
                    }
                }, 750);
            });
        });
    }

    renderQuestion(false);
}

/* ---- small helper: shuffle an array in place, and return it for convenience ---- */
function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

/* ---- password builder: learner types their own password ---- */
function buildPasswordBuilder(body, topic) {
    body.innerHTML = `
    <div class="pw-card">
      <div class="pw-state-row">
        <span class="pw-state-badge" id="pwStateBadge">Weak</span>
      </div>
      <input type="text" class="pw-input" id="pwInput" placeholder="Enter password" autocomplete="off" spellcheck="false">
      <div class="pw-meter"><div class="pw-meter-fill" id="pwMeterFill"></div></div>
      <p class="pw-hint">Password should be at least 8 characters and should contain a number, a symbol, and uppercase and lowercase letters.</p>
    </div>
    <ul class="pw-rules" id="pwRules">
      <li data-rule="len">At least 8 characters</li>
      <li data-rule="num">Contains a number</li>
      <li data-rule="sym">Contains a symbol</li>
      <li data-rule="name">Includes both uppercase and lowercase letters</li>
    </ul>
    <div class="action-row">
      <button class="primary-btn" id="pwSubmit" style="background:${topic.color}" disabled>Create Password</button>
    </div>
  `;

    const input = document.getElementById('pwInput');
    const fill = document.getElementById('pwMeterFill');
    const badge = document.getElementById('pwStateBadge');
    const submit = document.getElementById('pwSubmit');
    const rules = document.getElementById('pwRules');

    input.addEventListener('input', () => {
        const val = input.value;
        const checks = {
            len: val.length >= 8,
            num: /[0-9]/.test(val),
            sym: /[^A-Za-z0-9]/.test(val),
            name: /[A-Z]/.test(val) && /[a-z]/.test(val)
        };
        rules.querySelectorAll('li').forEach(li => {
            li.classList.toggle('met', checks[li.dataset.rule]);
        });
        const score = Object.values(checks).filter(Boolean).length;
        const pct = val.length ? (score / 4) * 100 : 0;
        fill.style.width = pct + '%';

        badge.className = 'pw-state-badge';
        if (!val.length) {
            badge.textContent = 'Weak';
            fill.style.background = 'var(--sky-mid)';
        } else if (score <= 1) {
            badge.textContent = 'Weak';
            badge.classList.add('weak');
            fill.style.background = 'var(--coral)';
        } else if (score <= 3) {
            badge.textContent = 'Good';
            badge.classList.add('okay');
            fill.style.background = 'var(--gold)';
        } else {
            badge.textContent = 'Strong';
            badge.classList.add('strong');
            fill.style.background = 'var(--mint-dark)';
        }
        submit.disabled = score < 4;
    });

    submit.addEventListener('click', () => {
        submit.disabled = true;
        input.disabled = true;
        markComplete(topic);
    });
}

/* ---- fill in the blank: left word bank + right-side numbered questions ---- */
function buildFillBlank(body, topic) {
    const a = topic.activity;
    const bankWords = shuffle(a.items.map((item, i) => ({ text: item.answer, id: i })).slice());

    body.innerHTML = `
    <div class="fb-layout">
      <div>
        <div class="fb-bank-label">Word Bank</div>
        <div class="fb-bank" id="fbBank">
          ${bankWords.map(w => `<button class="fb-word" data-id="${w.id}">${w.text}</button>`).join('')}
        </div>
      </div>
      <div class="fb-list">
        ${a.items.map((item, i) => `
          <p class="fb-sentence" data-i="${i}">
            <span class="fb-number">${i + 1}.</span>
            <span class="fb-text">${item.sentence.replace('___', `<button type="button" class="fb-blank" data-i="${i}"></button>`)}</span>
          </p>
        `).join('')}
      </div>
    </div>
    <div class="action-row">
      <button class="primary-btn" id="fbHint" style="background:${topic.color}">Hint</button>
      <button class="primary-btn" id="fbCheck" style="background:${topic.color}" disabled>Check Answers</button>
      <span class="a-feedback" id="fbFeedback"></span>
    </div>
  `;

    const blanks = [...body.querySelectorAll('.fb-blank')];
    const words = [...body.querySelectorAll('.fb-word')];
    let activeBlank = blanks[0];
    if (activeBlank) activeBlank.classList.add('active');

    function firstEmptyBlank() {
        return blanks.find(b => !b.dataset.filled) || null;
    }

    function refreshCheckButton() {
        const checkButton = document.getElementById('fbCheck');
        if (checkButton) {
            checkButton.disabled = blanks.some(b => !b.dataset.filled);
        }
    }

    function clearBlankState(blank) {
        blank.classList.remove('correct', 'incorrect', 'active');
        blank.dataset.filled = '';
        blank.textContent = '';
    }

    blanks.forEach(b => b.addEventListener('click', () => {
        blanks.forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        activeBlank = b;
    }));

    words.forEach(w => w.addEventListener('click', () => {
        if (w.classList.contains('used')) return;
        const target = activeBlank && !activeBlank.dataset.filled ? activeBlank : firstEmptyBlank();
        if (!target) return;
        target.textContent = w.textContent;
        target.dataset.filled = '1';
        target.dataset.wordId = w.dataset.id;
        target.classList.remove('active');
        w.classList.add('used');
        w.disabled = true;

        const next = firstEmptyBlank();
        if (next) {
            next.classList.add('active');
            activeBlank = next;
        }
        refreshCheckButton();
    }));

    blanks.forEach(b => b.addEventListener('click', () => {
        if (!b.dataset.filled) return;
        const usedWord = body.querySelector(`.fb-word[data-id="${b.dataset.wordId}"]`);
        if (usedWord) {
            usedWord.classList.remove('used');
            usedWord.disabled = false;
        }
        clearBlankState(b);
        delete b.dataset.wordId;
        blanks.forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        activeBlank = b;
        refreshCheckButton();
    }));

    document.getElementById('fbHint').addEventListener('click', () => {
        const target = activeBlank && !activeBlank.dataset.filled ? activeBlank : firstEmptyBlank();
        if (!target) return;

        const itemIndex = Number(target.dataset.i);
        const correctWord = a.items[itemIndex].answer;
        const feedback = document.getElementById('fbFeedback');

        feedback.textContent = `Hint: the answer is "${correctWord}".`;
        feedback.className = 'a-feedback bad';

        target.classList.remove('active');
        const next = firstEmptyBlank();
        if (next) {
            next.classList.add('active');
            activeBlank = next;
        }
    });

    document.getElementById('fbCheck').addEventListener('click', () => {
        let allCorrect = true;
        a.items.forEach((item, i) => {
            const blank = body.querySelector(`.fb-blank[data-i="${i}"]`);
            if (!blank) return;
            const ok = blank.textContent.trim().toLowerCase() === item.answer.toLowerCase();
            blank.classList.remove('correct', 'incorrect');
            blank.classList.add(ok ? 'correct' : 'incorrect');
            if (!ok) allCorrect = false;
        });
        const fb = document.getElementById('fbFeedback');
        if (allCorrect) {
            fb.textContent = 'All correct!';
            fb.className = 'a-feedback good';
            document.getElementById('fbCheck').disabled = true;
            markComplete(topic);
        } else {
            fb.textContent = 'Some answers are incorrect. Use the hint button to check the right word.';
            fb.className = 'a-feedback bad';
        }
    });
}

/* =========================================================
   BOOT — load topic data from data/topics.json, then start the app
========================================================= */
async function boot() {
    try {
        const res = await fetch('data/topics.json');
        TOPICS = await res.json();
    } catch (err) {
        console.error('Failed to load data/topics.json', err);
        topicGrid.innerHTML = '<p>Could not load lesson data. Please check that data/topics.json is reachable (running via a local server, not file://, is required for fetch to work).</p>';
        return;
    }
    TOPICS.forEach(t => { progress[t.id] = 'unlocked'; });
    renderMap();
}

boot();
