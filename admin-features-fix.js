/************************************************************
 * ADMIN FEATURES FIX
 *
 * Что делает:
 * ✅ Возвращает кнопку "Изменить пароль" для админа
 * ✅ Добавляет кнопку "Сетка гостям: Показать/Скрыть"
 * ✅ Админ управляет видимостью сетки для гостей
 * ✅ Настройка синхронизируется через Supabase realtime
 * ✅ Гость видит/не видит кнопку "Сетка" в реальном времени
 *
 * Подключать после app.js:
 * <script src="app.js"></script>
 * <script src="admin-features-fix.js"></script>
 ************************************************************/

(function () {
    if (window.__ADMIN_FEATURES_FIX_LOADED__) return;
    window.__ADMIN_FEATURES_FIX_LOADED__ = true;

    console.log('Admin Features Fix loaded');

    /************************************************************
     * CHECK
     ************************************************************/

    if (typeof state === 'undefined') {
        console.error('admin-features-fix.js: state не найден. Подключи файл после app.js');
        return;
    }

    if (!state.settings) state.settings = {};

    if (typeof state.settings.guestGridVisible === 'undefined') {
        state.settings.guestGridVisible = true;
    }

    /************************************************************
     * PATCH SETTINGS SAVE / LOAD
     ************************************************************/

    const originalMakeSettingsData = typeof makeSettingsData === 'function'
        ? makeSettingsData
        : null;

    if (originalMakeSettingsData) {
        makeSettingsData = function () {
            const data = originalMakeSettingsData();

            data.guestGridVisible = state.settings.guestGridVisible !== false;

            return data;
        };

        window.makeSettingsData = makeSettingsData;
    }

    const originalApplySettingsData = typeof applySettingsData === 'function'
        ? applySettingsData
        : null;

    if (originalApplySettingsData) {
        applySettingsData = function (data) {
            originalApplySettingsData(data || {});

            if (data && typeof data.guestGridVisible !== 'undefined') {
                state.settings.guestGridVisible = data.guestGridVisible !== false;
            }

            applyGuestGridVisibility();
            updateAdminFeatureButtons();
        };

        window.applySettingsData = applySettingsData;
    }

    /************************************************************
     * STYLES
     ************************************************************/

    function ensureAdminFeatureStyles() {
        if (document.getElementById('adminFeaturesFixStyles')) return;

        const style = document.createElement('style');
        style.id = 'adminFeaturesFixStyles';

        style.textContent = `
            #adminPasswordFixBtn {
                background: #8e44ad;
                color: white;
            }

            #adminPasswordFixBtn:hover {
                background: #6c3483;
            }

            #guestGridToggleBtn {
                background: #34495e;
                color: white;
            }

            #guestGridToggleBtn.grid-visible {
                background: #2ecc71;
            }

            #guestGridToggleBtn.grid-hidden {
                background: #e74c3c;
            }

            #guestGridToggleBtn:hover {
                filter: brightness(1.08);
            }

            .admin-feature-modal-note {
                color: var(--text-muted);
                font-size: 13px;
                margin-top: 8px;
                line-height: 1.5;
            }
        `;

        document.head.appendChild(style);
    }

    /************************************************************
     * PASSWORD MODAL
     ************************************************************/

    function ensurePasswordModal() {
        if (document.getElementById('adminPasswordFixModal')) return;

        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = 'adminPasswordFixModal';

        modal.innerHTML = `
            <div class="modal-content login-modal">
                <div class="modal-header">🔐 Изменить пароль админа</div>

                <div class="form-group">
                    <label>Новый пароль</label>
                    <input type="password" id="adminFeatureNewPassword" placeholder="Введите новый пароль">
                </div>

                <div class="form-group">
                    <label>Повторите пароль</label>
                    <input type="password" id="adminFeatureConfirmPassword" placeholder="Повторите новый пароль">
                    <div class="admin-feature-modal-note">
                        Пароль сохраняется в браузере администратора.
                    </div>
                </div>

                <div class="modal-actions">
                    <button class="btn btn-secondary" id="adminPasswordFixCancelBtn">Отмена</button>
                    <button class="btn btn-primary" id="adminPasswordFixSaveBtn">💾 Изменить пароль</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        document.getElementById('adminPasswordFixCancelBtn').onclick = closePasswordModal;
        document.getElementById('adminPasswordFixSaveBtn').onclick = saveAdminPasswordFromModal;

        const p1 = document.getElementById('adminFeatureNewPassword');
        const p2 = document.getElementById('adminFeatureConfirmPassword');

        [p1, p2].forEach(input => {
            if (!input) return;

            input.addEventListener('keydown', e => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    saveAdminPasswordFromModal();
                }
            });
        });
    }

    function openPasswordModal() {
        ensurePasswordModal();

        const modal = document.getElementById('adminPasswordFixModal');
        const p1 = document.getElementById('adminFeatureNewPassword');
        const p2 = document.getElementById('adminFeatureConfirmPassword');

        if (p1) p1.value = '';
        if (p2) p2.value = '';

        if (modal) modal.classList.add('active');

        setTimeout(() => {
            if (p1) p1.focus();
        }, 100);
    }

    function closePasswordModal() {
        const modal = document.getElementById('adminPasswordFixModal');

        if (modal) modal.classList.remove('active');
    }

    function saveAdminPasswordFromModal() {
        if (!state.isAdmin) {
            alert('Только админ может менять пароль');
            return;
        }

        const p1 = document.getElementById('adminFeatureNewPassword')?.value || '';
        const p2 = document.getElementById('adminFeatureConfirmPassword')?.value || '';

        if (!p1.trim()) {
            alert('Введите новый пароль');
            return;
        }

        if (p1 !== p2) {
            alert('Пароли не совпадают');
            return;
        }

        state.settings.adminPassword = p1;

        if (typeof saveAdminState === 'function') {
            saveAdminState();
        } else {
            localStorage.setItem('pokerTimerPassword', p1);
        }

        closePasswordModal();

        alert('Пароль админа изменён');
    }

    /************************************************************
     * HEADER BUTTONS
     ************************************************************/

    function ensureAdminFeatureButtons() {
        ensureAdminFeatureStyles();
        ensurePasswordModal();

        const userInfo = document.querySelector('.user-info');
        const logoutBtn = document.getElementById('logoutBtn');
        const editorBtn = document.getElementById('editorBtn');

        if (!userInfo) return;

        if (!document.getElementById('adminPasswordFixBtn')) {
            const btn = document.createElement('button');
            btn.className = 'btn';
            btn.id = 'adminPasswordFixBtn';
            btn.type = 'button';
            btn.textContent = '🔐 Изменить пароль';
            btn.style.display = 'none';
            btn.onclick = openPasswordModal;

            if (logoutBtn) {
                userInfo.insertBefore(btn, logoutBtn);
            } else {
                userInfo.appendChild(btn);
            }
        }

        if (!document.getElementById('guestGridToggleBtn')) {
            const btn = document.createElement('button');
            btn.className = 'btn';
            btn.id = 'guestGridToggleBtn';
            btn.type = 'button';
            btn.style.display = 'none';
            btn.onclick = toggleGuestGridVisibility;

            if (editorBtn) {
                userInfo.insertBefore(btn, editorBtn.nextSibling);
            } else if (logoutBtn) {
                userInfo.insertBefore(btn, logoutBtn);
            } else {
                userInfo.appendChild(btn);
            }
        }

        updateAdminFeatureButtons();
    }

    function updateAdminFeatureButtons() {
        const passwordBtn = document.getElementById('adminPasswordFixBtn');
        const toggleBtn = document.getElementById('guestGridToggleBtn');

        const isAdmin = !!state.isAdmin;
        const guestGridVisible = state.settings.guestGridVisible !== false;

        if (passwordBtn) {
            passwordBtn.style.display = isAdmin ? 'inline-block' : 'none';
        }

        if (toggleBtn) {
            toggleBtn.style.display = isAdmin ? 'inline-block' : 'none';

            toggleBtn.classList.remove('grid-visible', 'grid-hidden');

            if (guestGridVisible) {
                toggleBtn.classList.add('grid-visible');
                toggleBtn.textContent = '👁 Сетка гостям: Показана';
                toggleBtn.title = 'Нажми, чтобы скрыть сетку от гостей';
            } else {
                toggleBtn.classList.add('grid-hidden');
                toggleBtn.textContent = '🙈 Сетка гостям: Скрыта';
                toggleBtn.title = 'Нажми, чтобы показать сетку гостям';
            }
        }
    }

    /************************************************************
     * GUEST GRID VISIBILITY
     ************************************************************/

    function applyGuestGridVisibility() {
        const gridBtn = document.getElementById('gridBtn');
        const gridPage = document.getElementById('gridPage');

        const guestGridVisible = state.settings.guestGridVisible !== false;

        /**
         * Админ всегда видит сетку.
         */
        if (state.isAdmin) {
            if (gridBtn) gridBtn.style.display = 'inline-block';
            if (gridPage) gridPage.dataset.guestHidden = '0';
            return;
        }

        /**
         * Гость.
         */
        if (guestGridVisible) {
            if (gridBtn) gridBtn.style.display = 'inline-block';
            if (gridPage) gridPage.dataset.guestHidden = '0';
        } else {
            if (gridBtn) gridBtn.style.display = 'none';
            if (gridPage) gridPage.dataset.guestHidden = '1';

            /**
             * Если гость уже находится на странице сетки,
             * отправляем его обратно на таймер.
             */
            if (state.currentPage === 'gridPage') {
                if (typeof showPage === 'function') {
                    showPage('timerPage');
                } else {
                    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
                    const timerPage = document.getElementById('timerPage');
                    if (timerPage) timerPage.classList.add('active');
                    state.currentPage = 'timerPage';
                }
            }
        }
    }

    function toggleGuestGridVisibility() {
        if (!state.isAdmin) {
            alert('Только админ может менять видимость сетки');
            return;
        }

        const current = state.settings.guestGridVisible !== false;

        state.settings.guestGridVisible = !current;

        applyGuestGridVisibility();
        updateAdminFeatureButtons();

        /**
         * Сохраняем локально и в Supabase.
         * saveSettingsData уже использует cloudSet('settings', ...)
         */
        if (typeof saveSettingsData === 'function') {
            saveSettingsData();
        } else {
            localStorage.setItem('pokerSettings', JSON.stringify({
                primaryColor: state.settings.primaryColor,
                volume: state.settings.volume,
                totalPoints: state.settings.totalPoints,
                prizePlaces: state.settings.prizePlaces,
                tournament: state.tournament,
                guestGridVisible: state.settings.guestGridVisible
            }));
        }

        alert(
            state.settings.guestGridVisible !== false
                ? 'Сетка снова показана гостям'
                : 'Сетка скрыта от гостей'
        );
    }

    /************************************************************
     * PATCH updateAdminUI
     ************************************************************/

    if (typeof updateAdminUI === 'function' && !window.__ADMIN_FEATURES_UPDATE_UI_PATCHED__) {
        window.__ADMIN_FEATURES_UPDATE_UI_PATCHED__ = true;

        const originalUpdateAdminUI = updateAdminUI;

        updateAdminUI = function () {
            originalUpdateAdminUI();

            ensureAdminFeatureButtons();
            applyGuestGridVisibility();
            updateAdminFeatureButtons();
        };

        window.updateAdminUI = updateAdminUI;
    }

    /************************************************************
     * PATCH applyCloudRow
     *
     * Когда админ меняет настройку, гости получают settings realtime.
     ************************************************************/

    if (typeof applyCloudRow === 'function' && !window.__ADMIN_FEATURES_CLOUD_PATCHED__) {
        window.__ADMIN_FEATURES_CLOUD_PATCHED__ = true;

        const originalApplyCloudRow = applyCloudRow;

        applyCloudRow = function (row) {
            originalApplyCloudRow(row);

            try {
                if (row && row.key === 'settings') {
                    if (row.value && typeof row.value.guestGridVisible !== 'undefined') {
                        state.settings.guestGridVisible = row.value.guestGridVisible !== false;
                    }

                    applyGuestGridVisibility();
                    updateAdminFeatureButtons();
                }
            } catch (err) {
                console.warn('Admin features applyCloudRow error:', err);
            }
        };

        window.applyCloudRow = applyCloudRow;
    }

    /************************************************************
     * PATCH showPage
     *
     * Если гость вручную попытается открыть #gridPage,
     * а сетка скрыта — не пустим.
     ************************************************************/

    if (typeof showPage === 'function' && !window.__ADMIN_FEATURES_SHOW_PAGE_PATCHED__) {
        window.__ADMIN_FEATURES_SHOW_PAGE_PATCHED__ = true;

        const originalShowPage = showPage;

        showPage = function (pageId) {
            const guestGridVisible = state.settings.guestGridVisible !== false;

            if (!state.isAdmin && pageId === 'gridPage' && !guestGridVisible) {
                alert('Сетка сейчас скрыта администратором');
                pageId = 'timerPage';
            }

            originalShowPage(pageId);

            applyGuestGridVisibility();
            updateAdminFeatureButtons();
        };

        window.showPage = showPage;
    }

    /************************************************************
     * CLOUD FALLBACK POLLING
     *
     * Если realtime Supabase не сработает,
     * гость всё равно обновит настройку раз в 3 секунды.
     ************************************************************/

    let lastSettingsUpdatedAt = null;
    let settingsPollingStarted = false;

    async function loadSettingsFromCloudForGuestGrid() {
        try {
            if (state.isAdmin) return;

            if (!SUPABASE_URL || !SUPABASE_KEY) return;

            if (!window.supabase || typeof window.supabase.createClient !== 'function') {
                return;
            }

            if (!supabaseClient) {
                supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
            }

            const { data, error } = await supabaseClient
                .from('app_state')
                .select('key,value,updated_at')
                .eq('key', 'settings')
                .maybeSingle();

            if (error) {
                console.warn('Guest grid visibility settings read error:', error);
                return;
            }

            if (!data || !data.value) return;

            if (lastSettingsUpdatedAt && data.updated_at === lastSettingsUpdatedAt) {
                return;
            }

            lastSettingsUpdatedAt = data.updated_at;

            if (typeof data.value.guestGridVisible !== 'undefined') {
                state.settings.guestGridVisible = data.value.guestGridVisible !== false;

                if (typeof saveLocal === 'function') {
                    saveLocal('pokerSettings', {
                        primaryColor: state.settings.primaryColor,
                        volume: state.settings.volume,
                        totalPoints: state.settings.totalPoints,
                        prizePlaces: state.settings.prizePlaces,
                        tournament: state.tournament,
                        guestGridVisible: state.settings.guestGridVisible
                    });
                }

                applyGuestGridVisibility();
                updateAdminFeatureButtons();

                console.log('Guest grid visibility synced:', state.settings.guestGridVisible);
            }
        } catch (err) {
            console.warn('Guest grid visibility polling error:', err);
        }
    }

    function startSettingsPolling() {
        if (settingsPollingStarted) return;

        settingsPollingStarted = true;

        setInterval(() => {
            if (!state.isAdmin) {
                loadSettingsFromCloudForGuestGrid();
            }
        }, 3000);

        loadSettingsFromCloudForGuestGrid();
    }

    /************************************************************
     * INIT
     ************************************************************/

    function initAdminFeaturesFix() {
        ensureAdminFeatureButtons();

        /**
         * Если настройка уже была в localStorage, подхватим её.
         */
        try {
            const localSettingsRaw = localStorage.getItem('pokerSettings');

            if (localSettingsRaw) {
                const localSettings = JSON.parse(localSettingsRaw);

                if (typeof localSettings.guestGridVisible !== 'undefined') {
                    state.settings.guestGridVisible = localSettings.guestGridVisible !== false;
                }
            }
        } catch {}

        applyGuestGridVisibility();
        updateAdminFeatureButtons();

        startSettingsPolling();

        console.log('Admin Features Fix applied');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            initAdminFeaturesFix();

            setTimeout(initAdminFeaturesFix, 500);
            setTimeout(initAdminFeaturesFix, 1500);
            setTimeout(initAdminFeaturesFix, 3000);
        });
    } else {
        initAdminFeaturesFix();

        setTimeout(initAdminFeaturesFix, 500);
        setTimeout(initAdminFeaturesFix, 1500);
        setTimeout(initAdminFeaturesFix, 3000);
    }

    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            initAdminFeaturesFix();

            if (!state.isAdmin) {
                loadSettingsFromCloudForGuestGrid();
            }
        }
    });

})();