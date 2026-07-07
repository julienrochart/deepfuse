"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function AuthErrorContent() {
  const params = useSearchParams();
  const reason = params.get("reason");

  const isProfileError = reason === "profile";

  return (
    <div className="flex min-h-dvh flex-col items-center justify-between bg-gradient-to-br from-accent via-[#C74A8A] to-primary px-6 py-16">
      <div />

      <div className="flex flex-col items-center gap-6 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/20">
          <svg
            width="40"
            height="40"
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

        <p className="max-w-xs text-white/80">
          {isProfileError
            ? "Ton compte Spotify n'est pas encore autorisé sur DeepFuse. L'app est en phase de test — demande au créateur de t'ajouter."
            : "Une erreur est survenue lors de la connexion avec Spotify. Réessaie dans quelques instants."}
        </p>
      </div>

      <a
        href="/"
        className="block w-full max-w-sm rounded-full bg-white py-4 text-center text-lg font-semibold text-accent transition hover:bg-gray-50"
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
