import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { routeByTitle, readAssignment, selectTemplateName } from '../cv-template-select.mjs';

function fx() {
  const dir = mkdtempSync(join(tmpdir(), 'cvsel-'));
  writeFileSync(join(dir, 'cv-template.html'), '{{NAME}}{{EXPERIENCE}}{{EDUCATION}}');
  writeFileSync(
    join(dir, 'cv-template.executive-authority.html'),
    '<!-- career-ops-template\nname: Executive Authority\ntitles: CMO, VP Marketing\n-->\n{{NAME}}{{EXPERIENCE}}{{EDUCATION}}'
  );
  writeFileSync(
    join(dir, 'cv-template.growth.html'),
    '<!-- career-ops-template\nname: Growth\ntitles: VP Growth, Head of Growth Marketing\n-->\n{{NAME}}{{EXPERIENCE}}{{EDUCATION}}'
  );
  const profile = join(dir, 'profile.yml');
  writeFileSync(profile, 'cv:\n  template: executive-authority\n');
  const assignments = join(dir, 'assignments.json');
  writeFileSync(assignments, JSON.stringify({ '42': { cv: 'growth' } }));
  return { dir, profile, assignments };
}

test('routeByTitle: matches on title-header overlap', () => {
  const { dir } = fx();
  assert.equal(routeByTitle('cv', 'VP of Marketing, Restaurants', { dir }), 'executive-authority');
  assert.equal(routeByTitle('cv', 'Head of Growth Marketing', { dir }), 'growth');
  assert.equal(routeByTitle('cv', 'Staff Software Engineer', { dir }), null);
});

test('readAssignment: reads sidecar by number', () => {
  const { assignments } = fx();
  assert.equal(readAssignment('42', 'cv', { assignmentsPath: assignments }), 'growth');
  assert.equal(readAssignment('99', 'cv', { assignmentsPath: assignments }), null);
});

test('selectTemplateName: precedence pick > assign > route > default > standard', () => {
  const { dir, profile, assignments } = fx();
  const base = { dir, profilePath: profile, assignmentsPath: assignments };
  assert.equal(selectTemplateName('cv', { ...base, n: '42', jobTitle: 'CMO', pick: 'standard' }), 'standard'); // pick wins
  assert.equal(selectTemplateName('cv', { ...base, n: '42', jobTitle: 'CMO' }), 'growth'); // assignment wins over route
  assert.equal(selectTemplateName('cv', { ...base, n: '7', jobTitle: 'VP Growth' }), 'growth'); // route (no assignment)
  assert.equal(selectTemplateName('cv', { ...base, n: '7', jobTitle: 'Staff Engineer' }), 'executive-authority'); // profile default
  const noProfile = { dir, profilePath: join(dir, 'none.yml'), assignmentsPath: join(dir, 'none.json') };
  assert.equal(selectTemplateName('cv', { ...noProfile, jobTitle: 'Staff Engineer' }), 'standard'); // base fallback
});
