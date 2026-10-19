const cfg=window.CHECKERS_DASHBOARD;
const $=id=>document.getElementById(id);
const msg=text=>{$("message").textContent=text;};
const storageKey="checkers_website_session";
const endpoint=cfg?.supabaseUrl?.replace(/\/$/,"")+"/functions/v1/checkers-website-auth";
let token=sessionStorage.getItem(storageKey);
if(!cfg?.supabaseUrl||!cfg?.supabaseAnonKey){msg("Dashboard configuration missing.");$("login").disabled=true;throw new Error("Missing config");}
async function api(body){
 const response=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json",apikey:cfg.supabaseAnonKey},body:JSON.stringify(body),cache:"no-store"});
 const data=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(data.error||"Request failed");
 return data;
}
function signedOut(message){
 token=null;sessionStorage.removeItem(storageKey);$("stats").hidden=true;$("logout").hidden=true;$("loginForm").hidden=false;$("asof").textContent="";msg(message);
}
async function refresh(){
 if(!token){signedOut("Sign in using your Checker’s Tool username and website password.");return;}
 try{
  msg("Verifying administrator access…");
  const data=await api({action:"stats",token});
  const values={accounts:data.accounts,openTickets:data.open_tickets,tickets:data.total_tickets,jobs:data.active_jobs};
  for(const [id,value] of Object.entries(values))$(id).textContent=Number(value??0).toLocaleString();
  $("stats").hidden=false;$("logout").hidden=false;$("loginForm").hidden=true;
  $("asof").textContent="Last refreshed: "+new Date(data.generated_at).toLocaleString();
  msg("Signed in. Administrator access verified.");
 }catch(error){signedOut(error.message);}
}
$("loginForm").addEventListener("submit",async event=>{
 event.preventDefault();if(!$("loginForm").reportValidity())return;
 $("login").disabled=true;msg("Signing in securely…");
 try{
  const data=await api({action:"login",username:$("email").value.trim(),password:$("password").value});
  token=data.token;sessionStorage.setItem(storageKey,token);$("password").value="";
  await refresh();
 }catch(error){msg("Sign-in failed: "+error.message);}
 finally{$("login").disabled=false;}
});
$("logout").addEventListener("click",async()=>{
 const old=token;signedOut("Signed out.");$("password").value="";
 if(old)try{await api({action:"logout",token:old});}catch{}
});
void refresh();
