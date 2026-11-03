import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=fs.readFileSync(new URL('./app.js',import.meta.url),'utf8');
const body=source.slice(source.indexOf('function showToast('),source.indexOf('function isKeyboardField('));
function setup(hidden){
  const feedback={hidden:true,textContent:''},toast={hidden:true,textContent:''};
  let scheduled=0;
  const api=new Function('sheet','toast','clearTimeout','setTimeout',`let toastTimer;${body};return {showToast,clearSheetFeedback}`)({hidden,querySelector:()=>feedback},toast,()=>{},()=>{scheduled++});
  return {api,feedback,toast,scheduled:()=>scheduled};
}
test('dialog feedback stays within the modal and persists until cleared',()=>{
  const {api,feedback,toast,scheduled}=setup(false);
  api.showToast('Insufficient balance');
  assert.equal(feedback.textContent,'Insufficient balance');
  assert.equal(feedback.hidden,false);
  assert.equal(toast.hidden,true);
  assert.equal(scheduled(),0);
  api.showToast('Invalid account');
  assert.equal(feedback.textContent,'Invalid account');
  api.clearSheetFeedback();
  assert.equal(feedback.hidden,true);
  assert.equal(feedback.textContent,'');
});
test('outside a dialog notifications retain their timed behavior',()=>{
  const {api,feedback,toast,scheduled}=setup(true);
  api.showToast('Connected');
  assert.equal(toast.hidden,false);
  assert.equal(toast.textContent,'Connected');
  assert.equal(feedback.hidden,true);
  assert.equal(scheduled(),1);
});
