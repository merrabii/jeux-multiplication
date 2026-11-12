"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

/**
 * Composant de jeu client — boucle : /api/game/start → /api/game/answer
 * → /api/game/complete. Aucune réponse attendue n'arrive du serveur :
 * la correction est révélée uniquement APRÈS soumission (anti-triche).
 */

type ClientQuestion = {
  questionId: string;
  a: number;
  b: number;
  choices: number[];
  table: number;
};

type Kind = "LESSON" | "PRACTICE" | "CHALLENGE";

type Summary = {
  percentCorrect: number;
  perfect: boolean;
  targetReached: boolean;
  starsEarned: number;
  xpEarned: number;
  coinsEarned: number;
  diamondsEarned: number;
  correctCount: number;
  wrongCount: number;
  newLevel: number;
};

type AnswerFeedback = {
  isCorrect: boolean;
  correctAnswer: number;
  repeatedAddition: string;
};

type Phase = "config" | "playing" | "finished";

export function GameSession({
  kind,
  availableTables,
  fixedCount,
  recommendedReview,
}: {
  kind: Kind;
  availableTables: number[];
  /** Défi : nombre de questions imposé (5/10/20) — sinon libre. */
  fixedCount?: number;
  /** Multiplications à revoir en priorité (révision espacée). */
  recommendedReview?: Array<{ a: number; b: number }>;
}) {
  const [phase, setPhase] = useState<Phase>("config");
  const [selectedTables, setSelectedTables] = useState<number[]>(availableTables.slice(0, 1));
  const [difficulty, setDifficulty] = useState<"EASY" | "NORMAL" | "HARD">("EASY");
  const [count, setCount] = useState(fixedCount ?? 10);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<ClientQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [feedback, setFeedback] = useState<AnswerFeedback | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [newBadges, setNewBadges] = useState<string[]>([]);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [streak, setStreak] = useState(0);

  const total = questions.length;
  const current = questions[currentIndex];

  // Chronomètre léger (aucune pression : simple affichage).
  useEffect(() => {
    if (phase !== "playing" || startedAt === null) return;
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [phase, startedAt]);

  const startGame = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/game/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          tables: selectedTables,
          difficulty,
          questionCount: count,
          targetPercent: 80,
        }),
      });
      if (!response.ok) throw new Error("start");
      const data = (await response.json()) as {
        sessionId: string;
        questions: ClientQuestion[];
      };
      setSessionId(data.sessionId);
      setQuestions(data.questions);
      setCurrentIndex(0);
      setFeedback(null);
      setStreak(0);
      setStartedAt(Date.now());
      setElapsed(0);
      setPhase("playing");
    } catch {
      setError("Impossible de démarrer la session. Réessaie.");
    } finally {
      setBusy(false);
    }
  }, [kind, selectedTables, difficulty, count]);

  const answer = useCallback(
    async (choice: number) => {
      if (!sessionId || !current || busy) return;
      setBusy(true);
      try {
        const response = await fetch("/api/game/answer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            questionId: current.questionId,
            answer: choice,
          }),
        });
        if (!response.ok) throw new Error("answer");
        const data = (await response.json()) as AnswerFeedback;
        setFeedback(data);
        setStreak((s) => (data.isCorrect ? s + 1 : 0));
      } catch {
        setError("Erreur de connexion. Réessaie.");
      } finally {
        setBusy(false);
      }
    },
    [sessionId, current, busy],
  );

  const next = useCallback(async () => {
    if (currentIndex + 1 < total) {
      setCurrentIndex((i) => i + 1);
      setFeedback(null);
      return;
    }
    // Dernière question : complétion serveur (idempotente).
    setBusy(true);
    try {
      const response = await fetch("/api/game/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, durationSeconds: elapsed }),
      });
      if (!response.ok) throw new Error("complete");
      const data = (await response.json()) as {
        summary: Summary;
        newBadges: string[];
      };
      setSummary(data.summary);
      setNewBadges(data.newBadges);
      setPhase("finished");
    } catch {
      setError("Impossible de terminer la session. Réessaie.");
    } finally {
      setBusy(false);
    }
  }, [currentIndex, total, sessionId, elapsed]);

  const isPerfect = summary?.perfect ?? false;
  const encouragement = useMemo(() => {
    if (!summary) return "";
    if (summary.percentCorrect === 100) return "Incroyable ! Un sans-faute magique ! ✨";
    if (summary.percentCorrect >= 80) return "Bravo, c'est un excellent défi réussi !";
    if (summary.percentCorrect >= 50) return "Bien joué ! Continue, tu progresses !";
    return "Courage ! Chaque erreur t'aide à apprendre. Réessaie !";
  }, [summary]);

  /* ---------------- Configuration ---------------- */
  if (phase === "config") {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl bg-card p-6 text-card-foreground shadow-lg sm:p-8">
        {kind === "CHALLENGE" && (
          <div className="mb-5">
            <p className="font-display text-lg font-bold">Nombre de questions</p>
            <div className="mt-2 flex gap-3">
              {[5, 10, 20].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setCount(n)}
                  className="btn-large flex-1"
                  style={
                    count === n
                      ? { background: "var(--magic)", color: "#fff" }
                      : { background: "var(--background-soft)", color: "var(--foreground)" }
                  }
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        )}

        {kind === "PRACTICE" && (
          <div className="mb-5">
            <p className="font-display text-lg font-bold">Niveau</p>
            <div className="mt-2 flex gap-3">
              {(
                [
                  ["EASY", "Facile"],
                  ["NORMAL", "Moyen"],
                  ["HARD", "Difficile"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setDifficulty(value)}
                  className="btn-large flex-1"
                  style={
                    difficulty === value
                      ? { background: "var(--magic)", color: "#fff" }
                      : { background: "var(--background-soft)", color: "var(--foreground)" }
                  }
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mb-5">
          <p className="font-display text-lg font-bold">
            {kind === "LESSON" ? "Table à vérifier" : "Tables à travailler"}
          </p>
          <div className="mt-2 grid grid-cols-5 gap-2">
            {availableTables.map((table) => {
              const selected = selectedTables.includes(table);
              return (
                <button
                  key={table}
                  type="button"
                  onClick={() =>
                    setSelectedTables((prev) =>
                      kind === "LESSON"
                        ? [table]
                        : selected
                          ? prev.filter((t) => t !== table)
                          : [...prev, table].sort((x, y) => x - y),
                    )
                  }
                  className="rounded-xl border-2 py-3 font-display text-lg font-bold"
                  style={
                    selected
                      ? { borderColor: "var(--magic)", background: "var(--magic)", color: "#fff" }
                      : { borderColor: "var(--magic)", color: "var(--foreground)" }
                  }
                >
                  {table}
                </button>
              );
            })}
          </div>
        </div>

        {recommendedReview && recommendedReview.length > 0 && kind === "PRACTICE" && (
          <p className="rounded-xl bg-background-soft px-4 py-3 text-sm">
            À revoir en priorité :{" "}
            {recommendedReview.slice(0, 6).map((r) => `${r.a} × ${r.b}`).join(", ")}
          </p>
        )}

        {error && (
          <p role="alert" className="mt-3 rounded-xl bg-error/15 px-4 py-3 text-sm font-semibold text-error">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={() => void startGame()}
          disabled={busy || selectedTables.length === 0}
          className="btn-large mt-6 w-full bg-button text-white shadow-lg hover:bg-button-hover disabled:opacity-60"
        >
          {busy ? "Préparation magique…" : "C'est parti !"}
        </button>
      </div>
    );
  }

  /* ---------------- En jeu ---------------- */
  if (phase === "playing" && current) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center justify-between px-2 text-sm font-bold text-foreground-soft">
          <span>
            Question {currentIndex + 1} / {total}
          </span>
          <span>
            {kind !== "LESSON" && `⏱ ${elapsed}s`}
          </span>
        </div>
        <div
          className="mt-2 h-3 overflow-hidden rounded-full bg-background-soft"
          role="progressbar"
          aria-valuenow={currentIndex}
          aria-valuemin={0}
          aria-valuemax={total}
        >
          <div
            className="h-full rounded-full bg-star transition-all"
            style={{ width: `${(currentIndex / total) * 100}%` }}
          />
        </div>

        <div className="mt-6 rounded-2xl bg-card p-8 text-center text-card-foreground shadow-lg">
          <p className="font-display text-4xl font-bold sm:text-5xl">
            {current.a} × {current.b} = ?
          </p>

          {!feedback && (
            <div className="mt-8 grid grid-cols-2 gap-3">
              {current.choices.map((choice) => (
                <button
                  key={choice}
                  type="button"
                  disabled={busy}
                  onClick={() => void answer(choice)}
                  className="btn-large bg-button text-white shadow hover:bg-button-hover disabled:opacity-60"
                >
                  {choice}
                </button>
              ))}
            </div>
          )}

          {feedback && (
            <div className="mt-6">
              <p
                role="status"
                className={`font-display text-2xl font-bold ${
                  feedback.isCorrect ? "text-success" : "text-error"
                }`}
              >
                {feedback.isCorrect
                  ? streak >= 5
                    ? `Série de ${streak} ! Magique !`
                    : "Bravo, c'est exact !"
                  : `Presque ! ${current.a} × ${current.b} = ${feedback.correctAnswer}`}
              </p>
              {!feedback.isCorrect && (
                <p className="mt-2 text-foreground-soft">
                  {current.a} groupes de {current.b} :{" "}
                  <strong>{feedback.repeatedAddition}</strong>
                </p>
              )}
              <button
                type="button"
                onClick={() => void next()}
                disabled={busy}
                className="btn-large mt-6 bg-button text-white shadow hover:bg-button-hover disabled:opacity-60"
              >
                {currentIndex + 1 < total ? "Question suivante" : "Terminer la session"}
              </button>
            </div>
          )}

          {error && (
            <p role="alert" className="mt-3 rounded-xl bg-error/15 px-4 py-3 text-sm font-semibold text-error">
              {error}
            </p>
          )}
        </div>
      </div>
    );
  }

  /* ---------------- Bilan ---------------- */
  if (phase === "finished" && summary) {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl bg-card p-8 text-center text-card-foreground shadow-lg">
        <p className="font-display text-3xl font-bold">
          {isPerfect ? "Défi parfait ! ⭐⭐⭐" : "Session terminée !"}
        </p>
        <p className="mt-3 text-lg text-foreground-soft">{encouragement}</p>

        <div className="mx-auto mt-6 grid max-w-md grid-cols-2 gap-3 text-left">
          <p className="rounded-xl bg-background-soft px-4 py-3">
            ✅ Bonnes réponses : <strong>{summary.correctCount}</strong>
          </p>
          <p className="rounded-xl bg-background-soft px-4 py-3">
            ❌ Erreurs : <strong>{summary.wrongCount}</strong>
          </p>
          <p className="rounded-xl bg-background-soft px-4 py-3">
            🎯 Réussite : <strong>{summary.percentCorrect} %</strong>
          </p>
          <p className="rounded-xl bg-background-soft px-4 py-3">
            ⏱ Temps : <strong>{elapsed}s</strong>
          </p>
        </div>

        <div className="mx-auto mt-4 flex max-w-md flex-wrap justify-center gap-3">
          <p className="rounded-xl bg-star/20 px-4 py-3 font-bold">+{summary.starsEarned} ⭐</p>
          <p className="rounded-xl bg-magic/15 px-4 py-3 font-bold">+{summary.xpEarned} XP</p>
          {summary.coinsEarned > 0 && (
            <p className="rounded-xl bg-background-soft px-4 py-3 font-bold">+{summary.coinsEarned} 🪙</p>
          )}
          {summary.diamondsEarned > 0 && (
            <p className="rounded-xl bg-magic/15 px-4 py-3 font-bold">+{summary.diamondsEarned} 💎</p>
          )}
        </div>

        {summary.targetReached === false && (
          <p className="mt-3 text-sm text-foreground-soft">
            Objectif du défi : 80 % de réussite. Un peu d&apos;entraînement et
            ce sera gagné !
          </p>
        )}

        {newBadges.length > 0 && (
          <div className="mt-4 rounded-xl bg-star/20 px-4 py-3">
            <p className="font-display font-bold">Nouveaux badges !</p>
            <p>{newBadges.join(" · ")}</p>
          </div>
        )}

        <button
          type="button"
          onClick={() => {
            setPhase("config");
            setSummary(null);
            setNewBadges([]);
            setQuestions([]);
            setSessionId(null);
          }}
          className="btn-large mt-8 bg-button text-white shadow-lg hover:bg-button-hover"
        >
          Rejouer
        </button>
      </div>
    );
  }

  return null;
}
