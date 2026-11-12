import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Mail,
  Send,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  Server,
  Globe,
  Save,
  Key,
  Eye,
  EyeOff,
  ExternalLink,
  ShieldCheck,
  Check,
  Sparkles,
} from "lucide-react";
import api from "../../services/api";

interface EmailConfig {
  provider: string;
  fromName: string;
  fromEmail: string;
  frontendBaseUrl: string;
  mailjetApiKey?: string | null;
  hasMailjetSecretKey: boolean;
  smtpHost?: string | null;
  smtpPort: number;
  useSsl: boolean;
  updatedAt?: string | null;
}

interface TestEmailResponse {
  success: boolean;
  message: string;
  provider: string;
}

export const EmailSettingsTab: React.FC = () => {
  const queryClient = useQueryClient();

  // Form state
  const [fromName, setFromName] = useState("CoopIS Organization");
  const [fromEmail, setFromEmail] = useState("coopisorganization@gmail.com");
  const [frontendBaseUrl, setFrontendBaseUrl] = useState("http://localhost:5173");
  const [mailjetApiKey, setMailjetApiKey] = useState("");
  const [mailjetSecretKey, setMailjetSecretKey] = useState("");
  const [showSecretKey, setShowSecretKey] = useState(false);

  // Status & Feedback
  const [saveFeedback, setSaveFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Test email state
  const [recipientEmail, setRecipientEmail] = useState("c.pasuquin@gmail.com");
  const [testResult, setTestResult] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Query config
  const {
    data: config,
    isLoading,
    isRefetching,
    refetch,
    error,
  } = useQuery<EmailConfig>({
    queryKey: ["email-config"],
    queryFn: async () => {
      const res = await api.get<EmailConfig>("/settings/email-config");
      return res.data;
    },
  });

  // Sync loaded config to form
  useEffect(() => {
    if (config) {
      setFromName(config.fromName || "CoopIS Organization");
      setFromEmail(config.fromEmail || "coopisorganization@gmail.com");
      setFrontendBaseUrl(config.frontendBaseUrl || window.location.origin);
      setMailjetApiKey(config.mailjetApiKey || "");
      // Clear secret input so user can leave unchanged or overwrite
      setMailjetSecretKey("");
    }
  }, [config]);

  // Mutation to save config
  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        fromName: fromName.trim(),
        fromEmail: fromEmail.trim(),
        frontendBaseUrl: frontendBaseUrl.trim(),
        mailjetApiKey: mailjetApiKey.trim() || null,
        mailjetSecretKey: mailjetSecretKey.trim() || null,
      };
      const res = await api.put<EmailConfig>("/settings/email-config", payload);
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["email-config"], data);
      queryClient.invalidateQueries({ queryKey: ["email-status"] });
      setSaveFeedback({
        type: "success",
        message: "Mailjet configuration saved and applied successfully!",
      });
      setMailjetSecretKey("");
      setTimeout(() => setSaveFeedback(null), 6000);
    },
    onError: (err: unknown) => {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setSaveFeedback({
        type: "error",
        message: axiosErr.response?.data?.message || "Failed to save Mailjet configuration.",
      });
    },
  });

  // Mutation to send test email
  const testEmailMutation = useMutation({
    mutationFn: async (email: string) => {
      const res = await api.post<TestEmailResponse>("/settings/test-email", {
        recipientEmail: email.trim(),
      });
      return res.data;
    },
    onSuccess: (data) => {
      setTestResult({
        type: "success",
        message: data.message || "Test email dispatched successfully via Mailjet!",
      });
    },
    onError: (err: unknown) => {
      const axiosErr = err as {
        response?: { data?: { message?: string } };
      };
      setTestResult({
        type: "error",
        message:
          axiosErr.response?.data?.message ||
          "Failed to dispatch test email. Please check your Mailjet API credentials.",
      });
    },
  });

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    setSaveFeedback(null);
    saveMutation.mutate();
  };

  const handleSendTest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientEmail.trim()) return;
    setTestResult(null);
    testEmailMutation.mutate(recipientEmail);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mb-3" />
        <p className="text-sm font-medium">Loading email configuration...</p>
      </div>
    );
  }

  if (error || !config) {
    return (
      <div className="p-6 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-sm">Failed to Load Email Status</p>
          <p className="text-xs text-rose-700 mt-1">
            Unable to fetch current email provider settings from the backend.
          </p>
          <button
            onClick={() => refetch()}
            className="mt-3 px-3 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-semibold hover:bg-rose-700 transition cursor-pointer"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const isConfigured = Boolean(config.mailjetApiKey && config.hasMailjetSecretKey);

  return (
    <div className="space-y-6">
      {/* Header & Status Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Mail className="w-5 h-5 text-emerald-600" />
            Email Dispatch Settings & Live Configuration
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure company mail delivery for password resets, loan notifications, and official receipts.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
              isConfigured
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-amber-50 text-amber-700 border-amber-200"
            }`}
          >
            {isConfigured ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Mailjet Active & Configured
              </>
            ) : (
              <>
                <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                API Credentials Required
              </>
            )}
          </span>
          <button
            onClick={() => refetch()}
            disabled={isRefetching}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 shadow-sm transition self-start sm:self-auto cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefetching ? "animate-spin text-emerald-600" : ""}`} />
            Reload
          </button>
        </div>
      </div>

      {/* Main Mailjet Configuration Form */}
      <form onSubmit={handleSaveConfig} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Server className="w-4 h-4 text-emerald-600" />
            Mailjet SMTP Dispatch Configuration
          </h3>
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-emerald-600" />
            Provider: Mailjet
          </span>
        </div>

        {saveFeedback && (
          <div
            className={`p-4 rounded-xl border flex items-start gap-3 text-xs sm:text-sm ${
              saveFeedback.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                : "bg-rose-50 border-rose-200 text-rose-800"
            }`}
          >
            {saveFeedback.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            )}
            <div>
              <p className="font-bold">
                {saveFeedback.type === "success" ? "Changes Applied" : "Save Error"}
              </p>
              <p className="mt-0.5">{saveFeedback.message}</p>
            </div>
          </div>
        )}

        {/* Instructions Banner */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 space-y-2 leading-relaxed">
          <div className="font-bold flex items-center gap-1.5 text-slate-900">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            How to configure your free Mailjet credentials:
          </div>
          <ol className="list-decimal list-inside space-y-1 pl-1 text-[12px] text-slate-600">
            <li>
              Log in or register your free account at{" "}
              <a
                href="https://app.mailjet.com/signup"
                target="_blank"
                rel="noreferrer"
                className="text-emerald-600 underline font-semibold inline-flex items-center gap-0.5"
              >
                app.mailjet.com <ExternalLink className="w-2.5 h-2.5" />
              </a>{" "}
              (Free tier includes <strong>6,000 emails/month</strong> / 200/day to any recipient).
            </li>
            <li>
              Go to <strong>Account Settings &rarr; Senders &amp; Domains &rarr; Add a Sender Address</strong> and add{" "}
              <span className="font-mono font-semibold text-slate-900">{fromEmail}</span>. Click the verification link sent to your inbox.
            </li>
            <li>
              Go to <strong>Account Settings &rarr; SMTP and SEND API Settings</strong> (or Master API Key).
            </li>
            <li>
              Copy your <strong>API Key</strong> and <strong>Secret Key</strong> into the fields below and click <strong>Save &amp; Apply Configuration</strong>.
            </li>
          </ol>
        </div>

        {/* 1. Sender Details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
              Sender Name (From Name)
            </label>
            <input
              type="text"
              required
              value={fromName}
              onChange={(e) => setFromName(e.target.value)}
              placeholder="e.g. CoopIS Organization"
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
              Company Sender Address (From Email)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Mail className="w-4 h-4" />
              </div>
              <input
                type="email"
                required
                value={fromEmail}
                onChange={(e) => setFromEmail(e.target.value)}
                placeholder="coopisorganization@gmail.com"
                className="w-full pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* 2. Frontend Base URL */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
            Frontend Base URL (For Password Reset Links)
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Globe className="w-4 h-4" />
            </div>
            <input
              type="text"
              required
              value={frontendBaseUrl}
              onChange={(e) => setFrontendBaseUrl(e.target.value)}
              placeholder="http://localhost:5173"
              className="w-full pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            This root URL is prepended to password reset tokens sent to members and operators.
          </p>
        </div>

        {/* 3. Mailjet API Credentials */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-emerald-600" />
              Mailjet API Credentials
            </span>
            <div className="flex items-center gap-2">
              {config.hasMailjetSecretKey && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                  <Check className="w-3 h-3 text-emerald-600" />
                  Secret Key Stored
                </span>
              )}
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono text-slate-500 bg-white border border-slate-200">
                in-v3.mailjet.com:587 (TLS)
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Mailjet API Key
              </label>
              <input
                type="text"
                value={mailjetApiKey}
                onChange={(e) => setMailjetApiKey(e.target.value)}
                placeholder="Enter 32-character Mailjet API Key"
                className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Found in Mailjet: <em>Account Settings &rarr; SMTP and SEND API Settings</em>.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Mailjet Secret Key {config.hasMailjetSecretKey && <span className="text-slate-400 font-normal">(Leave blank to keep existing)</span>}
              </label>
              <div className="relative">
                <input
                  type={showSecretKey ? "text" : "password"}
                  value={mailjetSecretKey}
                  onChange={(e) => setMailjetSecretKey(e.target.value)}
                  placeholder={config.hasMailjetSecretKey ? "••••••••••••••••••••••••••••••••" : "Enter Mailjet Secret Key"}
                  className="w-full pl-3.5 pr-9 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  type="button"
                  onClick={() => setShowSecretKey((prev) => !prev)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showSecretKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Paired Secret Key generated with your API key.
              </p>
            </div>
          </div>
        </div>

        {/* Submit Save Button */}
        <div className="pt-2 flex justify-end">
          <button
            type="submit"
            disabled={saveMutation.isPending}
            className={`inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm text-white transition-all shadow-md cursor-pointer ${
              saveMutation.isPending
                ? "bg-slate-400 cursor-not-allowed"
                : "bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 shadow-emerald-600/20"
            }`}
          >
            {saveMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving Configuration...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save & Apply Configuration
              </>
            )}
          </button>
        </div>
      </form>

      {/* Diagnostics / Send Test Email Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <h3 className="text-sm font-bold text-slate-900 mb-1 flex items-center gap-2">
          <Send className="w-4 h-4 text-emerald-600" />
          Send Live Test Email
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          Verify live deliverability through <strong>Mailjet SMTP Relay</strong>. Test emails can be sent to <strong>any recipient</strong> (e.g. member personal emails like <span className="font-mono text-slate-700">c.pasuquin@gmail.com</span>).
        </p>

        {testResult && (
          <div
            className={`p-4 rounded-xl mb-4 border flex items-start gap-3 text-xs sm:text-sm ${
              testResult.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                : "bg-rose-50 border-rose-200 text-rose-800"
            }`}
          >
            {testResult.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            )}
            <div>
              <p className="font-bold">
                {testResult.type === "success" ? "Dispatch Succeeded" : "Dispatch Failed"}
              </p>
              <p className="mt-0.5 leading-relaxed">{testResult.message}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSendTest} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Mail className="w-4 h-4" />
            </div>
            <input
              type="email"
              required
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              placeholder="Enter recipient email (e.g. c.pasuquin@gmail.com)"
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
            />
          </div>
          <button
            type="submit"
            disabled={testEmailMutation.isPending || !recipientEmail.trim()}
            className={`inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg font-bold text-sm transition-all shadow-sm ${
              testEmailMutation.isPending || !recipientEmail.trim()
                ? "bg-slate-300 text-slate-500 cursor-not-allowed shadow-none"
                : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20 cursor-pointer"
            }`}
          >
            {testEmailMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Dispatching Test...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Send Test to {recipientEmail || "Recipient"}
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default EmailSettingsTab;
