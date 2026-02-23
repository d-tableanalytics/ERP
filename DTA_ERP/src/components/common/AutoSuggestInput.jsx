import React, { useState, useRef, useEffect } from "react";

const AutoSuggestInput = ({
  placeholder,
  value,
  onChange,
  suggestions = [],
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  const filteredSuggestions = suggestions.filter((item) =>
    item?.toString().toLowerCase().includes(value.toLowerCase())
  );

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!containerRef.current?.contains(e.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative w-full" ref={containerRef}>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => {
          onChange(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        className="w-full bg-bg-main border border-border-main rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
      />

      {isOpen && filteredSuggestions.length > 0 && (
        <div className="absolute z-50 mt-1 w-full bg-[#1e1e1e] border border-gray-700 rounded-lg shadow-lg max-h-60 overflow-auto">
          {filteredSuggestions.map((item, index) => (
            <div
              key={index}
              onClick={() => {
                onChange(item);
                setIsOpen(false);
              }}
              className="bg-bg-main border-b border-border-main  px-3 py-2 text-sm outline-none"
            >
              {item}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AutoSuggestInput;