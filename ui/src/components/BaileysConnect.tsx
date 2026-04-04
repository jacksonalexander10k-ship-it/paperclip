import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { QrCode, Check, Loader2, Unplug, Smartphone, Wifi, WifiOff } from "lucide-react";
import { baileysApi } from "../api/baileys";
import type { BaileysStatus } from "../api/baileys";
import { Button } from "./ui/button";
import { useCompany } from "../context/CompanyContext";
import type { LiveEvent } from "@paperclipai/shared";

interface BaileysConnectProps {
  agentId: string;
  agentName: string;
}

export function BaileysConnect({ agentId, agentName }: BaileysConnectProps) {
  const queryClient = useQueryClient();
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id ?? "";
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: status, isLoading } = useQuery({
    queryKey: ["agent-baileys", agentId],
    queryFn: () => baileysApi.status(agentId),
    refetchInterval: 10_000,
  });

  // Listen for live events (QR refresh, connected, disconnected)
  useEffect(() => {
    if (!companyId) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/realtime?companyId=${companyId}`;

    let ws: WebSocket | null = null;
    try {
      ws = new WebSocket(wsUrl);
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as LiveEvent;
          if (data.type === "baileys.qr" && (data.payload as any)?.agentId === agentId) {
            setQrDataUrl((data.payload as any).qrDataUrl);
          }
          if (data.type === "baileys.connected" && (data.payload as any)?.agentId === agentId) {
            setQrDataUrl(null);
            queryClient.invalidateQueries({ queryKey: ["agent-baileys", agentId] });
            queryClient.invalidateQueries({ queryKey: ["agent-whatsapp", agentId] });
          }
          if (data.type === "baileys.disconnected" && (data.payload as any)?.agentId === agentId) {
            setQrDataUrl(null);
            queryClient.invalidateQueries({ queryKey: ["agent-baileys", agentId] });
          }
        } catch { /* ignore parse errors */ }
      };
    } catch { /* WebSocket not available */ }

    return () => {
      ws?.close();
    };
  }, [companyId, agentId, queryClient]);

  const connectMutation = useMutation({
    mutationFn: () => baileysApi.connect(agentId, companyId),
    onSuccess: (result) => {
      if (result.qrDataUrl) {
        setQrDataUrl(result.qrDataUrl);
      }
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["agent-baileys", agentId] });
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Connection failed");
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: () => baileysApi.disconnect(agentId, true),
    onSuccess: () => {
      setQrDataUrl(null);
      queryClient.invalidateQueries({ queryKey: ["agent-baileys", agentId] });
      queryClient.invalidateQueries({ queryKey: ["agent-whatsapp", agentId] });
    },
  });

  if (isLoading) {
    return (
      <div className="rounded-lg border border-border p-4">
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Checking WhatsApp status...
        </div>
      </div>
    );
  }

  // Connected state
  if (status?.status === "connected") {
    return (
      <div className="rounded-lg border border-border p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-9 w-9 rounded-full bg-green-500/10">
              <Wifi className="h-4.5 w-4.5 text-green-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                WhatsApp Connected (QR)
                <Check className="h-3.5 w-3.5 text-green-500" />
              </p>
              <p className="text-xs text-muted-foreground">
                {status.phoneNumber ? `+${status.phoneNumber}` : "Connected via Baileys"}
                {" \u00B7 "}Messages flow through this agent
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => disconnectMutation.mutate()}
            disabled={disconnectMutation.isPending}
            className="text-muted-foreground hover:text-destructive"
          >
            <Unplug className="h-3.5 w-3.5 mr-1" />
            Disconnect
          </Button>
        </div>
      </div>
    );
  }

  // QR code scanning state
  if (qrDataUrl || status?.status === "qr_pending") {
    return (
      <div className="rounded-lg border border-border p-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center justify-center h-9 w-9 rounded-full bg-blue-500/10">
            <Smartphone className="h-4.5 w-4.5 text-blue-500" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Scan QR Code</p>
            <p className="text-xs text-muted-foreground">
              Open WhatsApp on your phone → Settings → Linked Devices → Link a Device
            </p>
          </div>
        </div>

        <div className="flex justify-center py-4">
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt="WhatsApp QR Code"
              className="w-64 h-64 rounded-lg border border-border"
            />
          ) : (
            <div className="w-64 h-64 rounded-lg border border-border flex items-center justify-center bg-muted">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>

        <p className="text-[10px] text-muted-foreground text-center mt-2">
          QR code refreshes automatically. Keep this screen open until connected.
        </p>
      </div>
    );
  }

  // Disconnected — show connect button
  return (
    <div className="rounded-lg border border-border p-4">
      <div className="flex items-center gap-3 mb-3">
        <div className="flex items-center justify-center h-9 w-9 rounded-full bg-muted">
          <QrCode className="h-4.5 w-4.5 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">WhatsApp (QR Code)</p>
          <p className="text-xs text-muted-foreground">
            Connect any WhatsApp number by scanning a QR code — {agentName} will handle messages
          </p>
        </div>
      </div>

      {error && (
        <p className="text-xs text-destructive mb-2">{error}</p>
      )}

      <Button
        variant="outline"
        size="sm"
        onClick={() => connectMutation.mutate()}
        disabled={connectMutation.isPending}
        className="w-full"
      >
        {connectMutation.isPending ? (
          <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
        ) : (
          <QrCode className="h-3.5 w-3.5 mr-1.5" />
        )}
        Connect via QR Code
      </Button>

      <p className="text-[10px] text-muted-foreground mt-2 leading-relaxed">
        Uses WhatsApp Web protocol. Connect any personal or business WhatsApp number — no API keys needed.
      </p>
    </div>
  );
}
