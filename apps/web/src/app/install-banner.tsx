"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function InstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosBanner, setShowIosBanner] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js");
    }

    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches;

    if (isIos && !isStandalone && !sessionStorage.getItem("pwa-dismissed")) {
      setShowIosBanner(true);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  async function handleInstall() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  }

  function handleDismiss() {
    setDismissed(true);
    setDeferredPrompt(null);
    setShowIosBanner(false);
    sessionStorage.setItem("pwa-dismissed", "1");
  }

  if (dismissed) return null;

  if (deferredPrompt) {
    return (
      <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-gray-900 px-4 py-3 shadow-xl">
        <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-xl">
          <img src="/icons/icon-192.png" alt="DeepFuse" className="h-full w-full" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white">Installer DeepFuse</p>
          <p className="text-xs text-gray-400">Ajouter à l&apos;écran d&apos;accueil</p>
        </div>
        <button
          onClick={handleInstall}
          className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white"
        >
          Installer
        </button>
        <button onClick={handleDismiss} className="p-1 text-gray-500">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    );
  }

  if (showIosBanner) {
    return (
      <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-gray-900 px-4 py-3 shadow-xl">
        <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-xl">
          <img src="/icons/icon-192.png" alt="DeepFuse" className="h-full w-full" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white">Installer DeepFuse</p>
          <p className="text-xs text-gray-400">
            Appuie sur{" "}
            <svg
              className="inline h-4 w-4 text-blue-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" />
            </svg>{" "}
            puis &quot;Sur l&apos;écran d&apos;accueil&quot;
          </p>
        </div>
        <button onClick={handleDismiss} className="p-1 text-gray-500">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    );
  }

  return null;
}
