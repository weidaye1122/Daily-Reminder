import { useEffect, useMemo, useRef, useState } from 'react';

interface TimePickerProps {
  value: string;
  onChange: (value: string) => void;
}

const hours = Array.from({ length: 24 }, (_, index) => index);
const minutes = Array.from({ length: 60 }, (_, index) => index);

const padTimePart = (value: number) => String(value).padStart(2, '0');

const parseTime = (value: string) => {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) {
    return { hour: 9, minute: 0 };
  }
  return {
    hour: Number(match[1]),
    minute: Number(match[2])
  };
};

const formatTime = (hour: number, minute: number) =>
  `${padTimePart(hour)}:${padTimePart(minute)}`;

export const TimePicker = ({ value, onChange }: TimePickerProps) => {
  const current = useMemo(() => parseTime(value), [value]);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(current);
  const hourListRef = useRef<HTMLDivElement>(null);
  const minuteListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      setDraft(current);
    }
  }, [current, open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    window.requestAnimationFrame(() => {
      hourListRef.current
        ?.querySelector<HTMLButtonElement>('[data-selected="true"]')
        ?.scrollIntoView({ block: 'center' });
      minuteListRef.current
        ?.querySelector<HTMLButtonElement>('[data-selected="true"]')
        ?.scrollIntoView({ block: 'center' });
    });
  }, [draft.hour, draft.minute, open]);

  const openPicker = () => {
    setDraft(current);
    setOpen(true);
  };

  const confirm = () => {
    onChange(formatTime(draft.hour, draft.minute));
    setOpen(false);
  };

  return (
    <div className="time-picker">
      <button
        type="button"
        className="inline-picker-button time-picker-trigger"
        onClick={openPicker}
      >
        <span>{value || formatTime(current.hour, current.minute)}</span>
      </button>

      {open ? (
        <div
          className="time-picker-backdrop"
          onClick={() => setOpen(false)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setOpen(false);
            }
          }}
          role="presentation"
        >
          <div
            className="time-picker-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="选择提醒时间"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="time-picker-head">
              <span>选择提醒时间</span>
              <strong>{formatTime(draft.hour, draft.minute)}</strong>
            </div>

            <div className="time-picker-columns">
              <div className="time-picker-column-wrap">
                <span>时</span>
                <div className="time-picker-column" ref={hourListRef}>
                  {hours.map((hour) => (
                    <button
                      key={hour}
                      type="button"
                      className={draft.hour === hour ? 'active' : ''}
                      data-selected={draft.hour === hour ? 'true' : undefined}
                      onClick={() =>
                        setDraft((currentDraft) => ({
                          ...currentDraft,
                          hour
                        }))
                      }
                    >
                      {padTimePart(hour)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="time-picker-column-wrap">
                <span>分</span>
                <div className="time-picker-column" ref={minuteListRef}>
                  {minutes.map((minute) => (
                    <button
                      key={minute}
                      type="button"
                      className={draft.minute === minute ? 'active' : ''}
                      data-selected={draft.minute === minute ? 'true' : undefined}
                      onClick={() =>
                        setDraft((currentDraft) => ({
                          ...currentDraft,
                          minute
                        }))
                      }
                    >
                      {padTimePart(minute)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="time-picker-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setDraft(current)}
              >
                还原
              </button>
              <button type="button" className="primary-button" onClick={confirm}>
                确认
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
