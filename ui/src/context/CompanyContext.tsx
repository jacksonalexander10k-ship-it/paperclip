import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Company } from "@paperclipai/shared";
import { companiesApi } from "../api/companies";
import { ApiError } from "../api/client";
import { queryKeys } from "../lib/queryKeys";
import type { CompanySelectionSource } from "../lib/company-selection";
type CompanySelectionOptions = { source?: CompanySelectionSource };

interface CompanyContextValue {
  companies: Company[];
  selectedCompanyId: string | null;
  selectedCompany: Company | null;
  selectionSource: CompanySelectionSource;
  loading: boolean;
  error: Error | null;
  setSelectedCompanyId: (companyId: string, options?: CompanySelectionOptions) => void;
  reloadCompanies: () => Promise<void>;
  createCompany: (data: {
    name: string;
    description?: string | null;
    budgetMonthlyCents?: number;
  }) => Promise<Company>;
}

const STORAGE_KEY = "paperclip.selectedCompanyId";

const CompanyContext = createContext<CompanyContextValue | null>(null);

export function CompanyProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [selectionSource, setSelectionSource] = useState<CompanySelectionSource>("bootstrap");
  // Prefer the company implied by the current URL path over the stale
  // localStorage value. Prevents a flash of the previously-selected company
  // (stale UUID, wrong data, extra WS connection) when the user deep-links
  // into /ABC/... with ABC different from the last session.
  const [selectedCompanyId, setSelectedCompanyIdState] = useState<string | null>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (typeof window === "undefined") return stored;
    const prefixMatch = window.location.pathname.match(/^\/([A-Za-z0-9-]{2,10})(?:\/|$)/);
    const urlPrefix = prefixMatch?.[1]?.toUpperCase();
    // If URL has a prefix, clear the bootstrap selection so queries don't
    // fire against the stale company while the URL-resolved one loads. The
    // route-sync effect below will populate selectedCompanyId once companies
    // list loads.
    if (urlPrefix) return null;
    return stored;
  });

  const { data: companies = [], isLoading, error } = useQuery({
    queryKey: queryKeys.companies.all,
    queryFn: async () => {
      try {
        return await companiesApi.list();
      } catch (err) {
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          return [];
        }
        throw err;
      }
    },
    retry: false,
  });
  const sidebarCompanies = useMemo(
    () => companies.filter((company) => company.status !== "archived"),
    [companies],
  );

  // Auto-select first company when list loads
  useEffect(() => {
    if (companies.length === 0) return;

    const selectableCompanies = sidebarCompanies.length > 0 ? sidebarCompanies : companies;
    const stored = localStorage.getItem(STORAGE_KEY);

    // If stored company still exists, keep it
    if (stored && selectableCompanies.some((c) => c.id === stored)) {
      // Ensure state matches localStorage (e.g. after deletion of another company)
      if (selectedCompanyId !== stored) {
        setSelectedCompanyIdState(stored);
        setSelectionSource("bootstrap");
      }
      return;
    }

    if (selectedCompanyId && selectableCompanies.some((c) => c.id === selectedCompanyId)) return;

    // Stored company was deleted or doesn't exist — select first available
    const next = selectableCompanies[0]!.id;
    setSelectedCompanyIdState(next);
    setSelectionSource("bootstrap");
    localStorage.setItem(STORAGE_KEY, next);
  }, [companies, selectedCompanyId, sidebarCompanies]);

  const setSelectedCompanyId = useCallback((companyId: string, options?: CompanySelectionOptions) => {
    setSelectedCompanyIdState(companyId);
    setSelectionSource(options?.source ?? "manual");
    localStorage.setItem(STORAGE_KEY, companyId);
  }, []);

  const reloadCompanies = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.companies.all });
  }, [queryClient]);

  const createMutation = useMutation({
    mutationFn: (data: {
      name: string;
      description?: string | null;
      budgetMonthlyCents?: number;
    }) =>
      companiesApi.create(data),
    onSuccess: (company) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.companies.all });
      setSelectedCompanyId(company.id);
    },
  });

  const createCompany = useCallback(
    async (data: {
      name: string;
      description?: string | null;
      budgetMonthlyCents?: number;
    }) => {
      return createMutation.mutateAsync(data);
    },
    [createMutation],
  );

  const selectedCompany = useMemo(
    () => companies.find((company) => company.id === selectedCompanyId) ?? null,
    [companies, selectedCompanyId],
  );

  const value = useMemo(
    () => ({
      companies,
      selectedCompanyId,
      selectedCompany,
      selectionSource,
      loading: isLoading,
      error: error as Error | null,
      setSelectedCompanyId,
      reloadCompanies,
      createCompany,
    }),
    [
      companies,
      selectedCompanyId,
      selectedCompany,
      selectionSource,
      isLoading,
      error,
      setSelectedCompanyId,
      reloadCompanies,
      createCompany,
    ],
  );

  return <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>;
}

export function useCompany() {
  const ctx = useContext(CompanyContext);
  if (!ctx) {
    throw new Error("useCompany must be used within CompanyProvider");
  }
  return ctx;
}
