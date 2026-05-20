import React from 'react';

interface HelpPrivacyButtonProps {
  onClick: () => void;
}

export const HelpPrivacyButton: React.FC<HelpPrivacyButtonProps> = ({ onClick }) => {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-6 right-6 z-30 w-14 h-14 rounded-full bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-lg hover:shadow-xl hover:scale-110 transition-all duration-200 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2"
      aria-label="Help and Privacy"
      title="Help & Privacy"
    >
      <svg
        className="w-7 h-7"
        fill="currentColor"
        viewBox="0 0 24 24"
      >
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.41-1.14-2.5-2.5-2.5s-2.5 1.09-2.5 2.5h-2c0-2.47 2.02-4.5 4.5-4.5s4.5 2.03 4.5 4.5c0 .88-.36 1.68-.93 2.25z" />
      </svg>
    </button>
  );
};
