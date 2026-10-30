import React, { useState, useEffect, useCallback } from "react";
import {
  Wifi,
  WifiOff,
  Globe,
  QrCode,
  Copy,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  X,
  KeyRound,
  Terminal,
  Loader2,
  Check,
  Eye,
  EyeOff,
} from "lucide-react";
import {
  RemoteAccessStatus,
  RemoteAccessSettings,
  RemoteAccessStatusState,
} from "../../types";
import { remoteAccessService } from "../../services/remoteAccessService";

export const RemoteAccessTab: React.FC = () => {
  const [status, setStatus] = useState<RemoteAccessStatus | null>(null);
  const [settings, setSettings] = useState<RemoteAccessSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [showToken, setShowToken] = useState(false);

  // Form states
  const [ngrokPath, setNgrokPath] = useState("ngrok");
  const [authtoken, setAuthtoken] = useState("");
  const [autoStart, setAutoStart] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [statusRes, settingsRes] = await Promise.all([
        remoteAccessService.getStatus(),
        remoteAccessService.getSettings(),
      ]);
      setStatus(statusRes);
      setSettings(settingsRes);
      setNgrokPath(settingsRes.ngrokPath || "ngrok");
      setAutoStart(settingsRes.autoStart);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || "Failed to load Remote Access data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    // Poll status every 5 seconds for live tunnel state changes
    const interval = setInterval(async () => {
      try {
        const [statusRes, settingsRes] = await Promise.all([
          remoteAccessService.getStatus(),
          remoteAccessService.getSettings(),
        ]);
        setStatus(statusRes);
        setSettings(settingsRes);
      } catch {
        // Suppress background polling errors
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [loadData]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingSettings(true);
      setError(null);
      setFeedback(null);
      const updated = await remoteAccessService.updateSettings({
        ngrokPath: ngrokPath.trim() || undefined,
        authtoken: authtoken.trim() || undefined,
        autoStart,
      });
      setSettings(updated);
      setAuthtoken("");
      const newStatus = await remoteAccessService.getStatus();
      setStatus(newStatus);
      setFeedback("Remote Access configuration saved successfully.");
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || "Failed to save configuration.");
    } finally {
      setSavingSettings(false);
    }
  };

  const handleStart = async () => {
    try {
      setActionLoading(true);
      setError(null);
      const st = await remoteAccessService.start();
      setStatus(st);
      if (st.errorMessage) {
        setError(st.errorMessage);
      } else {
        setFeedback("Remote access tunnel opened successfully!");
        setTimeout(() => setFeedback(null), 4000);
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || "Failed to start ngrok tunnel.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleStop = async () => {
    try {
      setActionLoading(true);
      setError(null);
      const st = await remoteAccessService.stop();
      setStatus(st);
      setFeedback("Remote access tunnel stopped.");
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || "Failed to stop ngrok tunnel.");
    } finally {
      setActionLoading(false);
    }
  };

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading && !status) {
    return (
      <div className="p-12 flex flex-col items-center justify-center text-slate-500 gap-3">
        <Loader2 className="w-7 h-7 text-emerald-600 animate-spin" />
        <span className="text-xs font-semibold">Connecting to Remote Access Service...</span>
      </div>
    );
  }

  const rawState = String(status?.state ?? "");
  const isRunning =
    rawState === "Running" ||
    rawState === "2" ||
    status?.state === RemoteAccessStatusState.Running;
  const isStarting =
    rawState === "Starting" ||
    rawState === "1" ||
    status?.state === RemoteAccessStatusState.Starting;

  return (
    <div className="space-y-6">
      {/* Security Warning Notice */}
      <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200/80 flex items-start gap-3.5 shadow-xs">
        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-900 space-y-1">
          <p className="font-bold text-amber-950">Security Notice: Secure ngrok HTTPS Tunnel</p>
          <p className="text-amber-800 leading-relaxed">
            Remote Access exposes your local CoopIS instance to the Internet using an encrypted ngrok HTTPS tunnel.
            Authentication, JWT tokens, and Administrator authorization rules remain strictly enforced. Only share
            access links with authorized cooperative personnel.
          </p>
        </div>
      </div>

      {feedback && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{feedback}</span>
          </div>
          <button type="button" onClick={() => setFeedback(null)} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button type="button" onClick={() => setError(null)} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Tunnel Status & Control Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center shadow-xs transition-colors ${
                isRunning
                  ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                  : "bg-slate-100 text-slate-500 border border-slate-200"
              }`}
            >
              {isRunning ? <Wifi className="w-6 h-6" /> : <WifiOff className="w-6 h-6" />}
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 tracking-tight">Remote Access Tunnel</h3>
              <p className="text-xs text-slate-500">
                Local Target: <span className="font-mono font-semibold text-slate-800">{status?.localAddress || "http://localhost:5173"}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-2xs ${
                isRunning
                  ? "bg-emerald-50 text-emerald-800 border border-emerald-300"
                  : isStarting
                  ? "bg-blue-50 text-blue-800 border border-blue-300"
                  : "bg-slate-100 text-slate-600 border border-slate-200"
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isRunning
                    ? "bg-emerald-600 animate-pulse"
                    : isStarting
                    ? "bg-blue-600 animate-ping"
                    : "bg-slate-400"
                }`}
              />
              {isRunning ? "RUNNING" : isStarting ? "STARTING..." : "DISABLED"}
            </span>

            {isRunning ? (
              <button
                type="button"
                onClick={handleStop}
                disabled={actionLoading}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-semibold text-xs transition-all shadow-md flex items-center gap-1.5 disabled:opacity-50"
              >
                {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <WifiOff className="w-3.5 h-3.5" />}
                <span>Stop Tunnel</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStart}
                disabled={actionLoading}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold text-xs transition-all shadow-md flex items-center gap-1.5 disabled:opacity-50"
              >
                {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wifi className="w-3.5 h-3.5" />}
                <span>Start Remote Access</span>
              </button>
            )}
          </div>
        </div>

        {/* Public URL Box (When Running) */}
        {isRunning && status?.publicUrl && (
          <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-3 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
                <Globe className="w-4 h-4 text-emerald-600" />
                Active Public HTTPS URL
              </span>
              {status.startedAt && (
                <span className="text-[11px] text-emerald-700 font-medium">
                  Started at: {new Date(status.startedAt).toLocaleTimeString()}
                </span>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <input
                type="text"
                readOnly
                value={status.publicUrl}
                className="flex-1 py-2 px-3 rounded-xl border border-emerald-300 bg-white font-mono text-sm text-emerald-900 font-bold focus:outline-none select-all"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => copyUrl(status.publicUrl!)}
                  className="py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-all flex items-center gap-1.5 shadow-xs"
                >
                  {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-200" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? "Copied!" : "Copy URL"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowQrModal(true)}
                  className="py-2 px-3 rounded-xl border border-emerald-300 bg-white text-emerald-800 hover:bg-emerald-100 font-semibold text-xs transition-colors flex items-center gap-1.5 shadow-2xs"
                >
                  <QrCode className="w-3.5 h-3.5 text-emerald-700" />
                  <span>QR Code</span>
                </button>

                <a
                  href={status.publicUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="py-2 px-3 rounded-xl border border-emerald-300 bg-white text-emerald-800 hover:bg-emerald-100 font-semibold text-xs transition-colors flex items-center gap-1.5 shadow-2xs"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Open Link</span>
                </a>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ngrok Configuration Form */}
      <form onSubmit={handleSaveSettings} className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-bold text-base text-slate-900">Tunnel Configuration</h3>
            <p className="text-xs text-slate-500">Configure ngrok binary paths, credentials, and startup behaviors</p>
          </div>
          {settings?.isNgrokDetected ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <Check className="w-3.5 h-3.5" />
              Auto-detected ({settings.ngrokVersion || "ngrok installed"})
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
              <AlertTriangle className="w-3.5 h-3.5" />
              ngrok not found on PATH
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Executable Path */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              ngrok Executable Path
            </label>
            <div className="relative">
              <Terminal className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                value={ngrokPath}
                onChange={(e) => setNgrokPath(e.target.value)}
                placeholder="ngrok"
                className="w-full pl-9 pr-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all font-mono font-medium text-slate-900"
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Default is <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-600">ngrok</code>. Provide full path if installed in a custom directory.
            </p>
          </div>

          {/* Authtoken */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                ngrok Authtoken
              </label>
              <a
                href="https://dashboard.ngrok.com/get-started/your-authtoken"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-emerald-600 hover:text-emerald-700 font-semibold flex items-center gap-1"
              >
                <span>Get Token</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <div className="relative">
              <KeyRound className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type={showToken ? "text" : "password"}
                value={authtoken}
                onChange={(e) => setAuthtoken(e.target.value)}
                placeholder={settings?.hasAuthtoken ? "••••••••••••••••••••••••" : "Paste your ngrok authtoken here"}
                className="w-full pl-9 pr-10 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all font-mono font-medium text-slate-900"
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
              >
                {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              {settings?.hasAuthtoken ? (
                <span className="text-emerald-600 font-semibold flex items-center gap-1">
                  <Check className="w-3 h-3" /> Authtoken is saved and configured.
                </span>
              ) : (
                "Required to start ngrok tunnels without connection timeouts."
              )}
            </p>
          </div>
        </div>

        {/* AutoStart Toggle */}
        <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
          <div>
            <span className="font-bold text-xs text-slate-800 block">Auto-Start on Application Launch</span>
            <span className="text-[11px] text-slate-500">
              Automatically launch the secure ngrok tunnel when the CoopIS backend starts up
            </span>
          </div>
          <button
            type="button"
            onClick={() => setAutoStart(!autoStart)}
            className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              autoStart ? "bg-emerald-600" : "bg-slate-300"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                autoStart ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={savingSettings}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50"
          >
            {savingSettings ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            <span>Save Configuration</span>
          </button>
        </div>
      </form>

      {/* QR Code Modal */}
      {showQrModal && status?.publicUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4 text-center">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <QrCode className="w-5 h-5 text-emerald-600" />
                <span>Remote Access QR Code</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowQrModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl flex items-center justify-center border border-slate-100">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(status.publicUrl)}&size=200x200`}
                alt="Remote Access QR Code"
                className="w-48 h-48 rounded-lg border border-slate-200 shadow-xs"
              />
            </div>

            <p className="text-xs text-slate-600 font-mono break-all px-2">
              {status.publicUrl}
            </p>

            <button
              type="button"
              onClick={() => setShowQrModal(false)}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-md transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
