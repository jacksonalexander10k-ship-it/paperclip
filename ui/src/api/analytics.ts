import { api } from "./client";

export interface AnalyticsSummary {
  dateRange: { start: string; end: string };
  agents: Array<{
    agentId: string;
    name: string;
    role: string;
    totalRuns: number;
    succeededRuns: number;
    failedRuns: number;
    successRate: number;
    costCents: number;
  }>;
  totals: {
    agents: number;
    runs: number;
    succeededRuns: number;
    failedRuns: number;
    successRate: number;
    costCents: number;
    tasksCompleted: number;
  };
  trends: {
    dailyCosts: Array<{ date: string; totalCents: number }>;
    dailyRuns: Array<{ date: string; total: number; succeeded: number; failed: number }>;
  };
}

export const analyticsApi = {
  summary: (companyId: string, start?: string, end?: string) => {
    const params = new URLSearchParams();
    if (start) params.set("start", start);
    if (end) params.set("end", end);
    const qs = params.toString();
    return api.get<AnalyticsSummary>(
      `/companies/${companyId}/analytics${qs ? `?${qs}` : ""}`,
    );
  },
};
