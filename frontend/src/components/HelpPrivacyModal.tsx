import React from 'react';

interface HelpPrivacyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpPrivacyModal: React.FC<HelpPrivacyModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/50 transition-opacity"
        onClick={onClose}
        role="presentation"
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="relative w-full max-w-md max-h-[90vh] bg-white rounded-lg shadow-xl overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-slate-900">Help & Privacy</h2>
            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
              aria-label="Close dialog"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          <div className="px-6 py-6 space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-3">Feedback</h3>
              <p className="text-slate-700 mb-3 text-sm">
                We'd love to hear your thoughts and suggestions! Your feedback helps us improve SpectraCast Suite.
              </p>
              <div className="flex flex-col gap-2">
                <a
                  href="mailto:mtalalaievskyi@kse.org.ua"
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium w-fit"
                >
                  Send Feedback
                </a>
                <p className="text-sm text-slate-600">Email: <span className="font-medium text-slate-900">mtalalaievskyi@kse.org.ua</span></p>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-3">Privacy & Data Security</h3>
              <div className="space-y-3 text-slate-700 text-sm">
                <div>
                  <p className="font-semibold text-slate-900 mb-1">Your Account</p>
                  <p>We collect your email address solely for authentication, account management, and critical service updates. We never sell your personal contact info to third parties.</p>
                </div>
                <div>
                  <p className="font-semibold text-slate-900 mb-1">Data Ownership</p>
                  <p>SpectraCast Suite acts as a Data Processor for the datasets you upload. Your data is yours — we do not use your datasets to train AI models or for any other internal purposes.</p>
                </div>
                <div>
                  <p className="font-semibold text-slate-900 mb-1">Full Control</p>
                  <p>You retain the right to access, export, or permanently delete your datasets and account at any time through your dashboard.</p>
                </div>
                <div className="pt-2 border-t border-slate-200">
                  <p>For more details, please review our <a href="#privacy-policy" className="text-blue-600 hover:text-blue-700 hover:underline font-medium">Privacy Policy</a> and <a href="#terms-of-service" className="text-blue-600 hover:text-blue-700 hover:underline font-medium">Terms of Service</a>.</p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-3">Frequently Asked Questions (FAQ)</h3>
              <div className="space-y-3 text-slate-700 text-sm">
                <div>
                  <p className="font-semibold text-slate-900 mb-1">What statistics does the app collect?</p>
                  <p>When running in remote mode, we collect anonymous statistics on the data quality strategies applied (e.g., the chosen outlier or imputation strategy, the system's recommended strategy, and the overall dataset size in rows). This helps us improve our recommendation algorithms.</p>
                </div>
                <div>
                  <p className="font-semibold text-slate-900 mb-1">How can I opt out of analytics tracking?</p>
                  <p>Telemetry tracking is automatically disabled if you activate "Local Mode" or run the application locally. No tracking events will be sent under these conditions.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
