const messageRepo = require('../../repositories/messageRepository');
const { validate } = require('../../validators/toolArgs');
const { resolveUserId } = require('../../validators/permissions');

const IST_OFFSET_MIN = 330;

const schema = {
  date: { type: 'string', max: 30 },
  period: { type: 'string', enum: ['today', 'yesterday'] },
  limit: { type: 'integer', min: 1, max: 200 },
};

module.exports = async function getChatSummary(args, user) {
  const v = validate(args || {}, schema);
  if (!v.ok) return { ok: false, error: v.errors.join('; ') };

  const userId = resolveUserId(user);
  if (!userId) return { ok: false, error: 'Authentication required.' };

  const target = resolveTargetDate(v.value.date, v.value.period);
  if (!target) return { ok: false, error: 'Please provide a valid chat date.' };

  const limit = v.value.limit || 200;
  const messages = await messageRepo.listForUserByRange(userId, target.from, target.to, limit);
  const visibleMessages = messages.filter((m) => m.role === 'user' || m.role === 'assistant');
  const userCount = visibleMessages.filter((m) => m.role === 'user').length;
  const assistantCount = visibleMessages.filter((m) => m.role === 'assistant').length;
  const turns = buildTurns(visibleMessages).slice(0, 12);

  return {
    ok: true,
    date: target.label,
    count: visibleMessages.length,
    userMessages: userCount,
    assistantMessages: assistantCount,
    summary: {
      title: `Chat Summary - ${formatDDMMYYYY(target.localDate)}`,
      date: formatDDMMYYYY(target.localDate),
      totalMessages: visibleMessages.length,
      userMessages: userCount,
      assistantMessages: assistantCount,
      highlights: buildHighlights(turns),
      turns,
    },
  };
};

function buildTurns(messages) {
  const turns = [];
  let current = null;

  for (const message of messages) {
    if (message.role === 'user') {
      current = {
        at: message.created_at,
        user: cleanText(message.content),
        assistant: '',
      };
      turns.push(current);
      continue;
    }

    if (message.role === 'assistant') {
      if (!current || current.assistant) {
        current = { at: message.created_at, user: '', assistant: '' };
        turns.push(current);
      }
      current.assistant = cleanText(message.content);
    }
  }

  return turns.filter((turn) => turn.user || turn.assistant);
}

function buildHighlights(turns) {
  const highlights = [];
  for (const turn of turns) {
    const action = firstActionLine(turn.assistant);
    if (action) {
      highlights.push(action);
    } else if (turn.user) {
      highlights.push(`You asked: ${truncate(turn.user, 90)}`);
    }
    if (highlights.length >= 6) break;
  }
  return highlights;
}

function firstActionLine(text = '') {
  const lines = text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const actionLine = lines.find((line) => /^(task|checklist|chat|attendance|dashboard|help ticket)\b/i.test(line))
    || lines.find((line) => /\b(created|updated|deleted|completed|summary)\b/i.test(line));
  return actionLine ? truncate(actionLine.replace(/\*\*/g, ''), 110) : '';
}

function cleanText(value = '') {
  return String(value || '')
    .replace(/\*\*/g, '')
    .replace(/[`_]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncate(value = '', max = 120) {
  const text = cleanText(value);
  if (text.length <= max) return text;
  return `${text.slice(0, max - 3).trim()}...`;
}

function resolveTargetDate(rawDate, period) {
  const today = nowISTDate();
  let localDate = today;

  if (period === 'yesterday') {
    localDate = addLocalDays(today, -1);
  } else if (rawDate) {
    localDate = parseLocalDate(rawDate);
  }

  if (!localDate) return null;

  const fromDate = new Date(Date.UTC(localDate.getFullYear(), localDate.getMonth(), localDate.getDate(), 0, 0, 0) - IST_OFFSET_MIN * 60_000);
  const toDate = new Date(fromDate.getTime() + 24 * 60 * 60_000);

  return {
    localDate,
    label: formatYYYYMMDD(localDate),
    from: formatDbTimestamp(fromDate),
    to: formatDbTimestamp(toDate),
  };
}

function parseLocalDate(value = '') {
  const text = String(value || '').trim().toLowerCase();
  if (!text || text === 'today' || text === 'this date') return nowISTDate();
  if (text === 'yesterday') return addLocalDays(nowISTDate(), -1);

  const ymd = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (ymd) return validLocalDate(Number(ymd[1]), Number(ymd[2]), Number(ymd[3]));

  const dmy = text.match(/^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?$/);
  if (dmy) {
    let year = dmy[3] ? Number(dmy[3]) : nowISTDate().getFullYear();
    if (year < 100) year += 2000;
    return validLocalDate(year, Number(dmy[2]), Number(dmy[1]));
  }

  const named = text.match(/^(\d{1,2})\s+(jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december)(?:\s+(\d{2,4}))?$/i);
  if (named) {
    let year = named[3] ? Number(named[3]) : nowISTDate().getFullYear();
    if (year < 100) year += 2000;
    return validLocalDate(year, monthNameToIndex(named[2]) + 1, Number(named[1]));
  }

  return null;
}

function nowISTDate() {
  const now = new Date(Date.now() + IST_OFFSET_MIN * 60_000);
  return new Date(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

function addLocalDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function validLocalDate(year, month, day) {
  const d = new Date(year, month - 1, day);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  return d;
}

function monthNameToIndex(value = '') {
  const key = value.slice(0, 3).toLowerCase();
  return ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(key);
}

function formatYYYYMMDD(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function formatDDMMYYYY(date) {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${date.getFullYear()}`;
}

function formatDbTimestamp(date) {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const min = String(date.getUTCMinutes()).padStart(2, '0');
  const ss = String(date.getUTCSeconds()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
}
