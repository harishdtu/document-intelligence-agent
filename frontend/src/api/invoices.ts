import { apiClient } from "./client";
import type { Invoice, InvoiceCorrectionPayload } from "../types";

export const invoicesApi = {
  list: () => apiClient.get<Invoice[]>("/invoices"),
  get: (id: string) => apiClient.get<Invoice>(`/invoices/${id}`),
  upload: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return apiClient.postForm<Invoice>("/invoices/upload", form);
  },
  extract: (id: string) => apiClient.post<Invoice>(`/invoices/${id}/extract`),
  correct: (id: string, payload: InvoiceCorrectionPayload) => apiClient.patch<Invoice>(`/invoices/${id}`, payload),
  sourceUrl: (id: string) => `${import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/api"}/invoices/${id}/source`
};
