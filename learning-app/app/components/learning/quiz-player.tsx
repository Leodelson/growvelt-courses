"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ActionButton } from "@/app/components/ui/action-button";
import { InlineFeedback } from "@/app/components/ui/inline-feedback";
import { useLanguage } from "@/app/components/language-provider";
import { createClient } from "@/app/lib/supabase/browser";

type QuizAttemptResult = {
  attemptId: number;
  submittedAt: string;
  scorePercentage: number;
  passed: boolean;
  correctAnswerCount: number;
  totalQuestionCount: number;
};

type EnrolledQuizSnapshot = {
  lesson: { title: string };
  quiz: {
    instructions: string | null;
    passingPercentage: number;
    questions: Array<{ id: number; text: string; options: Array<{ id: number; text: string }> }>;
    latestAttempt: { submittedAt: string; scorePercentage: number; passed: boolean } | null;
    attemptCount: number;
  };
};

export function QuizPlayer({ quiz, slug, lessonId, nextHref, courseHref }: {
  quiz: EnrolledQuizSnapshot;
  slug: string;
  lessonId: number;
  nextHref: string | null;
  courseHref: string;
}) {
  const router = useRouter();
  const { locale } = useLanguage();
  const text = locale === "fr" ? { unanswered: "Répondez à toutes les {count} question{plural} restantes avant d’envoyer.", noAccess: "Vous n’avez plus accès à ce quiz. Retournez à votre cours et réessayez.", invalid: "Ce quiz ne peut pas être envoyé dans son état actuel. Actualisez la page et réessayez.", failed: "Nous n’avons pas pu envoyer ce quiz. Réessayez.", passMark: "Note de passage", attempts: "Tentatives", passed: "Réussi", notPassed: "Non réussi", correct: "bonnes réponses", submitting: "Envoi du quiz…", retry: "Réessayer", submit: "Envoyer le quiz", next: "Continuer vers la leçon suivante", completed: "Voir le cours terminé" } : locale === "es" ? { unanswered: "Responde las {count} pregunta{plural} restantes antes de enviar.", noAccess: "Ya no tienes acceso para enviar este cuestionario. Vuelve al curso e inténtalo de nuevo.", invalid: "Este cuestionario no se puede enviar en su estado actual. Actualiza la página e inténtalo de nuevo.", failed: "No pudimos enviar este cuestionario. Inténtalo de nuevo.", passMark: "Puntuación mínima", attempts: "Intentos", passed: "Aprobado", notPassed: "No aprobado", correct: "correctas", submitting: "Enviando cuestionario…", retry: "Intentar de nuevo", submit: "Enviar cuestionario", next: "Continuar a la siguiente lección", completed: "Ver curso completado" } : { unanswered: "Answer all {count} remaining question{plural} before submitting.", noAccess: "You no longer have access to submit this quiz. Return to your course and try again.", invalid: "This quiz cannot be submitted in its current state. Refresh the page and try again.", failed: "We couldn’t submit this quiz. Please try again.", passMark: "Pass mark", attempts: "Attempts", passed: "Passed", notPassed: "Not passed", correct: "correct", submitting: "Submitting quiz…", retry: "Try again", submit: "Submit quiz", next: "Continue to next lesson", completed: "View completed course" };
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [result, setResult] = useState<QuizAttemptResult | null>(quiz.quiz.latestAttempt
    ? {
      attemptId: 0,
      submittedAt: quiz.quiz.latestAttempt.submittedAt,
      scorePercentage: quiz.quiz.latestAttempt.scorePercentage,
      passed: quiz.quiz.latestAttempt.passed,
      correctAnswerCount: 0,
      totalQuestionCount: quiz.quiz.questions.length,
    }
    : null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const unanswered = quiz.quiz.questions.filter((question) => !answers[question.id]).length;

  async function submit() {
    if (pending) return;
    if (unanswered) {
      setError(text.unanswered.replace("{count}", String(unanswered)).replace("{plural}", unanswered === 1 ? "" : "s"));
      return;
    }

    setPending(true);
    setError(null);
    const { data, error: rpcError } = await createClient().rpc("submit_own_quiz_attempt", {
      p_slug: slug,
      p_lesson_id: lessonId,
      p_answers: Object.entries(answers).map(([questionId, optionId]) => ({
        question_id: Number(questionId),
        option_id: optionId,
      })),
    });
    setPending(false);

    if (rpcError || !data?.[0]) {
      if (process.env.NODE_ENV === "development" && rpcError) {
        console.error(
          `Quiz submission failed — code: ${rpcError.code ?? "unknown"}; message: ${rpcError.message ?? "none"}; details: ${rpcError.details ?? "none"}; hint: ${rpcError.hint ?? "none"}`,
        );
      }
      setError(rpcError?.code === "42501"
        ? text.noAccess
        : rpcError?.code === "22023"
          ? text.invalid
          : text.failed);
      return;
    }

    setResult({
      attemptId: data[0].attempt_id,
      submittedAt: data[0].submitted_at,
      scorePercentage: data[0].score_percentage,
      passed: data[0].passed,
      correctAnswerCount: data[0].correct_answer_count,
      totalQuestionCount: data[0].total_question_count,
    });
    router.refresh();
  }

  return (
    <section className="quiz-player" aria-labelledby="quiz-title">
      <h2 id="quiz-title">{quiz.lesson.title}</h2>
      {quiz.quiz.instructions && <p className="quiz-instructions">{quiz.quiz.instructions}</p>}
      <p className="quiz-threshold">{text.passMark}: <strong>{quiz.quiz.passingPercentage}%</strong> · {text.attempts}: {quiz.quiz.attemptCount}</p>
      {result && <div className={`quiz-result${result.passed ? " is-passed" : " is-failed"}`} role="status"><strong>{result.passed ? text.passed : text.notPassed}</strong><span>{result.scorePercentage}% · {result.correctAnswerCount} / {result.totalQuestionCount} {text.correct}</span></div>}
      <ol className="quiz-questions">{quiz.quiz.questions.map((question, index) => <li key={question.id}><fieldset disabled={pending || Boolean(result?.passed)}><legend>{index + 1}. {question.text}</legend>{question.options.map((option) => <label key={option.id} className={`quiz-option${answers[question.id] === option.id ? " is-selected" : ""}`}><input type="radio" name={`question-${question.id}`} checked={answers[question.id] === option.id} onChange={() => setAnswers((current) => ({ ...current, [question.id]: option.id }))} />{option.text}</label>)}</fieldset></li>)}</ol>
      {error && <InlineFeedback variant="error">{error}</InlineFeedback>}
      <div className="quiz-actions">{!result?.passed && <ActionButton className="button button-primary" type="button" isPending={pending} pendingLabel={text.submitting} onClick={submit}>{result ? text.retry : text.submit}</ActionButton>}{result?.passed && <a className="button button-primary" href={nextHref ?? courseHref}>{nextHref ? text.next : text.completed}</a>}</div>
    </section>
  );
}
