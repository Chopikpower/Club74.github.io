/************************************************************
 * SOUND FIX FOR POKER TIMER
 *
 * Требования:
 * ✅ blind.mp3 — при начале каждого уровня
 * ✅ break.mp3 — при начале обычного перерыва
 * ✅ bigbreak.mp3 — при начале большого перерыва
 * ✅ Без дублирования вызовов
 * ✅ Работает у администратора и гостя
 *
 * Подключать ПОСЛЕ app.js:
 * <script src="app.js"></script>
 * <script src="sound-fix.js"></script>
 ************************************************************/

(function () {
    if (window.__POKER_TIMER_SOUND_FIX_LOADED__) return;
    window.__POKER_TIMER_SOUND_FIX_LOADED__ = true;

    console.log('Poker Timer sound fix loaded');

    /************************************************************
     * SAFETY
     ************************************************************/

    if (typeof state === 'undefined') {
        console.error('sound-fix.js: state не найден. Проверь, что sound-fix.js подключён после app.js');
        return;
    }

    const SOUND_PATHS = {
        levelStart: 'https://chopikpower.github.io/Club74.github.io/sound/blind.mp3',
        breakStart: 'https://chopikpower.github.io/Club74.github.io/sound/break.mp3',
        bigBreakStart: 'https://chopikpower.github.io/Club74.github.io/sound/bigbreak.mp3'
    };

    let lastPlayedStageSoundKey = null;
    let audioUnlocked = false;

    /************************************************************
     * AUDIO UNLOCK
     *
     * Важно:
     * Браузеры запрещают звук без действия пользователя.
     * Поэтому у гостя звук гарантированно заработает после любого клика/тапа
     * по странице.
     ************************************************************/

    function unlockAudio() {
        if (audioUnlocked) return;

        audioUnlocked = true;

        try {
            const audio = new Audio(SOUND_PATHS.levelStart);
            audio.volume = 0;
            audio.play()
                .then(() => {
                    audio.pause();
                    audio.currentTime = 0;
                    console.log('Audio unlocked');
                })
                .catch(() => {
                    audioUnlocked = false;
                });
        } catch {
            audioUnlocked = false;
        }
    }

    document.addEventListener('click', unlockAudio, { once: false });
    document.addEventListener('touchstart', unlockAudio, { once: false });
    document.addEventListener('keydown', unlockAudio, { once: false });

    /************************************************************
     * SOUND CORE
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
            return state.settings?.customLevelSound || state.settings?.defaultBlindSound || SOUND_PATHS.levelStart;
        }

        if (type === 'breakStart') {
            return state.settings?.customBreakSound || state.settings?.defaultBreakSound || SOUND_PATHS.breakStart;
        }

        if (type === 'bigBreakStart') {
            return state.settings?.customBigBreakSound || state.settings?.defaultBigBreakSound || SOUND_PATHS.bigBreakStart;
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
                console.warn('Звук заблокирован браузером или файл не найден:', src, err);
            });
        } catch (err) {
            console.warn('Ошибка воспроизведения звука:', err);
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
     * STAGE KEY
     *
     * Нужен, чтобы звук не повторялся дважды.
     ************************************************************/

    function getCurrentStageSoundType() {
        if (state.timer.tournamentEnded) return null;

        if (state.timer.isBreak) {
            if (state.timer.breakType === 'big') {
                return 'bigBreakStart';
            }

            return 'breakStart';
        }

        return 'levelStart';
    }

    function getCurrentStageSoundKey() {
        if (state.timer.tournamentEnded) return null;

        const type = getCurrentStageSoundType();

        if (!type) return null;

        return [
            type,
            Number(state.timer.currentLevel || 1),
            state.timer.isBreak ? String(state.timer.breakType || 'regular') : 'level',
            Number(state.timer.targetEndTime || 0),
            Number(state.timer.totalLevelTime || 0)
        ].join(':');
    }

    function playCurrentStageStartSoundOnce() {
        const type = getCurrentStageSoundType();
        const key = getCurrentStageSoundKey();

        if (!type || !key) return;

        if (lastPlayedStageSoundKey === key) {
            return;
        }

        lastPlayedStageSoundKey = key;

        playSound(type);

        console.log('Stage sound played:', type, key);
    }

    /************************************************************
     * OVERRIDE syncTimer
     *
     * Главное исправление:
     * Сначала переходим на новую стадию,
     * потом играем звук НАЧАЛА новой стадии.
     ************************************************************/

    window.syncTimer = function (silent = false) {
        if (!state.timer.isRunning || !state.timer.targetEndTime || state.timer.tournamentEnded) {
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
                playCurrentStageStartSoundOnce();
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

        if (changedStage) {
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
     * OVERRIDE startTimer
     *
     * При старте турнира/после паузы:
     * если это начало уровня — blind.mp3.
     *
     * Если это продолжение после паузы, звук НЕ повторяем,
     * потому что ключ стадии тот же.
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

        playCurrentStageStartSoundOnce();
    };

    /************************************************************
     * OVERRIDE nextLevel
     *
     * При ручном переходе вперёд звук тоже должен соответствовать
     * началу новой стадии.
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
            playCurrentStageStartSoundOnce();
        }
    };

    /************************************************************
     * OVERRIDE prevLevel
     *
     * Назад звук не играем.
     * Также сбрасываем ключ, чтобы при последующем старте звук мог сыграть.
     ************************************************************/

    const originalPrevLevel = window.prevLevel || prevLevel;

    window.prevLevel = function () {
        originalPrevLevel();
        lastPlayedStageSoundKey = null;
    };

    /************************************************************
     * OVERRIDE resetTimer
     *
     * После сброса звук не играет.
     * Ключ звука сбрасывается.
     ************************************************************/

    const originalResetTimer = window.resetTimer || resetTimer;

    window.resetTimer = function () {
        originalResetTimer();
        lastPlayedStageSoundKey = null;
    };

    /************************************************************
     * GUEST REALTIME SOUND
     *
     * У гостя звук должен сработать, когда админ запускает таймер
     * или вручную переводит уровень.
     *
     * Но НЕ должен играть при первичной загрузке страницы.
     ************************************************************/

    const originalApplyCloudRow = window.applyCloudRow || applyCloudRow;

    window.applyCloudRow = function (row) {
        const beforeKey = getCurrentStageSoundKey();
        const beforeRunning = !!state.timer.isRunning;
        const beforeEnded = !!state.timer.tournamentEnded;

        originalApplyCloudRow(row);

        try {
            if (!row || row.key !== 'timer') return;

            const afterKey = getCurrentStageSoundKey();
            const afterRunning = !!state.timer.isRunning;
            const afterEnded = !!state.timer.tournamentEnded;

            if (state.isAdmin) return;
            if (!cloudReady) return;
            if (afterEnded) return;
            if (!afterRunning) return;

            const stageChanged = beforeKey && afterKey && beforeKey !== afterKey;
            const remoteStarted = !beforeRunning && afterRunning && !beforeEnded;

            if (stageChanged || remoteStarted) {
                playCurrentStageStartSoundOnce();
            }
        } catch (err) {
            console.warn('Guest sound sync error:', err);
        }
    };

    /************************************************************
     * REBIND BUTTONS
     *
     * В app.js кнопки уже могли получить старые функции.
     * Поэтому перепривязываем основные кнопки на исправленные.
     ************************************************************/

    function rebindButton(id, handler) {
        const el = document.getElementById(id);
        if (!el) return;

        el.onclick = handler;
    }

    function rebindButtons() {
        rebindButton('startBtn', window.startTimer);
        rebindButton('resetBtn', window.resetTimer);
        rebindButton('forwardBtn', window.nextLevel);
        rebindButton('backBtn', window.prevLevel);

        rebindButton('playDefaultBlindSound', () => playDefaultSound(state.settings.defaultBlindSound || SOUND_PATHS.levelStart));
        rebindButton('playDefaultBreakSound', () => playDefaultSound(state.settings.defaultBreakSound || SOUND_PATHS.breakStart));
        rebindButton('playDefaultBigBreakSound', () => playDefaultSound(state.settings.defaultBigBreakSound || SOUND_PATHS.bigBreakStart));
    }

    /************************************************************
     * RESTART TIMER INTERVAL
     ************************************************************/

    function restartFixedInterval() {
        clearInterval(state.timer.interval);

        if (state.timer.isRunning) {
            state.timer.interval = setInterval(() => {
                syncTimer(false);
                updateTimerDisplay();
            }, 500);
        }
    }

    /************************************************************
     * INIT FIX
     ************************************************************/

    function initSoundFix() {
        rebindButtons();
        restartFixedInterval();

        if (typeof updateTimerDisplay === 'function') {
            updateTimerDisplay();
        }

        console.log('Poker Timer sound fix applied');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSoundFix);
    } else {
        initSoundFix();
    }

    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            restartFixedInterval();

            if (typeof syncTimer === 'function') {
                syncTimer(true);
            }

            if (typeof updateTimerDisplay === 'function') {
                updateTimerDisplay();
            }
        }
    });

})();