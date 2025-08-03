import { useState, useEffect } from 'react';
import DraggableWindow from './DraggableWindow';

const Polls = ({ isOpen, onToggle, onCreatePoll, onVote, polls = [], userInfo, isHost = false }) => {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newPoll, setNewPoll] = useState({
    question: '',
    options: ['', ''],
    type: 'multiple-choice', // 'multiple-choice', 'yes-no', 'rating'
    allowMultiple: false,
    anonymous: false
  });

  const addOption = () => {
    if (newPoll.options.length < 6) {
      setNewPoll(prev => ({
        ...prev,
        options: [...prev.options, '']
      }));
    }
  };

  const removeOption = (index) => {
    if (newPoll.options.length > 2) {
      setNewPoll(prev => ({
        ...prev,
        options: prev.options.filter((_, i) => i !== index)
      }));
    }
  };

  const updateOption = (index, value) => {
    setNewPoll(prev => ({
      ...prev,
      options: prev.options.map((opt, i) => i === index ? value : opt)
    }));
  };

  const handleCreatePoll = () => {
    if (newPoll.question.trim() && newPoll.options.every(opt => opt.trim())) {
      const pollData = {
        ...newPoll,
        id: Date.now(),
        createdBy: userInfo.name,
        createdAt: new Date().toISOString(),
        votes: {},
        isActive: true
      };
      
      onCreatePoll(pollData);
      setNewPoll({
        question: '',
        options: ['', ''],
        type: 'multiple-choice',
        allowMultiple: false,
        anonymous: false
      });
      setShowCreateForm(false);
    }
  };

  const handleVote = (pollId, optionIndex) => {
    onVote(pollId, optionIndex, userInfo.id);
  };

  const calculateResults = (poll) => {
    const totalVotes = Object.keys(poll.votes || {}).length;
    const optionCounts = {};
    
    Object.values(poll.votes || {}).forEach(vote => {
      if (Array.isArray(vote)) {
        vote.forEach(optionIdx => {
          optionCounts[optionIdx] = (optionCounts[optionIdx] || 0) + 1;
        });
      } else {
        optionCounts[vote] = (optionCounts[vote] || 0) + 1;
      }
    });

    return { totalVotes, optionCounts };
  };

  const hasUserVoted = (poll) => {
    return poll.votes && poll.votes[userInfo.id];
  };

  const pollsTitle = (
    <div className="flex items-center justify-between w-full">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
          <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
            <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
          </svg>
        </div>
        <div>
          <h3 className="text-surface-900 font-semibold text-sm">Polls</h3>
          <p className="text-xs text-surface-500">
            {polls.length} poll{polls.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {isHost && (
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="btn-ghost p-2 text-surface-500 hover:text-surface-700"
            title="Create new poll"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );

  return (
    <DraggableWindow
      title={pollsTitle}
      isOpen={isOpen}
      onClose={onToggle}
      defaultPosition={{ x: 20, y: 80 }}
      width="w-96"
      zIndex="z-40"
    >

      {/* Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {/* Create Poll Form */}
        {showCreateForm && isHost && (
          <div className="p-4 border-b border-gray-200">
            <h4 className="text-gray-900 font-medium mb-3">Create New Poll</h4>
            
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-700 mb-1">Question</label>
                <textarea
                  value={newPoll.question}
                  onChange={(e) => setNewPoll(prev => ({ ...prev, question: e.target.value }))}
                  placeholder="What's your question?"
                  className="input resize-none"
                  rows={2}
                  maxLength={200}
                />
              </div>

              <div>
                <label className="block text-sm text-surface-300 mb-1">Poll Type</label>
                <select
                  value={newPoll.type}
                  onChange={(e) => setNewPoll(prev => ({ ...prev, type: e.target.value }))}
                  className="input"
                >
                  <option value="multiple-choice">Multiple Choice</option>
                  <option value="yes-no">Yes/No</option>
                  <option value="rating">Rating (1-5)</option>
                </select>
              </div>

              {newPoll.type === 'multiple-choice' && (
                <div>
                  <label className="block text-sm text-surface-300 mb-1">Options</label>
                  {newPoll.options.map((option, index) => (
                    <div key={index} className="flex items-center gap-2 mb-2">
                      <input
                        type="text"
                        value={option}
                        onChange={(e) => updateOption(index, e.target.value)}
                        placeholder={`Option ${index + 1}`}
                        className="input flex-1"
                        maxLength={100}
                      />
                      {newPoll.options.length > 2 && (
                        <button
                          onClick={() => removeOption(index)}
                          className="btn-ghost p-2 text-red-400 hover:text-red-300"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                  {newPoll.options.length < 6 && (
                    <button
                      onClick={addOption}
                      className="btn-secondary text-sm"
                    >
                      + Add Option
                    </button>
                  )}
                </div>
              )}

              <div className="flex items-center gap-4 text-sm">
                <label className="flex items-center gap-2 text-surface-300">
                  <input
                    type="checkbox"
                    checked={newPoll.allowMultiple}
                    onChange={(e) => setNewPoll(prev => ({ ...prev, allowMultiple: e.target.checked }))}
                    className="rounded"
                  />
                  Allow multiple choices
                </label>
                <label className="flex items-center gap-2 text-surface-300">
                  <input
                    type="checkbox"
                    checked={newPoll.anonymous}
                    onChange={(e) => setNewPoll(prev => ({ ...prev, anonymous: e.target.checked }))}
                    className="rounded"
                  />
                  Anonymous
                </label>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setShowCreateForm(false)}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreatePoll}
                  className="btn-primary flex-1"
                  disabled={!newPoll.question.trim() || !newPoll.options.every(opt => opt.trim())}
                >
                  Create Poll
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Polls List */}
        <div className="p-4 space-y-4">
          {polls.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
                </svg>
              </div>
              <p className="text-gray-600 text-sm mb-2">No polls yet</p>
              {isHost ? (
                <p className="text-gray-400 text-xs">Create a poll to engage your audience!</p>
              ) : (
                <p className="text-gray-400 text-xs">Waiting for the host to create polls</p>
              )}
            </div>
          ) : (
            polls.map((poll) => (
              <PollCard
                key={poll.id}
                poll={poll}
                onVote={handleVote}
                hasVoted={hasUserVoted(poll)}
                results={calculateResults(poll)}
                userInfo={userInfo}
              />
            ))
          )}
        </div>
      </div>
    </DraggableWindow>
  );
};

// Individual Poll Card Component
const PollCard = ({ poll, onVote, hasVoted, results, userInfo }) => {
  const [selectedOptions, setSelectedOptions] = useState([]);

  const handleOptionSelect = (optionIndex) => {
    if (hasVoted) return;

    if (poll.allowMultiple) {
      setSelectedOptions(prev => 
        prev.includes(optionIndex)
          ? prev.filter(idx => idx !== optionIndex)
          : [...prev, optionIndex]
      );
    } else {
      setSelectedOptions([optionIndex]);
    }
  };

  const submitVote = () => {
    if (selectedOptions.length > 0) {
      onVote(poll.id, poll.allowMultiple ? selectedOptions : selectedOptions[0]);
      setSelectedOptions([]);
    }
  };

  const getPercentage = (optionIndex) => {
    if (results.totalVotes === 0) return 0;
    return Math.round(((results.optionCounts[optionIndex] || 0) / results.totalVotes) * 100);
  };

  return (
    <div className="bg-surface-800 rounded-lg p-4 border border-surface-700">
      <div className="mb-3">
        <h5 className="text-white font-medium text-sm mb-1">{poll.question}</h5>
        <div className="flex items-center gap-2 text-xs text-surface-400">
          <span>By {poll.createdBy}</span>
          <span>•</span>
          <span>{results.totalVotes} vote{results.totalVotes !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {poll.type === 'multiple-choice' && (
        <div className="space-y-2">
          {poll.options.map((option, index) => {
            const percentage = getPercentage(index);
            const votes = results.optionCounts[index] || 0;
            const isSelected = selectedOptions.includes(index);
            
            return (
              <div key={index} className="relative">
                <button
                  onClick={() => handleOptionSelect(index)}
                  disabled={hasVoted}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    hasVoted
                      ? 'bg-surface-700 border-surface-600 cursor-default'
                      : isSelected
                      ? 'bg-primary-600 border-primary-500 text-white'
                      : 'bg-surface-700 border-surface-600 hover:border-surface-500 text-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm">{option}</span>
                    {hasVoted && (
                      <div className="flex items-center gap-2 text-xs">
                        <span>{votes}</span>
                        <span>({percentage}%)</span>
                      </div>
                    )}
                  </div>
                </button>
                
                {hasVoted && (
                  <div
                    className="absolute left-0 top-0 bottom-0 bg-primary-500/20 rounded-lg transition-all duration-500"
                    style={{ width: `${percentage}%` }}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {!hasVoted && selectedOptions.length > 0 && (
        <button
          onClick={submitVote}
          className="btn-primary w-full mt-3 text-sm"
        >
          Submit Vote
        </button>
      )}

      {hasVoted && (
        <div className="mt-3 p-2 bg-green-500/10 border border-green-500/20 rounded text-green-400 text-xs text-center">
          ✓ Your vote has been recorded
        </div>
      )}
    </div>
  );
};

export default Polls;