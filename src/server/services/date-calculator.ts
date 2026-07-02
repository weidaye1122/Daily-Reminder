import { Lunar, LunarYear, Solar } from 'lunar-typescript';
import type {
  LunarDateValidation,
  Reminder,
  ReminderInput,
  ReminderSchedulePreview
} from '../../shared/types';
import {
  clampSolarDay,
  dayjs,
  formatChineseDate,
  formatDateKey,
  formatDateTime,
  isSameOrAfterDay,
  parseDate,
  parseDateTime,
  sortTimeValues
} from '../utils/time';

export class ReminderValidationError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

const WEEK_LABELS = ['星期天', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
const LUNAR_MONTH_LABELS = [
  '',
  '正月',
  '二月',
  '三月',
  '四月',
  '五月',
  '六月',
  '七月',
  '八月',
  '九月',
  '十月',
  '冬月',
  '腊月'
];
const LUNAR_DAY_LABELS = [
  '',
  '初一',
  '初二',
  '初三',
  '初四',
  '初五',
  '初六',
  '初七',
  '初八',
  '初九',
  '初十',
  '十一',
  '十二',
  '十三',
  '十四',
  '十五',
  '十六',
  '十七',
  '十八',
  '十九',
  '二十',
  '廿一',
  '廿二',
  '廿三',
  '廿四',
  '廿五',
  '廿六',
  '廿七',
  '廿八',
  '廿九',
  '三十'
];

const getSignedLunarMonth = (month: number, isLeapMonth: boolean) =>
  isLeapMonth ? month * -1 : month;

const getLunarSelectionLabel = (
  month: number,
  day: number,
  isLeapMonth: boolean
) =>
  `农历${isLeapMonth ? '闰' : ''}${LUNAR_MONTH_LABELS[month] ?? `${month}月`}${LUNAR_DAY_LABELS[day] ?? `第 ${day} 天`}`;

export const getCurrentLunarYear = (zone: string) => {
  const now = dayjs().tz(zone);
  return Solar.fromYmd(now.year(), now.month() + 1, now.date())
    .getLunar()
    .getYear();
};

const getLunarMonthInYear = (
  lunarYear: number,
  month: number,
  isLeapMonth: boolean
) => LunarYear.fromYear(lunarYear).getMonth(getSignedLunarMonth(month, isLeapMonth));

const solarFromLunar = (lunarYear: number, month: number, day: number, isLeapMonth: boolean) => {
  const lunar = Lunar.fromYmd(lunarYear, getSignedLunarMonth(month, isLeapMonth), day);
  return lunar.getSolar();
};

const toDayjsFromSolar = (solar: Solar, zone: string) =>
  parseDate(solar.toYmd(), zone);

const getLunarYearForDate = (date: dayjs.Dayjs) =>
  Solar.fromYmd(date.year(), date.month() + 1, date.date()).getLunar().getYear();

const getLunarLabel = (dateKey: string, zone: string) => {
  const solarDate = parseDate(dateKey, zone);
  const lunar = Solar.fromYmd(
    solarDate.year(),
    solarDate.month() + 1,
    solarDate.date()
  ).getLunar();
  return `农历${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`;
};

const getSolarParts = (solarDate: string | null) => {
  if (!solarDate) {
    throw new ReminderValidationError('公历日期不能为空');
  }
  const [year, month, day] = solarDate.split('-').map(Number);
  if (!year || !month || !day) {
    throw new ReminderValidationError('公历日期格式不正确');
  }
  return { year, month, day };
};

const normalizeReferenceMoment = (
  reference: dayjs.Dayjs | string,
  zone: string
) =>
  (typeof reference === 'string' ? parseDate(reference, zone) : reference.tz(zone))
    .second(0)
    .millisecond(0);

const findNextLunarYearlyOccurrence = (
  reminder: Reminder | ReminderInput,
  referenceDate: dayjs.Dayjs,
  zone: string
) => {
  if (!reminder.lunarMonth || !reminder.lunarDay) {
    throw new ReminderValidationError('农历日期不能为空');
  }
  const referenceLunarYear = getLunarYearForDate(referenceDate);
  for (
    let lunarYear = referenceLunarYear - 1;
    lunarYear <= referenceLunarYear + 20;
    lunarYear += 1
  ) {
    try {
      const solar = solarFromLunar(
        lunarYear,
        reminder.lunarMonth,
        reminder.lunarDay,
        reminder.isLeapMonth
      );
      const candidate = toDayjsFromSolar(solar, zone);
      if (isSameOrAfterDay(candidate, referenceDate)) {
        return candidate;
      }
    } catch {
      continue;
    }
  }
  return null;
};

const findNextLunarMonthlyOccurrence = (
  reminder: Reminder | ReminderInput,
  referenceDate: dayjs.Dayjs,
  zone: string
) => {
  if (!reminder.lunarDay) {
    throw new ReminderValidationError('农历日期不能为空');
  }

  const referenceLunarYear = getLunarYearForDate(referenceDate);
  for (
    let lunarYear = referenceLunarYear - 1;
    lunarYear <= referenceLunarYear + 5;
    lunarYear += 1
  ) {
    const months = LunarYear.fromYear(lunarYear).getMonthsInYear();
    for (const lunarMonth of months) {
      if (reminder.lunarDay > lunarMonth.getDayCount()) {
        continue;
      }
      const solar = Solar.fromJulianDay(
        lunarMonth.getFirstJulianDay() + reminder.lunarDay - 1
      );
      const candidate = toDayjsFromSolar(solar, zone);
      if (isSameOrAfterDay(candidate, referenceDate)) {
        return {
          occurrenceDate: candidate,
          lunarMonthLabel: `农历${lunarMonth.isLeap() ? '闰' : ''}${LUNAR_MONTH_LABELS[Math.abs(lunarMonth.getMonth())]}${LUNAR_DAY_LABELS[reminder.lunarDay]}`
        };
      }
    }
  }

  return null;
};

const getWeeklyAnchorWeekday = (
  reminder: Reminder,
  zone: string,
  referenceDate: dayjs.Dayjs
) => {
  if (reminder.solarDate) {
    return parseDate(reminder.solarDate, zone).day();
  }

  if (reminder.dateType === 'lunar') {
    const lunarOccurrence = findNextLunarYearlyOccurrence(reminder, referenceDate, zone);
    if (!lunarOccurrence) {
      throw new ReminderValidationError('无法计算农历周提醒的锚点日期');
    }
    return lunarOccurrence.day();
  }

  throw new ReminderValidationError('每周提醒需要选择星期');
};

export const validateLunarSelection = (
  reminder: Pick<ReminderInput, 'lunarMonth' | 'lunarDay' | 'isLeapMonth'>,
  referenceYear: number
) => {
  const validation = getLunarDateValidation(reminder, referenceYear);
  if (!validation.nextValidLunarYear) {
    throw new ReminderValidationError(validation.message);
  }
};

export const getLunarDateValidation = (
  reminder: Pick<ReminderInput, 'lunarMonth' | 'lunarDay' | 'isLeapMonth'>,
  referenceYear: number
): LunarDateValidation => {
  if (!reminder.lunarMonth || !reminder.lunarDay) {
    throw new ReminderValidationError('请选择完整的农历日期');
  }
  if (reminder.lunarMonth < 1 || reminder.lunarMonth > 12) {
    throw new ReminderValidationError('农历月份需要在 1 到 12 之间');
  }
  if (reminder.lunarDay < 1 || reminder.lunarDay > 30) {
    throw new ReminderValidationError('农历日期需要在初一到三十之间');
  }

  const label = getLunarSelectionLabel(
    reminder.lunarMonth,
    reminder.lunarDay,
    reminder.isLeapMonth
  );
  let currentYearValid = false;
  let currentYearReason = '';

  const currentMonth = getLunarMonthInYear(
    referenceYear,
    reminder.lunarMonth,
    reminder.isLeapMonth
  );
  if (!currentMonth) {
    currentYearReason = reminder.isLeapMonth
      ? `${referenceYear} 农历年没有闰${LUNAR_MONTH_LABELS[reminder.lunarMonth]}`
      : `${referenceYear} 农历年没有${LUNAR_MONTH_LABELS[reminder.lunarMonth]}`;
  } else if (reminder.lunarDay > currentMonth.getDayCount()) {
    currentYearReason = `${referenceYear} 农历年${label}不存在，这个月只有 ${currentMonth.getDayCount()} 天`;
  } else {
    currentYearValid = true;
  }

  for (let year = referenceYear; year <= referenceYear + 20; year += 1) {
    const candidateMonth = getLunarMonthInYear(
      year,
      reminder.lunarMonth,
      reminder.isLeapMonth
    );
    if (!candidateMonth || reminder.lunarDay > candidateMonth.getDayCount()) {
      continue;
    }
    const solar = solarFromLunar(
      year,
      reminder.lunarMonth,
      reminder.lunarDay,
      reminder.isLeapMonth
    );
    const nextSolarDate = solar.toYmd();
    return {
      label,
      referenceLunarYear: referenceYear,
      currentYearValid,
      nextValidLunarYear: year,
      nextSolarDate,
      message: currentYearValid
        ? `${label}在 ${referenceYear} 农历年有效，对应公历 ${nextSolarDate}`
        : `${currentYearReason}，下一次可用年份是 ${year} 农历年，对应公历 ${nextSolarDate}`
    };
  }

  return {
    label,
    referenceLunarYear: referenceYear,
    currentYearValid: false,
    nextValidLunarYear: null,
    nextSolarDate: null,
    message: `${label}在未来 20 个农历年内都无法换算，请调整月份或日期`
  };
};

export const resolveStoredSolarDateForCreate = (
  input: ReminderInput,
  zone: string,
  todayKey: string
) => {
  if (input.repeatType !== 'once') {
    return input.solarDate;
  }
  if (input.dateType === 'solar') {
    return input.solarDate;
  }
  const nextOccurrence = findNextLunarYearlyOccurrence(input, parseDate(todayKey, zone), zone);
  if (!nextOccurrence) {
    throw new ReminderValidationError('无法计算下一次农历提醒日期');
  }
  return formatDateKey(nextOccurrence);
};

const resolveOccurrence = (
  reminder: Reminder,
  zone: string,
  referenceDate: dayjs.Dayjs
): {
  occurrenceDate: dayjs.Dayjs;
  displayLabel: string;
  lunarLabel?: string;
} | null => {
  if (reminder.dateType === 'lunar' && reminder.repeatType === 'yearly') {
    const occurrenceDate = findNextLunarYearlyOccurrence(reminder, referenceDate, zone);
    if (!occurrenceDate) {
      return null;
    }
    const lunarLabel = getLunarLabel(formatDateKey(occurrenceDate), zone);
    return {
      occurrenceDate,
      lunarLabel,
      displayLabel: `${lunarLabel}（对应 ${formatChineseDate(formatDateKey(occurrenceDate), zone)}）`
    };
  }

  if (reminder.dateType === 'lunar' && reminder.repeatType === 'monthly') {
    const lunarMonthly = findNextLunarMonthlyOccurrence(reminder, referenceDate, zone);
    if (!lunarMonthly) {
      return null;
    }
    return {
      occurrenceDate: lunarMonthly.occurrenceDate,
      lunarLabel: lunarMonthly.lunarMonthLabel,
      displayLabel: `${lunarMonthly.lunarMonthLabel}（对应 ${formatChineseDate(
        formatDateKey(lunarMonthly.occurrenceDate),
        zone
      )}）`
    };
  }

  switch (reminder.repeatType) {
    case 'yearly': {
      const { month, day } = getSolarParts(reminder.solarDate);
      let candidate = parseDate(
        `${referenceDate.year()}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        zone
      );
      if (!isSameOrAfterDay(candidate, referenceDate)) {
        candidate = candidate.add(1, 'year');
      }
      return {
        occurrenceDate: candidate,
        displayLabel: formatChineseDate(formatDateKey(candidate), zone)
      };
    }
    case 'monthly': {
      const { day } = getSolarParts(reminder.solarDate);
      let monthCursor = referenceDate;
      const targetDay = day;
      while (true) {
        const resolvedDay = clampSolarDay(
          monthCursor.year(),
          monthCursor.month() + 1,
          targetDay
        );
        const candidate = parseDate(
          `${monthCursor.year()}-${String(monthCursor.month() + 1).padStart(2, '0')}-${String(resolvedDay).padStart(2, '0')}`,
          zone
        );
        if (isSameOrAfterDay(candidate, referenceDate)) {
          return {
            occurrenceDate: candidate,
            displayLabel: formatChineseDate(formatDateKey(candidate), zone)
          };
        }
        monthCursor = monthCursor.add(1, 'month').startOf('month');
      }
    }
    case 'weekly': {
      const anchorWeekday = getWeeklyAnchorWeekday(reminder, zone, referenceDate);
      const offset = (anchorWeekday - referenceDate.day() + 7) % 7;
      const occurrenceDate = referenceDate.add(offset, 'day');
      return {
        occurrenceDate,
        displayLabel: WEEK_LABELS[anchorWeekday]
      };
    }
    case 'once': {
      const { year, month, day } = getSolarParts(reminder.solarDate);
      const candidate = parseDate(
        `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        zone
      );
      if (!isSameOrAfterDay(candidate, referenceDate)) {
        return null;
      }
      if (reminder.dateType === 'lunar') {
        const lunarLabel = getLunarLabel(formatDateKey(candidate), zone);
        return {
          occurrenceDate: candidate,
          lunarLabel,
          displayLabel: `${lunarLabel}（对应 ${formatChineseDate(formatDateKey(candidate), zone)}）`
        };
      }
      return {
        occurrenceDate: candidate,
        displayLabel: formatChineseDate(formatDateKey(candidate), zone)
      };
    }
  }
};

const findNextReminderSlot = (
  reminder: Reminder,
  occurrenceDate: dayjs.Dayjs,
  referenceMoment: dayjs.Dayjs,
  zone: string
) => {
  const startDate = occurrenceDate.subtract(reminder.advanceDays, 'day');
  const sortedTimes = sortTimeValues(reminder.remindTimes);
  const slotStartDate = referenceMoment.startOf('day').isAfter(startDate, 'day')
    ? referenceMoment.startOf('day')
    : startDate;

  for (
    let dateCursor = slotStartDate;
    !dateCursor.isAfter(occurrenceDate, 'day');
    dateCursor = dateCursor.add(1, 'day')
  ) {
    const dateKey = formatDateKey(dateCursor);
    for (const time of sortedTimes) {
      const slotMoment = parseDateTime(dateKey, time, zone);
      if (slotMoment.isBefore(referenceMoment)) {
        continue;
      }
      return {
        nextRemindDate: dateKey,
        nextRemindTime: time,
        nextRemindDateTime: formatDateTime(slotMoment)
      };
    }
  }

  return null;
};

export const getReminderPreview = (
  reminder: Reminder,
  zone: string,
  reference: dayjs.Dayjs | string
): ReminderSchedulePreview | null => {
  const referenceMoment = normalizeReferenceMoment(reference, zone);
  const maxCycles =
    reminder.repeatType === 'weekly'
      ? 120
      : reminder.repeatType === 'monthly'
        ? 48
        : reminder.repeatType === 'once'
          ? 1
          : 24;

  let searchDate = referenceMoment.startOf('day');

  for (let index = 0; index < maxCycles; index += 1) {
    const occurrence = resolveOccurrence(reminder, zone, searchDate);
    if (!occurrence) {
      return null;
    }

    const slot = findNextReminderSlot(
      reminder,
      occurrence.occurrenceDate,
      referenceMoment,
      zone
    );

    if (slot) {
      return {
        occurrenceDate: formatDateKey(occurrence.occurrenceDate),
        nextRemindDate: slot.nextRemindDate,
        nextRemindTime: slot.nextRemindTime,
        nextRemindDateTime: slot.nextRemindDateTime,
        daysUntilNextRemind: parseDate(slot.nextRemindDate, zone).diff(
          referenceMoment.startOf('day'),
          'day'
        ),
        daysLeft: occurrence.occurrenceDate.diff(parseDate(slot.nextRemindDate, zone), 'day'),
        displayLabel: occurrence.displayLabel,
        lunarLabel: occurrence.lunarLabel
      };
    }

    if (reminder.repeatType === 'once') {
      return null;
    }

    searchDate = occurrence.occurrenceDate.add(1, 'day');
  }

  return null;
};

const getCompactReminderFields = (
  reminder: Reminder,
  preview: ReminderSchedulePreview,
  zone: string
) => {
  const targetDate =
    reminder.dateType === 'lunar' && preview.lunarLabel
      ? `${preview.lunarLabel}（对应公历 ${formatChineseDate(preview.occurrenceDate, zone)}）`
      : preview.displayLabel;
  const remindStatus =
    preview.daysLeft === 0 ? '今天就是提醒日期' : `还有 ${preview.daysLeft} 天`;
  return { targetDate, remindStatus };
};

export const buildCompactReminderTemplate = (
  reminder: Reminder,
  preview: ReminderSchedulePreview,
  zone: string,
  options: { boldTitle?: boolean } = {}
) => {
  const { targetDate, remindStatus } = getCompactReminderFields(reminder, preview, zone);
  const title = options.boldTitle ? `**${reminder.title}**` : reminder.title;
  return `${title}\n${targetDate}\n${remindStatus}`;
};

export const buildCompactReminderBody = (
  reminder: Reminder,
  preview: ReminderSchedulePreview,
  zone: string
) => {
  const { targetDate, remindStatus } = getCompactReminderFields(reminder, preview, zone);
  return `${targetDate}\n${remindStatus}`;
};
