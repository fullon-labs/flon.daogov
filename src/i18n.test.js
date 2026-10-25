import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

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
  const remaining=removeTranslatedText(htmlSource).replaceAll('中文','').replaceAll('文','');
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
