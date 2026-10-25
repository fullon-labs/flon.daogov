import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {generatedLocaleTerms} from './locales/index.js';

const appSource=fs.readFileSync(new URL('./app.js',import.meta.url),'utf8');
const htmlSource=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const han=/[\u3400-\u9fff]/;
const translationKeys=[...appSource.matchAll(/\['([^']*[\u3400-\u9fff][^']*)','[^']*'\]/g)]
  .map(match=>match[1])
  .sort((left,right)=>right.length-left.length);

function removeTranslatedText(value){
  let output=value;
  for(const key of translationKeys)output=output.split(key).join('');
  return output;
}

test('all static page copy is covered by the English dictionary',()=>{
  const withoutLanguageOptions=htmlSource.replace(/<div class="language-menu"[\s\S]*?<\/div>/,'');
  const remaining=removeTranslatedText(withoutLanguageOptions).replaceAll('中文','').replaceAll('文','');
  assert.equal(han.test(remaining),false,remaining.match(/[\u3400-\u9fff]+/g)?.join(', '));
});

test('all dynamically rendered copy is translated or explicitly bilingual',()=>{
  const dynamicSource=appSource.slice(appSource.indexOf('const sourceText='));
  const uncovered=dynamicSource.split('\n').filter(line=>{
    if(line.includes('currentLanguage')||line.includes('${zh?'))return false;
    return han.test(removeTranslatedText(line));
  });
  assert.deepEqual(uncovered,[]);
});

test('language selector is global and supports the configured locales',()=>{
  const topbar=htmlSource.match(/<header class="topbar">[\s\S]*?<\/header>/)?.[0]||'';
  const profile=htmlSource.match(/<section class="view" data-view="mine"[\s\S]*?<\/section>\s*<\/main>/)?.[0]||'';
  assert.match(topbar,/data-action="language-toggle"/);
  for(const locale of ['en','fr','ja','ko','es','zh-CN','zh-TW'])assert.match(topbar,new RegExp(`data-language-option="${locale}"`));
  assert.doesNotMatch(profile,/data-language(?:-option|-label|=)/);
});

test('every non-English locale covers all page vocabulary',()=>{
  const baseSource=appSource.slice(0,appSource.indexOf('const languageLabels='));
  const keys=[...new Set([...baseSource.matchAll(/\['([^']*[\u3400-\u9fff][^']*)','([^']+)'\]/g)].map(match=>match[2]))];
  for(const locale of ['fr','ja','ko','es','zh-TW']){
    const dictionary=generatedLocaleTerms[locale];
    assert.ok(dictionary,`${locale} locale dictionary was not found`);
    for(const key of keys){
      assert.equal(typeof dictionary[key],'string',`${locale} is missing ${key}`);
      assert.notEqual(dictionary[key].trim(),'');
    }
  }
});
