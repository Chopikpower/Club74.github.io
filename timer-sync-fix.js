/************************************************************
 * TIMER CLOUD SYNC FIX
 *
 * ПРОБЛЕМА:
 * У гостей таймер обновлялся только через Supabase Realtime
 * (WebSocket-подписка в subscribeCloud()). Если сокет обрывается —
 * экран телефона заблокировался, вкладка свернулась в фон,
 * просела сеть на турнире — событие Realtime теряется без следа.
 * Ничего его не подхватывает, пока канал сам не переподключится,
 * из-за чего таймер у гостей "зависает", запускается с большой
 * задержкой или не реагирует на паузу вовсе.
 *
 * У блока 'settings' уже был запасной поллинг на такой случай
 * (см. admin-features-fix.js -> loadSettingsFromCloudForGuestGrid),
 * а у 'timer' — не было. Этот файл добавляет то же самое для timer:
 * гость раз в 2 секунды дочитывает актуальное состояние таймера
 * напрямую из базы, независимо от того, жив realtime-канал или нет.
 ************************************************************/

(function () {
    if (window.__TIMER_SYNC_FIX_PATCHED__) return;
    window.__TIMER_SYNC_FIX_PATCHED__ = true;

    let lastTimerUpdatedAt = null;
    let pollingStarted = false;

    async function pollTimerFromCloud() {
        try {
            // Админ — источник истины сам по себе, ему поллинг не нужен.
            if (state.isAdmin) return;

            if (!supabaseClient) return;

            const { data, error } = await supabaseClient
                .from('app_state')
                .select('key,value,updated_at')
                .eq('key', 'timer')
                .maybeSingle();

            if (error) {
                console.warn('Timer polling read error:', error);
                return;
            }

            if (!data || !data.value) return;

            // Ничего не изменилось с прошлого раза — пропускаем,
            // чтобы не дёргать applyCloudRow впустую.
            if (lastTimerUpdatedAt && data.updated_at === lastTimerUpdatedAt) return;

            lastTimerUpdatedAt = data.updated_at;

            if (typeof applyCloudRow === 'function') {
                applyingRemote = true;
                applyCloudRow({ key: 'timer', value: data.value });
                applyingRemote = false;
            }
        } catch (err) {
            console.warn('Timer polling error:', err);
        }
    }

    function startTimerPolling() {
        if (pollingStarted) return;
        pollingStarted = true;

        setInterval(pollTimerFromCloud, 2000);
        pollTimerFromCloud();
    }

    function boot() {
        startTimerPolling();

        // Как только устройство "проснулось" (вернулись в приложение,
        // разблокировали телефон, восстановился интернет) —
        // сразу же принудительно подтягиваем актуальное состояние,
        // не дожидаясь ближайшего тика поллинга.
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) pollTimerFromCloud();
        });

        window.addEventListener('online', pollTimerFromCloud);
        window.addEventListener('focus', pollTimerFromCloud);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }

    // На случай, если supabaseClient создаётся с задержкой
    // (initSupabase ещё не успел отработать к моменту загрузки этого файла).
    setTimeout(boot, 800);
    setTimeout(boot, 2000);
})();
