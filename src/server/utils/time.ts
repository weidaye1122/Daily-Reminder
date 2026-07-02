import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat.js';
import timezone from 'dayjs/plugin/timezone.js';
import utc from 'dayjs/plugin/utc.js';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(customParseFormat);

export { dayjs };

export const DATE_FORMAT = 'YYYY-MM-DD';
export const TIME_FORMAT = 'HH:mm';
export const DATE_TIME_FORMAT = 'YYYY-MM-DD HH:mm:ss';

export const nowInZone = (zone: string) => dayjs().tz(zone);

export const parseDate = (value: string, zone: string) =>
  dayjs.tz(value, DATE_FORMAT, zone).startOf('day');

export const parseDateTime = (date: string, time: string, zone: string) =>
  dayjs.tz(`${date} ${time}`, 'YYYY-MM-DD HH:mm', zone);

export const formatDateTime = (value: dayjs.Dayjs) =>
  value.format(DATE_TIME_FORMAT);

export const formatDateKey = (value: dayjs.Dayjs) =>
  value.format(DATE_FORMAT);

export const formatTimeKey = (value: dayjs.Dayjs) =>
  value.format(TIME_FORMAT);

export const formatChineseDate = (dateKey: string, zone: string) =>
  parseDate(dateKey, zone).format('YYYY年M月D日');

export const clampSolarDay = (year: number, month: number, day: number) => {
  const firstDay = dayjs(`${year}-${String(month).padStart(2, '0')}-01`);
  return Math.min(day, firstDay.daysInMonth());
};

export const isTimeString = (value: string) =>
  /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);

export const sortTimeValues = (values: string[]) =>
  [...values].sort((left, right) => left.localeCompare(right));

export const isSameOrAfterDay = (left: dayjs.Dayjs, right: dayjs.Dayjs) =>
  left.isSame(right, 'day') || left.isAfter(right, 'day');
