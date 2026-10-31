import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const app=fs.readFileSync(new URL('./app.js',import.meta.url),'utf8');
const wallet=fs.readFileSync(new URL('./wallet.js',import.meta.url),'utf8');
const styles=fs.readFileSync(new URL('./styles.css',import.meta.url),'utf8');

test('desktop wallet entry opens QR directly only without a local extension',()=>{
  assert.match(html,/data-action="account" data-desktop-wallet-connect/);
  assert.match(app,/target\.hasAttribute\('data-desktop-wallet-connect'\)&&!walletSession&&!hasHuFuExtension\(\)\)await requestWalletConnection\(target,'anchor'\)/);
  assert.match(app,/walletSession=await connectWallet\(providerChoice\)/);
});

test('desktop wallet entry stays hidden below the desktop breakpoint',()=>{
  assert.match(styles,/\.desktop-wallet-button\{display:none\}/);
  assert.match(styles,/@media\(min-width:900px\)[\s\S]*\.desktop-wallet-button\{display:flex/);
});

test('connected wallet entry displays the account name instead of provider name',()=>{
  assert.match(app,/label=walletSession\?\.account\|\|'连接钱包'/);
  assert.doesNotMatch(app,/label=walletSession\?walletProviderName/);
});

test('app icon styles do not override the wallet transport QR code',()=>{
  assert.match(styles,/#app-frame svg\{width:24px;height:24px/);
  assert.doesNotMatch(styles,/(?:^|})svg\{width:24px;height:24px/);
});

test('unchecked BP vote controls do not display a checkmark',()=>{
  assert.match(styles,/\.check svg\{width:15px;opacity:0\}/);
  assert.match(styles,/\.check-control>input:checked\+\.check svg\{opacity:1\}/);
});

test('desktop Web lets users choose an installed extension or Anchor QR',()=>{
  const start=wallet.indexOf('export async function connectWallet');
  const end=wallet.indexOf('export function autoConnectHuFuWallet()',start);
  const branch=wallet.slice(start,end);

  assert.match(wallet,/export function hasHuFuExtension\(\)/);
  assert.match(app,/data-action="connect-wallet-hufu"/);
  assert.match(app,/data-action="connect-wallet-qr"/);
  assert.match(branch,/providerChoice==='hufu'/);
  assert.match(branch,/link\.login\(appId\(\),anchorDappInfo\(\)\)/);
});

test('Anchor QR metadata excludes transient query and callback fragments',()=>{
  assert.match(wallet,/function anchorDappInfo\(\)/);
  assert.match(wallet,/pageUrl\.search='';pageUrl\.hash=''/);
  assert.match(wallet,/return \[document\.title,icon,pageUrl\.href\]/);
});
