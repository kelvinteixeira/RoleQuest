/**
 * Voice chat signalling over a private Supabase Realtime broadcast channel,
 * "voice:<campaign id>". Realtime Authorization (RLS on realtime.messages, see
 * supabase/migrations/20261110000000_voice_chat.sql) lets only campaign
 * members join it. The audio never passes through Supabase: browsers use these
 * messages to open WebRTC calls with each other.
 */
import { supabase } from "@/lib/supabase/client";
import type { VoiceEnvelope, VoiceSignalRepository } from "../contracts";

export const supabaseVoiceSignal: VoiceSignalRepository = {
  connect(campaignId, onSignal, onStatus) {
    const client = supabase();
    const channel = client
      .channel(`voice:${campaignId}`, { config: { private: true, broadcast: { self: false } } })
      .on("broadcast", { event: "signal" }, ({ payload }) => onSignal(payload as VoiceEnvelope))
      .subscribe((status) => {
        if (status === "SUBSCRIBED") onStatus("connected");
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") onStatus("offline");
      });
    return {
      send(envelope) {
        void channel.send({ type: "broadcast", event: "signal", payload: envelope });
      },
      close() {
        void client.removeChannel(channel);
      },
    };
  },
};
