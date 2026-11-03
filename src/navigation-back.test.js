import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=fs.readFileSync(new URL('./app.js',import.meta.url),'utf8');
const body=source.slice(source.indexOf('const viewHistory=[];'),source.indexOf('function setNodeMode('));
test('back follows internal views without leaving the application',()=>{
  const views=['overview','nodes','mine'].map(name=>({dataset:{view:name},classList:{active:name==='overview',contains(){return this.active},toggle(_,value){this.active=value}}}));
  const sheet={hidden:true};let messages=0;
  const api=new Function('views','nav','window','sheet','closeSheet','showToast','setMobileVoteTab','refreshBPRecovery',`const currentLanguage='zh-CN';${body};return {showView,navigateBack}`)(views,[],{scrollTo(){},history:{back(){throw new Error('Must not navigate browser history')}}},sheet,()=>{sheet.hidden=true},()=>messages++,()=>{},()=>{});
  const active=()=>views.find(v=>v.classList.active).dataset.view;
  api.showView('nodes');api.showView('mine');
  sheet.hidden=false;api.navigateBack();assert.equal(sheet.hidden,true);assert.equal(active(),'mine');
  api.navigateBack();assert.equal(active(),'nodes');
  api.navigateBack();assert.equal(active(),'overview');
  api.navigateBack();assert.equal(active(),'overview');assert.equal(messages,1);
});
