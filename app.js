/************************************************************
 * POKER TIMER EMERGENCY FIX
 * Вставить В САМЫЙ НИЗ файла после init();
 ************************************************************/

(function () {
    if (window.__POKER_TIMER_FIX_LOADED__) return;
    window.__POKER_TIMER_FIX_LOADED__ = true;

    console.log('Poker Timer Fix loaded');

    function q(id) {
        return document.getElementById(id);
    }

    function exists(id) {
        return !!q(id);
    }

    function safeCall(name, ...args) {
        try {
            if (typeof window[name] === 'function') {
                return window[name](...args);
            }

            console.warn('Функция не найдена:', name);
        } catch (err) {
            console.error('Ошибка в функции ' + name + ':', err);
            alert('Ошибка: ' + err.message);
        }
    }

    function bindClick(id, handler) {
        const el = q(id);
        if (!el) {
            console.warn('Кнопка не найдена:', id);
            return;
        }

        if (el.dataset.pokerFixClick === '1') return;
        el.dataset.pokerFixClick = '1';

        el.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();

            try {
                handler(e);
            } catch (err) {
                console.error('Ошибка кнопки #' + id + ':', err);
                alert('Ошибка кнопки #' + id + ': ' + err.message);
            }
        });
    }

    function bindInput(id, handler) {
        const el = q(id);
        if (!el) {
            console.warn('Поле не найдено:', id);
            return;
        }

        if (el.dataset.pokerFixInput === '1') return;
        el.dataset.pokerFixInput = '1';

        el.addEventListener('input', function (e) {
            try {
                handler(e);
            } catch (err) {
                console.error('Ошибка поля #' + id + ':', err);
            }
        });
    }

    function showElement(id, display) {
        const el = q(id);
        if (el) el.style.display = display || '';
    }

    function hideElement(id) {
        const el = q(id);
        if (el) el.style.display = 'none';
    }

    function addClass(id, className) {
        const el = q(id);
        if (el) el.classList.add(className);
    }

    function removeClass(id, className) {
        const el = q(id);
        if (el) el.classList.remove(className);
    }

    function getValue(id) {
        const el = q(id);
        return el ? el.value : '';
    }

    function setValue(id, value) {
        const el = q(id);
        if (el) el.value = value;
    }

    /************************************************************
     * OVERRIDE SAFE TIMER FUNCTIONS
     ************************************************************/

    window.syncTimer = function (silent = false) {
        if (
            typeof state === 'undefined' ||
            !state.timer ||
            !state.timer.isRunning ||
            !state.timer.targetEndTime ||
            state.timer.tournamentEnded
        ) {
            return;
        }

        let currentNow = Date.now();
        let changedStage = false;

        while (
            state.timer.isRunning &&
            !state.timer.tournamentEnded &&
            state.timer.targetEndTime &&
            currentNow >= Number(state.timer.targetEndTime)
        ) {
            const endedAt = Number(state.timer.targetEndTime);

            if (typeof moveToNextStage === 'function') {
                moveToNextStage(endedAt);
            }

            changedStage = true;

            if (!silent && !state.timer.tournamentEnded) {
                if (state.timer.isBreak) {
                    if (state.timer.breakType === 'big') {
                        if (typeof playSound === 'function') playSound('bigBreakStart');
                    } else {
                        if (typeof playSound === 'function') playSound('breakStart');
                    }
                } else {
                    if (typeof playSound === 'function') playSound('levelEnd');
                }
            }

            currentNow = Date.now();
        }

        if (
            state.timer.isRunning &&
            !state.timer.tournamentEnded &&
            state.timer.targetEndTime
        ) {
            state.timer.timeRemaining = Math.max(
                0,
                Math.ceil((Number(state.timer.targetEndTime) - Date.now()) / 1000)
            );

            state.timer.elapsedTime = Math.max(
                0,
                Number(state.timer.totalLevelTime || 0) - Number(state.timer.timeRemaining || 0)
            );
        }

        if (changedStage && typeof saveTimerState === 'function') {
            saveTimerState();
        }
    };

    window.playSound = function (type) {
        if (typeof state === 'undefined') return;

        let src = '';

        switch (type) {
            case 'levelEnd':
            case 'levelStart':
                src = state.settings.customLevelSound || state.settings.defaultBlindSound;
                break;

            case 'breakStart':
                src = state.settings.customBreakSound || state.settings.defaultBreakSound;
                break;

            case 'bigBreakStart':
                src = state.settings.customBigBreakSound || state.settings.defaultBigBreakSound;
                break;

            default:
                return;
        }

        if (!src) return;

        const audio = new Audio(src);
        audio.volume = (Number(state.settings.volume) || 70) / 100;
        audio.play().catch(function () {});
    };

    window.playDefaultSound = function (src) {
        if (!src) return;

        const audio = new Audio(src);

        if (typeof state !== 'undefined') {
            audio.volume = (Number(state.settings.volume) || 70) / 100;
        } else {
            audio.volume = 0.7;
        }

        audio.play().catch(function () {});
    };

    /************************************************************
     * SAFE NAVIGATION
     ************************************************************/

    function bindGlobalNavigation() {
        if (window.__POKER_TIMER_NAV_FIXED__) return;
        window.__POKER_TIMER_NAV_FIXED__ = true;

        document.addEventListener('click', function (e) {
            const navBtn = e.target.closest('.nav-btn');

            if (navBtn) {
                const page = navBtn.dataset.page;

                if (page) {
                    e.preventDefault();
                    e.stopPropagation();

                    if (typeof showPage === 'function') {
                        showPage(page);
                    }

                    return;
                }
            }

            const tab = e.target.closest('.tournament-tab');

            if (tab) {
                const tabName = tab.dataset.tournamentTab;

                if (tabName) {
                    e.preventDefault();
                    e.stopPropagation();

                    if (typeof setTournamentTab === 'function') {
                        setTournamentTab(tabName);
                    }

                    return;
                }
            }
        });
    }

    /************************************************************
     * SAFE LOGIN / ADMIN
     ************************************************************/

    function loginAsAdmin() {
        if (typeof state === 'undefined') {
            alert('Ошибка: state не найден');
            return;
        }

        const pass = getValue('adminPassword');

        if (pass === state.settings.adminPassword) {
            state.isAdmin = true;

            if (typeof saveAdminState === 'function') saveAdminState();

            removeClass('loginModal', 'active');
            setValue('adminPassword', '');

            showElement('timerControls', 'flex');
            showElement('progressContainer');
            showElement('playerRegistrationSection', 'block');
            showElement('logoutBtn', 'inline-block');
            hideElement('loginBtn');

            if (typeof updateAdminUI === 'function') updateAdminUI();
            if (typeof renderTables === 'function') renderTables();
            if (typeof updateTimerDisplay === 'function') updateTimerDisplay();

            console.log('Админ вошёл');
        } else {
            alert('Неверный пароль');
        }
    }

    function logoutAdmin() {
        if (typeof state === 'undefined') return;

        state.isAdmin = false;

        if (typeof saveAdminState === 'function') saveAdminState();

        hideElement('timerControls');
        hideElement('progressContainer');
        hideElement('playerRegistrationSection');
        hideElement('logoutBtn');
        showElement('loginBtn', 'inline-block');

        if (typeof updateAdminUI === 'function') updateAdminUI();
        if (typeof showPage === 'function') showPage('timerPage');
    }

    /************************************************************
     * SAFE EXTRA BUTTONS
     ************************************************************/

    function addSafeRulesButton() {
        if (exists('rulesBtn')) return;

        const ratingBtn = q('ratingBtn');
        if (!ratingBtn) return;

        const btn = document.createElement('button');
        btn.className = 'btn btn-warning nav-btn';
        btn.id = 'rulesBtn';
        btn.dataset.page = 'rulesPage';
        btn.textContent = '📜 Правила';

        ratingBtn.before(btn);
    }

    function addSafePlayerFileButtons() {
        if (exists('savePlayersFileBtn')) return;

        const createGridBtn = q('createGridBtn');
        if (!createGridBtn) return;

        const btns = document.createElement('div');
        btns.style.display = 'flex';
        btns.style.gap = '10px';
        btns.style.flexWrap = 'wrap';
        btns.style.marginTop = '15px';

        btns.innerHTML = `
            <button class="btn btn-secondary" id="savePlayersFileBtn">💾 Сохранить список игроков</button>
            <button class="btn btn-secondary" id="loadPlayersFileBtn">📂 Загрузить список игроков</button>
        `;

        createGridBtn.after(btns);

        bindClick('savePlayersFileBtn', function () {
            safeCall('savePlayersToFile');
        });

        bindClick('loadPlayersFileBtn', function () {
            safeCall('loadPlayersFromFile');
        });
    }

    /************************************************************
     * MAIN BUTTON BINDINGS
     ************************************************************/

    function fixButtons() {
        console.log('Poker Timer Fix: привязка кнопок');

        bindGlobalNavigation();

        addSafeRulesButton();
        addSafePlayerFileButtons();

        /********************
         * TIMER BUTTONS
         ********************/

        bindClick('startBtn', function () {
            safeCall('startTimer');
        });

        bindClick('pauseBtn', function () {
            safeCall('pauseTimer');
        });

        bindClick('resetBtn', function () {
            safeCall('resetTimer');
        });

        bindClick('backBtn', function () {
            safeCall('prevLevel');
        });

        bindClick('forwardBtn', function () {
            safeCall('nextLevel');
        });

        bindClick('progressContainer', function (e) {
            if (typeof seekTimerByProgress === 'function') {
                seekTimerByProgress(e);
            }
        });

        /********************
         * LOGIN BUTTONS
         ********************/

        bindClick('loginBtn', function () {
            addClass('loginModal', 'active');
        });

        bindClick('cancelLoginBtn', function () {
            removeClass('loginModal', 'active');
        });

        bindClick('confirmLoginBtn', function () {
            loginAsAdmin();
        });

        bindClick('logoutBtn', function () {
            logoutAdmin();
        });

        /********************
         * PLAYERS / GRID
         ********************/

        bindClick('addPlayerBtn', function () {
            safeCall('addPlayer');
        });

        bindClick('createGridBtn', function () {
            safeCall('createGrid');
        });

        bindClick('addPlayerToGridBtn', function () {
            safeCall('addPlayerToGrid');
        });

        bindClick('createFinalTableBtn', function () {
            safeCall('createFinalTable');
        });

        bindClick('endTournamentBtn', function () {
            safeCall('endTournament');
        });

        /********************
         * MODALS
         ********************/

        bindClick('confirmMoveBtn', function () {
            safeCall('confirmMovePlayer');
        });

        bindClick('cancelMoveBtn', function () {
            removeClass('movePlayerModal', 'active');
        });

        bindClick('closePlayerActionBtn', function () {
            removeClass('playerActionModal', 'active');
        });

        /********************
         * RATING
         ********************/

        bindClick('saveRatingJpgBtn', function () {
            safeCall('saveRatingAsJpg');
        });

        /********************
         * LEVELS / TEMPLATES
         ********************/

        bindClick('addLevelBtn', function () {
            safeCall('addLevel');
        });

        bindClick('saveLevelsBtn', function () {
            safeCall('saveLevels');
        });

        bindClick('exportBtn', function () {
            safeCall('exportCurrentTemplate');
        });

        bindClick('importBtn', function () {
            safeCall('importTemplate');
        });

        bindClick('newTemplateBtn', function () {
            safeCall('newTemplate');
        });

        /********************
         * POINTS
         ********************/

        bindClick('savePointsConfigBtn', function () {
            safeCall('savePointsConfig');
        });

        bindClick('loadPresetBtn', function () {
            addClass('pointsPresetModal', 'active');
        });

        /********************
         * RESET
         ********************/

        bindClick('resetAllBtn', function () {
            safeCall('resetAll');
        });

        /********************
         * SETTINGS
         ********************/

        bindInput('volumeSlider', function (e) {
            if (typeof state === 'undefined') return;

            state.settings.volume = e.target.value;

            const volumeValue = q('volumeValue');
            if (volumeValue) volumeValue.textContent = e.target.value;

            if (typeof saveSettingsData === 'function') saveSettingsData();
        });

        bindInput('primaryColorPicker', function (e) {
            if (typeof state === 'undefined') return;

            state.settings.primaryColor = e.target.value;

            if (typeof updateSettingsUI === 'function') updateSettingsUI();
            if (typeof saveSettingsData === 'function') saveSettingsData();
        });

        bindInput('primaryColorText', function (e) {
            if (typeof state === 'undefined') return;

            state.settings.primaryColor = e.target.value;

            if (typeof updateSettingsUI === 'function') updateSettingsUI();
            if (typeof saveSettingsData === 'function') saveSettingsData();
        });

        bindClick('changePasswordBtn', function () {
            if (typeof state === 'undefined') return;

            const p1 = getValue('newPassword');
            const p2 = getValue('confirmPassword');

            if (!p1 || p1 !== p2) {
                alert('Пароли не совпадают');
                return;
            }

            state.settings.adminPassword = p1;

            if (typeof saveAdminState === 'function') saveAdminState();

            setValue('newPassword', '');
            setValue('confirmPassword', '');

            alert('Пароль изменён');
        });

        /********************
         * SOUND
         ********************/

        bindClick('playDefaultBlindSound', function () {
            if (typeof state !== 'undefined') {
                playDefaultSound(state.settings.defaultBlindSound);
            }
        });

        bindClick('playDefaultBreakSound', function () {
            if (typeof state !== 'undefined') {
                playDefaultSound(state.settings.defaultBreakSound);
            }
        });

        bindClick('playDefaultBigBreakSound', function () {
            if (typeof state !== 'undefined') {
                playDefaultSound(state.settings.defaultBigBreakSound);
            }
        });

        bindClick('saveSoundBtn', function () {
            alert('Настройки звука сохранены');
        });

        /********************
         * ADMIN TABS
         ********************/

        document.querySelectorAll('.admin-tab').forEach(function (tab) {
            if (tab.dataset.pokerFixTab === '1') return;
            tab.dataset.pokerFixTab = '1';

            tab.addEventListener('click', function (e) {
                e.preventDefault();

                document.querySelectorAll('.admin-tab').forEach(function (t) {
                    t.classList.remove('active');
                });

                document.querySelectorAll('.tab-content').forEach(function (c) {
                    c.classList.remove('active');
                });

                tab.classList.add('active');

                const content = q(tab.dataset.tab + 'Tab');
                if (content) content.classList.add('active');

                if (tab.dataset.tab === 'templates') safeCall('renderTemplatesList');
                if (tab.dataset.tab === 'levels') safeCall('renderLevelsTable');
                if (tab.dataset.tab === 'points') safeCall('updatePointsConfig');
            });
        });

        /********************
         * ENTER LOGIN
         ********************/

        const passwordInput = q('adminPassword');

        if (passwordInput && passwordInput.dataset.pokerFixEnter !== '1') {
            passwordInput.dataset.pokerFixEnter = '1';

            passwordInput.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    loginAsAdmin();
                }
            });
        }

        /********************
         * VISIBILITY
         ********************/

        if (!window.__POKER_TIMER_VISIBILITY_FIXED__) {
            window.__POKER_TIMER_VISIBILITY_FIXED__ = true;

            document.addEventListener('visibilitychange', function () {
                if (!document.hidden) {
                    if (typeof syncTimer === 'function') syncTimer(true);
                    if (typeof updateTimerDisplay === 'function') updateTimerDisplay();
                    if (typeof restartTimerIntervalIfNeeded === 'function') {
                        restartTimerIntervalIfNeeded();
                    }
                }
            });
        }

        /********************
         * UPDATE UI
         ********************/

        try {
            if (typeof updateSettingsUI === 'function') updateSettingsUI();
            if (typeof updateTimerDisplay === 'function') updateTimerDisplay();
            if (typeof renderPlayerList === 'function') renderPlayerList();
            if (typeof renderTables === 'function') renderTables();
            if (typeof renderRating === 'function') renderRating();
            if (typeof updateAdminUI === 'function') updateAdminUI();
        } catch (err) {
            console.warn('Ошибка обновления интерфейса:', err);
        }

        console.log('Poker Timer Fix: кнопки привязаны');
    }

    /************************************************************
     * EXPORT MISSING FUNCTIONS TO WINDOW
     ************************************************************/

    try {
        if (typeof addPlayer === 'function') window.addPlayer = addPlayer;
        if (typeof createGrid === 'function') window.createGrid = createGrid;
        if (typeof addPlayerToGrid === 'function') window.addPlayerToGrid = addPlayerToGrid;
        if (typeof createFinalTable === 'function') window.createFinalTable = createFinalTable;
        if (typeof endTournament === 'function') window.endTournament = endTournament;

        if (typeof saveRatingAsJpg === 'function') window.saveRatingAsJpg = saveRatingAsJpg;

        if (typeof addLevel === 'function') window.addLevel = addLevel;
        if (typeof saveLevels === 'function') window.saveLevels = saveLevels;
        if (typeof exportCurrentTemplate === 'function') window.exportCurrentTemplate = exportCurrentTemplate;
        if (typeof importTemplate === 'function') window.importTemplate = importTemplate;
        if (typeof newTemplate === 'function') window.newTemplate = newTemplate;

        if (typeof savePointsConfig === 'function') window.savePointsConfig = savePointsConfig;
        if (typeof resetAll === 'function') window.resetAll = resetAll;

        if (typeof savePlayersToFile === 'function') window.savePlayersToFile = savePlayersToFile;
        if (typeof loadPlayersFromFile === 'function') window.loadPlayersFromFile = loadPlayersFromFile;
    } catch (err) {
        console.warn('Не удалось экспортировать функции:', err);
    }

    /************************************************************
     * START FIX
     ************************************************************/

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            fixButtons();

            setTimeout(fixButtons, 300);
            setTimeout(fixButtons, 1000);
            setTimeout(fixButtons, 2000);
        });
    } else {
        fixButtons();

        setTimeout(fixButtons, 300);
        setTimeout(fixButtons, 1000);
        setTimeout(fixButtons, 2000);
    }

})();
