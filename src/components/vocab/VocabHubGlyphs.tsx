/** Shared flashcard-stack glyph for the SRS deck hub tile. */
export function VocabDeckGlyph({
  className,
  interactive,
}: {
  className?: string;
  interactive?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={`vocab-hub-glyph ${interactive ? "vocab-hub-glyph-interactive " : ""}${className ?? "h-7 w-7"}`}
      aria-hidden="true"
      fill="none"
    >
      <rect
        className="vocab-hub-deck vocab-hub-deck-2"
        x="12.4"
        y="10.8"
        width="23"
        height="27"
        rx="3.5"
        stroke="currentColor"
        strokeWidth="2"
        opacity="0.28"
      />
      <rect
        className="vocab-hub-deck vocab-hub-deck-1"
        x="10.2"
        y="8.6"
        width="23"
        height="27"
        rx="3.5"
        stroke="currentColor"
        strokeWidth="2"
        opacity="0.52"
      />
      <g className="vocab-hub-card">
        <rect
          x="8"
          y="6.4"
          width="23"
          height="27"
          rx="3.5"
          stroke="currentColor"
          strokeWidth="2.5"
        />
        <line
          className="vocab-hub-line vocab-hub-line-a"
          x1="12.6"
          y1="14.4"
          x2="26.4"
          y2="14.4"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          opacity="0.42"
        />
        <rect
          className="vocab-hub-blank"
          x="12.6"
          y="18.7"
          width="11.6"
          height="3.1"
          rx="0.8"
          fill="currentColor"
        />
        <line
          className="vocab-hub-line vocab-hub-line-b"
          x1="12.6"
          y1="24.8"
          x2="21.6"
          y2="24.8"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          opacity="0.42"
        />
      </g>
      <g
        className="vocab-hub-srs"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path
          className="vocab-hub-srs-arc"
          d="M33.6 32.2a6.3 6.3 0 1 0-4.9-6.1"
          strokeWidth="2.2"
          fill="none"
        />
        <path
          className="vocab-hub-srs-tip"
          d="M28.2 24.8l-.3 3.7 3.3-1.1"
          strokeWidth="2"
          fill="none"
        />
      </g>
    </svg>
  );
}

/** Matching flashcard glyph for Words-in-Context quiz hub tile. */
export function VocabQuizGlyph({
  className,
  interactive,
}: {
  className?: string;
  interactive?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={`vocab-hub-glyph ${interactive ? "vocab-hub-glyph-interactive " : ""}${className ?? "h-7 w-7"}`}
      aria-hidden="true"
      fill="none"
    >
      <rect
        className="vocab-hub-deck vocab-hub-deck-2"
        x="12.4"
        y="10.8"
        width="23"
        height="27"
        rx="3.5"
        stroke="currentColor"
        strokeWidth="2"
        opacity="0.28"
      />
      <rect
        className="vocab-hub-deck vocab-hub-deck-1"
        x="10.2"
        y="8.6"
        width="23"
        height="27"
        rx="3.5"
        stroke="currentColor"
        strokeWidth="2"
        opacity="0.52"
      />
      <g className="vocab-hub-card">
        <rect
          x="8"
          y="6.4"
          width="23"
          height="27"
          rx="3.5"
          stroke="currentColor"
          strokeWidth="2.5"
        />
        <line
          className="vocab-hub-line vocab-hub-line-a"
          x1="12.6"
          y1="13.2"
          x2="26.4"
          y2="13.2"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          opacity="0.38"
        />
        <line
          className="vocab-hub-line vocab-hub-line-mid"
          x1="12.6"
          y1="17.2"
          x2="19.2"
          y2="17.2"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          opacity="0.38"
        />
        <rect
          className="vocab-hub-blank vocab-hub-quiz-blank"
          x="19.5"
          y="15.8"
          width="8.2"
          height="3.1"
          rx="0.8"
          stroke="currentColor"
          strokeWidth="1.4"
          fill="currentColor"
          fillOpacity="0.18"
        />
        <line
          className="vocab-hub-line vocab-hub-line-b"
          x1="12.6"
          y1="21.4"
          x2="24.8"
          y2="21.4"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          opacity="0.38"
        />
        <line
          className="vocab-hub-line vocab-hub-line-c"
          x1="12.6"
          y1="25.4"
          x2="20.4"
          y2="25.4"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          opacity="0.38"
        />
      </g>
      <g className="vocab-hub-quiz-badge" stroke="currentColor" strokeLinecap="round">
        <circle
          className="vocab-hub-quiz-ring"
          cx="34.2"
          cy="33.4"
          r="5.2"
          strokeWidth="2"
          fill="currentColor"
          fillOpacity="0.12"
        />
        <path
          className="vocab-hub-quiz-check"
          d="M31.6 33.4l1.8 1.8 3.4-3.6"
          strokeWidth="2"
          fill="none"
        />
      </g>
    </svg>
  );
}
