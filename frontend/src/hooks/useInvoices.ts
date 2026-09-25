import { useCallback, useEffect, useState } from "react";
import { invoicesApi } from "../api/invoices";
import { ApiError } from "../api/client";
import type { Invoice } from "../types";

export function useInvoices() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await invoicesApi.list();
      setInvoices(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load invoices.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { invoices, loading, error, refresh };
}
