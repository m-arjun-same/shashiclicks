/* ShashiClicks — Book a Shoot (kit room). Own code.
   Reference kit-room pattern: sticky photo stage with the initials composited on the
   photo, form column with section rows, sticky summary with the booking deposit. */
(function(){
"use strict";
const SERVICES=["Maternity Photography","Newborn Photography","Infant / Toddler Photography","Kids Photography","Cake Smash","Sibling Photography","Family Photography","Event Photography","Wedding Photography","Pre-Post Wedding Photography","Fashion Portfolio Photography","Professional Headshot","Product Photography","Matrimony","UGC Shoot","Interior Walkthrough","Live Streaming"];
let service=SERVICES[0], place="Studio — Hafeezpet", frameColor="#C96F4A";
const $=id=>document.getElementById(id);
const chips=$("serviceChips");
SERVICES.forEach((s,i)=>{
  const b=document.createElement("button"); b.type="button"; b.textContent=s; if(i===0)b.classList.add("on");
  b.addEventListener("click",()=>{ service=s; chips.querySelectorAll("button").forEach(x=>x.classList.remove("on")); b.classList.add("on"); sync(); });
  chips.appendChild(b);
});
const placeChips=$("placeChips");
placeChips.querySelectorAll("button").forEach(b=>b.addEventListener("click",()=>{
  place=b.textContent; placeChips.querySelectorAll("button").forEach(x=>x.classList.remove("on")); b.classList.add("on"); sync();
}));
document.querySelectorAll("#swatches button").forEach(b=>b.addEventListener("click",()=>{
  frameColor=b.dataset.color; $("vColor").textContent=b.dataset.name;
  document.querySelectorAll("#swatches button").forEach(x=>x.classList.remove("on")); b.classList.add("on"); draw();
}));
function initialsOf(name){
  const parts=(name||"").trim().split(/\s+/).filter(Boolean);
  if(!parts.length) return "X";
  if(parts.length===1) return parts[0][0].toUpperCase();
  return (parts[0][0]+parts[parts.length-1][0]).toUpperCase();
}
const can=$("kitCanvas"), ctx=can.getContext("2d");
function draw(){
  const W=can.width, H=can.height; if(!W||!H) return;
  ctx.clearRect(0,0,W,H);
  /* initials drawn INTO the photo, vertical — same composite as the homepage tool */
  const names=$("kNames").value||$("kName").value||"";
  const ini=initialsOf(names||"Your Names");
  const x=W*0.88, y=H*0.66, fs=Math.round(H*0.085);
  ctx.save(); ctx.translate(x,y); ctx.rotate(-Math.PI/2);
  ctx.font="900 "+fs+"px 'FK Screamer', Impact, sans-serif";
  ctx.textAlign="center"; ctx.textBaseline="middle";
  ctx.shadowColor="rgba(0,0,0,.45)"; ctx.shadowBlur=10;
  ctx.fillStyle="#EDE4D2"; ctx.fillText(ini,0,0);
  ctx.font=(fs*0.34)+"px 'Caveat', cursive"; ctx.fillStyle=frameColor;
  ctx.fillText("framed by ShashiClicks",0,fs*0.78);
  ctx.restore();
}
function fitKit(){
  const st=can.parentElement, w=st.clientWidth, h=st.clientHeight;
  if(w&&h&&(can.width!==w||can.height!==h)){ can.width=w; can.height=h; }
  draw();
}
window.addEventListener("resize",fitKit);
function sync(){
  $("stageSvc").textContent=service;
  $("vService").textContent=service.replace(/ Photography$/,"");
  $("vPlace").textContent=place;
  $("sumLine").textContent=service+" — booking deposit";
  const names=$("kNames").value||$("kName").value||"";
  const ini=initialsOf(names||"Your Names");
  const prev=$("iniPreview");
  prev.textContent=ini;
  prev.classList.toggle("live", !!names.trim());
  draw();
}
["kName","kNames","kDate"].forEach(id=>$(id).addEventListener("input",sync));
function message(){
  const addons=[...document.querySelectorAll(".addon:checked")].map(x=>x.value);
  const lines=["Hello ShashiClicks, I would like to book a shoot.",
    "Service: "+service,
    "Name: "+($("kName").value||"—"),
    "Names to frame: "+($("kNames").value||"—"),
    "Phone: "+($("kPhone").value||"—"),
    "Email: "+($("kEmail").value||"—"),
    "Preferred date: "+($("kDate").value||"To be discussed"),
    "Place: "+place,
    "Add-ons: "+(addons.length?addons.join(", "):"None"),
    "Notes: "+($("kNotes").value||"—"),
    "I understand the booking deposit is ₹5,000, adjusted against my package."];
  return lines.join("\n");
}
$("sendWa").addEventListener("click",()=>{ window.open("https://wa.me/917032857077?text="+encodeURIComponent(message()),"_blank"); });
$("sendMail").addEventListener("click",()=>{ location.href="mailto:contact@shashiclicks.com?subject="+encodeURIComponent("Shoot booking — "+service)+"&body="+encodeURIComponent(message()); });
if(document.fonts&&document.fonts.ready) document.fonts.ready.then(fitKit);
fitKit();
sync();
})();
