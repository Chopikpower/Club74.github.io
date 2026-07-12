/************************************************************
 * CLOCK SYNC FIX
 *
 * ПРОБЛЕМА:
 * Таймер считает оставшееся время как targetEndTime - now(),
 * где now() = Date.now() — то есть системные часы КОНКРЕТНОГО
 * устройства. targetEndTime у всех устройств одинаковый (пришёл
 * из облака), но если часы телефонов чуть разошлись (а на
 * практике так почти всегда) — на экранах будет разное
 * оставшееся время, хотя данные синхронизированы идеально.
 *
 * ФИКС:
 * Периодически сверяем часы устройства с часами сервера
 * Supabase (берём заголовок Date из обычного HTTP-ответа) и
 * считаем разницу (clockOffsetMs). Дальше во всём приложении
 * now() возвращает не "голый" Date.now(), а время, скорректированное
 * на эту разницу — то есть все устройства ориентируются на одно
 * и то же "серверное" время, а не на свои локальные часы.
 ************************************************************/

(function () {
    if (window.__CLOCK_SYNC_FIX_PATCHED__) return;
    window.__CLOCK_SYNC_FIX_PATCHED__ = true;

    let clockOffsetMs = 0;

    // Оригинальный now() из app.js возвращал голый Date.now().
    // Подменяем на версию с поправкой на смещение серверных часов.
    window.now = function () {
        return Date.now() + clockOffsetMs;
    };

    async function syncClockOffset() {
        try {
            if (!SUPABASE_URL || !SUPABASE_KEY) return;

            const t0 = Date.now();

            const res = await fetch(
                `${SUPABASE_URL}/rest/v1/app_state?select=key&limit=1`,
                {
                    method: 'GET',
                    headers: {
                        apikey: SUPABASE_KEY,
                        Authorization: `Bearer ${SUPABASE_KEY}`
                    }
                }
            );

            const t1 = Date.now();

            const serverDateHeader = res.headers.get('date');
            if (!serverDateHeader) return;

            const serverTime = new Date(serverDateHeader).getTime();
            if (Number.isNaN(serverTime)) return;

            // Компенсируем время сетевого запроса — считаем,
            // что серверный момент соответствует середине round-trip.
            const rtt = t1 - t0;
            const estimatedServerNowAtT1 = serverTime + rtt / 2;

            clockOffsetMs = estimatedServerNowAtT1 - t1;

            console.log('Clock sync offset (ms):', Math.round(clockOffsetMs));
        } catch (err) {
            console.warn('Clock sync error:', err);
        }
    }

    function boot() {
        syncClockOffset();

        // Переустанавливаем поправку раз в минуту — часы могут
        // "поплыть" за время долгой сессии.
        setInterval(syncClockOffset, 60000);

        // И сразу же при возврате устройства к жизни —
        // после блокировки экрана, сворачивания вкладки, обрыва сети.
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) syncClockOffset();
        });

        window.addEventListener('online', syncClockOffset);
        window.addEventListener('focus', syncClockOffset);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})();
