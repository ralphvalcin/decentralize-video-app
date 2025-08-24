// EnhancedErrorBoundary.jsx - Advanced error handling with user-friendly recovery
import React, { Component } from 'react';
import { useAccessibility } from './AccessibilityProvider';

class EnhancedErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
      retryCount: 0,
      isRecovering: false,
      recoveryStep: 0
    };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      error,
      errorId: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    
    // Log error details for debugging
    console.error('Error caught by boundary:', {
      error: error.toString(),
      errorInfo,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
      url: window.location.href
    });

    // Track error in analytics if available
    if (window.analytics && typeof window.analytics.track === 'function') {
      window.analytics.track('Error Boundary Triggered', {
        error: error.toString(),
        component: errorInfo?.componentStack?.split('\n')[1] || 'Unknown',
        timestamp: Date.now(),
        retryCount: this.state.retryCount
      });
    }

    // Announce error to screen readers
    if (this.props.accessibility?.announce) {
      this.props.accessibility.announce(
        'An error has occurred in the application. Recovery options are available.',
        'assertive'
      );
    }
  }

  handleRetry = () => {
    this.setState(prevState => ({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: prevState.retryCount + 1,
      isRecovering: true
    }));

    // Announce retry attempt
    if (this.props.accessibility?.announce) {
      this.props.accessibility.announce('Attempting to recover from error...');
    }

    // Reset recovering state after a delay
    setTimeout(() => {
      this.setState({ isRecovering: false });
    }, 2000);
  };

  handleReload = () => {
    // Announce page reload
    if (this.props.accessibility?.announce) {
      this.props.accessibility.announce('Reloading page to recover from error...');
    }
    
    window.location.reload();
  };

  handleReportError = () => {
    const errorReport = {
      errorId: this.state.errorId,
      error: this.state.error?.toString(),
      stack: this.state.error?.stack,
      componentStack: this.state.errorInfo?.componentStack,
      userAgent: navigator.userAgent,
      url: window.location.href,
      timestamp: Date.now(),
      retryCount: this.state.retryCount
    };

    // Copy error report to clipboard
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(JSON.stringify(errorReport, null, 2))
        .then(() => {
          if (this.props.accessibility?.announce) {
            this.props.accessibility.announce('Error details copied to clipboard');
          }
        })
        .catch(() => {
          // Fallback: show error details in a text area
          const textarea = document.createElement('textarea');
          textarea.value = JSON.stringify(errorReport, null, 2);
          document.body.appendChild(textarea);
          textarea.select();
          document.execCommand('copy');
          document.body.removeChild(textarea);
        });
    }

    // Send error report to server if endpoint is available
    if (this.props.errorReportingEndpoint) {
      fetch(this.props.errorReportingEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(errorReport)
      }).catch(console.error);
    }
  };

  render() {
    if (this.state.hasError) {
      const { error, errorId, retryCount, isRecovering } = this.state;
      
      return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            {/* Error Icon */}
            <div className="text-center mb-6">
              <div className="text-6xl mb-4" role="img" aria-label="Error">
                {isRecovering ? '🔄' : '⚠️'}
              </div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                {isRecovering ? 'Recovering...' : 'Something went wrong'}
              </h1>
              <p className="text-gray-600 dark:text-gray-300">
                {isRecovering 
                  ? 'We\'re trying to fix the issue automatically.'
                  : 'We encountered an unexpected error. Don\'t worry, we can help you get back on track.'
                }
              </p>
            </div>

            {/* Error Details (Collapsible) */}
            {!isRecovering && (
              <details className="mb-6 bg-gray-50 dark:bg-gray-700 rounded p-4">
                <summary className="cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300">
                  Technical Details
                </summary>
                <div className="mt-3 text-xs text-gray-600 dark:text-gray-400 font-mono">
                  <p><strong>Error ID:</strong> {errorId}</p>
                  <p><strong>Message:</strong> {error?.message || 'Unknown error'}</p>
                  {retryCount > 0 && (
                    <p><strong>Retry Count:</strong> {retryCount}</p>
                  )}
                </div>
              </details>
            )}

            {/* Recovery Actions */}
            {!isRecovering && (
              <div className="space-y-3">
                {/* Primary Actions */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    onClick={this.handleRetry}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                      focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                      transition-colors font-medium"
                    aria-describedby="retry-description"
                  >
                    Try Again
                  </button>
                  <button
                    onClick={this.handleReload}
                    className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700
                      focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2
                      transition-colors font-medium"
                    aria-describedby="reload-description"
                  >
                    Reload Page
                  </button>
                </div>

                {/* Secondary Actions */}
                <div className="border-t dark:border-gray-600 pt-4">
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                    Still having trouble?
                  </h3>
                  <div className="space-y-2">
                    <button
                      onClick={this.handleReportError}
                      className="w-full px-4 py-2 bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200 
                        rounded-lg hover:bg-orange-200 dark:hover:bg-orange-800
                        focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2
                        transition-colors text-sm font-medium"
                    >
                      Copy Error Details
                    </button>
                    
                    {this.props.supportUrl && (
                      <a
                        href={this.props.supportUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full inline-block px-4 py-2 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200
                          rounded-lg hover:bg-green-200 dark:hover:bg-green-800
                          focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2
                          transition-colors text-sm font-medium text-center"
                      >
                        Contact Support
                      </a>
                    )}
                  </div>
                </div>

                {/* Helpful Tips */}
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 mt-4">
                  <h3 className="text-sm font-medium text-blue-900 dark:text-blue-200 mb-2">
                    💡 Quick Tips
                  </h3>
                  <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-1">
                    <li>• Check your internet connection</li>
                    <li>• Make sure your browser is up to date</li>
                    <li>• Try clearing your browser cache</li>
                    <li>• Disable browser extensions temporarily</li>
                  </ul>
                </div>
              </div>
            )}

            {/* Recovery Progress Indicator */}
            {isRecovering && (
              <div className="mt-6">
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-2">
                  <div className="bg-blue-600 h-2 rounded-full animate-pulse w-1/2"></div>
                </div>
                <p className="text-center text-sm text-gray-600 dark:text-gray-400">
                  Attempting recovery...
                </p>
              </div>
            )}

            {/* Screen Reader Instructions */}
            <div className="sr-only">
              <p id="retry-description">
                Attempts to recover from the error by restarting the failed component
              </p>
              <p id="reload-description">
                Reloads the entire page to start fresh
              </p>
              <p>
                Error ID {errorId} has occurred. You can try to recover automatically, 
                reload the page, or contact support for assistance.
              </p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Wrapper component to inject accessibility context
const EnhancedErrorBoundaryWrapper = (props) => {
  const accessibility = useAccessibility();
  return <EnhancedErrorBoundary {...props} accessibility={accessibility} />;
};

export default EnhancedErrorBoundaryWrapper;