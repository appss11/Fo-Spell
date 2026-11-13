'use strict';
const vscode = require('vscode');
const {spawn} = require('node:child_process');
const os = require('node:os');
const path = require('node:path');
const wordRE = /\p{L}+(?:['’]\p{L}+)*/gu;
const supported = new Set(['json','jsonc','plaintext','markdown']);
const findings = new Map(), revisions = new Map(), timers = new Map(), ignored = new Set();
const cache = new Map();
let diagnostics, red, blue, warningShown = false;
function setting(name, fallback) {return vscode.workspace.getConfiguration('faroese').get(name,fallback);}
function expand(s) {return String(s).replaceAll('${userHome}',os.homedir()).replace(/^~(?=\/)/,os.homedir());}
function run(executable,args,input,timeout=30000) {
  return new Promise((resolve,reject)=>{
    const child=spawn(expand(executable),args,{stdio:['pipe','pipe','pipe'],shell:false});
    let out='',err='',done=false;
    const timer=setTimeout(()=>child.kill(),timeout);
    child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
    child.stdout.on('data',s=>{out+=s;if(out.length>4e6)child.kill();});
    child.stderr.on('data',s=>{err+=s;if(err.length>1e5)child.kill();});
    child.on('error',e=>{if(!done){done=true;clearTimeout(timer);reject(e);}});
    child.on('close',code=>{if(done)return;done=true;clearTimeout(timer);code===0?resolve(out):reject(new Error(err||`Exit ${code}`));});
    child.stdin.on('error',()=>{});child.stdin.end(input||'');
  });
}
function tokens(doc) {
  const source=doc.getText(), result=[], max=setting('maxUniqueWords',300);
  let spans=[{text:source,offset:0}];
  if(doc.languageId==='json'||doc.languageId==='jsonc') {
    spans=[];
    // Only check unescaped JSON string values. Skips keys and avoids invalid offsets for escaped strings.
    const rx=/(?:"(?:\\.|[^"\\])*")\s*(:)?/g;let m;
    while((m=rx.exec(source))) {
      if(m[1])continue;
      const quoted=m[0].match(/^"(?:\\.|[^"\\])*"/)[0];
      if(quoted.includes('\\'))continue;
      spans.push({text:quoted.slice(1,-1),offset:m.index+1});
    }
  }
  const distinct=new Set();
  for(const span of spans) for(const m of span.text.matchAll(wordRE)) {
    const word=m[0],key=word;
    if(ignored.has(key))continue;
    if(!distinct.has(key) && distinct.size>=max)continue;
    distinct.add(key);
    const start=span.offset+m.index;
    result.push({word,key,range:new vscode.Range(doc.positionAt(start),doc.positionAt(start+word.length))});
  }
  return result;
}
async function hunspell(words) {
  if(!words.length)return new Map();
  // -l prints unknown words only; no fragile parsing of interactive Hunspell protocol.
  const output=await run(setting('hunspellPath','hunspell'),['-d',setting('dictionary','fo_FO'),'-l'],words.join('\n')+'\n');
  const bad=new Set(output.split(/\r?\n/).filter(Boolean));
  return new Map(words.map(w=>[w,!bad.has(w)]));
}
async function divvun(word) {
  const model=expand(setting('modelPath','${userHome}/AI/Faroese-Language-Tools/divvun/fo.bhfst'));
  const exe=expand(setting('divvunPath','${userHome}/.cargo/bin/divvunspell'));
  const cacheKey=exe+'|'+model+'|'+word;
  if(cache.has(cacheKey))return cache.get(cacheKey);
  const output=await run(exe,['suggest','--archive',model,'--json',word],'',20000);
  const item=JSON.parse(output).suggest?.[0];
  if(!item||typeof item.is_correct!=='boolean')throw new Error('Unexpected Divvun response');
  const value={correct:item.is_correct,suggestions:(item.suggestions||[]).map(s=>s.value).filter(s=>typeof s==='string' && s.toLocaleLowerCase()!==word.toLocaleLowerCase()).slice(0,6)};
  if(cache.size>10000)cache.clear();cache.set(cacheKey,value);
  return value;
}
function likelyOCR(word,suggestions) {
  const w=word.toLocaleLowerCase();
  return suggestions.some(s=>{
    const t=s.toLocaleLowerCase();if(t===w||t.length!==w.length)return false;
    let differences=0;
    for(let i=0;i<w.length;i++)if(w[i]!==t[i]) {
      differences++;
      if(!new Set(['d:ð','o:ø','a:á','i:í','u:ú','y:ý']).has(w[i]+':'+t[i]))return false;
    }
    return differences===1;
  });
}
function paint() {
  for(const editor of vscode.window.visibleTextEditors) {
    const fs=findings.get(editor.document.uri.toString())||[];
    editor.setDecorations(red,fs.filter(f=>f.red).map(f=>f.range));
    editor.setDecorations(blue,fs.filter(f=>!f.red).map(f=>f.range));
  }
}
async function check(doc) {
  if(!setting('enabled',true)||!supported.has(doc.languageId))return;
  const id=doc.uri.toString(),rev=(revisions.get(id)||0)+1;revisions.set(id,rev);
  const all=tokens(doc),words=[...new Set(all.map(t=>t.key))];
  let hs;
  try{hs=await hunspell(words);}catch(e){if(!warningShown){warningShown=true;vscode.window.showWarningMessage('Faroese Language Tools: Hunspell unavailable: '+e.message);}return;}
  if(revisions.get(id)!==rev)return;
  const uniqueRejected=words.filter(w=>!hs.get(w));
  const results=new Map();
  // Only run expensive Divvun checks for Hunspell rejections. Run sequentially to avoid memory spikes.
  for(const word of uniqueRejected) {
    if(revisions.get(id)!==rev)return;
    let result=null;
    if(setting('useDivvun',true))try{result=await divvun(word);}catch(e){if(!warningShown){warningShown=true;vscode.window.showWarningMessage('Faroese Language Tools: Divvun unavailable; uncertain words shown blue. '+e.message);}}
    results.set(word,result);
  }
  if(revisions.get(id)!==rev)return;
  const current=[],diags=[];
  for(const t of all) {
    if(hs.get(t.key))continue;
    const d=results.get(t.key);
    if(d?.correct===true)continue;
    const suggestions=d?.suggestions||[];
    const isRed=d?.correct===false && likelyOCR(t.word,suggestions);
    current.push({...t,red:isRed,suggestions});
    const diagnostic=new vscode.Diagnostic(t.range,isRed?'Likely Faroese OCR/spelling error':'Faroese spelling needs review',isRed?vscode.DiagnosticSeverity.Error:vscode.DiagnosticSeverity.Information);
    diagnostic.source='Faroese Language Tools';diagnostic.code=isRed?'likely-ocr':'review';
    if(suggestions.length)diagnostic.message+=' — suggestions: '+suggestions.slice(0,3).join(', ');
    diags.push(diagnostic);
  }
  findings.set(id,current);diagnostics.set(doc.uri,diags);paint();
}
function schedule(doc,delay=400) {
  if(!supported.has(doc.languageId))return;
  const key=doc.uri.toString(),old=timers.get(key);if(old)clearTimeout(old);
  // Invalidate an in-flight analysis immediately, not after debounce expires.
  revisions.set(key,(revisions.get(key)||0)+1);
  timers.set(key,setTimeout(()=>{timers.delete(key);void check(doc);},delay));
}
function activate(context) {
  diagnostics=vscode.languages.createDiagnosticCollection('faroese-language-tools');
  red=vscode.window.createTextEditorDecorationType({textDecoration:'underline wavy #e05252'});
  blue=vscode.window.createTextEditorDecorationType({textDecoration:'underline wavy #3989ed'});
  context.subscriptions.push(diagnostics,red,blue);
  context.subscriptions.push(vscode.commands.registerCommand('faroese.check',()=>{const d=vscode.window.activeTextEditor?.document;if(d)schedule(d,0);}));
  context.subscriptions.push(vscode.commands.registerCommand('faroese.ignore',(word,uri)=>{
    ignored.add(word.toLocaleLowerCase());const d=vscode.workspace.textDocuments.find(x=>x.uri.toString()===uri.toString());if(d)schedule(d,0);
  }));
  context.subscriptions.push(vscode.languages.registerCodeActionsProvider([...supported].map(language=>({language})),{
    provideCodeActions(document,range){
      const actions=[];
      for(const f of (findings.get(document.uri.toString())||[]).filter(x=>x.range.intersection(range)!==undefined).slice(0,3)) {
        for(const suggestion of f.suggestions.slice(0,5)) {
          const a=new vscode.CodeAction('Replace with “'+suggestion+'”',vscode.CodeActionKind.QuickFix);
          a.edit=new vscode.WorkspaceEdit();a.edit.replace(document.uri,f.range,suggestion);actions.push(a);
        }
        const a=new vscode.CodeAction('Ignore “'+f.word+'” for this session',vscode.CodeActionKind.QuickFix);
        a.command={command:'faroese.ignore',title:'Ignore word',arguments:[f.word,document.uri]};actions.push(a);
      }
      return actions;
    }
  },{providedCodeActionKinds:[vscode.CodeActionKind.QuickFix]}));
  context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(e=>{if(setting('checkOnType',true))schedule(e.document);}));
  context.subscriptions.push(vscode.workspace.onDidOpenTextDocument(d=>schedule(d,0)));
  context.subscriptions.push(vscode.window.onDidChangeVisibleTextEditors(paint));
  context.subscriptions.push(vscode.workspace.onDidCloseTextDocument(d=>{
    const key=d.uri.toString();clearTimeout(timers.get(key));timers.delete(key);findings.delete(key);revisions.delete(key);diagnostics.delete(d.uri);
  }));
  for(const d of vscode.workspace.textDocuments)schedule(d,0);
}
function deactivate(){for(const timer of timers.values())clearTimeout(timer);}
module.exports={activate,deactivate};
