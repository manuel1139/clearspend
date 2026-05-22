import { format, isValid, parse, parseISO } from 'date-fns';

const RECEIPT_DATE_FORMATS = [
  'yyyy-MM-dd',
  'yyyy/M/d',
  'yyyy.M.d',
  'M/d/yy',
  'M/d/yyyy',
  'd.M.yy',
  'd.M.yyyy',
];

export function normalizeReceiptDate(value?: string) {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  const parsedDates = [
    parseISO(trimmed),
    ...RECEIPT_DATE_FORMATS.map((dateFormat) =>
      parse(trimmed, dateFormat, new Date()),
    ),
  ];

  for (const parsedDate of parsedDates) {
    if (isValid(parsedDate)) {
      return format(parsedDate, 'yyyy-MM-dd');
    }
  }

  return null;
}
