"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ActionButton } from "@/app/components/ui/action-button";
import { InlineFeedback } from "@/app/components/ui/inline-feedback";
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
      setError(`Answer all ${unanswered} remaining question${unanswered === 1 ? "" : "s"} before submitting.`);
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
        ? "You no longer have access to submit this quiz. Return to your course and try again."
        : rpcError?.code === "22023"
          ? "This quiz cannot be submitted in its current state. Refresh the page and try again."
          : "We couldn’t submit this quiz. Please try again.");
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
      <p className="quiz-threshold">Pass mark: <strong>{quiz.quiz.passingPercentage}%</strong> · Attempts: {quiz.quiz.attemptCount}</p>
      {result && <div className={`quiz-result${result.passed ? " is-passed" : " is-failed"}`} role="status"><strong>{result.passed ? "Passed" : "Not passed"}</strong><span>{result.scorePercentage}% · {result.correctAnswerCount} of {result.totalQuestionCount} correct</span></div>}
      <ol className="quiz-questions">{quiz.quiz.questions.map((question, index) => <li key={question.id}><fieldset disabled={pending || Boolean(result?.passed)}><legend>{index + 1}. {question.text}</legend>{question.options.map((option) => <label key={option.id} className={`quiz-option${answers[question.id] === option.id ? " is-selected" : ""}`}><input type="radio" name={`question-${question.id}`} checked={answers[question.id] === option.id} onChange={() => setAnswers((current) => ({ ...current, [question.id]: option.id }))} />{option.text}</label>)}</fieldset></li>)}</ol>
      {error && <InlineFeedback variant="error">{error}</InlineFeedback>}
      <div className="quiz-actions">{!result?.passed && <ActionButton className="button button-primary" type="button" isPending={pending} pendingLabel="Submitting quiz…" onClick={submit}>{result ? "Try again" : "Submit quiz"}</ActionButton>}{result?.passed && <a className="button button-primary" href={nextHref ?? courseHref}>{nextHref ? "Continue to next lesson" : "View completed course"}</a>}</div>
    </section>
  );
}
