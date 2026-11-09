/* ShashiClicks — Book a Shoot configurator. Own code.
   2D-canvas compositor like the reference kit room: photo x frame colour x initials x label. */
(function(){
"use strict";
const SERVICES=["Maternity Photography","Newborn Photography","Infant / Toddler Photography","Kids Photography","Cake Smash","Sibling Photography","Family Photography","Event Photography","Wedding Photography","Pre-Post Wedding Photography","Fashion Portfolio Photography","Professional Headshot","Product Photography","Matrimony","UGC Shoot","Interior Walkthrough","Live Streaming"];
let service=SERVICES[0], place="Studio — Hafeezpet", frameColor="#C9A227";
const chips=document.getElementById("serviceChips");
SERVICES.forEach((s,i)=>{
  const b=document.createElement("button"); b.type="button"; b.textContent=s; if(i===0)b.classList.add("on");
  b.addEventListener("click",()=>{ service=s; chips.querySelectorAll("button").forEach(x=>x.classList.remove("on")); b.classList.add("on"); sync(); });
  chips.appendChild(b);
});
const placeChips=document.getElementById("placeChips");
placeChips.querySelectorAll("button").forEach(b=>b.addEventListener("click",()=>{
  place=b.textContent; placeChips.querySelectorAll("button").forEach(x=>x.classList.remove("on")); b.classList.add("on"); sync();
}));
document.querySelectorAll("#swatches button").forEach(b=>b.addEventListener("click",()=>{
  frameColor=b.dataset.color; document.querySelectorAll("#swatches button").forEach(x=>x.classList.remove("on")); b.classList.add("on"); draw();
}));
const $=id=>document.getElementById(id);
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
  /* frame in the chosen colour */
  ctx.strokeStyle=frameColor; ctx.lineWidth=10;
  ctx.strokeRect(28,28,W-56,H-56);
  ctx.lineWidth=2; ctx.strokeRect(48,48,W-96,H-96);
  /* initials monogram, bottom centre — same slot logic as the homepage tool */
  const names=$("kNames").value||$("kName").value||"Your Names";
  const ini=initialsOf(names);
  const cx=W/2, cy=H-Math.round(H*0.13), r=Math.round(Math.min(W,H)*0.082);
  ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2);
  ctx.fillStyle="rgba(13,10,7,.75)"; ctx.fill();
  ctx.lineWidth=3; ctx.strokeStyle=frameColor; ctx.stroke();
  ctx.fillStyle="#EDE4D2"; ctx.font="900 "+Math.round(r*0.92)+"px 'FK Screamer', Impact, sans-serif";
  ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText(ini,cx,cy+2);
  ctx.font="600 "+Math.round(H*0.027)+"px 'Geist Mono', monospace"; ctx.fillStyle=frameColor;
  ctx.fillText(service.toUpperCase(), cx, 92);
}
function fitKit(){
  const st=can.parentElement, w=st.clientWidth, h=st.clientHeight;
  if(w&&h&&(can.width!==w||can.height!==h)){ can.width=w; can.height=h; }
  draw();
}
window.addEventListener("resize",fitKit);
function sync(){
  $("rService").textContent=service;
  $("rNames").textContent=($("kNames").value||$("kName").value||"—");
  $("rDate").textContent=$("kDate").value||"To be discussed";
  $("rPlace").textContent=place;
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
