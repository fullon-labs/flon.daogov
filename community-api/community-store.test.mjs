import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {CommunityStore} from './community-store.mjs';

test('community interaction state persists across service restarts',()=>{
  const directory=mkdtempSync(join(tmpdir(),'fullon-community-'));
  try{
    const file=join(directory,'state.json'),store=new CommunityStore({file});
    store.setVote('testnet','discussion','7','hellotoworld','up');
    store.setReaction('testnet','discussion','7','hellotoworld','HEART',true);
    const restored=new CommunityStore({file}).summary('testnet','discussion','7','hellotoworld');
    assert.deepEqual(restored.votes,{up:1,down:0});
    assert.deepEqual(restored.reactions,{HEART:1});
    assert.deepEqual(restored.viewer,{vote:'up',reactions:['HEART']});
  }finally{rmSync(directory,{recursive:true,force:true})}
});
