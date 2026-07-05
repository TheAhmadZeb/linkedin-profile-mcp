#!/usr/bin/env node
/**
 * LinkedIn Profile MCP Editor
 *
 * Reads and writes LinkedIn profile fields via browser automation.
 * Requires: npx linkedin-mcp --login (one-time) to establish a session.
 *
 * Usage:
 *   node edit-profile.js get <field>              # Read a field
 *   node edit-profile.js set <field> <value>      # Write a field
 *   node edit-profile.js test                     # Test + revert headline
 *   node edit-profile.js list                     # Show all fields
 *   node edit-profile.js add-exp --<key> <val>    # Add experience entry
 *   node edit-profile.js add-edu --<key> <val>    # Add education entry
 *
 * Environment:
 *   LINKEDIN_PROFILE_DIR   - Browser profile directory (default: ~/.linkedin-mcp/profile)
 *   LINKEDIN_VANITY        - Your LinkedIn vanity URL slug (required)
 *   LINKEDIN_HEADLESS      - Set to "true" for headless Chrome
 *   DISPLAY                - X display for headed mode (default: :99)
 */

const { chromium } = require('patchright');

const PROFILE_DIR = process.env.LINKEDIN_PROFILE_DIR || require('path').join(require('os').homedir(), '.linkedin-mcp', 'profile');
const VANITY = process.env.LINKEDIN_VANITY;
const HEADLESS = process.env.LINKEDIN_HEADLESS === 'true';
const DISPLAY = process.env.DISPLAY || ':99';

if (!VANITY) {
  console.error('ERROR: LINKEDIN_VANITY environment variable is required');
  process.exit(1);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

const EDIT_PAGES = {
  intro:     `https://www.linkedin.com/in/${VANITY}/edit/intro`,
  about:     `https://www.linkedin.com/in/${VANITY}/edit/forms/summary/new/`,
  add_exp:   `https://www.linkedin.com/in/${VANITY}/edit/forms/position/new/`,
  add_edu:   `https://www.linkedin.com/in/${VANITY}/edit/forms/education/new/`,
  add_project: `https://www.linkedin.com/in/${VANITY}/edit/forms/project/new/`,
};

const FIELD_MAP = {
  intro: [
    { idx: 0, name: 'first_name',      tag: 'INPUT',    label: 'First name*' },
    { idx: 1, name: 'last_name',       tag: 'INPUT',    label: 'Last name*' },
    { idx: 2, name: 'additional_name', tag: 'INPUT',    label: 'Additional name' },
    { idx: 3, name: 'pronouns',        tag: 'SELECT',   label: 'Pronouns' },
    { idx: 4, name: 'headline',        tag: 'DIV',      label: 'Headline', contenteditable: true },
    { idx: 5, name: 'position',        tag: 'SELECT',   label: 'Position*' },
    { idx: 6, name: 'industry',        tag: 'INPUT',    label: 'Industry*' },
    { idx: 7, name: 'school',          tag: 'SELECT',   label: 'School*' },
    { idx: 8, name: 'country',         tag: 'INPUT',    label: 'Country/Region*' },
    { idx: 9, name: 'city',            tag: 'INPUT',    label: 'City' },
  ],
  about: [
    { idx: 0, name: 'about',           tag: 'DIV',      label: 'About', contenteditable: true },
  ],
  add_exp: [
    { idx: 0, name: 'title',           tag: 'INPUT',    label: 'Title' },
    { idx: 1, name: 'employment_type', tag: 'SELECT',   label: 'Employment type' },
    { idx: 2, name: 'company',         tag: 'INPUT',    label: 'Company' },
    { idx: 3, name: 'start_month',     tag: 'SELECT',   label: 'Start month' },
    { idx: 4, name: 'start_year',      tag: 'SELECT',   label: 'Start year*' },
    { idx: 5, name: 'end_month',       tag: 'SELECT',   label: 'End month' },
    { idx: 6, name: 'end_year',        tag: 'SELECT',   label: 'End year' },
    { idx: 7, name: 'location',        tag: 'INPUT',    label: 'Location' },
    { idx: 8, name: 'location_type',   tag: 'SELECT',   label: 'Location type' },
    { idx: 9, name: 'description',     tag: 'DIV',      label: 'Description', contenteditable: true },
  ],
  add_edu: [
    { idx: 0, name: 'school',          tag: 'INPUT',    label: 'School*' },
    { idx: 1, name: 'degree',          tag: 'INPUT',    label: 'Degree' },
    { idx: 2, name: 'field_of_study',  tag: 'INPUT',    label: 'Field of study' },
    { idx: 3, name: 'start_month',     tag: 'SELECT',   label: 'Start month' },
    { idx: 4, name: 'start_year',      tag: 'SELECT',   label: 'Start year' },
    { idx: 5, name: 'end_month',       tag: 'SELECT',   label: 'End month' },
    { idx: 6, name: 'end_year',        tag: 'SELECT',   label: 'End year' },
    { idx: 7, name: 'grade',           tag: 'INPUT',    label: 'Grade' },
    { idx: 8, name: 'activities',      tag: 'TEXTAREA', label: 'Activities' },
    { idx: 9, name: 'description',     tag: 'TEXTAREA', label: 'Description' },
  ],
  add_project: [
    { idx: 0, name: 'project_name',       tag: 'INPUT',    label: 'Project name*' },
    { idx: 1, name: 'description',        tag: 'TEXTAREA', label: 'Description' },
    { idx: 2, name: 'start_month',        tag: 'SELECT',   label: 'Start month' },
    { idx: 3, name: 'start_year',         tag: 'SELECT',   label: 'Start year' },
    { idx: 4, name: 'end_month',          tag: 'SELECT',   label: 'End month' },
    { idx: 5, name: 'end_year',           tag: 'SELECT',   label: 'End year' },
    { idx: 6, name: 'currently_working',  tag: 'CHECKBOX', label: 'I am currently working on this project' },
    { idx: 7, name: 'project_url',        tag: 'INPUT',    label: 'Project URL' },
    { idx: 8, name: 'associated_with',    tag: 'INPUT',    label: 'Associated with' },
    { idx: 9, name: 'contributors',       tag: 'INPUT',    label: 'Contributors' },
    { idx: 10, name: 'skills_used',       tag: 'INPUT',    label: 'Skills used' },
  ],
};

function getFieldInfo(fieldName) {
  for (const [pageName, fields] of Object.entries(FIELD_MAP)) {
    const f = fields.find(f => f.name === fieldName);
    if (f) return { pageName, fieldDef: f };
  }
  return null;
}

async function readField(page, pageName, fieldDef) {
  await page.goto(EDIT_PAGES[pageName], { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
  await sleep(2500);
  const el = page.locator('input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"]), textarea, [contenteditable="true"], [contenteditable=""], select').nth(fieldDef.idx);
  return (await el.isVisible().catch(() => false))
    ? (await el.evaluate(e => e.value || e.innerText || '')).trim()
    : null;
}

async function writeField(page, pageName, fieldDef, value) {
  await page.goto(EDIT_PAGES[pageName], { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
  await sleep(2500);
  const selector = fieldDef.tag === 'CHECKBOX'
    ? 'input[type="checkbox"]'
    : 'input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"]), textarea, [contenteditable="true"], [contenteditable=""], select';
  const el = page.locator(selector).nth(fieldDef.idx);
  if (!(await el.isVisible().catch(() => false))) throw new Error(`Field '${fieldDef.name}' not visible`);

  if (fieldDef.tag === 'CHECKBOX') {
    const checked = await el.isChecked();
    if ((value === true || value === 'true') !== checked) {
      await el.click();
    }
  } else if (fieldDef.tag === 'SELECT') {
    await el.selectOption(value);
  } else if (fieldDef.contenteditable || fieldDef.tag === 'DIV') {
    await el.click();
    await sleep(300);
    await el.evaluate(el => { el.innerText = ''; });
    await el.type(value, { delay: 15 });
  } else {
    await el.fill('');
    await el.type(value, { delay: 10 });
  }

  const saveBtn = page.getByRole('button', { name: /save/i }).first();
  if (await saveBtn.isVisible().catch(() => false)) {
    await saveBtn.click();
    await sleep(3000);
  }
  console.log(`✅ ${fieldDef.name} updated`);
}

async function launchBrowser() {
  const launchEnv = { ...process.env };
  if (HEADLESS) {
    launchEnv.DISPLAY = DISPLAY;
  }
  return await chromium.launchPersistentContext(PROFILE_DIR, {
    channel: 'chrome',
    headless: HEADLESS,
    args: [
      '--no-sandbox',
      '--disable-gpu',
      '--disable-blink-features=AutomationControlled',
      '--enable-unsafe-swiftshader',
    ],
    env: launchEnv,
  });
}

async function main() {
  const cmd = process.argv[2];
  if (!cmd || cmd === '--help' || cmd === '-h') {
    console.log(`
Usage:
  node edit-profile.js get <field>              Read a profile field
  node edit-profile.js set <field> <value>      Write a profile field
  node edit-profile.js test                     Safe test (modifies headline, reverts)
  node edit-profile.js list                     Show all editable fields
  node edit-profile.js add-exp --<key> <val>    Add experience
  node edit-profile.js add-edu --<key> <val>    Add education

Set LINKEDIN_VANITY env var to your LinkedIn vanity URL slug.
`);
    return;
  }

  const context = await launchBrowser();
  const page = await context.newPage();
  page.setDefaultTimeout(20000);

  try {
    if (cmd === 'get') {
      const field = process.argv[3];
      const info = getFieldInfo(field);
      if (!info) { console.log(`Unknown field: ${field}`); return; }
      const val = await readField(page, info.pageName, info.fieldDef);
      console.log(`${field} = "${val}"`);
    } else if (cmd === 'set') {
      const field = process.argv[3];
      const value = process.argv.slice(4).join(' ');
      const info = getFieldInfo(field);
      if (!info) { console.log(`Unknown field: ${field}`); return; }
      await writeField(page, info.pageName, info.fieldDef, value);
    } else if (cmd === 'test') {
      const def = FIELD_MAP.intro.find(f => f.name === 'headline');
      const orig = await readField(page, 'intro', def);
      console.log(`Original: "${orig}"`);
      await writeField(page, 'intro', def, orig + '.');
      await sleep(2000);
      await page.goto(`https://www.linkedin.com/in/${VANITY}/`, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await sleep(2000);
      const text = await page.evaluate(() => (document.querySelector('main') || document.body).innerText.substring(0, 500));
      console.log('Profile:', text.split('\n').filter(l => l.trim()).slice(0, 8).join(' | '));
      await writeField(page, 'intro', def, orig);
      console.log('✅ Restored to original');
    } else if (cmd === 'list') {
      for (const [pn, fields] of Object.entries(FIELD_MAP)) {
        console.log(`\n--- ${pn} ---`);
        fields.forEach(f => console.log(`  ${f.name}: ${f.label} (${f.tag})`));
      }
    } else {
      console.log(`Unknown command: ${cmd}`);
      console.log('Usage: node edit-profile.js <get|set|test|list> [field] [value]');
    }
  } catch (e) {
    console.error('❌', e.message);
  } finally {
    await sleep(1000);
    await context.close();
  }
}

main();
