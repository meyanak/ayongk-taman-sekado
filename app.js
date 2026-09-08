/* Meyanak multi-user social network
   Backend: Supabase Auth + Postgres + Storage + RLS.
   Isi SUPABASE_URL dan SUPABASE_ANON_KEY sebelum deployment.
*/
const SUPABASE_URL = window.MEYANAK_SUPABASE_URL || "YOUR_SUPABASE_URL";
const SUPABASE_ANON_KEY = window.MEYANAK_SUPABASE_ANON_KEY || "YOUR_SUPABASE_ANON_KEY";
const configured = SUPABASE_URL.startsWith("https://") && !SUPABASE_URL.includes("YOUR_") && !SUPABASE_ANON_KEY.includes("YOUR_");
const db = configured ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

let state = { user:null, profile:null, posts:[], users:[], saved:new Set(), currentCommentPost:null, currentMessageUser:null, authMode:"login" };

const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
const initial = name => (name || "?").trim().charAt(0).toUpperCase() || "?";
function toast(msg){$("toast").textContent=msg;$("toast").classList.remove("hidden");setTimeout(()=>$("toast").classList.add("hidden"),3000);}
function requireAuth(){if(!state.user){openAuth();return false}return true}
function timeAgo(date){const sec=Math.max(0,(Date.now()-new Date(date).getTime())/1000);if(sec<60)return"baru saja";if(sec<3600)return`${Math.floor(sec/60)} mnt`;if(sec<86400)return`${Math.floor(sec/3600)} jam`;return`${Math.floor(sec/86400)} hari`}

async function init(){
  if(!configured){ $("loading").classList.add("hidden"); toast("Backend belum dikonfigurasi. Ikuti README untuk menghubungkan Supabase."); renderGuest(); return; }
  const {data:{session}} = await db.auth.getSession();
  await applySession(session);
  db.auth.onAuthStateChange(async (_event, session)=>{ await applySession(session); });
}
async function applySession(session){
  state.user = session?.user || null;
  if(state.user){
    await ensureProfile();
    await loadSaved();
    await loadPosts();
    await loadUsers();
    updateIdentity();
  } else {
    state.profile=null; state.posts=[]; state.users=[]; state.saved=new Set(); updateIdentity(); renderGuest();
  }
  $("loading").classList.add("hidden");
}
async function ensureProfile(){
  let {data:p,error} = await db.from("profiles").select("*").eq("id",state.user.id).maybeSingle();
  if(error) return console.error(error);
  if(!p){
    const name = state.user.user_metadata?.full_name || state.user.email.split("@")[0];
    const res = await db.from("profiles").insert({id:state.user.id,display_name:name,username:makeUsername(name,state.user.id)}).select().single();
    p=res.data;
  }
  state.profile=p;
}
function makeUsername(name,id){return (String(name).toLowerCase().replace(/[^a-z0-9]+/g,"").slice(0,18)||"user")+"_"+id.slice(0,6)}
function updateIdentity(){
  const p=state.profile, n=p?.display_name || "Tamu", i=initial(n);
  ["headerAvatar","sideAvatar","composerAvatar","modalAvatar"].forEach(id=>{if($(id))$(id).textContent=i});
  ["headerName","sideName","modalName"].forEach(id=>{if($(id))$(id).textContent=n});
}
function renderGuest(){
  $("posts").innerHTML=`<article class="card empty"><h3>Selamat datang di Meyanak</h3><p>Daftar atau masuk untuk membuat, menyimpan, menyukai, mengomentari, dan membagikan postingan.</p><button class="primary" onclick="openAuth()">Masuk / Daftar</button></article>`;
  $("emptyFeed").classList.add("hidden");
}
async function loadPosts(){
  const {data,error}=await db.from("posts").select("*,profiles!posts_author_id_fkey(id,display_name,username,avatar_url),likes(user_id),comments(count),saves(user_id)").order("created_at",{ascending:false}).limit(100);
  if(error){console.error(error);toast("Gagal memuat postingan.");return}
  state.posts=(data||[]).map(p=>({...p,liked:(p.likes||[]).some(x=>x.user_id===state.user.id),saved:(p.saves||[]).some(x=>x.user_id===state.user.id),like_count:(p.likes||[]).length,comment_count:p.comments?.[0]?.count||0}));
  renderPosts();
}
function renderPosts(list=state.posts){
  $("posts").innerHTML=list.map(p=>{
    const media=p.media_url ? (p.media_type==="video"?`<video class="post-media" src="${esc(p.media_url)}" controls preload="metadata"></video>`:`<img class="post-media" src="${esc(p.media_url)}" alt="${esc(p.media_alt||"Media postingan")}">`):"";
    const privateBadge=p.visibility==="private"?" · 🔒 Hanya saya":" · 🌐 Publik";
    return `<article class="card post" data-id="${p.id}">
      <div class="post-head"><span class="avatar">${esc(initial(p.profiles?.display_name))}</span><div><strong>${esc(p.profiles?.display_name||"Pengguna")}</strong><small>@${esc(p.profiles?.username||"user")} · ${timeAgo(p.created_at)}${privateBadge}</small></div>
      ${p.author_id===state.user?.id?`<button class="more" data-action="delete">⋯</button>`:""}</div>
      ${p.body?`<div class="post-body">${esc(p.body)}</div>`:""}${media}
      <div class="post-stats"><span>♥ ${p.like_count}</span><span>${p.comment_count} komentar</span></div>
      <div class="post-actions">
        <button class="${p.liked?"liked":""}" data-action="like">♥ Suka</button>
        <button data-action="comment">◯ Komentar</button>
        <button class="${p.saved?"saved":""}" data-action="save">🔖 Simpan</button>
        <button data-action="share">↗ Bagikan</button>
      </div>
    </article>`;
  }).join("");
  $("emptyFeed").classList.toggle("hidden",list.length!==0);
}
async function loadSaved(){
  const {data}=await db.from("saves").select("post_id").eq("user_id",state.user.id);
  state.saved=new Set((data||[]).map(x=>x.post_id));
}
async function loadUsers(){
  const {data}=await db.from("profiles").select("id,display_name,username,avatar_url,bio").neq("id",state.user.id).order("display_name").limit(100);
  state.users=data||[]; renderContacts();
}
function renderContacts(){
  $("contactList").innerHTML=state.users.slice(0,6).map(u=>`<div class="contact"><span class="avatar">${esc(initial(u.display_name))}</span><span>${esc(u.display_name)}</span></div>`).join("") || `<p class="muted">Belum ada pengguna lain.</p>`;
}
async function likePost(id){
  if(!requireAuth())return;
  const p=state.posts.find(x=>x.id===id); if(!p)return;
  if(p.liked){await db.from("likes").delete().eq("post_id",id).eq("user_id",state.user.id);p.liked=false;p.like_count=Math.max(0,p.like_count-1)}
  else{await db.from("likes").insert({post_id:id,user_id:state.user.id});p.liked=true;p.like_count++}
  renderPosts();
}
async function savePost(id){
  if(!requireAuth())return;
  const p=state.posts.find(x=>x.id===id); if(!p)return;
  if(p.saved){await db.from("saves").delete().eq("post_id",id).eq("user_id",state.user.id);p.saved=false;state.saved.delete(id)}
  else{await db.from("saves").insert({post_id:id,user_id:state.user.id});p.saved=true;state.saved.add(id)}
  renderPosts();
}
async function deletePost(id){
  const p=state.posts.find(x=>x.id===id); if(!p || p.author_id!==state.user.id)return;
  if(!confirm("Hapus postingan ini?"))return;
  const {error}=await db.from("posts").delete().eq("id",id);
  if(error){toast(error.message);return}
  if(p.media_path) await db.storage.from("media").remove([p.media_path]);
  state.posts=state.posts.filter(x=>x.id!==id);renderPosts();toast("Postingan dihapus.");
}
async function openComments(id){
  state.currentCommentPost=id; $("commentsModal").classList.remove("hidden"); $("commentsList").innerHTML="<p class='muted'>Memuat…</p>";
  const {data,error}=await db.from("comments").select("*,profiles(display_name)").eq("post_id",id).order("created_at");
  if(error){$("commentsList").innerHTML=`<p>${esc(error.message)}</p>`;return}
  $("commentsList").innerHTML=(data||[]).map(c=>`<div class="comment"><span class="avatar">${esc(initial(c.profiles?.display_name))}</span><div class="comment-body"><small><b>${esc(c.profiles?.display_name||"Pengguna")}</b> · ${timeAgo(c.created_at)}</small>${esc(c.body)}</div></div>`).join("") || "<p class='muted'>Belum ada komentar.</p>";
}
async function submitComment(e){
  e.preventDefault();if(!requireAuth())return;
  const body=$("commentText").value.trim();if(!body)return;
  const {error}=await db.from("comments").insert({post_id:state.currentCommentPost,user_id:state.user.id,body});
  if(error){toast(error.message);return}
  $("commentText").value="";await openComments(state.currentCommentPost);await loadPosts();
}
async function sharePost(id){
  const url=`${location.origin}${location.pathname}?post=${encodeURIComponent(id)}`;
  try{await navigator.clipboard.writeText(url);toast("Tautan postingan disalin.")}catch{prompt("Salin tautan ini:",url)}
}
async function uploadMedia(file){
  if(!file)return null;
  if(file.size>50*1024*1024)throw new Error("Ukuran media maksimal 50 MB.");
  const ext=(file.name.split(".").pop()||"bin").toLowerCase();
  const path=`${state.user.id}/${crypto.randomUUID()}.${ext}`;
  const {error}=await db.storage.from("media").upload(path,file,{upsert:false,contentType:file.type});
  if(error)throw error;
  const {data}=db.storage.from("media").getPublicUrl(path);
  return {url:data.publicUrl,path,type:file.type.startsWith("video/")?"video":"image"};
}
async function publish(){
  if(!requireAuth())return;
  const body=$("postText").value.trim(), file=$("mediaInput").files[0], visibility=$("postVisibility").value;
  if(!body && !file){toast("Tambahkan tulisan atau media.");return}
  $("publishBtn").disabled=true;$("publishBtn").textContent="Mengunggah…";
  try{
    let media=null;if(file)media=await uploadMedia(file);
    const {error}=await db.from("posts").insert({author_id:state.user.id,body:body||null,visibility,media_url:media?.url||null,media_path:media?.path||null,media_type:media?.type||null});
    if(error){if(media)await db.storage.from("media").remove([media.path]);throw error}
    closeModal("postModal");$("postText").value="";$("mediaInput").value="";$("uploadPreview").classList.add("hidden");await loadPosts();toast("Postingan dipublikasikan.");
  }catch(e){toast(e.message||"Gagal mempublikasikan.")}
  finally{$("publishBtn").disabled=false;$("publishBtn").textContent="Posting"}
}
function openAuth(){state.authMode="login";renderAuth();$("authModal").classList.remove("hidden")}
function renderAuth(){const signup=state.authMode==="signup";$("authTitle").textContent=signup?"Daftar ke Meyanak":"Masuk ke Meyanak";$("authSubmit").textContent=signup?"Daftar":"Masuk";$("authNameWrap").classList.toggle("hidden",!signup);$("authSwitchText").textContent=signup?"Sudah punya akun?":"Belum punya akun?";$("authSwitch").textContent=signup?"Masuk":"Daftar akun baru"}
async function submitAuth(e){
  e.preventDefault();
  if(!configured){toast("Konfigurasikan Supabase terlebih dahulu.");return}
  const email=$("authEmail").value.trim(),password=$("authPassword").value,name=$("authName").value.trim();
  let res;
  if(state.authMode==="signup")res=await db.auth.signUp({email,password,options:{data:{full_name:name||email.split("@")[0]}}});
  else res=await db.auth.signInWithPassword({email,password});
  if(res.error){toast(res.error.message);return}
  if(state.authMode==="signup" && !res.data.session)toast("Akun dibuat. Periksa email untuk konfirmasi, lalu masuk.");
  else closeModal("authModal");
}
function closeModal(id){$(id)?.classList.add("hidden")}
function showView(view){
  document.querySelectorAll(".nav-btn").forEach(n=>n.classList.toggle("active",n.dataset.view===view));
  if(view==="home"){$("homeView").classList.remove("hidden");$("genericView").classList.add("hidden");return}
  $("homeView").classList.add("hidden");$("genericView").classList.remove("hidden");
  if(view==="profile") renderProfile(); else if(view==="friends") renderFriends(); else if(view==="messages") renderMessages(); else if(view==="saved") renderSaved(); else renderGeneric(view);
}
function renderProfile(){const p=state.profile||{};$("genericView").innerHTML=`<h1>${esc(p.display_name||"Profil")}</h1><p class="muted">@${esc(p.username||"")} · ${esc(p.bio||"Belum ada bio.")}</p><div class="card" style="padding:16px;margin-top:16px"><b>Postingan Anda</b><p>${state.posts.filter(x=>x.author_id===state.user?.id).length} postingan terlihat di sesi ini.</p></div>`}
function renderFriends(){$("genericView").innerHTML=`<h1>Pengguna Meyanak</h1><p class="muted">Temukan pengguna lain dan kirim pesan privat.</p>`+(state.users.map(u=>`<div class="user-card"><span class="avatar">${esc(initial(u.display_name))}</span><div><b>${esc(u.display_name)}</b><small>@${esc(u.username||"")}</small></div><button class="small-btn" onclick="openMessage('${u.id}','${esc(u.display_name).replace(/'/g,"&#039;")}')">✉ Pesan</button></div>`).join("")||"<p>Belum ada pengguna lain.</p>")}
function renderSaved(){const list=state.posts.filter(p=>p.saved);$("genericView").innerHTML=`<h1>Tersimpan</h1><p class="muted">Postingan yang Anda simpan.</p>`;const holder=document.createElement("div");holder.innerHTML=list.map(p=>`<article class="card post"><b>${esc(p.profiles?.display_name||"Pengguna")}</b><div class="post-body">${esc(p.body||"")}</div></article>`).join("")||"<p class='muted'>Belum ada postingan tersimpan.</p>";$("genericView").append(holder)}
async function renderMessages(){if(!requireAuth())return;$("genericView").innerHTML=`<h1>Pesan privat</h1><p class="muted">Pilih pengguna dari menu Pengguna untuk memulai percakapan.</p>`}
function renderGeneric(view){const map={notifications:["Notifikasi","Aktivitas akun akan tampil di sini."],groups:["Komunitas","Ruang komunitas Meyanak dapat dikembangkan di modul berikutnya."]};const d=map[view]||["Meyanak","Ruang sosial untuk terhubung dan berbagi."];$("genericView").innerHTML=`<h1>${d[0]}</h1><p>${d[1]}</p>`}
function openMessage(userId,name){state.currentMessageUser=userId;$("messageTarget").textContent=`Kirim pesan kepada ${name}`;$("messageText").value="";$("messageModal").classList.remove("hidden")}
async function submitMessage(e){e.preventDefault();if(!requireAuth())return;const body=$("messageText").value.trim();if(!body)return;const {error}=await db.from("messages").insert({sender_id:state.user.id,receiver_id:state.currentMessageUser,body});if(error){toast(error.message);return}closeModal("messageModal");toast("Pesan terkirim.");showView("messages")}
function search(q){q=q.toLowerCase().trim();if(!q){renderPosts();return}renderPosts(state.posts.filter(p=>(p.body||"").toLowerCase().includes(q)||(p.profiles?.display_name||"").toLowerCase().includes(q)||(p.profiles?.username||"").toLowerCase().includes(q)))}

document.addEventListener("click",async e=>{
  const view=e.target.closest("[data-view]");if(view){showView(view.dataset.view);return}
  const close=e.target.closest("[data-close]");if(close){closeModal(close.dataset.close);return}
  const btn=e.target.closest("[data-action]");if(btn){
    const action=btn.dataset.action;
    if(action.startsWith("open-")){openComposer(action.replace("open-",""));return}
    const card=btn.closest(".post");const id=card?.dataset.id;if(id&&action==="like")likePost(id);if(id&&action==="save")savePost(id);if(id&&action==="comment")openComments(id);if(id&&action==="share")sharePost(id);if(id&&action==="delete")deletePost(id);
  }
});
$("openComposer").onclick=()=>openComposer();$("openComposer2").onclick=()=>openComposer();
function openComposer(){if(!requireAuth())return;updateIdentity();$("postModal").classList.remove("hidden");$("postText").focus()}
$("authSwitch").onclick=()=>{state.authMode=state.authMode==="login"?"signup":"login";renderAuth()};
$("authForm").onsubmit=submitAuth;$("publishBtn").onclick=publish;$("commentForm").onsubmit=submitComment;$("messageForm").onsubmit=submitMessage;
$("globalSearch").oninput=e=>search(e.target.value);
$("mediaInput").onchange=e=>{const f=e.target.files[0];if(!f){$("uploadPreview").classList.add("hidden");return}const url=URL.createObjectURL(f);$("uploadPreview").classList.remove("hidden");$("uploadPreview").innerHTML=f.type.startsWith("video/")?`<video src="${url}" controls></video>`:`<img src="${url}" alt="Pratinjau">`};
$("menuBtn").onclick=async()=>{if(!state.user){openAuth();return}if(confirm("Keluar dari Meyanak?")){await db.auth.signOut();showView("home")}};
$("brandBtn").onclick=()=>showView("home");
init();