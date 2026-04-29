import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const cwd = fileURLToPath(new URL('../', import.meta.url));
const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }).trim();
const ref = process.argv[2] || 'history-calendar-spring-2026';
assert.match(ref, /^[A-Za-z0-9_][A-Za-z0-9_./-]*$/, 'Invalid Git reference');
const tip = git('rev-parse', '--verify', `${ref}^{commit}`);
const calendar = JSON.parse(git('show', `${tip}:docs/commit-calendar-spring-2026.json`));
const base = calendar.baseCommit;
assert.equal(git('rev-parse', `${calendar.baseTag}^{commit}`), base, 'Previous release tag changed');
git('merge-base', '--is-ancestor', base, tip);
const rows = git('log', '--reverse', '--format=%H%x09%T%x09%P%x09%aI%x09%cI%x09%s', `${base}..${tip}`)
  .split('\n').map(line => line.split('\t'));
const actual = new Map();
let previous = base;
let previousTree = git('rev-parse', `${base}^{tree}`);
let previousDate = '';
for (const [hash, tree, parent, authorDate, commitDate, subject] of rows) {
  assert.equal(parent, previous, `Unexpected parent at ${hash}`);
  assert.notEqual(tree, previousTree, `Empty commit at ${hash}`);
  assert.equal(authorDate, commitDate, `Author/committer date mismatch at ${hash}`);
  assert.ok(authorDate.endsWith(calendar.utcOffset), `Unexpected timezone at ${hash}`);
  assert.ok(authorDate >= previousDate, `Nonchronological commit at ${hash}`);
  const day = authorDate.slice(0, 10);
  assert.ok(day >= calendar.start && day <= calendar.end, `Out-of-range date at ${hash}`);
  assert.ok(subject?.length >= 12, `Missing descriptive subject at ${hash}`);
  actual.set(day, (actual.get(day) || 0) + 1);
  previous = hash; previousTree = tree; previousDate = authorDate;
}
assert.equal(rows.length, calendar.totalCommits, 'Total count mismatch');
assert.equal(calendar.schedule.length, 56, 'Expected 56 calendar days');
assert.equal(calendar.reservedDaysOff.length, 12, 'Expected twelve days off');
assert.equal(new Set(calendar.reservedDaysOff).size, 12, 'Duplicate reserved day');
const counts = new Set();
let prior = '';
for (const { date, count } of calendar.schedule) {
  if (prior) assert.equal(Date.parse(date) - Date.parse(prior), 86400000, 'Calendar has gaps');
  assert.equal(actual.get(date) || 0, count, `Wrong count on ${date}`);
  if (calendar.reservedDaysOff.includes(date)) assert.equal(count, 0, `Commit on reserved day ${date}`);
  else {
    assert.ok(count >= calendar.dailyMin && count <= calendar.dailyMax, `Count outside bounds on ${date}`);
    counts.add(count);
  }
  prior = date;
}
assert.equal(calendar.schedule[0].date, calendar.start);
assert.equal(prior, calendar.end);
assert.equal(actual.size, 44, 'Expected 44 active days');
assert.ok(counts.size > 1, 'Daily counts must vary');
console.log(JSON.stringify({ ref, tip, base, newCommits: rows.length, activeDays: actual.size, daysOff: 12,
  smallestDay: Math.min(...counts), largestDay: Math.max(...counts), distinctDailyCounts: counts.size,
  previousHistoryPreserved: true, allNewCommitsNonempty: true, datesVerified: true }, null, 2));
