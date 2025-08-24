import { useState, useRef, useEffect } from 'react';
import DOMPurify from 'dompurify';
import SidePanel from './SidePanel';

const QA = ({ isOpen, onToggle, onSubmitQuestion, onVoteQuestion, onAnswerQuestion, questions = [], userInfo, isHost = false, stackPosition = 0, totalOpenPanels = 1 }) => {
  const [newQuestion, setNewQuestion] = useState('');
  const [sortBy, setSortBy] = useState('votes'); // 'votes', 'recent', 'answered'
  const [filterAnswered, setFilterAnswered] = useState('all'); // 'all', 'answered', 'unanswered'
  const inputRef = useRef(null);

   
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSubmitQuestion = (e) => {
    e.preventDefault();
    const sanitizedQuestion = DOMPurify.sanitize(newQuestion.trim());
    if (sanitizedQuestion && sanitizedQuestion.length > 0 && sanitizedQuestion.length <= 500) {
      onSubmitQuestion({
        id: Date.now(),
        question: sanitizedQuestion,
        author: userInfo.name,
        authorId: userInfo.id,
        timestamp: new Date().toISOString(),
        votes: 0,
        votedBy: [],
        answer: null,
        answeredBy: null,
        answeredAt: null,
        isAnswered: false
      });
      setNewQuestion('');
    }
  };

  const handleVote = (questionId) => {
    onVoteQuestion(questionId, userInfo.id);
  };

  const handleAnswer = (questionId, answer) => {
    if (isHost && answer.trim()) {
      onAnswerQuestion(questionId, {
        answer: DOMPurify.sanitize(answer.trim()),
        answeredBy: userInfo.name,
        answeredAt: new Date().toISOString()
      });
    }
  };

  const getSortedQuestions = () => {
    let filtered = questions;

    // Apply filter
    if (filterAnswered === 'answered') {
      filtered = questions.filter(q => q.isAnswered);
    } else if (filterAnswered === 'unanswered') {
      filtered = questions.filter(q => !q.isAnswered);
    }

    // Apply sort
    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'votes':
          return b.votes - a.votes;
        case 'recent':
          return new Date(b.timestamp) - new Date(a.timestamp);
        case 'answered':
          if (a.isAnswered && !b.isAnswered) return -1;
          if (!a.isAnswered && b.isAnswered) return 1;
          return b.votes - a.votes;
        default:
          return 0;
      }
    });
  };

  const _formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const sortedQuestions = getSortedQuestions();
  const totalQuestions = questions.length;
  const answeredCount = questions.filter(q => q.isAnswered).length;

  const qaIcon = (
    <svg className="w-4 h-4 text-purple-400" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
    </svg>
  );

  const qaTitle = (
    <div>
      <h3 className="text-sm font-semibold text-white">Questions</h3>
      <p className="text-xs text-slate-400">
        {totalQuestions} question{totalQuestions !== 1 ? 's' : ''} • {answeredCount} answered
      </p>
    </div>
  );

  return (
    <SidePanel
      isOpen={isOpen}
      onToggle={onToggle}
      title={qaTitle}
      icon={qaIcon}
      position="right"
      stackPosition={stackPosition}
      totalOpenPanels={totalOpenPanels}
      zIndex="z-40"
    >

      {/* Filters and Sort */}
      <div className="p-4 border-b border-slate-700">
        <div className="flex items-center gap-2 mb-3">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors flex-1"
          >
            <option value="votes">Most Voted</option>
            <option value="recent">Most Recent</option>
            <option value="answered">Answered First</option>
          </select>
          <select
            value={filterAnswered}
            onChange={(e) => setFilterAnswered(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors flex-1"
          >
            <option value="all">All Questions</option>
            <option value="unanswered">Unanswered</option>
            <option value="answered">Answered</option>
          </select>
        </div>

        {/* Submit Question Form */}
        <form onSubmit={handleSubmitQuestion} className="space-y-2">
          <textarea
            ref={inputRef}
            value={newQuestion}
            onChange={(e) => setNewQuestion(e.target.value)}
            placeholder="Ask a question..."
            className="w-full px-3 py-2 text-sm bg-slate-700 border border-slate-600 rounded-lg resize-none min-h-[60px] text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            maxLength={500}
            rows={2}
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">
              {newQuestion.length}/500
            </span>
            <button
              type="submit"
              disabled={!newQuestion.trim()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors text-sm"
            >
              Ask Question
            </button>
          </div>
        </form>
      </div>

      {/* Questions List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {sortedQuestions.length === 0 ? (
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-slate-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
            </div>
            <p className="text-slate-300 text-sm mb-2">
              {filterAnswered === 'answered' ? 'No answered questions yet' :
               filterAnswered === 'unanswered' ? 'No unanswered questions' :
               'No questions yet'}
            </p>
            <p className="text-slate-500 text-xs">Be the first to ask a question!</p>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            {sortedQuestions.map((question) => (
              <QuestionCard
                key={question.id}
                question={question}
                onVote={handleVote}
                onAnswer={handleAnswer}
                userInfo={userInfo}
                isHost={isHost}
                canVote={!question.votedBy.includes(userInfo.id)}
              />
            ))}
          </div>
        )}
      </div>
    </SidePanel>
  );
};

// Individual Question Card Component
const QuestionCard = ({ question, onVote, onAnswer, userInfo, isHost, canVote }) => {
  const [showAnswerForm, setShowAnswerForm] = useState(false);
  const [answerText, setAnswerText] = useState('');

  const handleSubmitAnswer = (e) => {
    e.preventDefault();
    if (answerText.trim()) {
      onAnswer(question.id, answerText);
      setAnswerText('');
      setShowAnswerForm(false);
    }
  };

  const isOwnQuestion = question.authorId === userInfo.id;

  return (
    <div className={`bg-surface-800 rounded-lg p-4 border ${
      question.isAnswered ? 'border-green-500/30' : 'border-surface-700'
    }`}>
      {/* Question Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <p className="text-white text-sm leading-relaxed mb-2">
            {question.question}
          </p>
          <div className="flex items-center gap-2 text-xs text-surface-400">
            <span>By {question.author}</span>
            {isOwnQuestion && <span className="text-primary-400">(You)</span>}
            <span>•</span>
            <span>{formatTime(question.timestamp)}</span>
          </div>
        </div>
      </div>

      {/* Vote Button */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => onVote(question.id)}
          disabled={!canVote || isOwnQuestion}
          className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs transition-colors ${
            canVote && !isOwnQuestion
              ? 'bg-surface-700 hover:bg-surface-600 text-surface-300 hover:text-white'
              : 'bg-surface-700/50 text-surface-500 cursor-not-allowed'
          }`}
        >
          <span>👍</span>
          <span>{question.votes}</span>
        </button>

        {isHost && !question.isAnswered && (
          <button
            onClick={() => setShowAnswerForm(!showAnswerForm)}
            className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white rounded-lg transition-colors text-xs"
          >
            Answer
          </button>
        )}
      </div>

      {/* Answer Form (Host Only) */}
      {showAnswerForm && isHost && (
        <form onSubmit={handleSubmitAnswer} className="mb-3">
          <textarea
            value={answerText}
            onChange={(e) => setAnswerText(e.target.value)}
            placeholder="Type your answer..."
            className="w-full px-3 py-2 text-sm bg-slate-700 border border-slate-600 rounded-lg resize-none text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors mb-2"
            rows={3}
            maxLength={1000}
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">
              {answerText.length}/1000
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowAnswerForm(false)}
                className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white rounded-lg transition-colors text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!answerText.trim()}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors text-xs"
              >
                Submit Answer
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Answer Display */}
      {question.isAnswered && question.answer && (
        <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 mt-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-green-400 text-sm">✓ Answered</span>
            <span className="text-xs text-slate-400">
              by {question.answeredBy} • {formatTime(question.answeredAt)}
            </span>
          </div>
          <p className="text-white text-sm leading-relaxed">
            {question.answer}
          </p>
        </div>
      )}
    </div>
  );
};

const formatTime = (timestamp) => {
  return new Date(timestamp).toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit' 
  });
};

export default QA;
