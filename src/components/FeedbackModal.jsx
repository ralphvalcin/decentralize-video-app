import { useState } from 'react';

const FeedbackModal = ({ isOpen, onClose, onSubmit, roomId, callDuration }) => {
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [email, setEmail] = useState('');

  const stars = [1, 2, 3, 4, 5];
  const feedbackOptions = [
    'Great audio/video quality',
    'Easy to use interface',
    'Connection was stable',
    'Features worked well',
    'Would recommend to others'
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (rating === 0) return;

    setIsSubmitting(true);
    
    const feedbackData = {
      rating,
      feedback,
      email: email.trim(),
      roomId,
      callDuration,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent
    };

    try {
      // Store feedback locally for now - can be upgraded to API later
      const existingFeedback = JSON.parse(localStorage.getItem('appFeedback') || '[]');
      existingFeedback.push(feedbackData);
      localStorage.setItem('appFeedback', JSON.stringify(existingFeedback));
      
      onSubmit(feedbackData);
      onClose();
    } catch (error) {
      console.error('Error submitting feedback:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="text-center mb-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              How was your call?
            </h3>
            <p className="text-gray-600 text-sm">
              Help us improve your experience
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Star Rating */}
            <div className="text-center">
              <p className="text-sm font-medium text-gray-700 mb-3">Rate your experience</p>
              <div className="flex justify-center space-x-1">
                {stars.map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    className={`text-2xl transition-colors ${
                      star <= rating ? 'text-yellow-400' : 'text-gray-300'
                    } hover:text-yellow-400`}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Feedback Options */}
            {rating >= 4 && (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-3">What did you like?</p>
                <div className="space-y-2">
                  {feedbackOptions.map((option) => (
                    <label key={option} className="flex items-center">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFeedback(prev => prev ? `${prev}, ${option}` : option);
                          } else {
                            setFeedback(prev => prev.replace(option, '').replace(/^,\s*|,\s*$|,\s*,/g, '').trim());
                          }
                        }}
                      />
                      <span className="ml-2 text-sm text-gray-700">{option}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Additional Feedback */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Additional feedback (optional)
              </label>
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows="3"
                placeholder="Tell us more about your experience..."
              />
            </div>

            {/* Email for follow-up */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email (optional - for product updates)
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="your@email.com"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
              >
                Skip
              </button>
              <button
                type="submit"
                disabled={rating === 0 || isSubmitting}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default FeedbackModal;