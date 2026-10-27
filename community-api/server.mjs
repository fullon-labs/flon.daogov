import {createSign} from 'node:crypto';
import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';

const json=(res,status,body)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(body))};
const secret=(value,file)=>value||(file?readFileSync(file,'utf8').trim():'');
const b64=value=>Buffer.from(JSON.stringify(value)).toString('base64url');

export function createCommunityServer(options={}){
  const config={
    botToken:options.botToken||secret(process.env.GITHUB_BOT_TOKEN,process.env.GITHUB_BOT_TOKEN_FILE),
    appId:options.appId||secret(process.env.GITHUB_APP_ID,process.env.GITHUB_APP_ID_FILE),
    installationId:options.installationId||secret(process.env.GITHUB_APP_INSTALLATION_ID,process.env.GITHUB_APP_INSTALLATION_ID_FILE),
    privateKey:options.privateKey||secret(process.env.GITHUB_APP_PRIVATE_KEY,process.env.GITHUB_APP_PRIVATE_KEY_FILE),
    owner:options.owner||process.env.GITHUB_OWNER||'fullon-labs',
    repo:options.repo||process.env.GITHUB_REPO||'flon.daogov',
    category:options.category||process.env.GITHUB_DISCUSSION_CATEGORY||'General',
    allowedOrigins:new Set(options.allowedOrigins||String(process.env.ALLOWED_ORIGINS||'https://daogov.flon.network,https://daogov-t.flon.network').split(',').map(value=>value.trim()).filter(Boolean)),
    fetchImpl:options.fetchImpl||fetch,
    now:options.now||Date.now
  };
  if(!config.botToken&&!(config.appId&&config.installationId&&config.privateKey))throw new Error('Missing GitHub bot credentials');
  const rates=new Map();let installationToken=null;
  async function github(path,{token,method='GET',body}={}){
    const response=await config.fetchImpl(`https://api.github.com${path}`,{method,headers:{accept:'application/vnd.github+json','content-type':'application/json','user-agent':'FullOn-DAO-Community-API','x-github-api-version':'2022-11-28',authorization:`Bearer ${token}`},body:body?JSON.stringify(body):undefined});
    const result=await response.json().catch(()=>({}));if(!response.ok)throw Object.assign(new Error(result.message||`GitHub ${response.status}`),{status:response.status});return result;
  }
  function appJwt(){const now=Math.floor(config.now()/1000),unsigned=`${b64({alg:'RS256',typ:'JWT'})}.${b64({iat:now-60,exp:now+540,iss:String(config.appId)})}`,signer=createSign('RSA-SHA256');signer.update(unsigned);return `${unsigned}.${signer.sign(config.privateKey,'base64url')}`}
  async function token(){
    if(config.botToken)return config.botToken;
    if(installationToken&&installationToken.expiresAt>config.now()+60000)return installationToken.value;
    const result=await github(`/app/installations/${config.installationId}/access_tokens`,{token:appJwt(),method:'POST'});installationToken={value:result.token,expiresAt:Date.parse(result.expires_at)};return installationToken.value;
  }
  async function graph(query,variables={}){const result=await github('/graphql',{token:await token(),method:'POST',body:{query,variables}});if(result.errors?.length)throw new Error(result.errors.map(value=>value.message).join('; '));return result.data}
  const originAllowed=req=>{const origin=req.headers.origin;return !origin||config.allowedOrigins.has(origin)};
  async function readBody(req){let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>12000)throw Object.assign(new Error('Request too large'),{status:413})}return JSON.parse(raw||'{}')}
  function rateLimit(key){const now=config.now(),entry=rates.get(key)||[],current=entry.filter(time=>now-time<3600000);if(current.length>=5)throw Object.assign(new Error('Discussion creation rate limit exceeded'),{status:429});current.push(now);rates.set(key,current)}
  async function repository(){return graph(`query($owner:String!,$repo:String!){repository(owner:$owner,name:$repo){id discussionCategories(first:50){nodes{id name}} discussions(first:30,orderBy:{field:UPDATED_AT,direction:DESC}){nodes{id number title bodyText url createdAt updatedAt author{login} comments{totalCount}}}}}`,{owner:config.owner,repo:config.repo})}
  const server=createServer(async(req,res)=>{
    try{
      const url=new URL(req.url,'http://community.local'),path=url.pathname.replace(/^\/community-api/,'');
      if(req.method==='GET'&&path==='/healthz')return json(res,200,{ok:true,mode:'dao-bot'});
      if(req.method==='GET'&&path==='/v1/session')return json(res,200,{authenticated:true,mode:'dao-bot'});
      if(req.method==='GET'&&path==='/v1/discussions'){
        const data=await repository(),items=data.repository.discussions.nodes.map(item=>({...item,comments:item.comments.totalCount,author:item.author?.login||''}));return json(res,200,{items,mode:'dao-bot'});
      }
      if(req.method==='POST'&&path==='/v1/discussions'){
        if(!originAllowed(req))return json(res,403,{error:'Origin not allowed'});const body=await readBody(req),title=String(body.title||'').trim(),discussionBody=String(body.body||'').trim(),actor=String(body.actor||'').trim();
        if(!/^[a-z1-5.]{1,12}$/.test(actor))return json(res,422,{error:'A connected FLON account is required'});if(title.length<3||title.length>120||discussionBody.length<10||discussionBody.length>10000)return json(res,422,{error:'Invalid discussion title or body'});rateLimit(`${req.socket.remoteAddress||'unknown'}:${actor}`);
        const data=await repository(),category=data.repository.discussionCategories.nodes.find(item=>item.name.toLowerCase()===config.category.toLowerCase());if(!category)throw new Error(`GitHub discussion category not found: ${config.category}`);
        const submittedBody=`${discussionBody}\n\n---\nSubmitted through FullOn DAO by FLON account \`${actor}\`.`;
        const result=await graph(`mutation($repositoryId:ID!,$categoryId:ID!,$title:String!,$body:String!){createDiscussion(input:{repositoryId:$repositoryId,categoryId:$categoryId,title:$title,body:$body}){discussion{id number title bodyText url createdAt updatedAt author{login} comments{totalCount}}}}`,{repositoryId:data.repository.id,categoryId:category.id,title,body:submittedBody});const item=result.createDiscussion.discussion;console.info(JSON.stringify({event:'discussion.created',actor,discussion:item.number,at:new Date(config.now()).toISOString()}));return json(res,201,{...item,comments:item.comments.totalCount,author:item.author?.login||''});
      }
      return json(res,404,{error:'Not found'});
    }catch(error){console.error('[community-api]',error.message);return json(res,error.status||500,{error:error.status&&error.status<500?error.message:'Community service error'})}
  });
  return server;
}

if(process.argv[1]===new URL(import.meta.url).pathname){const port=Number(process.env.PORT||8789);createCommunityServer().listen(port,'0.0.0.0',()=>console.log(`community-api listening on ${port}`))}
