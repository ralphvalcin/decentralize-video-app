import { useState } from 'react'
import { useSessionStore } from '../store/useSessionStore'
import type { Question } from '../types'

interface QAPanelProps {
  onSubmitQuestion: (text: string) => void
  onVoteQuestion: (questionId: string) => void
  onAnswerQuestion: (questionId: string, answer: string) => void
}

export function QAPanel({ onSubmitQuestion, onVoteQuestion, onAnswerQuestion }: QAPanelProps) {
  const questions = useSessionStore((s) => s.questions)
  const [draft, setDraft] = useState('')
  const [votedIds, setVotedIds] = useState<Set<string>>(new Set())
  const [answerDrafts, setAnswerDrafts] = useState<Record<string, string>>({})
  const [expandedAnswerIds, setExpandedAnswerIds] = useState<Set<string>>(new Set())

  const sorted = [...questions].sort((a, b) => b.votes - a.votes)

  function handleUpvote(q: Question) {
    onVoteQuestion(q.id)
    setVotedIds((prev) => new Set(prev).add(q.id))
  }

  function handleExpandAnswer(id: string) {
    setExpandedAnswerIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function handleSubmitAnswer(id: string) {
    const text = (answerDrafts[id] ?? '').trim()
    if (!text) return
    onAnswerQuestion(id, text)
    setAnswerDrafts((prev) => ({ ...prev, [id]: '' }))
    setExpandedAnswerIds((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }

  function handleAsk() {
    const text = draft.trim()
    if (!text) return
    onSubmitQuestion(text)
    setDraft('')
  }

  return (
    <div
      data-testid="qa-panel"
      className="w-[280px] shrink-0 border-l border-[var(--border-subtle)] flex flex-col bg-[var(--surface-base)]"
    >
      <div className="px-4 py-3 border-b border-[var(--border-subtle)] shrink-0">
        <span className="text-[var(--text-primary)] text-sm font-semibold">Q&A</span>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2 flex flex-col gap-3">
        {sorted.length === 0 ? (
          <p data-testid="qa-empty" className="text-[var(--text-secondary)] text-xs text-center mt-4">
            No questions yet
          </p>
        ) : (
          sorted.map((q) => (
            <div
              key={q.id}
              data-testid={`qa-question-${q.id}`}
              className="border border-[var(--border-subtle)] rounded-[8px] p-3 flex flex-col gap-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <p className="text-[var(--text-primary)] text-xs font-medium">{q.text}</p>
                  <p className="text-[var(--text-secondary)] text-[10px] mt-0.5">{q.author}</p>
                </div>
                <div className="flex flex-col items-center shrink-0">
                  <button
                    data-testid={`btn-upvote-${q.id}`}
                    disabled={votedIds.has(q.id)}
                    onClick={() => handleUpvote(q)}
                    className="text-xs text-[var(--text-secondary)] hover:text-[var(--accent-live)] disabled:opacity-40 disabled:cursor-default"
                  >
                    ▲
                  </button>
                  <span className="text-[10px] text-[var(--text-secondary)]">{q.votes}</span>
                </div>
              </div>

              {q.isAnswered ? (
                <div
                  data-testid="qa-answer"
                  className="bg-green-50 dark:bg-green-900/20 rounded-[6px] px-2 py-1.5 text-xs"
                >
                  <p className="text-green-800 dark:text-green-200">{q.answer}</p>
                  <p className="text-green-600 dark:text-green-400 text-[10px] mt-0.5">
                    Answered by {q.answeredBy}
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  <button
                    data-testid={`btn-expand-answer-${q.id}`}
                    onClick={() => handleExpandAnswer(q.id)}
                    className="text-[10px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-left"
                  >
                    {expandedAnswerIds.has(q.id) ? 'Cancel' : 'Answer'}
                  </button>
                  {expandedAnswerIds.has(q.id) && (
                    <div className="flex gap-1">
                      <input
                        data-testid={`answer-input-${q.id}`}
                        value={answerDrafts[q.id] ?? ''}
                        onChange={(e) =>
                          setAnswerDrafts((prev) => ({ ...prev, [q.id]: e.target.value }))
                        }
                        placeholder="Type answer…"
                        className="flex-1 text-[10px] bg-[var(--surface-raised)] border border-[var(--border-subtle)] rounded-[4px] px-2 py-1 text-[var(--text-primary)] outline-none"
                      />
                      <button
                        data-testid={`btn-submit-answer-${q.id}`}
                        onClick={() => handleSubmitAnswer(q.id)}
                        className="text-[10px] px-2 py-1 bg-[var(--accent-live)] text-white rounded-[4px]"
                      >
                        Submit
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <div className="px-3 py-2 border-t border-[var(--border-subtle)] flex gap-2 shrink-0">
        <input
          data-testid="qa-ask-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAsk()}
          placeholder="Ask a question…"
          className="flex-1 text-xs bg-[var(--surface-raised)] border border-[var(--border-subtle)] rounded-[8px] px-3 py-2 text-[var(--text-primary)] outline-none"
        />
        <button
          data-testid="btn-ask"
          disabled={!draft.trim()}
          onClick={handleAsk}
          className="text-xs px-3 py-2 bg-[var(--accent-live)] text-white rounded-[8px] disabled:opacity-40 disabled:cursor-default"
        >
          Ask
        </button>
      </div>
    </div>
  )
}
