import { useCallback, useEffect, useState } from "react";
import { invoicesApi } from "../api/invoices";
import { ApiError } from "../api/client";
import type { Invoice } from "../types";

export function useInvoice(id: string | undefined) {
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await invoicesApi.get(id);
      setInvoice(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load invoice.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { invoice, setInvoice, loading, error, refresh };
}
