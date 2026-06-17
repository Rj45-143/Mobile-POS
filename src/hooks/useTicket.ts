import { useState } from "react";
import {
  saveTicket as saveTicketAPI,
  TicketPayload,
} from "../services/ticketService";

export const useTicket = () => {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saveTicket = async (ticketData: TicketPayload, token: string) => {
    setSaving(true);
    setError(null);

    try {
      const saved = await saveTicketAPI(ticketData, token);
      return saved;
    } catch (err: any) {
      setError(err.message || "Failed to save ticket");
      return null;
    } finally {
      setSaving(false);
    }
  };

  return { saveTicket, saving, error };
};
