// === STATE ===
let isPremium = false;
let selectedOption = null;
let userTags = ['Stem cells', 'Tricky wording'];
const correctAnswer = 'C';
let history = ['home'];

// === NAVIGATION ===
function navigateTo(page) {
    document.querySelectorAll('.page').forEach(function(p) { p.classList.remove('active'); });
    var target = document.getElementById('page-' + page);
    if (target) {
        target.classList.add('active');
    }
    window.scrollTo(0, 0);

    if (history[history.length - 1] !== page) {
        history.push(page);
    }
    updateBackButton();

    if (page === 'question') {
        resetQuestion();
    }
    if (page === 'profile') {
        updateProfileMode();
    }
}

function goBack() {
    if (history.length > 1) {
        history.pop();
        var prev = history[history.length - 1];
        document.querySelectorAll('.page').forEach(function(p) { p.classList.remove('active'); });
        var target = document.getElementById('page-' + prev);
        if (target) {
            target.classList.add('active');
        }
        window.scrollTo(0, 0);
        updateBackButton();
    }
}

function updateBackButton() {
    var btn = document.getElementById('backBtn');
    if (history.length > 1) {
        btn.classList.add('visible');
    } else {
        btn.classList.remove('visible');
    }
}

// === MODE TOGGLE ===
function toggleMode() {
    isPremium = !isPremium;
    var toggle = document.getElementById('modeToggle');
    var label = document.getElementById('modeLabel');

    if (isPremium) {
        toggle.classList.add('premium');
        label.textContent = 'PREMIUM';
        label.classList.add('premium-active');
    } else {
        toggle.classList.remove('premium');
        label.textContent = 'FREE';
        label.classList.remove('premium-active');
    }

    updatePremiumFeatures();
    updateProfileMode();
}

function updatePremiumFeatures() {
    var premiumBtns = document.querySelectorAll('.premium-btn');
    var libraryGrid = document.getElementById('libraryGrid');
    var weaknessSection = document.getElementById('weaknessSection');
    var revisionSection = document.getElementById('revisionSection');
    var allQuestionTags = document.querySelectorAll('.question-tags');

    if (isPremium) {
        premiumBtns.forEach(function(btn) { btn.style.opacity = '1'; });
        if (libraryGrid) libraryGrid.style.display = '';
        if (weaknessSection) weaknessSection.querySelector('.weakness-list').style.display = '';
        if (revisionSection) revisionSection.querySelector('.revision-path').style.display = '';
        allQuestionTags.forEach(function(tags) { tags.style.display = ''; });
    } else {
        premiumBtns.forEach(function(btn) { btn.style.opacity = '0.4'; });
        if (libraryGrid) libraryGrid.style.display = 'none';
        if (weaknessSection) weaknessSection.querySelector('.weakness-list').style.display = 'none';
        if (revisionSection) revisionSection.querySelector('.revision-path').style.display = 'none';
        allQuestionTags.forEach(function(tags) { tags.style.display = 'none'; });
    }
}

function updateProfileMode() {
    var profileMode = document.getElementById('profileMode');
    if (isPremium) {
        profileMode.textContent = 'PREMIUM MODE';
        profileMode.classList.add('premium-mode');
    } else {
        profileMode.textContent = 'FREE MODE';
        profileMode.classList.remove('premium-mode');
    }
}

// === QUESTION INTERACTION ===
function selectOption(option) {
    if (selectedOption) return;
    selectedOption = option;

    var options = document.querySelectorAll('.option');
    options.forEach(function(opt) {
        var optValue = opt.getAttribute('data-option');

        if (optValue === option) {
            opt.classList.add('selected');
            if (optValue === correctAnswer) {
                opt.classList.add('correct');
                opt.querySelector('.option-result').textContent = 'CORRECT';
            } else {
                opt.classList.add('incorrect');
                opt.querySelector('.option-result').textContent = 'INCORRECT';
                var correctOpt = document.querySelector('.option[data-option="' + correctAnswer + '"]');
                correctOpt.classList.add('revealed', 'correct');
                correctOpt.querySelector('.option-result').textContent = 'CORRECT';
            }
        }
        opt.classList.add('revealed');
    });
}

function resetQuestion() {
    selectedOption = null;
    var options = document.querySelectorAll('.option');
    options.forEach(function(opt) {
        opt.classList.remove('selected', 'correct', 'incorrect', 'revealed');
        opt.querySelector('.option-result').textContent = '';
    });
}

// === PANELS ===
function openPanel(type) {
    if (type === 'tag') {
        if (!isPremium) return;
        openTagModal();
        return;
    }

    if ((type === 'attempt' || type === 'similar') && !isPremium) {
        return;
    }

    var panel = document.getElementById('slidePanel');
    var overlay = document.getElementById('panelOverlay');
    var title = document.getElementById('panelTitle');
    var content = document.getElementById('panelContent');

    title.textContent = getPanelTitle(type);
    content.innerHTML = getPanelContent(type);

    panel.classList.add('active');
    overlay.classList.add('active');
}

function closePanel() {
    var panel = document.getElementById('slidePanel');
    var overlay = document.getElementById('panelOverlay');
    panel.classList.remove('active');
    overlay.classList.remove('active');
}

function getPanelTitle(type) {
    switch (type) {
        case 'markscheme': return 'Mark Scheme';
        case 'analysis': return 'AI Analysis';
        case 'similar': return 'Similar Questions';
        case 'attempt': return 'My Attempt History';
        default: return '';
    }
}

function getPanelContent(type) {
    switch (type) {
        case 'markscheme': return getMarkSchemeContent();
        case 'analysis': return getAnalysisContent();
        case 'similar': return getSimilarContent();
        case 'attempt': return getAttemptContent();
        default: return '';
    }
}

function getMarkSchemeContent() {
    return '<div class="panel-section"><div class="panel-section-title">Correct Answer</div><div class="panel-answer">C</div><p>1 and 3 only</p></div>';
}

function getAnalysisContent() {
    return '<div class="panel-section"><div class="panel-section-title">Related Syllabus Topic</div><p style="margin-bottom:4px; color: var(--text-muted); font-size: 0.8rem;">Primary:</p><div class="syllabus-tag">5.1 Replication and division of nuclei and cells</div></div><div class="panel-section"><div class="panel-section-title">Option-by-Option Explanation</div><span class="statement-label correct-label">Statement 1 — Correct</span><p>Stem cells can divide by mitosis and daughter cells can either remain undifferentiated or differentiate into specialised cells.</p><span class="statement-label incorrect-label">Statement 2 — Incorrect</span><p>Most body cells contain the same genetic information. The difference is gene expression, not genetic information retention.</p><span class="statement-label correct-label">Statement 3 — Correct</span><p>Adult stem cells remain in certain tissues for repair and replacement throughout the lifetime of the organism.</p><span class="statement-label incorrect-label">Statement 4 — Incorrect</span><p>Stem cells do not have more telomeres than other body cells. Telomerase activity (not telomere count) is what allows certain cells to maintain division capacity.</p></div><div class="panel-section"><div class="panel-section-title">Reasoning Chain</div><div class="reasoning-chain"><div class="reasoning-step">Stem cells function in tissue repair</div><div class="reasoning-step">Need ability to self-renew</div><div class="reasoning-step">Need ability to differentiate</div><div class="reasoning-step">Mitosis produces daughter cells</div><div class="reasoning-step">Some remain stem cells, some become specialised cells</div></div></div><div class="panel-section"><div class="panel-section-title">Common Mistakes</div><div class="mistake-item"><span class="mistake-icon">!</span><p>Students often confuse "genetic information" with "gene expression". Statement 2 is a classic trap: all body cells do share the same DNA, but the question asks about what makes stem cells <em>different</em>, which lies in expression patterns, not information content.</p></div><div class="mistake-item"><span class="mistake-icon">!</span><p>Statement 4 is frequently misjudged because telomerase activity is mistaken for telomere quantity. Cells do not have "more" telomeres — the number of telomeres is fixed by chromosome count. It is telomerase enzyme activity that extends replicative capacity.</p></div></div>';
}

function getSimilarContent() {
    return '<div class="panel-section"><div class="panel-section-title">Questions with similar concepts</div><div class="similar-item"><span class="paper-code-tag small">9700/11/O/N/23</span><span>Q18 — Cell cycle S phase</span></div><div class="similar-item"><span class="paper-code-tag small">9700/12/M/J/22</span><span>Q24 — Stem cell differentiation</span></div><div class="similar-item"><span class="paper-code-tag small">9700/11/F/M/22</span><span>Q19 — Properties of stem cells</span></div><div class="similar-item"><span class="paper-code-tag small">9700/12/O/N/21</span><span>Q20 — Telomeres and cell division</span></div></div>';
}

function getAttemptContent() {
    return '<div class="panel-section"><div class="panel-section-title">Your Attempts</div><div class="attempt-history"><div class="attempt-item"><div class="attempt-date">2024-12-15 14:32</div><div class="attempt-result"><span class="attempt-answer incorrect">B</span><span class="attempt-label">Incorrect — selected 1, 2 and 3 only</span></div></div><div class="attempt-item"><div class="attempt-date">2025-01-03 09:18</div><div class="attempt-result"><span class="attempt-answer correct">C</span><span class="attempt-label">Correct — 1 and 3 only</span></div></div></div></div>';
}

// === TAG MODAL ===
function openTagModal() {
    var modal = document.getElementById('tagModal');
    modal.classList.add('active');
    renderUserTags();
}

function closeTagModal() {
    var modal = document.getElementById('tagModal');
    modal.classList.remove('active');
}

function renderUserTags() {
    var list = document.getElementById('userTagsList');
    list.innerHTML = userTags.map(function(tag) {
        return '<span class="tag-chip removable" onclick="removeTag(\'' + tag + '\')">' + tag + ' &times;</span>';
    }).join('');
}

function addTag() {
    var input = document.getElementById('tagInput');
    var value = input.value.trim();
    if (value && userTags.indexOf(value) === -1) {
        userTags.push(value);
        input.value = '';
        renderUserTags();
        updateQuestionTags();
    }
}

function removeTag(tag) {
    var index = userTags.indexOf(tag);
    if (index > -1) {
        userTags.splice(index, 1);
        renderUserTags();
        updateQuestionTags();
    }
}

function updateQuestionTags() {
    var tagsContainer = document.getElementById('questionTags1');
    if (tagsContainer) {
        tagsContainer.innerHTML = userTags.map(function(tag) {
            return '<span class="tag-chip">' + tag + '</span>';
        }).join('');
    }
}

// === INIT ===
document.addEventListener('DOMContentLoaded', function() {
    updatePremiumFeatures();
    updateQuestionTags();
    updateBackButton();

    document.getElementById('tagModal').addEventListener('click', function(e) {
        if (e.target === document.getElementById('tagModal')) {
            closeTagModal();
        }
    });

    document.getElementById('tagInput').addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            addTag();
        }
    });
});

// === COLLAPSIBLE SUBTOPICS ===
function toggleSubtopic(titleElement) {
    titleElement.classList.toggle('collapsed');
}