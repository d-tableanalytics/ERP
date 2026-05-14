import React from 'react';

/**
 * Minimal Markdown renderer — handles **bold**, • bullets, numbered lists,
 * and line breaks. Avoids adding a new dependency.
 */
const MarkdownLite = ({ text }) => {
  if (!text) return null;
  const lines = String(text).split('\n');
  return (
    <div className="markdown-lite whitespace-pre-line leading-relaxed">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={idx} className="h-2" />;

        const bullet = trimmed.startsWith('• ') || trimmed.startsWith('- ') || trimmed.startsWith('* ');
        const number = /^\d+\.\s/.test(trimmed);
        const content = bullet
          ? trimmed.slice(2)
          : number
          ? trimmed.replace(/^\d+\.\s/, '')
          : line;

        return (
          <div key={idx} className={bullet || number ? 'flex gap-2 items-start' : ''}>
            {bullet && <span className="text-primary mt-0.5 flex-shrink-0">•</span>}
            {number && <span className="text-primary mt-0.5 flex-shrink-0">{trimmed.match(/^\d+/)[0]}.</span>}
            <span className="flex-1">{renderInline(content)}</span>
          </div>
        );
      })}
    </div>
  );
};

function renderInline(text) {
  // Split on **bold** while keeping the markers as group separators.
  const parts = String(text).split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}

export default MarkdownLite;
