-- Role Quest — voice chat at the table.
--
-- Members talk over WebRTC, straight between browsers. To find each other they
-- exchange small signalling messages on a private Realtime broadcast channel
-- named "voice:<campaign id>". These policies (Realtime Authorization) let only
-- members of that campaign join the channel, send on it and hear it.

create policy voice_members_receive on realtime.messages for select to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and realtime.topic() like 'voice:%'
    and public.is_member(substr(realtime.topic(), 7))
  );

create policy voice_members_send on realtime.messages for insert to authenticated
  with check (
    realtime.messages.extension = 'broadcast'
    and realtime.topic() like 'voice:%'
    and public.is_member(substr(realtime.topic(), 7))
  );
