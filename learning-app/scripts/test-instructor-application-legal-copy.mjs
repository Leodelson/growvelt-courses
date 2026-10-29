// Isolated render test: no authentication or external requests.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const require = createRequire(import.meta.url);
let selectedLocale = 'en';
const source = fs.readFileSync('app/components/instructor/application-form.tsx', 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
const loadedModule = { exports: {} };
vm.runInNewContext(code, { exports: loadedModule.exports, require(id) {
  if (id === 'next/link') return function Link({ children, ...props }) { return React.createElement('a', props, children); };
  if (id.endsWith('/language-provider')) return { useLanguage: () => ({ locale: selectedLocale, t: key => key }) };
  if (id.endsWith('/action-button')) return { ActionButton: ({ children }) => React.createElement('button', null, children) };
  if (id.endsWith('/inline-feedback')) return { InlineFeedback: () => null };
  if (id.endsWith('.module.css')) return { legalCopy: 'instructorLegalCopy' };
  return require(id);
} });

const { InstructorApplicationForm } = loadedModule.exports;
for (const [locale, terms, privacy] of [
  ['en', 'Terms of Service', 'Privacy Policy'],
  ['fr', 'Conditions d’utilisation', 'Politique de confidentialité'],
  ['es', 'Términos de servicio', 'Política de privacidad'],
]) {
  selectedLocale = locale;
  const html = renderToStaticMarkup(React.createElement(InstructorApplicationForm, { identity: { fullName: 'Example Applicant', email: 'applicant@example.invalid' } }));
  assert.ok(html.includes(terms), `${locale}: Terms label`);
  assert.ok(html.includes(privacy), `${locale}: Privacy label`);
  assert.match(html, /href="\/terms-of-service" target="_blank" rel="noopener noreferrer"/);
  assert.match(html, /href="\/privacy-policy" target="_blank" rel="noopener noreferrer"/);
  assert.match(html, /instructorLegalCopy/);
}
console.log('PASS: instructor application links Terms and Privacy in all supported languages and preserves the form in a separate tab.');
