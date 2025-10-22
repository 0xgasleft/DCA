import { useState, useRef, useEffect } from "react";

export default function ClockTimePicker({ value, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const [hour, minute] = value.split(':').map(Number);
  const pickerRef = useRef(null);

  // Close picker when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (pickerRef.current && !pickerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleHourClick = (newHour) => {
    const roundedMinute = Math.floor(minute / 15) * 15;
    const timeString = `${String(newHour).padStart(2, '0')}:${String(roundedMinute).padStart(2, '0')}`;
    onChange(timeString);
  };

  const handleMinuteClick = (newMinute) => {
    const timeString = `${String(hour).padStart(2, '0')}:${String(newMinute).padStart(2, '0')}`;
    onChange(timeString);
  };

  const formatTime = (h, m) => {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  // Generate 15-minute intervals
  const minuteIntervals = [0, 15, 30, 45];

  return (
    <div className="relative" ref={pickerRef}>
      {/* Display Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 focus:border-transparent bg-white dark:bg-gray-700 text-left flex items-center justify-between hover:border-purple-300 dark:hover:border-purple-500 transition-colors"
      >
        <div className="flex items-center gap-3">
          <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-2xl font-bold text-gray-900 dark:text-white">{formatTime(hour, minute)}</span>
        </div>
        <svg className={`w-5 h-5 text-gray-400 dark:text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Clock Picker Dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-2 w-full bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 p-6 transition-all duration-200 ease-out opacity-100 scale-100">
          <div className="flex gap-6">
            {/* Hour Selector */}
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3 text-center">Hour</h3>
              <div className="grid grid-cols-4 gap-2 max-h-64 overflow-y-auto">
                {Array.from({ length: 24 }, (_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleHourClick(i)}
                    className={`p-3 rounded-lg font-semibold text-sm transition-all ${
                      hour === i
                        ? 'bg-gradient-to-br from-purple-600 to-purple-700 text-white shadow-lg scale-105'
                        : 'bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-purple-100 dark:hover:bg-purple-900/30 hover:text-purple-700 dark:hover:text-purple-300'
                    }`}
                  >
                    {String(i).padStart(2, '0')}
                  </button>
                ))}
              </div>
            </div>

            {/* Divider */}
            <div className="w-px bg-gray-200 dark:bg-gray-700"></div>

            {/* Minute Selector */}
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3 text-center">Minute</h3>
              <div className="grid grid-cols-2 gap-2">
                {minuteIntervals.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => handleMinuteClick(m)}
                    className={`p-4 rounded-lg font-semibold transition-all ${
                      minute === m || (minute > m && minute < m + 15)
                        ? 'bg-gradient-to-br from-purple-600 to-purple-700 text-white shadow-lg scale-105'
                        : 'bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-purple-100 dark:hover:bg-purple-900/30 hover:text-purple-700 dark:hover:text-purple-300'
                    }`}
                  >
                    {String(m).padStart(2, '0')}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Current Selection Display */}
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="text-center">
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Selected Time</p>
              <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">{formatTime(hour, minute)}</p>
            </div>
          </div>

          {/* Done Button */}
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="w-full mt-4 py-2 bg-gradient-to-r from-purple-600 to-purple-700 dark:from-purple-700 dark:to-purple-800 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-purple-800 dark:hover:from-purple-600 dark:hover:to-purple-700 transition-all"
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
}
