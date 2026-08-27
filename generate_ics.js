// 從 index.html 抽出 COURSES + INFO_EVENTS，產出完整訂閱用 events.ics
// 用法：node generate_ics.js
const fs = require('fs');
const path = require('path');

const HTML_PATH = path.join(__dirname, 'index.html');
const OUT_PATH  = path.join(__dirname, 'events.ics');

const html = fs.readFileSync(HTML_PATH, 'utf8');

function extractArray(varName) {
  const startMatch = html.match(new RegExp(`const ${varName}\\s*=\\s*\\[`));
  if (!startMatch) throw new Error(`找不到 ${varName}`);
  let i = startMatch.index + startMatch[0].length - 1; // 指向開頭的 [
  let depth = 0;
  let end = -1;
  for (; i < html.length; i++) {
    if (html[i] === '[') depth++;
    else if (html[i] === ']') {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }
  if (end === -1) throw new Error(`${varName} 陣列沒有正確結尾`);
  const arrayText = html.slice(startMatch.index + `const ${varName} = `.length, end + 1);
  return new Function(`return ${arrayText}`)();
}

const COURSES     = extractArray('COURSES');
const INFO_EVENTS = extractArray('INFO_EVENTS');

function pad2(n) { return String(n).padStart(2, '0'); }

function icsEscape(str) {
  return String(str).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

function parseTimeRange(timeStr) {
  const m = String(timeStr).match(/^(\d{1,2}):(\d{2})\s*[–-]\s*(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return { sh: +m[1], smin: +m[2], eh: +m[3], emin: +m[4] };
}

let uidCounter = 0;
function buildEvent({ summary, location, y, mo, d, time }) {
  uidCounter++;
  const range = parseTimeRange(time);
  const lines = [
    'BEGIN:VEVENT',
    `UID:${y}${pad2(mo)}${pad2(d)}-${uidCounter}@studioa-enrollment`,
    `SUMMARY:${icsEscape(summary)}`
  ];
  if (location) lines.push(`LOCATION:${icsEscape(location)}`);
  if (!range) {
    const nd = new Date(y, mo - 1, d + 1);
    lines.push(`DTSTART;VALUE=DATE:${y}${pad2(mo)}${pad2(d)}`);
    lines.push(`DTEND;VALUE=DATE:${nd.getFullYear()}${pad2(nd.getMonth() + 1)}${pad2(nd.getDate())}`);
  } else {
    lines.push(`DTSTART;TZID=Asia/Taipei:${y}${pad2(mo)}${pad2(d)}T${pad2(range.sh)}${pad2(range.smin)}00`);
    lines.push(`DTEND;TZID=Asia/Taipei:${y}${pad2(mo)}${pad2(d)}T${pad2(range.eh)}${pad2(range.emin)}00`);
  }
  lines.push('END:VEVENT');
  return lines.join('\r\n');
}

const vevents = [];

COURSES.forEach(c => {
  c.sessions.forEach(s => {
    const [mo, d] = s.date.replace(/–.*/, '').split('/').map(Number); // 兩天課程 '10/27–10/28' 取第一天
    const summary = c.name + (s.tag ? ' ' + s.tag.replace(/【|】/g, '') : '');
    vevents.push(buildEvent({ summary, location: s.loc, y: 2026, mo, d, time: s.time }));
  });
});

INFO_EVENTS.forEach(e => {
  const [y, mo, d] = e.date.split('-').map(Number);
  vevents.push(buildEvent({ summary: e.name, location: '', y, mo, d, time: e.time }));
});

const ics = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'PRODID:-//STUDIO A//在職課程報名平台//EN',
  'CALSCALE:GREGORIAN',
  'X-WR-CALNAME:STUDIO A / Straight A 在職課程',
  'BEGIN:VTIMEZONE',
  'TZID:Asia/Taipei',
  'BEGIN:STANDARD',
  'DTSTART:19700101T000000',
  'TZOFFSETFROM:+0800',
  'TZOFFSETTO:+0800',
  'TZNAME:CST',
  'END:STANDARD',
  'END:VTIMEZONE',
  ...vevents,
  'END:VCALENDAR'
].join('\r\n');

fs.writeFileSync(OUT_PATH, ics, 'utf8');
console.log(`已產出 ${OUT_PATH}，共 ${vevents.length} 筆事件`);
