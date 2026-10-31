import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const app=fs.readFileSync(new URL('./app.js',import.meta.url),'utf8');
const styles=fs.readFileSync(new URL('./styles.css',import.meta.url),'utf8');

test('desktop wallet entry opens the wallet transport directly',()=>{
  assert.match(html,/data-action="account" data-desktop-wallet-connect/);
  assert.match(app,/target\.hasAttribute\('data-desktop-wallet-connect'\)&&!walletSession\)await requestWalletConnection\(target\)/);
  assert.match(app,/walletSession=await connectWallet\(\)/);
});

test('desktop wallet entry stays hidden below the desktop breakpoint',()=>{
  assert.match(styles,/\.desktop-wallet-button\{display:none\}/);
  assert.match(styles,/@media\(min-width:900px\)[\s\S]*\.desktop-wallet-button\{display:flex/);
});
