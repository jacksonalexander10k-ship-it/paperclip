import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MessageCircle, Check, X, Loader2, Unplug, QrCode, Key } from "lucide-react";
import { agentCredentialsApi } from "../api/agent-credentials";
import { Button } from "./ui/button";
import { BaileysConnect } from "./BaileysConnect";

interface WhatsAppConnectProps {
  agentId: string;
  agentName: string;
}

export function WhatsAppConnect({ agentId, agentName }: WhatsAppConnectProps) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"qr" | "api">("qr");
  const [showForm, setShowForm] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data: status, isLoading } = useQuery({
    queryKey: ["agent-whatsapp", agentId],
    queryFn: () => agentCredentialsApi.getWhatsAppStatus(agentId),
  });

  const connectMutation = useMutation({
    mutationFn: () =>
      agentCredentialsApi.connectWhatsApp(agentId, {
        apiKey,
        phoneNumberId,
        phoneNumber: phoneNumber || undefined,
      }),
    onSuccess: () => {
      setShowForm(false);
      setApiKey("");
      setPhoneNumberId("");
      setPhoneNumber("");
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["agent-whatsapp", agentId] });
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Connection failed");
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: () => agentCredentialsApi.disconnectWhatsApp(agentId),
    onSuccess: () => {
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

  // Connected via 360dialog API
  if (status?.connected) {
    return (
      <div className="rounded-lg border border-border p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-9 w-9 rounded-full bg-green-500/10">
              <MessageCircle className="h-4.5 w-4.5 text-green-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                WhatsApp Connected (API)
                <Check className="h-3.5 w-3.5 text-green-500" />
              </p>
              <p className="text-xs text-muted-foreground">
                {status.phoneNumber ? `+${status.phoneNumber}` : `Phone ID: ${status.phoneNumberId}`}
                {status.connectedAt && ` \u00B7 Connected ${new Date(status.connectedAt).toLocaleDateString()}`}
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

  // Not connected — show mode toggle + connect form
  return (
    <div className="space-y-3">
      {/* Mode toggle */}
      <div className="flex gap-2">
        <Button
          variant={mode === "qr" ? "default" : "outline"}
          size="sm"
          onClick={() => setMode("qr")}
          className="flex-1"
        >
          <QrCode className="h-3.5 w-3.5 mr-1.5" />
          QR Code
        </Button>
        <Button
          variant={mode === "api" ? "default" : "outline"}
          size="sm"
          onClick={() => setMode("api")}
          className="flex-1"
        >
          <Key className="h-3.5 w-3.5 mr-1.5" />
          API Key
        </Button>
      </div>

      {/* QR Code mode — Baileys */}
      {mode === "qr" && (
        <BaileysConnect agentId={agentId} agentName={agentName} />
      )}

      {/* API Key mode — 360dialog */}
      {mode === "api" && (
        <div className="rounded-lg border border-border p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex items-center justify-center h-9 w-9 rounded-full bg-muted">
              <MessageCircle className="h-4.5 w-4.5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">WhatsApp Business API</p>
              <p className="text-xs text-muted-foreground">
                Connect via 360dialog API key for production use
              </p>
            </div>
          </div>

          {!showForm ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowForm(true)}
              className="w-full"
            >
              <Key className="h-3.5 w-3.5 mr-1.5" />
              Connect with API Key
            </Button>
          ) : (
            <div className="space-y-3 pt-1">
              <div>
                <label className="text-xs font-medium text-foreground mb-1 block">
                  360dialog API Key
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Paste your 360dialog API key"
                  className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-foreground mb-1 block">
                  Phone Number ID
                </label>
                <input
                  type="text"
                  value={phoneNumberId}
                  onChange={(e) => setPhoneNumberId(e.target.value)}
                  placeholder="e.g. 123456789"
                  className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-foreground mb-1 block">
                  Phone Number (optional, for display)
                </label>
                <input
                  type="text"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="e.g. 971501234567"
                  className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm"
                />
              </div>

              {error && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <X className="h-3 w-3" /> {error}
                </p>
              )}

              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => connectMutation.mutate()}
                  disabled={!apiKey || !phoneNumberId || connectMutation.isPending}
                >
                  {connectMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                  ) : (
                    <Check className="h-3.5 w-3.5 mr-1" />
                  )}
                  Connect
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowForm(false);
                    setError(null);
                  }}
                >
                  Cancel
                </Button>
              </div>

              <p className="text-[10px] text-muted-foreground leading-relaxed">
                Get your API key from{" "}
                <a href="https://hub.360dialog.com" target="_blank" rel="noopener noreferrer" className="underline">
                  360dialog Hub
                </a>
                . Each agent needs its own WhatsApp Business number.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
