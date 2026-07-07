"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function AuthErrorContent() {
  const params = useSearchParams();
  const reason = params.get("reason");
  const isProfileError = reason === "profile";

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !name.trim()) return;
    setSending(true);
    try {
      await fetch("/api/access-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          name: name.trim(),
          message: message.trim() || undefined,
        }),
      });
      setSubmitted(true);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center bg-gradient-to-br from-accent via-[#C74A8A] to-primary px-6 py-12">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/20">
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-white">Connexion impossible</h1>

        <p className="max-w-xs text-sm text-white/80">
          {isProfileError
            ? "DeepFuse est en phase de test. Demande un accès ci-dessous et tu seras notifié par email."
            : "Une erreur est survenue lors de la connexion avec Spotify. Réessaie dans quelques instants."}
        </p>
      </div>

      {isProfileError && !submitted && (
        <form onSubmit={handleSubmit} className="mt-8 w-full max-w-sm">
          <div className="rounded-2xl bg-white/95 p-6 shadow-xl backdrop-blur">
            <h2 className="mb-4 text-center text-lg font-bold text-gray-900">Demander un accès</h2>
            <div className="flex flex-col gap-3">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ton prénom"
                required
                className="rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary focus:outline-none"
              />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email Spotify"
                required
                className="rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary focus:outline-none"
              />
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Un petit mot ? (optionnel)"
                rows={2}
                className="resize-none rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary focus:outline-none"
              />
              <button
                type="submit"
                disabled={!email.trim() || !name.trim() || sending}
                className="rounded-xl bg-primary py-3 text-sm font-semibold text-white transition disabled:opacity-50"
              >
                {sending ? "Envoi..." : "Envoyer ma demande"}
              </button>
            </div>
          </div>
        </form>
      )}

      {submitted && (
        <div className="mt-8 w-full max-w-sm rounded-2xl bg-white/95 p-6 text-center shadow-xl backdrop-blur">
          <div className="mb-3 flex justify-center">
            <svg
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#22c55e"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-gray-900">Demande envoyée !</h2>
          <p className="mt-1 text-sm text-gray-500">
            Tu recevras un email quand ton accès sera activé.
          </p>
        </div>
      )}

      <a
        href="/"
        className="mt-8 block w-full max-w-sm rounded-full bg-white py-4 text-center text-lg font-semibold text-accent transition hover:bg-gray-50"
      >
        Retour
      </a>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-gradient-to-br from-accent via-[#C74A8A] to-primary">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-white border-t-transparent" />
        </div>
      }
    >
      <AuthErrorContent />
    </Suspense>
  );
}
