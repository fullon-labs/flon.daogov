import {createHmac,randomBytes,timingSafeEqual} from 'node:crypto';
import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';

const enc=value=>Buffer.from(value).toString('base64url');
const dec=value=>Buffer.from(value,'base64url').toString();
const json=(res,status,body,headers={})=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...headers});res.end(JSON.stringify(body))};
const redirect=(res,url,headers={})=>{res.writeHead(302,{location:url,'cache-control':'no-store',...headers});res.end()};
const cookies=req=>Object.fromEntries(String(req.headers.cookie||'').split(';').map(v=>v.trim().split(/=(.*)/s)).filter(([k])=>k));
const safeEqual=(left,right)=>{const a=Buffer.from(left),b=Buffer.from(right);return a.length===b.length&&timingSafeEqual(a,b)};
const secret=(value,file)=>value||(file?readFileSync(file,'utf8').trim():'');

export function createCommunityServer(options={}){
  const config={
    clientId:options.clientId||secret(process.env.GITHUB_CLIENT_ID,process.env.GITHUB_CLIENT_ID_FILE),
    clientSecret:options.clientSecret||secret(process.env.GITHUB_CLIENT_SECRET,process.env.GITHUB_CLIENT_SECRET_FILE),
    sessionSecret:options.sessionSecret||secret(process.env.SESSION_SECRET,process.env.SESSION_SECRET_FILE),
    callbackUrl:options.callbackUrl||process.env.GITHUB_OAUTH_CALLBACK_URL||'https://daogov.flon.network/community-api/v1/auth/github/callback',
    cookieDomain:options.cookieDomain??process.env.SESSION_COOKIE_DOMAIN??'.flon.network',
    owner:options.owner||process.env.GITHUB_OWNER||'fullon-labs',
    repo:options.repo||process.env.GITHUB_REPO||'flon.daogov',
    category:options.category||process.env.GITHUB_DISCUSSION_CATEGORY||'General',
    allowedOrigins:new Set(options.allowedOrigins||String(process.env.ALLOWED_ORIGINS||'https://daogov.flon.network,https://daogov-t.flon.network').split(',').map(v=>v.trim()).filter(Boolean)),
    fetchImpl:options.fetchImpl||fetch,
    now:options.now||Date.now
  };
  for(const [key,value] of Object.entries({clientId:config.clientId,clientSecret:config.clientSecret,sessionSecret:config.sessionSecret}))if(!value)throw new Error(`Missing ${key}`);
  const sessions=new Map(),rates=new Map();
  const sign=value=>createHmac('sha256',config.sessionSecret).update(value).digest('base64url');
  const stateFor=returnTo=>{const payload=enc(JSON.stringify({returnTo,nonce:randomBytes(16).toString('hex'),expires:config.now()+600000}));return `${payload}.${sign(payload)}`};
  const parseState=value=>{const [payload,signature]=String(value||'').split('.');if(!payload||!signature||!safeEqual(signature,sign(payload)))throw new Error('Invalid OAuth state');const state=JSON.parse(dec(payload));if(state.expires<config.now())throw new Error('Expired OAuth state');return state};
  const cookieFor=id=>`dao_community_session=${id}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800${config.cookieDomain?`; Domain=${config.cookieDomain}`:''}`;
  const sessionFor=req=>sessions.get(cookies(req).dao_community_session);
  async function github(path,{token,method='GET',body,headers={}}={}){
    const response=await config.fetchImpl(`https://api.github.com${path}`,{method,headers:{accept:'application/vnd.github+json','content-type':'application/json','user-agent':'FullOn-DAO-Community-API','x-github-api-version':'2022-11-28',...(token?{authorization:`Bearer ${token}`}:{}) ,...headers},body:body?JSON.stringify(body):undefined});
    const result=await response.json().catch(()=>({}));if(!response.ok)throw Object.assign(new Error(result.message||`GitHub ${response.status}`),{status:response.status});return result;
  }
  async function graph(token,query,variables={}){const result=await github('/graphql',{token,method:'POST',body:{query,variables}});if(result.errors?.length)throw new Error(result.errors.map(v=>v.message).join('; '));return result.data}
  const validReturnTo=value=>{try{const url=new URL(value);return config.allowedOrigins.has(url.origin)?url.toString():[...config.allowedOrigins][0]}catch{return [...config.allowedOrigins][0]}};
  const originAllowed=req=>{const origin=req.headers.origin;return !origin||config.allowedOrigins.has(origin)};
  async function readBody(req){let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>12000)throw Object.assign(new Error('Request too large'),{status:413})}return JSON.parse(raw||'{}')}
  function rateLimit(session){const key=session.user.login,now=config.now(),entry=rates.get(key)||[];const current=entry.filter(time=>now-time<3600000);if(current.length>=10)throw Object.assign(new Error('Discussion creation rate limit exceeded'),{status:429});current.push(now);rates.set(key,current)}
  async function repository(token){return graph(token,`query($owner:String!,$repo:String!){repository(owner:$owner,name:$repo){id discussionCategories(first:50){nodes{id name}} discussions(first:30,orderBy:{field:UPDATED_AT,direction:DESC}){nodes{id number title bodyText url createdAt updatedAt author{login} comments{totalCount}}}}}`,{owner:config.owner,repo:config.repo})}
  const server=createServer(async(req,res)=>{
    try{
      const url=new URL(req.url,'http://community.local'),path=url.pathname.replace(/^\/community-api/,'');
      if(req.method==='GET'&&path==='/healthz')return json(res,200,{ok:true});
      if(req.method==='GET'&&path==='/v1/session'){const session=sessionFor(req);return json(res,200,session?{authenticated:true,user:session.user}:{authenticated:false})}
      if(req.method==='GET'&&path==='/v1/auth/github'){
        const returnTo=validReturnTo(url.searchParams.get('return_to')||'');
        const target=new URL('https://github.com/login/oauth/authorize');target.searchParams.set('client_id',config.clientId);target.searchParams.set('redirect_uri',config.callbackUrl);target.searchParams.set('scope','read:user public_repo');target.searchParams.set('state',stateFor(returnTo));return redirect(res,target.toString());
      }
      if(req.method==='GET'&&path==='/v1/auth/github/callback'){
        const state=parseState(url.searchParams.get('state')),code=url.searchParams.get('code');if(!code)throw Object.assign(new Error('Missing OAuth code'),{status:400});
        const tokenResponse=await config.fetchImpl('https://github.com/login/oauth/access_token',{method:'POST',headers:{accept:'application/json','content-type':'application/json','user-agent':'FullOn-DAO-Community-API'},body:JSON.stringify({client_id:config.clientId,client_secret:config.clientSecret,code,redirect_uri:config.callbackUrl})});
        const tokenData=await tokenResponse.json();if(!tokenResponse.ok||!tokenData.access_token)throw new Error(tokenData.error_description||'OAuth token exchange failed');
        const user=await github('/user',{token:tokenData.access_token});const id=randomBytes(32).toString('base64url');sessions.set(id,{token:tokenData.access_token,user:{login:user.login,avatar_url:user.avatar_url,html_url:user.html_url},createdAt:config.now()});return redirect(res,state.returnTo,{'set-cookie':cookieFor(id)});
      }
      if(req.method==='GET'&&path==='/v1/discussions'){
        const session=sessionFor(req);if(!session)return json(res,200,{items:[],authenticated:false});const data=await repository(session.token),items=data.repository.discussions.nodes.map(item=>({...item,comments:item.comments.totalCount,author:item.author?.login||''}));return json(res,200,{items});
      }
      if(req.method==='POST'&&path==='/v1/discussions'){
        if(!originAllowed(req))return json(res,403,{error:'Origin not allowed'});const session=sessionFor(req);if(!session)return json(res,401,{error:'GitHub sign-in required'});rateLimit(session);const body=await readBody(req),title=String(body.title||'').trim(),discussionBody=String(body.body||'').trim();if(title.length<3||title.length>120||discussionBody.length<10||discussionBody.length>10000)return json(res,422,{error:'Invalid discussion title or body'});
        const data=await repository(session.token),category=data.repository.discussionCategories.nodes.find(item=>item.name.toLowerCase()===config.category.toLowerCase());if(!category)throw new Error(`GitHub discussion category not found: ${config.category}`);
        const result=await graph(session.token,`mutation($repositoryId:ID!,$categoryId:ID!,$title:String!,$body:String!){createDiscussion(input:{repositoryId:$repositoryId,categoryId:$categoryId,title:$title,body:$body}){discussion{id number title bodyText url createdAt updatedAt author{login} comments{totalCount}}}}`,{repositoryId:data.repository.id,categoryId:category.id,title,body:discussionBody});const item=result.createDiscussion.discussion;return json(res,201,{...item,comments:item.comments.totalCount,author:item.author?.login||''});
      }
      return json(res,404,{error:'Not found'});
    }catch(error){console.error('[community-api]',error.message);return json(res,error.status||500,{error:error.status&&error.status<500?error.message:'Community service error'})}
  });
  return server;
}

if(process.argv[1]===new URL(import.meta.url).pathname){const port=Number(process.env.PORT||8789);createCommunityServer().listen(port,'0.0.0.0',()=>console.log(`community-api listening on ${port}`))}
