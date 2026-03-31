import { api } from "./client";

export interface Property {
  id: string;
  companyId: string;
  landlordId: string | null;
  unit: string | null;
  buildingName: string | null;
  streetAddress: string | null;
  area: string | null;
  propertyType: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  sqft: number | null;
  floor: number | null;
  viewType: string | null;
  parkingSpaces: number | null;
  titleDeedNo: string | null;
  photos: string[];
  saleValue: number | null;
  purchasePrice: number | null;
  rentalPrice: number | null;
  serviceCharge: number | null;
  listingType: string | null;
  pipelineStatus: string | null;
  status: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  leadCount: number;
  landlordName: string | null;
  landlordPhone: string | null;
  landlordEmail: string | null;
}

export interface PropertyListResponse {
  items: Property[];
  summary: Record<string, number>;
}

export interface PropertyLead {
  id: string;
  leadId: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  score: number | null;
  stage: string | null;
  interestLevel: string | null;
  linkedAt: string;
}

export interface PropertyFilters {
  listingType?: string;
  pipelineStatus?: string;
  area?: string;
  bedrooms?: number;
  propertyType?: string;
  priceMin?: number;
  priceMax?: number;
}

function buildQuery(filters?: PropertyFilters): string {
  if (!filters) return "";
  const params = new URLSearchParams();
  if (filters.listingType !== undefined) params.set("listingType", filters.listingType);
  if (filters.pipelineStatus !== undefined) params.set("pipelineStatus", filters.pipelineStatus);
  if (filters.area !== undefined) params.set("area", filters.area);
  if (filters.bedrooms !== undefined) params.set("bedrooms", String(filters.bedrooms));
  if (filters.propertyType !== undefined) params.set("propertyType", filters.propertyType);
  if (filters.priceMin !== undefined) params.set("priceMin", String(filters.priceMin));
  if (filters.priceMax !== undefined) params.set("priceMax", String(filters.priceMax));
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export const propertiesApi = {
  list: (companyId: string, filters?: PropertyFilters) =>
    api.get<PropertyListResponse>(
      `/companies/${encodeURIComponent(companyId)}/properties${buildQuery(filters)}`,
    ),

  get: (companyId: string, propertyId: string) =>
    api.get<Property>(
      `/companies/${encodeURIComponent(companyId)}/properties/${encodeURIComponent(propertyId)}`,
    ),

  create: (companyId: string, data: Record<string, unknown>) =>
    api.post<Property>(`/companies/${encodeURIComponent(companyId)}/properties`, data),

  update: (companyId: string, propertyId: string, data: Record<string, unknown>) =>
    api.patch<Property>(
      `/companies/${encodeURIComponent(companyId)}/properties/${encodeURIComponent(propertyId)}`,
      data,
    ),

  remove: (companyId: string, propertyId: string) =>
    api.delete<{ ok: true }>(
      `/companies/${encodeURIComponent(companyId)}/properties/${encodeURIComponent(propertyId)}`,
    ),

  listLeads: (companyId: string, propertyId: string) =>
    api.get<PropertyLead[]>(
      `/companies/${encodeURIComponent(companyId)}/properties/${encodeURIComponent(propertyId)}/leads`,
    ),

  linkLead: (companyId: string, propertyId: string, leadId: string, interestLevel?: string) =>
    api.post<PropertyLead>(
      `/companies/${encodeURIComponent(companyId)}/properties/${encodeURIComponent(propertyId)}/leads`,
      { leadId, interestLevel },
    ),

  unlinkLead: (companyId: string, propertyId: string, leadId: string) =>
    api.delete<{ ok: true }>(
      `/companies/${encodeURIComponent(companyId)}/properties/${encodeURIComponent(propertyId)}/leads/${encodeURIComponent(leadId)}`,
    ),
};
