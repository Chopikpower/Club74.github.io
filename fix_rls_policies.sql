-- Разрешаем публичному (anon) ключу писать в app_state.
-- Приложение и так ограничивает запись на клиенте (только при state.isAdmin === true),
-- но на уровне базы записи сейчас блокируются полностью — их и нужно разрешить.

create policy "public_write_app_state_insert"
on public.app_state
for insert
to public
with check (true);

create policy "public_write_app_state_update"
on public.app_state
for update
to public
using (true)
with check (true);
