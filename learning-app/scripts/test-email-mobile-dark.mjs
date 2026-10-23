import assert from "node:assert/strict";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import vm from "node:vm";
import ts from "typescript";
import { parseDocument } from "htmlparser2";
import { isTag } from "domhandler";
import { findAll, textContent } from "domutils";
import { updatedCopy } from "./update-visible-brand-copy.mjs";

const require = createRequire(import.meta.url), cache = new Map();
export function loadEmail(name) {
  if (cache.has(name)) return cache.get(name);
  const mod = { exports: {} };
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL(`../app/lib/email/${name}.ts`,import.meta.url),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,
    { exports:mod.exports, URL, require:id=>id==="server-only" ? {} : id.endsWith("site-urls.mjs") ? {learningAbsoluteUrl:path=>`https://www.growvelt.com${path}`} : id.startsWith("./") ? loadEmail(id.slice(2)) : require(id) });
  cache.set(name,mod.exports); return mod.exports;
}
const {prepareMobileDarkEmailHtml:prepare}=loadEmail("email-dark-compatibility");
const {renderGrowveltEmail,renderGrowveltEmailLegacy}=loadEmail("growvelt-email-template");
const tokens = html=>html.match(/\{\{\{[\s\S]*?\}\}\}|\{\{[\s\S]*?\}\}/g) ?? [];
const elements = html=>findAll(isTag,parseDocument(html).children);
const snapshot = html=>{
  const nodes=elements(html);
  return {
    text:nodes.filter(node=>node.name==="body").map(node=>textContent(node)),
    links:nodes.filter(node=>node.name==="a").map(node=>({href:node.attribs.href,text:textContent(node)})),
    images:nodes.filter(node=>node.name==="img").map(node=>node.attribs),
    tables:nodes.filter(node=>node.name==="table"||node.name==="td").map(node=>({name:node.name,width:node.attribs.width,bgcolor:node.attribs.bgcolor,
      style:(node.attribs.style||"").replace(/(^|;)background:/g,"$1background-color:")})),
    tokens:tokens(html),
  };
};
export const sampleEmail = {baseUrl:"https://www.growvelt.com",greeting:"Ndu",title:"New login to your Growvelt account",
  paragraphs:["We noticed a new sign-in to your Growvelt Learning account. Here are the details."],
  details:[{label:"Location",value:"Abuja, Nigeria"},{label:"Device",value:"Safari on iPhone"},{label:"IP address",value:"192.0.2.1"}],
  primaryAction:{label:"Review account settings",href:"https://www.growvelt.com/learning/dashboard/settings"},
  reason:"You received this security alert because of a new sign-in."};

for (const input of [sampleEmail,{...sampleEmail,title:"Learning news",details:[],messageMarkdown:"Hello **learners**.\n\n- Your next lesson\n- A practical skill",unsubscribeUrl:"{{{RESEND_UNSUBSCRIBE_URL}}}"}]) {
  const old=renderGrowveltEmailLegacy(input),updated=renderGrowveltEmail(input);
  assert.deepEqual(snapshot(updated),snapshot(old),"copy, actions, images, table geometry, desktop colours and tokens remain unchanged");
  assert.doesNotMatch(updated,/color-scheme|light only/);
  assert.match(updated,/@media screen and \(max-width:600px\)/);
  assert.match(updated,/u \+ \.gvl-gmail-compat/);
  assert.match(updated,/background-image:linear-gradient\(#17181b,#17181b\)!important/);
  assert.equal(prepare(updated),updated,"idempotent output cannot nest text blends");
  for(const node of elements(updated).filter(node=>node.name==="img")) {
    let parent=node.parent;
    while(parent){assert.doesNotMatch(parent.attribs?.class ?? "",/gvl-(?:s|d)\b/,"never blend the logo/photo as text");parent=parent.parent;}
  }
  assert.ok(Buffer.byteLength(updated)<80000,"normal emails keep ample room for Gmail's message clipping threshold");
}
assert.ok(Buffer.byteLength(renderGrowveltEmail({...sampleEmail,messageMarkdown:"- x\n".repeat(999).trim()}))<80000,"a maximum-length bullet message stays below the clipping safety budget");
const templateFixture='<!doctype html><html><head><meta name="color-scheme" content="light only"></head><body bgcolor="#17181b"><table><tr><td><a href="{{ .ConfirmationURL }}">{{ .Token }}</a>{{ .TokenHash }} {{ .SiteURL }} {{ if .Email }}{{ .Email }}{{ end }} {{{RESEND_UNSUBSCRIBE_URL}}}</td></tr></table></body></html>';
assert.deepEqual(tokens(prepare(templateFixture)),tokens(templateFixture));
assert.equal(prepare("<p>Not a full email</p>"),"<p>Not a full email</p>");

const directory=new URL("../supabase/email-templates/",import.meta.url),files=readdirSync(directory).filter(name=>name.endsWith(".html"));
const subjects=JSON.parse(readFileSync(new URL("subjects.json",directory),"utf8"));
assert.equal(files.length,13);
assert.deepEqual(Object.keys(subjects).sort(),[...files].sort());
for(const file of files){
  const path=new URL(file,directory),before=readFileSync(path,"utf8"),after=prepare(before);
  assert.deepEqual(snapshot(after),snapshot(before),`${file}: protect Auth placeholders, links, copy and desktop appearance`);
  if(process.argv.includes("--write-auth")) writeFileSync(path,after+(!after.endsWith("\n")?"\n":""));
  else assert.equal(before,after,`${file}: run the explicit Auth preparation step`);
}
// Optional generated release artifact: compatibility-only changes from HEAD,
// keeping unrelated in-progress Auth palette edits out of this release.
if(process.argv.includes("--release-auth-manifest")) {
  const manifest=files.map(file=>{
    const before=execFileSync("git",["show",`HEAD:learning-app/supabase/email-templates/${file}`],{encoding:"utf8"});
    const after=prepare(updatedCopy(before)).trimEnd()+"\n";
    assert.deepEqual(snapshot(after),snapshot(updatedCopy(before)));
    const preserved=prepare(updatedCopy(before.replaceAll("#e5e7eb","#f4f4f5").replaceAll("#c4c7cc","#e4e4e7"))).trim().replaceAll("\r\n","\n");
    assert.equal(readFileSync(new URL(file,directory),"utf8").trim().replaceAll("\r\n","\n"),preserved,"unrelated Auth edits must be understood and preserved before isolation");
    return {file,before,after,subject:subjects[file]};
  });
  writeFileSync(new URL("../.next/email-auth-mobile-release.json",import.meta.url),JSON.stringify(manifest));
}

const {renderEmailCenterMessage}=loadEmail("email-center-render"),{createEmailCenterResendTransport}=loadEmail("email-center-resend"),{emptyEmailDocument}=loadEmail("email-center");
const document={...emptyEmailDocument,subject:"Learning news",message:"Your next practical learning step."},operation="learning-center-fixture-mobile";
const transport=createEmailCenterResendTransport({senders:{learning:"no-reply@growvelt.com"},verifiedDomains:["growvelt.com"],request:async()=>assert.fail("Network forbidden")});
const remote={name:operation,segment_id:loadEmail("email-center-audience").LEARNING_EMAIL_SEGMENT_ID,from:"Growvelt <no-reply@growvelt.com>",subject:document.subject};
assert.equal(transport.matchesBroadcast({...remote,html:renderEmailCenterMessage(document,"there")},document,operation),true);
assert.equal(transport.matchesBroadcast({...remote,from:"Growvelt Learning <no-reply@growvelt.com>",html:renderEmailCenterMessage(document,"there",undefined,true)},document,operation),true,"old prepared/queued sender and HTML remain recoverable");
assert.equal(transport.matchesBroadcast({...remote,html:renderEmailCenterMessage(document,"there",undefined,true)+"tampered"},document,operation),false);
const inboxOnly={...document,subject:"INBOX ONLY SUBJECT",headline:""};
assert.doesNotMatch(renderEmailCenterMessage(inboxOnly),/INBOX ONLY SUBJECT|<h1\b/);
assert.match(renderEmailCenterMessage({...inboxOnly,headline:"An optional heading"}),/An optional heading/);
assert.doesNotMatch(renderEmailCenterMessage({...inboxOnly,headline:"An optional heading"}),/INBOX ONLY SUBJECT/);
assert.match(renderEmailCenterMessage(inboxOnly,"there",undefined,true),/INBOX ONLY SUBJECT/);
console.log(`PASS mobile email compatibility: desktop semantics/geometry, Gmail-scoped narrow CSS, escaping, tokens, images, idempotence, ${files.length} Auth sources and legacy broadcast recovery. No real email sent.`);
