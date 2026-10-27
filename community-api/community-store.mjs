import {mkdirSync,readFileSync,renameSync,writeFileSync} from 'node:fs';
import {dirname} from 'node:path';

const EMPTY={version:1,subjects:{}};

export class CommunityStore{
  constructor({file='',initial}={}){
    this.file=file;
    this.state=initial?structuredClone(initial):this.load();
  }
  load(){
    if(!this.file)return structuredClone(EMPTY);
    try{return JSON.parse(readFileSync(this.file,'utf8'))}catch(error){
      if(error.code==='ENOENT')return structuredClone(EMPTY);
      throw error;
    }
  }
  save(){
    if(!this.file)return;
    mkdirSync(dirname(this.file),{recursive:true});
    const temporary=`${this.file}.${process.pid}.tmp`;
    writeFileSync(temporary,`${JSON.stringify(this.state,null,2)}\n`,{mode:0o600});
    renameSync(temporary,this.file);
  }
  key(network,kind,id){return `${network}:${kind}:${id}`}
  subject(network,kind,id){
    const key=this.key(network,kind,id);
    return this.state.subjects[key]||(this.state.subjects[key]={votes:{},reactions:{}});
  }
  summary(network,kind,id,actor=''){
    const subject=this.state.subjects[this.key(network,kind,id)]||{votes:{},reactions:{}};
    const votes=Object.values(subject.votes||{}),reactions={};
    for(const values of Object.values(subject.reactions||{}))for(const emoji of values)reactions[emoji]=(reactions[emoji]||0)+1;
    return {votes:{up:votes.filter(value=>value==='up').length,down:votes.filter(value=>value==='down').length},reactions,viewer:{vote:subject.votes?.[actor]||null,reactions:subject.reactions?.[actor]||[]}};
  }
  setVote(network,kind,id,actor,vote){
    const subject=this.subject(network,kind,id);
    if(vote)subject.votes[actor]=vote;else delete subject.votes[actor];
    this.save();return this.summary(network,kind,id,actor);
  }
  setReaction(network,kind,id,actor,emoji,active){
    const subject=this.subject(network,kind,id),values=new Set(subject.reactions[actor]||[]);
    if(active)values.add(emoji);else values.delete(emoji);
    if(values.size)subject.reactions[actor]=[...values];else delete subject.reactions[actor];
    this.save();return this.summary(network,kind,id,actor);
  }
}
