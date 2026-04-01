const GRAPH_API = "https://graph.facebook.com/v21.0";

export function facebookAdsService() {
  async function graphPost(path: string, token: string, params: Record<string, unknown>) {
    const res = await fetch(`${GRAPH_API}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(params),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`Facebook API error: ${JSON.stringify(data)}`);
    return data;
  }

  async function graphGet(path: string, token: string, fields?: string) {
    const url = new URL(`${GRAPH_API}${path}`);
    url.searchParams.set("access_token", token);
    if (fields) url.searchParams.set("fields", fields);
    const res = await fetch(url.toString());
    const data = await res.json();
    if (!res.ok) throw new Error(`Facebook API error: ${JSON.stringify(data)}`);
    return data;
  }

  return {
    createCampaign: (token: string, adAccountId: string, params: {
      name: string;
      objective: string;
      status?: string;
      special_ad_categories?: string[];
    }) => graphPost(`/${adAccountId}/campaigns`, token, {
      ...params,
      special_ad_categories: params.special_ad_categories ?? ["HOUSING"],
      status: params.status ?? "PAUSED",
    }),

    createAdSet: (token: string, adAccountId: string, params: {
      name: string;
      campaign_id: string;
      daily_budget: number;
      billing_event: string;
      optimization_goal: string;
      targeting: Record<string, unknown>;
      start_time?: string;
      end_time?: string;
      status?: string;
    }) => graphPost(`/${adAccountId}/adsets`, token, {
      ...params,
      billing_event: params.billing_event ?? "IMPRESSIONS",
      status: params.status ?? "PAUSED",
    }),

    createAd: (token: string, adAccountId: string, params: {
      name: string;
      adset_id: string;
      creative: Record<string, unknown>;
      status?: string;
    }) => graphPost(`/${adAccountId}/ads`, token, {
      ...params,
      status: params.status ?? "PAUSED",
    }),

    createLeadForm: (token: string, pageId: string, params: {
      name: string;
      questions: Array<{ type: string; key?: string; label?: string }>;
      privacy_policy?: { url: string; link_text?: string };
      thank_you_page?: { title: string; body: string };
    }) => graphPost(`/${pageId}/leadgen_forms`, token, params),

    getCampaignInsights: (token: string, campaignId: string) =>
      graphGet(`/${campaignId}/insights`, token, "impressions,clicks,spend,cpc,cpm,ctr,actions"),

    pauseCampaign: (token: string, campaignId: string) =>
      graphPost(`/${campaignId}`, token, { status: "PAUSED" }),

    resumeCampaign: (token: string, campaignId: string) =>
      graphPost(`/${campaignId}`, token, { status: "ACTIVE" }),

    updateBudget: (token: string, adSetId: string, dailyBudget: number) =>
      graphPost(`/${adSetId}`, token, { daily_budget: dailyBudget }),

    getLeadData: (token: string, leadId: string) =>
      graphGet(`/${leadId}`, token, "field_data,created_time,ad_id,form_id"),
  };
}
