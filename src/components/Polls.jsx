import { useState } from 'react';
import SidePanel from './SidePanel';

const Polls = ({ isOpen, onToggle, onCreatePoll, onVote, polls = [], userInfo, isHost = false, stackPosition = 0, totalOpenPanels = 1 }) => {
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

  const pollsIcon = (
    <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
      <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
    </svg>
  );

  const pollsTitle = (
    <div className="flex items-center justify-between w-full">
      <div>
        <h3 className="text-sm font-semibold text-white">Polls</h3>
        <p className="text-xs text-slate-400">
          {polls.length} poll{polls.length !== 1 ? 's' : ''}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {isHost && (
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
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
    <SidePanel
      isOpen={isOpen}
      onToggle={onToggle}
      title={pollsTitle}
      icon={pollsIcon}
      position="right"
      stackPosition={stackPosition}
      totalOpenPanels={totalOpenPanels}
      zIndex="z-40"
    >

      {/* Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {/* Create Poll Form */}
        {showCreateForm && isHost && (
          <div className="p-4 border-b border-slate-700">
            <h4 className="text-white font-medium mb-3">Create New Poll</h4>
            
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-slate-300 mb-1">Question</label>
                <textarea
                  value={newPoll.question}
                  onChange={(e) => setNewPoll(prev => ({ ...prev, question: e.target.value }))}
                  placeholder="What's your question?"
                  className="w-full px-3 py-2 text-sm bg-slate-700 border border-slate-600 rounded-lg resize-none text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  rows={2}
                  maxLength={200}
                />
              </div>

              <div>
                <label className="block text-sm text-surface-300 mb-1">Poll Type</label>
                <select
                  value={newPoll.type}
                  onChange={(e) => setNewPoll(prev => ({ ...prev, type: e.target.value }))}
                  className="w-full px-3 py-2 text-sm bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
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
                        className="w-full px-3 py-2 text-sm bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors flex-1"
                        maxLength={100}
                      />
                      {newPoll.options.length > 2 && (
                        <button
                          onClick={() => removeOption(index)}
                          className="p-2 text-red-400 hover:text-red-300 hover:bg-slate-700 rounded-lg transition-colors"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                  {newPoll.options.length < 6 && (
                    <button
                      onClick={addOption}
                      className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white rounded-lg transition-colors text-sm"
                    >
                      + Add Option
                    </button>
                  )}
                </div>
              )}

              <div className="flex items-center gap-4 text-sm">
                <label className="flex items-center gap-2 text-slate-300">
                  <input
                    type="checkbox"
                    checked={newPoll.allowMultiple}
                    onChange={(e) => setNewPoll(prev => ({ ...prev, allowMultiple: e.target.checked }))}
                    className="rounded"
                  />
                  Allow multiple choices
                </label>
                <label className="flex items-center gap-2 text-slate-300">
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
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white rounded-lg transition-colors flex-1"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreatePoll}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex-1"
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
              <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-slate-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
                </svg>
              </div>
              <p className="text-slate-300 text-sm mb-2">No polls yet</p>
              {isHost ? (
                <p className="text-slate-500 text-xs">Create a poll to engage your audience!</p>
              ) : (
                <p className="text-slate-500 text-xs">Waiting for the host to create polls</p>
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
    </SidePanel>
  );
};

// Individual Poll Card Component
const PollCard = ({ poll, onVote, hasVoted, results, userInfo: _userInfo }) => {
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
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors w-full mt-3 text-sm"
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