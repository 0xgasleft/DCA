import { useState, useRef, useEffect } from "react";

export default function ClockTimePicker({ value, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState({});
  const [hour, minute] = value.split(':').map(Number);
  const buttonRef = useRef(null);
  const pickerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (
        pickerRef.current && !pickerRef.current.contains(event.target) &&
        buttonRef.current && !buttonRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Recalculate position on scroll/resize while open
  useEffect(() => {
    if (!isOpen) return;
    const recalc = () => calcDropdownPos();
    window.addEventListener('scroll', recalc, true);
    window.addEventListener('resize', recalc);
    return () => {
      window.removeEventListener('scroll', recalc, true);
      window.removeEventListener('resize', recalc);
    };
  }, [isOpen]);

  const calcDropdownPos = () => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const dropdownHeight = 380;
    const spaceBelow = window.innerHeight - rect.bottom;

    if (spaceBelow < dropdownHeight && rect.top > dropdownHeight) {
      // Open upward
      setDropdownStyle({
        position: 'fixed',
        bottom: window.innerHeight - rect.top + 8,
        left: rect.left,
        width: rect.width,
        zIndex: 9999,
      });
    } else {
      // Open downward (default)
      setDropdownStyle({
        position: 'fixed',
        top: rect.bottom + 8,
        left: rect.left,
        width: rect.width,
        zIndex: 9999,
      });
    }
  };

  const handleOpen = () => {
    calcDropdownPos();
    setIsOpen(!isOpen);
  };

  const handleHourClick = (newHour) => {
    const roundedMinute = Math.floor(minute / 15) * 15;
    onChange(`${String(newHour).padStart(2, '0')}:${String(roundedMinute).padStart(2, '0')}`);
  };

  const handleMinuteClick = (newMinute) => {
    onChange(`${String(hour).padStart(2, '0')}:${String(newMinute).padStart(2, '0')}`);
  };

  const formatTime = (h, m) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

  const minuteIntervals = [0, 15, 30, 45];

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={handleOpen}
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

      {isOpen && (
        <div
          ref={pickerRef}
          style={dropdownStyle}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 p-6"
        >
          <div className="flex gap-6">
            {/* Hours */}
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3 text-center">Hour (UTC)</h3>
              <div className="grid grid-cols-4 gap-2 max-h-52 overflow-y-auto pr-1">
                {Array.from({ length: 24 }, (_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleHourClick(i)}
                    className={`p-2.5 rounded-lg font-semibold text-sm transition-all ${
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

            <div className="w-px bg-gray-200 dark:bg-gray-700"></div>

            {/* Minutes */}
            <div className="w-28">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3 text-center">Minute</h3>
              <div className="grid grid-cols-2 gap-2">
                {minuteIntervals.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => handleMinuteClick(m)}
                    className={`p-3 rounded-lg font-semibold transition-all ${
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

          {/* Selected time display */}
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 text-center">
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Selected Time (your local time)</p>
            <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">{formatTime(hour, minute)}</p>
          </div>

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
