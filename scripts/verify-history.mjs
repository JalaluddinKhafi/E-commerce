import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const cwd = fileURLToPath(new URL('../', import.meta.url));
const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }).trim();
const ref = process.argv[2] || 'history-calendar-2025';
assert.match(ref, /^[A-Za-z0-9_][A-Za-z0-9_./-]*$/, 'Invalid Git reference');
const tip = git('rev-parse', '--verify', `${ref}^{commit}`);
const calendar = JSON.parse(git('show', `${tip}:docs/commit-calendar.json`));
const rows = git('log', '--reverse', '--format=%H%x09%T%x09%P%x09%aI%x09%cI%x09%s', tip)
  .split('\n').map(line => line.split('\t'));
const actual = new Map();
let previous = null;
let previousTree = null;
let previousDate = '';
for (const [hash, tree, parent, authorDate, commitDate, subject] of rows) {
  assert.equal(parent, previous || '', `Unexpected parents at ${hash}`);
  assert.notEqual(tree, previousTree, `Empty commit at ${hash}`);
  assert.equal(authorDate, commitDate, `Author/committer date mismatch at ${hash}`);
  assert.ok(authorDate.endsWith(calendar.utcOffset), `Unexpected timezone at ${hash}`);
  assert.ok(authorDate >= previousDate, `Nonchronological history at ${hash}`);
  const day = authorDate.slice(0, 10);
  assert.ok(day >= calendar.start && day <= calendar.end, `Out-of-range date at ${hash}`);
  assert.ok(subject?.length >= 12, `Missing descriptive message at ${hash}`);
  actual.set(day, (actual.get(day) || 0) + 1);
  previous = hash;
  previousTree = tree;
  previousDate = authorDate;
}
assert.equal(rows.length, calendar.totalCommits, 'Total commit count mismatch');
assert.equal(calendar.schedule.length, 113, 'Expected 113 calendar days');
assert.equal(calendar.reservedDaysOff.length, 10, 'Expected ten reserved days');
assert.equal(new Set(calendar.reservedDaysOff).size, 10, 'Duplicate days off');
let priorDay = '';
const counts = new Set();
for (const { date, count } of calendar.schedule) {
  assert.ok(date > priorDay, 'Calendar must be sorted without duplicate dates');
  if (priorDay) assert.equal(Date.parse(date) - Date.parse(priorDay), 86400000, 'Calendar has gaps');
  assert.equal(actual.get(date) || 0, count, `Count mismatch for ${date}`);
  if (calendar.reservedDaysOff.includes(date)) assert.equal(count, 0, `Commit on reserved day ${date}`);
  else {
    assert.ok(count >= calendar.dailyMin && count <= calendar.dailyMax, `Daily limit exceeded on ${date}`);
    counts.add(count);
  }
  priorDay = date;
}
assert.equal(actual.size, 103, 'Expected 103 active days');
assert.ok(counts.size > 1, 'Daily counts must vary');
console.log(JSON.stringify({ ref, tip, commits: rows.length, activeDays: actual.size, daysOff: 10,
  smallestDay: Math.min(...counts), largestDay: Math.max(...counts), distinctDailyCounts: counts.size,
  allCommitsNonempty: true, authorAndCommitterDatesVerified: true }, null, 2));
