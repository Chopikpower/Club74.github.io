/************************************************************
 * STABLE SOUND FIX FOR POKER TIMER
 *
 * ✅ blind.mp3 — при начале каждого уровня
 * ✅ break.mp3 — при начале обычного перерыва
 * ✅ bigbreak.mp3 — при начале большого перерыва
 * ✅ Без дублей
 * ✅ Работает у админа и гостя
 * ✅ Работает при авто-переходе
 * ✅ Работает при кнопке "Вперёд"
 * ✅ При "Назад" звук НЕ играет
 *
 * Подключать ПОСЛЕ app.js и после остальных фиксов:
 * <script src="sound-fix.js"></script>
 ************************************************************/

(function () {
    if (window.__STABLE_POKER_SOUND_FIX__) return;
    window.__STABLE_POKER_SOUND_FIX__ = true;

    console.log('Stable Poker Sound Fix loaded');

    if (typeof state === 'undefined') {
        console.error('sound-fix.js: state не найден. Файл должен быть подключён после app.js');
        return;
    }

    /************************************************************
     * SETTINGS
     ************************************************************/

    const DEFAULT_SOUNDS = {
        levelStart: 'sound/blind.mp3',
        breakStart: 'sound/break.mp3',
        bigBreakStart: 'sound/bigbreak.mp3'
    };

    let lastPlayedStageKey = null;
    let audioUnlocked = false;

    /************************************************************
     * AUDIO UNLOCK
     *
     * Браузеры часто запрещают звук без клика пользователя.
     * Поэтому после любого клика/тапа звук разблокируется.
     ************************************************************/

    function unlockAudio() {
        if (audioUnlocked) return;

        try {
            const audio = new Audio(DEFAULT_SOUNDS.levelStart);
            audio.volume = 0;
            audio.muted = true;

            audio.play()
                .then(() => {
                    audio.pause();
                    audio.currentTime = 0;
                    audioUnlocked = true;
                    console.log('Audio unlocked');
                })
                .catch(() => {
                    audioUnlocked = false;
                });
        } catch {
            audioUnlocked = false;
        }
    }

    document.addEventListener('click', unlockAudio);
    document.addEventListener('touchstart', unlockAudio);
    document.addEventListener('keydown', unlockAudio);

    /************************************************************
     * SOUND HELPERS
     ************************************************************/

    function getVolume() {
        const volume = Number(state.settings?.volume);

        if (Number.isFinite(volume)) {
            return Math.max(0, Math.min(1, volume / 100));
        }

        return 0.7;
    }

    function getSoundSrc(type) {
        if (type === 'levelStart') {
            return state.settings?.customLevelSound ||
                state.settings?.defaultBlindSound ||
                DEFAULT_SOUNDS.levelStart;
        }

        if (type === 'breakStart') {
            return state.settings?.customBreakSound ||
                state.settings?.defaultBreakSound ||
                DEFAULT_SOUNDS.breakStart;
        }

        if (type === 'bigBreakStart') {
            return state.settings?.customBigBreakSound ||
                state.settings?.defaultBigBreakSound ||
                DEFAULT_SOUNDS.bigBreakStart;
        }

        return null;
    }

    window.playSound = function (type) {
        const src = getSoundSrc(type);

        if (!src) return;

        try {
            const audio = new Audio(src);
            audio.volume = getVolume();

            audio.play().catch(err => {
                console.warn('Звук не проиграл. Возможно, браузер заблокировал autoplay или файл не найден:', src, err);
            });
        } catch (err) {
            console.warn('Ошибка запуска звука:', err);
        }
    };

    window.playDefaultSound = function (src) {
        if (!src) return;

        try {
            const audio = new Audio(src);
            audio.volume = getVolume();

            audio.play().catch(() => {
                alert('Не удалось воспроизвести файл: ' + src);
            });
        } catch {
            alert('Не удалось воспроизвести файл: ' + src);
        }
    };

    /************************************************************
     * STAGE DETECTION
     ************************************************************/

    function getStageSoundType() {
        if (!state.timer || state.timer.tournamentEnded) return null;

        if (state.timer.isBreak) {
            if (state.timer.breakType === 'big') {
                return 'bigBreakStart';
            }

            return 'breakStart';
        }

        return 'levelStart';
    }

    function getStageKey() {
        if (!state.timer || state.timer.tournamentEnded) return null;

        const type = getStageSoundType();

        if (!type) return null;

        /**
         * tournamentStartedAt нужен, чтобы после сброса и нового старта
         * уровень 1 снова мог проиграть blind.mp3.
         *
         * targetEndTime НЕ используем, иначе после паузы/продолжения
         * звук мог бы повторяться.
         */
        return [
            state.timer.tournamentStartedAt || 'not-started',
            type,
            Number(state.timer.currentLevel || 1),
            state.timer.isBreak ? String(state.timer.breakType || 'regular') : 'level'
        ].join(':');
    }

    function playStageStartSoundOnce() {
        const type = getStageSoundType();
        const key = getStageKey();

        if (!type || !key) return;

        if (lastPlayedStageKey === key) {
            return;
        }

        lastPlayedStageKey = key;

        playSound(type);

        console.log('Sound played:', type, key);
    }

    function markCurrentStageAsAlreadyPlayed() {
        lastPlayedStageKey = getStageKey();
    }

    function resetSoundMemory() {
        lastPlayedStageKey = null;
    }

    /************************************************************
     * OVERRIDE syncTimer
     *
     * ВАЖНО:
     * Сначала переводим таймер на новую стадию,
     * потом играем звук НАЧАЛА новой стадии.
     ************************************************************/

    window.syncTimer = function (silent = false) {
        if (
            !state.timer ||
            !state.timer.isRunning ||
            !state.timer.targetEndTime ||
            state.timer.tournamentEnded
        ) {
            return;
        }

        let currentNow = now();
        let changedStage = false;

        while (
            state.timer.isRunning &&
            !state.timer.tournamentEnded &&
            state.timer.targetEndTime &&
            currentNow >= Number(state.timer.targetEndTime)
        ) {
            const endedAt = Number(state.timer.targetEndTime);

            moveToNextStage(endedAt);
            changedStage = true;

            if (!silent && !state.timer.tournamentEnded) {
                playStageStartSoundOnce();
            }

            currentNow = now();
        }

        if (
            state.timer.isRunning &&
            !state.timer.tournamentEnded &&
            state.timer.targetEndTime
        ) {
            const remainingMs = Math.max(0, Number(state.timer.targetEndTime) - now());

            state.timer.timeRemaining = Math.ceil(remainingMs / 1000);
            state.timer.elapsedTime = Math.max(
                0,
                Number(state.timer.totalLevelTime || 0) - Number(state.timer.timeRemaining || 0)
            );
        }

        if (changedStage && typeof saveTimerState === 'function') {
            saveTimerState();
        }
    };

    /************************************************************
     * OVERRIDE timerTick
     ************************************************************/

    window.timerTick = function () {
        syncTimer(false);
        updateTimerDisplay();
    };

    /************************************************************
     * OVERRIDE INTERVALS
     ************************************************************/

    window.startTimerInterval = function () {
        clearInterval(state.timer.interval);

        state.timer.interval = setInterval(() => {
            syncTimer(false);
            updateTimerDisplay();
        }, 500);
    };

    window.restartTimerIntervalIfNeeded = function () {
        clearInterval(state.timer.interval);

        if (state.timer.isRunning) {
            startTimerInterval();
        }
    };

    /************************************************************
     * OVERRIDE startTimer
     *
     * При первом старте уровня играет blind.mp3.
     * При продолжении после паузы звук НЕ повторяется.
     ************************************************************/

    window.startTimer = function () {
        if (state.timer.isRunning || state.timer.tournamentEnded) return;

        ensureTournamentStarted();

        state.timer.isRunning = true;
        state.timer.isPaused = false;
        state.timer.targetEndTime = now() + Number(state.timer.timeRemaining || 0) * 1000;

        startTimerInterval();
        saveTimerState();
        updateTimerDisplay();

        playStageStartSoundOnce();
    };

    /************************************************************
     * OVERRIDE pauseTimer
     *
     * На паузе звук не трогаем.
     ************************************************************/

    window.pauseTimer = function () {
        if (!state.timer.isRunning) return;

        syncTimer(true);

        state.timer.isRunning = false;
        state.timer.isPaused = true;
        state.timer.targetEndTime = null;

        clearInterval(state.timer.interval);

        saveTimerState();
        updateTimerDisplay();
    };

    /************************************************************
     * OVERRIDE nextLevel
     *
     * При ручном "Вперёд" звук играет для новой стадии.
     ************************************************************/

    window.nextLevel = function () {
        const wasRunning = state.timer.isRunning;

        moveToNextStage(now());

        if (!state.timer.tournamentEnded) {
            state.timer.isRunning = wasRunning;
            state.timer.isPaused = false;

            if (wasRunning) {
                state.timer.targetEndTime = now() + Number(state.timer.timeRemaining || 0) * 1000;
                startTimerInterval();
            } else {
                state.timer.targetEndTime = null;
                clearInterval(state.timer.interval);
            }
        }

        saveTimerState();
        updateTimerDisplay();

        if (!state.timer.tournamentEnded) {
            playStageStartSoundOnce();
        }
    };

    /************************************************************
     * OVERRIDE prevLevel
     *
     * При "Назад" звук НЕ играем.
     * Но память звука сбрасываем, чтобы если потом снова нажать "Вперёд",
     * звук новой стадии снова сработал.
     ************************************************************/

    window.prevLevel = function () {
        const t = currentTemplate();

        if (state.timer.currentLevel <= 1 && !state.timer.isBreak) {
            alert('Это первый уровень, назад перемотать нельзя');
            return;
        }

        clearInterval(state.timer.interval);

        if (state.timer.isBreak) {
            state.timer.isBreak = false;
            state.timer.breakType = null;
        } else {
            state.timer.currentLevel = Math.max(1, Number(state.timer.currentLevel) - 1);
        }

        state.timer.isRunning = false;
        state.timer.isPaused = false;
        state.timer.tournamentEnded = false;
        state.timer.totalLevelTime = t.levelDuration * 60;
        state.timer.timeRemaining = state.timer.totalLevelTime;
        state.timer.elapsedTime = 0;
        state.timer.targetEndTime = null;

        resetSoundMemory();

        saveTimerState();
        updateTimerDisplay();
    };

    /************************************************************
     * OVERRIDE resetTimer
     *
     * Сброс — без звука.
     ************************************************************/

    window.resetTimer = function () {
        const t = currentTemplate();

        clearInterval(state.timer.interval);

        Object.assign(state.timer, {
            currentLevel: 1,
            timeRemaining: t.levelDuration * 60,
            totalLevelTime: t.levelDuration * 60,
            elapsedTime: 0,
            isRunning: false,
            isPaused: false,
            isBreak: false,
            breakType: null,
            tournamentEnded: false,
            tournamentStartedAt: null,
            targetEndTime: null
        });

        resetSoundMemory();

        saveTimerState();
        updateTimerDisplay();
    };

    /************************************************************
     * GUEST CLOUD SOUND
     *
     * Гость получает изменение таймера из Supabase.
     * Если админ запустил таймер или перевёл стадию —
     * у гостя тоже играет нужный звук.
     ************************************************************/

    if (typeof applyCloudRow === 'function' && !window.__STABLE_SOUND_CLOUD_PATCHED__) {
        window.__STABLE_SOUND_CLOUD_PATCHED__ = true;

        const originalApplyCloudRow = applyCloudRow;

        window.applyCloudRow = function (row) {
            const beforeKey = getStageKey();
            const beforeRunning = !!state.timer?.isRunning;
            const beforeStartedAt = state.timer?.tournamentStartedAt || null;

            originalApplyCloudRow(row);

            try {
                if (!row || row.key !== 'timer') return;

                const afterKey = getStageKey();
                const afterRunning = !!state.timer?.isRunning;
                const afterStartedAt = state.timer?.tournamentStartedAt || null;

                /**
                 * Админ сам играет звук локально.
                 * Этот блок нужен только гостям.
                 */
                if (state.isAdmin) return;

                /**
                 * При первичной загрузке облака cloudReady ещё false.
                 * Чтобы гость не слышал звук просто при открытии страницы.
                 */
                if (!cloudReady) {
                    markCurrentStageAsAlreadyPlayed();
                    return;
                }

                /**
                 * Если пришёл сброс турнира.
                 */
                if (!afterStartedAt || state.timer.tournamentEnded) {
                    resetSoundMemory();
                    return;
                }

                if (!afterRunning) {
                    return;
                }

                const remoteStarted = !beforeRunning && afterRunning;
                const stageChanged = beforeKey && afterKey && beforeKey !== afterKey;
                const tournamentRestarted = beforeStartedAt && afterStartedAt && beforeStartedAt !== afterStartedAt;

                if (remoteStarted || stageChanged || tournamentRestarted) {
                    playStageStartSoundOnce();
                }
            } catch (err) {
                console.warn('Guest cloud sound error:', err);
            }
        };

        applyCloudRow = window.applyCloudRow;
    }

    /************************************************************
     * REBIND BUTTONS
     *
     * Старый app.js уже назначил onclick на старые функции.
     * Поэтому здесь перепривязываем кнопки к новым функциям.
     ************************************************************/

    function rebindButton(id, handler) {
        const el = document.getElementById(id);
        if (!el) return;

        el.onclick = handler;
    }

    function rebindButtons() {
        rebindButton('startBtn', window.startTimer);
        rebindButton('pauseBtn', window.pauseTimer);
        rebindButton('resetBtn', window.resetTimer);
        rebindButton('forwardBtn', window.nextLevel);
        rebindButton('backBtn', window.prevLevel);

        rebindButton('playDefaultBlindSound', () => {
            playDefaultSound(state.settings?.defaultBlindSound || DEFAULT_SOUNDS.levelStart);
        });

        rebindButton('playDefaultBreakSound', () => {
            playDefaultSound(state.settings?.defaultBreakSound || DEFAULT_SOUNDS.breakStart);
        });

        rebindButton('playDefaultBigBreakSound', () => {
            playDefaultSound(state.settings?.defaultBigBreakSound || DEFAULT_SOUNDS.bigBreakStart);
        });
    }

    /************************************************************
     * FIX EXISTING RUNNING TIMER
     ************************************************************/

    function restartFixedTimerIfNeeded() {
        clearInterval(state.timer.interval);

        if (state.timer.isRunning) {
            startTimerInterval();
        }
    }

    /************************************************************
     * INIT
     ************************************************************/

    function initStableSoundFix() {
        /**
         * При открытии страницы не проигрываем звук текущего уровня.
         * Просто считаем текущую стадию уже озвученной.
         */
        markCurrentStageAsAlreadyPlayed();

        rebindButtons();
        restartFixedTimerIfNeeded();

        if (typeof updateTimerDisplay === 'function') {
            updateTimerDisplay();
        }

        console.log('Stable Poker Sound Fix applied');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            initStableSoundFix();

            setTimeout(initStableSoundFix, 500);
            setTimeout(initStableSoundFix, 1500);
        });
    } else {
        initStableSoundFix();

        setTimeout(initStableSoundFix, 500);
        setTimeout(initStableSoundFix, 1500);
    }

    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            restartFixedTimerIfNeeded();

            if (typeof syncTimer === 'function') {
                syncTimer(true);
            }

            if (typeof updateTimerDisplay === 'function') {
                updateTimerDisplay();
            }
        }
    });

})();
