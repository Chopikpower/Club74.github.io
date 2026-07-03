/************************************************************
 * ADMIN PASSWORD CLOUD FIX
 *
 * Что исправляет:
 * ✅ Пароль админа работает в новом браузере
 * ✅ Пароль админа работает в инкогнито
 * ✅ Пароль синхронизируется через Supabase
 * ✅ Старый localStorage-пароль переносится в облако
 *
 * Подключать ПОСЛЕ app.js и после admin-features-fix.js:
 *
 * <script src="app.js"></script>
 * <script src="sound-fix.js"></script>
 * <script src="admin-features-fix.js"></script>
 * <script src="admin-password-cloud-fix.js"></script>
 ************************************************************/

(function () {
    if (window.__ADMIN_PASSWORD_CLOUD_FIX_LOADED__) return;
    window.__ADMIN_PASSWORD_CLOUD_FIX_LOADED__ = true;

    console.log('Admin Password Cloud Fix loaded');

    if (typeof state === 'undefined') {
        console.error('admin-password-cloud-fix.js: state не найден. Подключи файл после app.js');
        return;
    }

    if (!state.settings) state.settings = {};

    /************************************************************
     * DEFAULT PASSWORD INIT
     ************************************************************/

    function getLocalAdminPassword() {
        return (
            localStorage.getItem('pokerTimerPassword') ||
            state.settings.adminPassword ||
            'secret'
        );
    }

    state.settings.adminPassword = getLocalAdminPassword();

    /************************************************************
     * PATCH makeSettingsData
     * Добавляем adminPassword в объект настроек, который уходит в Supabase.
     ************************************************************/

    if (typeof makeSettingsData === 'function' && !window.__PASSWORD_FIX_MAKE_SETTINGS_PATCHED__) {
        window.__PASSWORD_FIX_MAKE_SETTINGS_PATCHED__ = true;

        const originalMakeSettingsData = makeSettingsData;

        makeSettingsData = function () {
            const data = originalMakeSettingsData();

            data.adminPassword = state.settings.adminPassword || getLocalAdminPassword();

            if (typeof state.settings.guestGridVisible !== 'undefined') {
                data.guestGridVisible = state.settings.guestGridVisible !== false;
            }

            return data;
        };

        window.makeSettingsData = makeSettingsData;
    }

    /************************************************************
     * PATCH applySettingsData
     * Читаем adminPassword из Supabase.
     ************************************************************/

    if (typeof applySettingsData === 'function' && !window.__PASSWORD_FIX_APPLY_SETTINGS_PATCHED__) {
        window.__PASSWORD_FIX_APPLY_SETTINGS_PATCHED__ = true;

        const originalApplySettingsData = applySettingsData;

        applySettingsData = function (data) {
            originalApplySettingsData(data || {});

            if (data && typeof data.adminPassword !== 'undefined' && data.adminPassword) {
                state.settings.adminPassword = String(data.adminPassword);
                localStorage.setItem('pokerTimerPassword', state.settings.adminPassword);
            }

            if (data && typeof data.guestGridVisible !== 'undefined') {
                state.settings.guestGridVisible = data.guestGridVisible !== false;
            }
        };

        window.applySettingsData = applySettingsData;
    }

    /************************************************************
     * SUPABASE HELPERS
     ************************************************************/

    async function ensureSupabaseClient() {
        if (supabaseClient) return supabaseClient;

        if (!SUPABASE_URL || !SUPABASE_KEY) {
            console.warn('Supabase URL/KEY отсутствуют');
            return null;
        }

        if (!window.supabase || typeof window.supabase.createClient !== 'function') {
            console.warn('Supabase SDK не подключён');
            return null;
        }

        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        return supabaseClient;
    }

    async function readCloudSettings() {
        try {
            const client = await ensureSupabaseClient();
            if (!client) return null;

            const { data, error } = await client
                .from('app_state')
                .select('key,value,updated_at')
                .eq('key', 'settings')
                .maybeSingle();

            if (error) {
                console.warn('Ошибка чтения settings из Supabase:', error);
                return null;
            }

            if (!data || !data.value) return null;

            if (typeof applySettingsData === 'function') {
                applySettingsData(data.value);
            }

            if (typeof saveLocal === 'function') {
                saveLocal('pokerSettings', {
                    ...data.value,
                    adminPassword: state.settings.adminPassword
                });
            } else {
                localStorage.setItem('pokerSettings', JSON.stringify({
                    ...data.value,
                    adminPassword: state.settings.adminPassword
                }));
            }

            return data.value;
        } catch (err) {
            console.warn('readCloudSettings error:', err);
            return null;
        }
    }

    async function writeCloudSettings() {
        try {
            const client = await ensureSupabaseClient();
            if (!client) return;

            const value = typeof makeSettingsData === 'function'
                ? makeSettingsData()
                : {
                    primaryColor: state.settings.primaryColor,
                    volume: state.settings.volume,
                    totalPoints: state.settings.totalPoints,
                    prizePlaces: state.settings.prizePlaces,
                    tournament: state.tournament,
                    guestGridVisible: state.settings.guestGridVisible !== false,
                    adminPassword: state.settings.adminPassword || getLocalAdminPassword()
                };

            value.adminPassword = state.settings.adminPassword || getLocalAdminPassword();

            const { error } = await client
                .from('app_state')
                .upsert({
                    key: 'settings',
                    value,
                    updated_at: new Date().toISOString()
                });

            if (error) {
                console.warn('Ошибка записи settings в Supabase:', error);
                return;
            }

            console.log('Пароль админа сохранён в Supabase');
        } catch (err) {
            console.warn('writeCloudSettings error:', err);
        }
    }

    /************************************************************
     * PASSWORD SAVE
     ************************************************************/

    async function saveAdminPasswordEverywhere(password) {
        password = String(password || '').trim();

        if (!password) {
            alert('Введите пароль');
            return false;
        }

        state.settings.adminPassword = password;

        localStorage.setItem('pokerTimerPassword', password);

        try {
            const localSettingsRaw = localStorage.getItem('pokerSettings');
            const localSettings = localSettingsRaw ? JSON.parse(localSettingsRaw) : {};

            localSettings.adminPassword = password;

            if (typeof state.settings.guestGridVisible !== 'undefined') {
                localSettings.guestGridVisible = state.settings.guestGridVisible !== false;
            }

            localStorage.setItem('pokerSettings', JSON.stringify(localSettings));
        } catch {
            localStorage.setItem('pokerSettings', JSON.stringify({
                adminPassword: password
            }));
        }

        await writeCloudSettings();

        return true;
    }

    /************************************************************
     * LOGIN FIX
     ************************************************************/

    async function loginWithCloudPassword() {
        const input = document.getElementById('adminPassword');
        const pass = input ? input.value : '';

        /**
         * Перед проверкой пароля читаем актуальный пароль из Supabase.
         */
        await readCloudSettings();

        const correctPassword = state.settings.adminPassword || 'secret';

        if (pass === correctPassword) {
            state.isAdmin = true;

            localStorage.setItem('pokerTimerIsAdmin', 'true');
            localStorage.setItem('pokerTimerPassword', correctPassword);

            if (typeof saveAdminState === 'function') {
                saveAdminState();
            }

            const modal = document.getElementById('loginModal');
            if (modal) modal.classList.remove('active');

            if (input) input.value = '';

            if (typeof updateAdminUI === 'function') updateAdminUI();
            if (typeof renderTables === 'function') renderTables();
            if (typeof updateTimerDisplay === 'function') updateTimerDisplay();

            /**
             * Если в Supabase ещё не было пароля, сохраняем текущий.
             */
            await writeCloudSettings();

            console.log('Вход админа успешен');
        } else {
            alert('Неверный пароль');
        }
    }

    function patchLoginButton() {
        const btn = document.getElementById('confirmLoginBtn');

        if (btn && btn.dataset.passwordCloudFix !== '1') {
            btn.dataset.passwordCloudFix = '1';

            /**
             * capture=true + stopImmediatePropagation
             * блокирует старый обработчик входа, который проверял только localStorage.
             */
            btn.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopImmediatePropagation();

                loginWithCloudPassword();
            }, true);
        }

        const input = document.getElementById('adminPassword');

        if (input && input.dataset.passwordCloudEnterFix !== '1') {
            input.dataset.passwordCloudEnterFix = '1';

            input.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    e.stopImmediatePropagation();

                    loginWithCloudPassword();
                }
            }, true);
        }
    }

    /************************************************************
     * CHANGE PASSWORD FIX
     * Перехватывает старую кнопку из вкладки настроек.
     ************************************************************/

    async function changePasswordFromSettingsTab() {
        if (!state.isAdmin) {
            alert('Только админ может менять пароль');
            return;
        }

        const p1 = document.getElementById('newPassword')?.value || '';
        const p2 = document.getElementById('confirmPassword')?.value || '';

        if (!p1.trim()) {
            alert('Введите новый пароль');
            return;
        }

        if (p1 !== p2) {
            alert('Пароли не совпадают');
            return;
        }

        const ok = await saveAdminPasswordEverywhere(p1);

        if (!ok) return;

        const input1 = document.getElementById('newPassword');
        const input2 = document.getElementById('confirmPassword');

        if (input1) input1.value = '';
        if (input2) input2.value = '';

        alert('Пароль изменён и сохранён в облако');
    }

    /************************************************************
     * CHANGE PASSWORD FIX
     * Перехватывает кнопку из admin-features-fix.js, если она подключена.
     ************************************************************/

    async function changePasswordFromAdminFeatureModal() {
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

        const ok = await saveAdminPasswordEverywhere(p1);

        if (!ok) return;

        const input1 = document.getElementById('adminFeatureNewPassword');
        const input2 = document.getElementById('adminFeatureConfirmPassword');
        const modal = document.getElementById('adminPasswordFixModal');

        if (input1) input1.value = '';
        if (input2) input2.value = '';
        if (modal) modal.classList.remove('active');

        alert('Пароль изменён и сохранён в облако');
    }

    function patchChangePasswordButtons() {
        /**
         * Делегированный обработчик.
         * Работает даже если кнопка появилась позже.
         */
        if (window.__PASSWORD_FIX_CHANGE_BUTTONS_PATCHED__) return;
        window.__PASSWORD_FIX_CHANGE_BUTTONS_PATCHED__ = true;

        document.addEventListener('click', function (e) {
            const target = e.target;

            if (!target) return;

            if (target.id === 'changePasswordBtn') {
                e.preventDefault();
                e.stopImmediatePropagation();

                changePasswordFromSettingsTab();
                return;
            }

            if (target.id === 'adminPasswordFixSaveBtn') {
                e.preventDefault();
                e.stopImmediatePropagation();

                changePasswordFromAdminFeatureModal();
                return;
            }
        }, true);
    }

    /************************************************************
     * PATCH saveAdminState
     ************************************************************/

    if (typeof saveAdminState === 'function' && !window.__PASSWORD_FIX_SAVE_ADMIN_PATCHED__) {
        window.__PASSWORD_FIX_SAVE_ADMIN_PATCHED__ = true;

        const originalSaveAdminState = saveAdminState;

        saveAdminState = function () {
            originalSaveAdminState();

            localStorage.setItem('pokerTimerPassword', state.settings.adminPassword || getLocalAdminPassword());

            if (state.isAdmin) {
                writeCloudSettings();
            }
        };

        window.saveAdminState = saveAdminState;
    }

    /************************************************************
     * PATCH applyCloudRow
     ************************************************************/

    if (typeof applyCloudRow === 'function' && !window.__PASSWORD_FIX_APPLY_CLOUD_PATCHED__) {
        window.__PASSWORD_FIX_APPLY_CLOUD_PATCHED__ = true;

        const originalApplyCloudRow = applyCloudRow;

        applyCloudRow = function (row) {
            originalApplyCloudRow(row);

            try {
                if (row && row.key === 'settings' && row.value) {
                    if (typeof row.value.adminPassword !== 'undefined' && row.value.adminPassword) {
                        state.settings.adminPassword = String(row.value.adminPassword);
                        localStorage.setItem('pokerTimerPassword', state.settings.adminPassword);
                    }
                }
            } catch (err) {
                console.warn('Password cloud applyCloudRow error:', err);
            }
        };

        window.applyCloudRow = applyCloudRow;
    }

    /************************************************************
     * BOOTSTRAP
     ************************************************************/

    async function bootstrapPasswordCloudFix() {
        patchLoginButton();
        patchChangePasswordButtons();

        /**
         * Сначала читаем пароль из облака.
         */
        const cloudSettings = await readCloudSettings();

        /**
         * Если пользователь уже админ в этом браузере,
         * но в облаке ещё нет adminPassword —
         * переносим локальный пароль в Supabase.
         */
        if (state.isAdmin) {
            const cloudHasPassword = cloudSettings && cloudSettings.adminPassword;

            if (!cloudHasPassword) {
                state.settings.adminPassword = getLocalAdminPassword();
                await writeCloudSettings();
                console.log('Локальный пароль админа перенесён в Supabase');
            }
        }

        patchLoginButton();

        console.log('Admin Password Cloud Fix applied');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            bootstrapPasswordCloudFix();

            setTimeout(bootstrapPasswordCloudFix, 500);
            setTimeout(bootstrapPasswordCloudFix, 1500);
            setTimeout(bootstrapPasswordCloudFix, 3000);
        });
    } else {
        bootstrapPasswordCloudFix();

        setTimeout(bootstrapPasswordCloudFix, 500);
        setTimeout(bootstrapPasswordCloudFix, 1500);
        setTimeout(bootstrapPasswordCloudFix, 3000);
    }

})();