import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Mail, Check, X, Loader2, Unplug, ExternalLink } from "lucide-react";
import { agentCredentialsApi } from "../api/agent-credentials";
import { Button } from "./ui/button";

interface GmailConnectProps {
  agentId: string;
  agentName: string;
}

export function GmailConnect({ agentId, agentName }: GmailConnectProps) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [accessToken, setAccessToken] = useState("");
  const [refreshToken, setRefreshToken] = useState("");
  const [gmailAddress, setGmailAddress] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data: status, isLoading } = useQuery({
    queryKey: ["agent-gmail", agentId],
    queryFn: () => agentCredentialsApi.getGmailStatus(agentId),
  });

  const oauthMutation = useMutation({
    mutationFn: () => agentCredentialsApi.getGmailOAuthUrl(agentId),
    onSuccess: (data) => {
      // Open Google OAuth in a popup
      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      const popup = window.open(
        data.url,
        "gmail-oauth",
        `width=${width},height=${height},left=${left},top=${top}`,
      );

      // Poll for popup closure (OAuth callback will close it)
      const interval = setInterval(() => {
        if (popup?.closed) {
          clearInterval(interval);
          queryClient.invalidateQueries({ queryKey: ["agent-gmail", agentId] });
        }
      }, 500);
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Failed to start OAuth");
    },
  });

  const connectMutation = useMutation({
    mutationFn: () =>
      agentCredentialsApi.connectGmail(agentId, {
        accessToken,
        refreshToken,
        gmailAddress,
      }),
    onSuccess: () => {
      setShowForm(false);
      setAccessToken("");
      setRefreshToken("");
      setGmailAddress("");
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["agent-gmail", agentId] });
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Connection failed");
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: () => agentCredentialsApi.disconnectGmail(agentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent-gmail", agentId] });
    },
  });

  if (isLoading) {
    return (
      <div className="rounded-lg border border-border p-4">
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Checking Gmail status...
        </div>
      </div>
    );
  }

  // Connected
  if (status?.connected) {
    return (
      <div className="rounded-lg border border-border p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-9 w-9 rounded-full bg-green-500/10">
              <Mail className="h-4.5 w-4.5 text-green-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                Gmail Connected
                <Check className="h-3.5 w-3.5 text-green-500" />
              </p>
              <p className="text-xs text-muted-foreground">
                {status.gmailAddress}
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

  // Not connected
  return (
    <div className="rounded-lg border border-border p-4">
      <div className="flex items-center gap-3 mb-3">
        <div className="flex items-center justify-center h-9 w-9 rounded-full bg-muted">
          <Mail className="h-4.5 w-4.5 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">Gmail</p>
          <p className="text-xs text-muted-foreground">
            Connect {agentName}'s email to send and read messages
          </p>
        </div>
      </div>

      {!showForm ? (
        <div className="space-y-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => oauthMutation.mutate()}
            disabled={oauthMutation.isPending}
            className="w-full"
          >
            {oauthMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
            )}
            Connect with Google
          </Button>
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="text-[10px] text-muted-foreground hover:text-foreground underline w-full text-center"
          >
            Or enter tokens manually
          </button>
        </div>
      ) : (
        <div className="space-y-3 pt-1">
          <div>
            <label className="text-xs font-medium text-foreground mb-1 block">
              Gmail Address
            </label>
            <input
              type="email"
              value={gmailAddress}
              onChange={(e) => setGmailAddress(e.target.value)}
              placeholder="sarah@dubaiproperties.ae"
              className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-foreground mb-1 block">
              Access Token
            </label>
            <input
              type="password"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              placeholder="Paste Google OAuth access token"
              className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-foreground mb-1 block">
              Refresh Token
            </label>
            <input
              type="password"
              value={refreshToken}
              onChange={(e) => setRefreshToken(e.target.value)}
              placeholder="Paste Google OAuth refresh token"
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
              disabled={!gmailAddress || !accessToken || !refreshToken || connectMutation.isPending}
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
            Get tokens from{" "}
            <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer" className="underline">
              Google Cloud Console
            </a>
            . Required scopes: gmail.readonly, gmail.send, gmail.modify.
          </p>
        </div>
      )}
    </div>
  );
}
