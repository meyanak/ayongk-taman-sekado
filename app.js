const posts = [
  {id:1,name:"Andi Pratama",initial:"A",time:"2 jam",text:"Hari ini saya belajar bahwa gagasan yang baik akan tumbuh ketika kita berani mendengarkan sudut pandang orang lain. Mari terus berdiskusi dan membangun ruang belajar yang sehat. 📚",likes:42,comments:8,liked:false},
  {id:2,name:"Salsa Putri",initial:"S",time:"5 jam",text:"Sedang menyusun rencana kegiatan komunitas untuk bulan ini. Ada yang punya ide kegiatan yang bisa melibatkan banyak pelajar?",likes:27,comments:5,liked:false},
  {id:3,name:"Raka Wijaya",initial:"R",time:"Kemarin",text:"Membaca bukan sekadar mengumpulkan pengetahuan. Kadang satu paragraf bisa mengubah cara kita melihat dunia.",likes:64,comments:12,liked:false}
];

const postsEl = document.getElementById("posts");
function renderPosts(list=posts){
  postsEl.innerHTML = list.map(p=>`
    <article class="card post" data-id="${p.id}">
      <div class="post-head">
        <span class="avatar">${p.initial}</span>
        <div><strong>${p.name}</strong><small>${p.time} · 🌐</small></div>
        <button class="more">⋯</button>
      </div>
      <div class="post-body">${escapeHtml(p.text)}</div>
      ${p.id===1 ? '<div class="post-art">MEYANAK</div>' : ''}
      <div class="post-stats"><span>♥ ${p.likes}</span><span>${p.comments} komentar · 3 dibagikan</span></div>
      <div class="post-actions">
        <button class="${p.liked?'liked':''}" data-action="like">♥ Suka</button>
        <button data-action="comment">◯ Komentar</button>
        <button data-action="share">↗ Bagikan</button>
      </div>
    </article>`).join("");
}
function escapeHtml(s){return s.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));}
renderPosts();

function openModal(){document.getElementById("postModal").classList.remove("hidden");document.getElementById("postText").focus();}
function closeModal(){document.getElementById("postModal").classList.add("hidden");}
document.getElementById("openComposer").onclick=openModal;
document.getElementById("closeModal").onclick=closeModal;
document.getElementById("postModal").addEventListener("click",e=>{if(e.target.id==="postModal")closeModal()});

document.getElementById("publishBtn").onclick=()=>{
  const text=document.getElementById("postText").value.trim();
  if(!text){alert("Tulis sesuatu terlebih dahulu.");return;}
  posts.unshift({id:Date.now(),name:"Dilan",initial:"D",time:"Baru saja",text,likes:0,comments:0,liked:false});
  renderPosts(); document.getElementById("postText").value=""; closeModal();
};

document.addEventListener("click",e=>{
  const btn=e.target.closest("[data-action]");
  if(!btn)return;
  const card=btn.closest(".post"); const p=card && posts.find(x=>x.id==card.dataset.id);
  if(!p)return;
  if(btn.dataset.action==="like"){p.liked=!p.liked;p.likes += p.liked?1:-1;renderPosts();}
  if(btn.dataset.action==="comment"){const msg=prompt("Tulis komentar:");if(msg){p.comments++;renderPosts();}}
  if(btn.dataset.action==="share"){navigator.clipboard?.writeText(location.href);alert("Postingan siap dibagikan.");}
});

function showView(view){
  const home=document.getElementById("homeView"), generic=document.getElementById("genericView");
  if(view==="home"){home.classList.remove("hidden");generic.classList.add("hidden");return;}
  home.classList.add("hidden");generic.classList.remove("hidden");
  const data={
    profile:["Profil Dilan","Kelola profil, foto, bio, dan aktivitas Anda."],
    friends:["Teman","Temukan orang baru dan kelola permintaan pertemanan."],
    groups:["Komunitas","Jelajahi komunitas berdasarkan minat, pelajaran, dan gagasan."],
    saved:["Tersimpan","Kumpulan postingan yang Anda simpan untuk dibaca kembali."],
    events:["Kegiatan","Temukan dan ikuti kegiatan komunitas di sekitar Anda."],
    market:["Jelajah","Temukan topik, komunitas, dan percakapan yang sedang berkembang."],
    notifications:["Notifikasi","3 notifikasi baru: permintaan pertemanan, komentar, dan aktivitas komunitas."]
  };
  const d=data[view]||["Meyanak","Ruang sosial untuk terhubung dan berbagi gagasan."];
  generic.innerHTML=`<h1>${d[0]}</h1><p>${d[1]}</p><div class="card" style="padding:18px;margin-top:20px"><b>Segera hadir</b><p>Modul ini sudah memiliki struktur navigasi dan siap dikembangkan dengan backend/API.</p></div>`;
}
document.querySelectorAll("[data-view]").forEach(el=>el.addEventListener("click",()=>{
  document.querySelectorAll(".nav-btn").forEach(n=>n.classList.toggle("active",n.dataset.view===el.dataset.view));
  showView(el.dataset.view);
}));
document.getElementById("globalSearch").addEventListener("input",e=>{
  const q=e.target.value.toLowerCase().trim();
  if(!q){renderPosts();return;}
  renderPosts(posts.filter(p=>(p.name+" "+p.text).toLowerCase().includes(q)));
});
document.querySelectorAll(".composer-actions button").forEach(b=>b.addEventListener("click",openModal));
document.getElementById("menuBtn").onclick=()=>alert("Menu akun: Profil · Pengaturan · Keluar");
