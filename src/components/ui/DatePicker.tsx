import { useState, useRef, useEffect } from "react";
import { Calendar, X } from "lucide-react";
import { cn } from "../../lib/utils";
import { Input } from "./Input";
import { Button } from "./Button";

interface DatePickerProps {
  value: string; // ISO date string (YYYY-MM-DD) or empty
  onChange: (isoDate: string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
}

export function DatePicker({ value, onChange, placeholder = "DD/MM/YYYY", className, id }: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [displayValue, setDisplayValue] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const pickerRef = useRef<HTMLDivElement>(null);

  // Convert ISO to DD/MM/YYYY for display
  const isoToDisplay = (iso: string): string => {
    if (!iso) return "";
    const date = new Date(iso);
    if (isNaN(date.getTime())) return "";
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  // Convert DD/MM/YYYY to ISO
  const displayToISO = (display: string): string => {
    if (!display) return "";
    const match = display.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!match) return "";
    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const year = parseInt(match[3], 10);
    if (day < 1 || day > 31 || month < 1 || month > 12) return "";
    const date = new Date(year, month - 1, day);
    if (date.getDate() !== day || date.getMonth() !== month - 1 || date.getFullYear() !== year) return "";
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };

  // Initialize display value and selected date from ISO value
  useEffect(() => {
    if (value) {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        setDisplayValue(isoToDisplay(value));
        setSelectedDate(date);
        setCurrentMonth(new Date(date.getFullYear(), date.getMonth(), 1));
      } else {
        setDisplayValue("");
        setSelectedDate(null);
      }
    } else {
      setDisplayValue("");
      setSelectedDate(null);
    }
  }, [value]);

  // Close picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    setDisplayValue(inputValue);
    const isoDate = displayToISO(inputValue);
    if (isoDate) {
      onChange(isoDate);
      const date = new Date(isoDate);
      setSelectedDate(date);
      setCurrentMonth(new Date(date.getFullYear(), date.getMonth(), 1));
    } else if (inputValue === "") {
      onChange("");
      setSelectedDate(null);
    }
  };

  const handleInputBlur = () => {
    if (displayValue && !displayToISO(displayValue)) {
      // Invalid date, reset to last valid value
      setDisplayValue(value ? isoToDisplay(value) : "");
    }
  };

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    const isoDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    onChange(isoDate);
    setDisplayValue(isoToDisplay(isoDate));
    setIsOpen(false);
  };

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const today = new Date();
  const daysInMonth = getDaysInMonth(currentMonth);
  const firstDay = getFirstDayOfMonth(currentMonth);
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const days = [];
  // Empty cells for days before the first day of the month
  for (let i = 0; i < firstDay; i++) {
    days.push(null);
  }
  // Days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    days.push(day);
  }

  return (
    <div ref={pickerRef} className={cn("relative", className)}>
      <div className="relative">
        <Input
          id={id}
          type="text"
          placeholder={placeholder}
          value={displayValue}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          onFocus={() => setIsOpen(true)}
          className={cn("pr-10", className)}
          maxLength={10}
        />
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded"
        >
          <Calendar className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      {isOpen && (
        <div className="absolute z-[9999] mt-1 bg-card border border-border rounded-lg shadow-lg p-4 w-64">
          {/* Calendar Header */}
          <div className="flex items-center justify-between mb-4">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={prevMonth}
              className="h-8 w-8 p-0"
            >
              ←
            </Button>
            <div className="font-semibold text-sm">
              {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={nextMonth}
              className="h-8 w-8 p-0"
            >
              →
            </Button>
          </div>

          {/* Day Names */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {dayNames.map((day) => (
              <div key={day} className="text-center text-xs font-medium text-muted-foreground py-1">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Days */}
          <div className="grid grid-cols-7 gap-1">
            {days.map((day, index) => {
              if (day === null) {
                return <div key={`empty-${index}`} className="h-8" />;
              }
              const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
              const isToday = date.toDateString() === today.toDateString();
              const isSelected = selectedDate && date.toDateString() === selectedDate.toDateString();
              const isCurrentMonth = date.getMonth() === currentMonth.getMonth();

              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => handleDateSelect(date)}
                  className={cn(
                    "h-8 w-8 rounded text-sm transition-colors",
                    !isCurrentMonth && "text-muted-foreground opacity-50",
                    isCurrentMonth && !isSelected && !isToday && "hover:bg-muted",
                    isToday && !isSelected && "bg-primary/10 text-primary font-semibold",
                    isSelected && "bg-primary text-primary-foreground font-semibold"
                  )}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* Today Button */}
          <div className="mt-3 pt-3 border-t border-border">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleDateSelect(today)}
              className="w-full"
            >
              Today
            </Button>
          </div>

          {/* Clear Button */}
          {selectedDate && (
            <div className="mt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  onChange("");
                  setDisplayValue("");
                  setSelectedDate(null);
                  setIsOpen(false);
                }}
                className="w-full text-muted-foreground"
              >
                <X className="h-4 w-4 mr-1" />
                Clear
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

