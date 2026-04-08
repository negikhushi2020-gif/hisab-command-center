"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "hisab.business.state.v1";

export default function MigratePage() {
  const [status, setStatus] = useState<"checking" | "no-data" | "uploading" | "done" | "error">(
    "checking",
  );
  const [message, setMessage] = useState("Reading your data from this browser...");
  const [countdown, setCountdown] = useState(4);

  useEffect(() => {
    const run = async () => {
      const raw = window.localStorage.getItem(STORAGE_KEY);

      if (!raw) {
        setStatus("no-data");
        setMessage("No data found in this browser. Nothing to migrate.");
        return;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        setStatus("error");
        setMessage("Could not read local data — it appears corrupted.");
        return;
      }

      // Step 1: Auto-download backup
      try {
        const blob = new Blob([JSON.stringify(parsed, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `hisab-backup-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch {
        // backup download failed silently — still continue with upload
      }

      // Step 2: Upload to server (overwrite whatever is there)
      setStatus("uploading");
      setMessage("Saving your data to the server...");

      try {
        const res = await fetch("/api/state", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: raw,
        });

        if (!res.ok) throw new Error("Server returned error");

        setStatus("done");
        setMessage(
          "✓ Your data has been saved to the server and a backup downloaded to your Downloads folder.",
        );

        // Countdown redirect to dashboard
        let t = 4;
        const interval = setInterval(() => {
          t -= 1;
          setCountdown(t);
          if (t <= 0) {
            clearInterval(interval);
            window.location.replace("/");
          }
        }, 1000);
      } catch {
        setStatus("error");
        setMessage(
          "Could not save to server. Make sure the server (start-hisab.bat) is running and try again.",
        );
      }
    };

    run();
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#e8f4fd] to-[#d0eaff] p-6">
      <div className="w-full max-w-md rounded-3xl bg-white/90 p-8 shadow-lg">
        <p className="text-xs font-semibold tracking-[0.2em] text-[#26415f] uppercase">
          Hisab · Data Migration
        </p>
        <h1 className="mt-3 text-2xl font-bold text-[#0f1b2e]">Saving Your Data</h1>

        <div className="mt-6 space-y-3">
          {status === "checking" && (
            <div className="flex items-center gap-3">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#26415f] border-t-transparent" />
              <p className="text-sm text-[#26415f]">{message}</p>
            </div>
          )}

          {status === "uploading" && (
            <div className="flex items-center gap-3">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#26415f] border-t-transparent" />
              <p className="text-sm text-[#26415f]">{message}</p>
            </div>
          )}

          {status === "done" && (
            <div>
              <p className="text-sm font-semibold text-green-700">{message}</p>
              <p className="mt-4 text-sm text-[#26415f]">
                Redirecting to dashboard in <strong>{countdown}</strong> second{countdown !== 1 ? "s" : ""}...
              </p>
              <a
                href="/"
                className="mt-4 inline-block rounded-full bg-[#0f1b2e] px-5 py-2 text-sm font-semibold text-white transition hover:opacity-90"
              >
                Go Now →
              </a>
            </div>
          )}

          {status === "no-data" && (
            <div>
              <p className="text-sm text-[#26415f]">{message}</p>
              <a
                href="/"
                className="mt-4 inline-block rounded-full bg-[#0f1b2e] px-5 py-2 text-sm font-semibold text-white transition hover:opacity-90"
              >
                Go to Dashboard
              </a>
            </div>
          )}

          {status === "error" && (
            <div>
              <p className="text-sm font-semibold text-red-600">{message}</p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="mt-4 rounded-full bg-[#26415f] px-5 py-2 text-sm font-semibold text-white transition hover:opacity-90"
              >
                Retry
              </button>
            </div>
          )}
        </div>

        <div className="mt-8 rounded-2xl bg-[#f0f7ff] p-4 text-xs text-[#26415f]">
          <p className="font-semibold">What is happening?</p>
          <ol className="mt-2 list-decimal pl-4 space-y-1">
            <li>Reading your business data from this browser</li>
            <li>Downloading a JSON backup to your Downloads folder</li>
            <li>Saving it to the app server (accessible from all browsers)</li>
            <li>Redirecting you to the dashboard</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
