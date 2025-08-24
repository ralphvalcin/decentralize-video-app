import { useState } from 'react';
import toast from 'react-hot-toast';

const ShareModal = ({ isOpen, onClose, roomId, roomUrl }) => {
  const [showQRCode, setShowQRCode] = useState(false);
  const [copied, setCopied] = useState('');

  if (!isOpen) return null;

  const shareUrl = roomUrl || `${window.location.origin}/room/${roomId}`;
  const meetingTitle = `Join my video call`;
  const meetingMessage = `Join me for a video call! 

🎥 Meeting Link: ${shareUrl}
📱 Room ID: ${roomId}

No downloads required - just click the link and enter your name to join.

Powered by Decentralized Video Chat`;

  const copyToClipboard = async (text, type) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(type);
      toast.success(`${type} copied to clipboard!`);
      setTimeout(() => setCopied(''), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      toast.error('Failed to copy to clipboard');
    }
  };

  const shareViaEmail = () => {
    const subject = encodeURIComponent(meetingTitle);
    const body = encodeURIComponent(meetingMessage);
    window.open(`mailto:?subject=${subject}&body=${body}`);
  };

  const shareViaWhatsApp = () => {
    const message = encodeURIComponent(`${meetingTitle}\n\n${shareUrl}\n\nRoom ID: ${roomId}`);
    window.open(`https://wa.me/?text=${message}`);
  };

  const shareViaTwitter = () => {
    const text = encodeURIComponent(`${meetingTitle} ${shareUrl}`);
    window.open(`https://twitter.com/intent/tweet?text=${text}`);
  };

  const shareViaNative = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: meetingTitle,
          text: 'Join my video call',
          url: shareUrl
        });
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('Error sharing:', err);
        }
      }
    } else {
      toast.error('Native sharing not supported on this device');
    }
  };

  // Simple QR Code generator using QR Server API
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(shareUrl)}`;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-semibold text-gray-900">
              Share Meeting
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-xl"
            >
              ×
            </button>
          </div>

          {/* Meeting URL */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Meeting Link
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={shareUrl}
                readOnly
                className="flex-1 p-3 border border-gray-300 rounded-md bg-gray-50 text-sm"
              />
              <button
                onClick={() => copyToClipboard(shareUrl, 'Link')}
                className="px-4 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                {copied === 'Link' ? '✓' : '📋'}
              </button>
            </div>
          </div>

          {/* Room ID */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Room ID
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={roomId}
                readOnly
                className="flex-1 p-3 border border-gray-300 rounded-md bg-gray-50 text-sm font-mono"
              />
              <button
                onClick={() => copyToClipboard(roomId, 'Room ID')}
                className="px-4 py-3 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
              >
                {copied === 'Room ID' ? '✓' : '📋'}
              </button>
            </div>
          </div>

          {/* QR Code Toggle */}
          <div className="mb-6">
            <button
              onClick={() => setShowQRCode(!showQRCode)}
              className="w-full p-3 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors flex items-center justify-center space-x-2"
            >
              <span>📱</span>
              <span>{showQRCode ? 'Hide QR Code' : 'Show QR Code'}</span>
            </button>
            
            {showQRCode && (
              <div className="mt-4 text-center">
                <img
                  src={qrCodeUrl}
                  alt="QR Code for meeting"
                  className="mx-auto border border-gray-200 rounded"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.nextSibling.style.display = 'block';
                  }}
                />
                <div style={{ display: 'none' }} className="text-gray-500 text-sm mt-2">
                  QR Code could not be loaded
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Scan with phone camera to join
                </p>
              </div>
            )}
          </div>

          {/* Share Options */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-gray-700">Share via:</h4>
            
            <div className="grid grid-cols-2 gap-3">
              {/* Native Share (Mobile) */}
              {navigator.share && (
                <button
                  onClick={shareViaNative}
                  className="flex items-center justify-center space-x-2 p-3 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                >
                  <span>📤</span>
                  <span className="text-sm">Share</span>
                </button>
              )}

              {/* Email */}
              <button
                onClick={shareViaEmail}
                className="flex items-center justify-center space-x-2 p-3 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                <span>📧</span>
                <span className="text-sm">Email</span>
              </button>

              {/* WhatsApp */}
              <button
                onClick={shareViaWhatsApp}
                className="flex items-center justify-center space-x-2 p-3 border border-green-300 rounded-md hover:bg-green-50 transition-colors text-green-700"
              >
                <span>💬</span>
                <span className="text-sm">WhatsApp</span>
              </button>

              {/* Twitter */}
              <button
                onClick={shareViaTwitter}
                className="flex items-center justify-center space-x-2 p-3 border border-blue-300 rounded-md hover:bg-blue-50 transition-colors text-blue-700"
              >
                <span>🐦</span>
                <span className="text-sm">Twitter</span>
              </button>
            </div>

            {/* Copy Full Message */}
            <button
              onClick={() => copyToClipboard(meetingMessage, 'Message')}
              className="w-full p-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              {copied === 'Message' ? '✓ Copied!' : 'Copy Full Invitation Message'}
            </button>
          </div>

          {/* Instructions */}
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <h5 className="text-sm font-medium text-blue-900 mb-2">📋 How to join:</h5>
            <ol className="text-xs text-blue-800 space-y-1">
              <li>1. Click the meeting link or enter Room ID manually</li>
              <li>2. Enter your display name</li>
              <li>3. Allow camera/microphone permissions</li>
              <li>4. Start video chatting instantly!</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShareModal;
