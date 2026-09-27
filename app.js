/* GeoStudy Atlas */
const C = window.APP_CONFIG || {};
const HAS_DB = !!(C.SUPABASE_URL && C.SUPABASE_ANON_KEY);
const sb = HAS_DB ? window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY) : null;

const INDIA_URL = "https://cdn.jsdelivr.net/gh/udit-001/india-maps-data@main/geojson/india.geojson";
const INDIA_STATE_URL = name => "https://cdn.jsdelivr.net/gh/udit-001/india-maps-data@main/geojson/states/" + slug(name) + ".geojson";
const WORLD_URL = "https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson";

const stateNames = [
"Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Goa","Gujarat","Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala","Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana","Tripura","Uttarakhand","Uttar Pradesh","West Bengal","Andaman and Nicobar Islands","Chandigarh","Dadra & Nagar Haveli and Daman & Diu","Delhi","Jammu and Kashmir","Ladakh","Lakshadweep","Puducherry"
];
const regionInfo = {
  India:{capital:"New Delhi",hint:"Click a state to load its districts."},
  World:{hint:"Click a country to open its country-level study view."}
};

let map=null, layer=null, markerLayer=null, currentMode=null, currentPlace=null, notes=[];
let authMode="signin", session=null;

const $=id=>document.getElementById(id);
const slug=s=>s.toLowerCase().replace(/&/g,"and").replace(/[’']/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
function toast(msg){const t=$("toast");t.textContent=msg;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2300)}
function show(id){["homeView","mapView","searchView","studyView"].forEach(x=>$(x).classList.toggle("hidden",x!==id));$("backBtn").classList.toggle("hidden",id==="homeView")}
function setTitle(title,crumb){$("placeTitle").textContent=title;$("crumb").textContent=crumb}
function safe(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
function notesForRegion(region){return notes.filter(n=>!region || (n.region||"").toLowerCase().includes(region.toLowerCase()))}
function saveLocal(){localStorage.setItem("geostudy_notes",JSON.stringify(notes))}
function loadLocal(){try{notes=JSON.parse(localStorage.getItem("geostudy_notes")||"[]")}catch{notes=[]}}
async function loadNotes(){
  if(!HAS_DB){loadLocal();renderNotes();renderMarkers();return}
  if(!session){notes=[];renderNotes();return}
  const {data,error}=await sb.from("notes").select("*").order("updated_at",{ascending:false});
  if(error){toast("Database read failed");console.error(error);return}
  notes=data||[];renderNotes();renderMarkers();
}
async function upsertNote(n){
  if(!HAS_DB){if(n.id){notes=notes.map(x=>x.id===n.id?n:x)}else{n.id=crypto.randomUUID();notes.unshift(n)}saveLocal();return}
  const payload={...n,user_id:session.user.id};
  delete payload.created_at; delete payload.updated_at;
  const {data,error}=await sb.from("notes").upsert(payload).select().single();
  if(error) throw error;
  notes=notes.filter(x=>x.id!==data.id);notes.unshift(data);
}
async function deleteNote(id){
  if(!HAS_DB){notes=notes.filter(n=>n.id!==id);saveLocal();return}
  const {error}=await sb.from("notes").delete().eq("id",id);if(error)throw error;notes=notes.filter(n=>n.id!==id);
}
function initMap(){
  if(map)return;
  map=L.map("map",{zoomControl:true,worldCopyJump:false}).setView([20,78],4);
  // No paid basemap: OpenStreetMap standard tiles.
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:18,attribution:"© OpenStreetMap contributors"}).addTo(map);
  markerLayer=L.layerGroup().addTo(map);
}
function clearLayers(){if(layer){map.removeLayer(layer);layer=null}markerLayer.clearLayers()}
function styleFeature(){return {color:"#536074",weight:1,fillColor:"#dce4ff",fillOpacity:.72}}
function hover(e){e.target.setStyle({weight:2,color:"#315cf6",fillColor:"#bfcaff",fillOpacity:.85});e.target.bringToFront()}
function reset(e){layer.resetStyle(e.target)}
function getName(p){return p.name||p.NAME||p.NAME_1||p.st_nm||p.State_Name||p.district||p.DISTRICT||p.Dist_Name||"Unknown"}
async function openIndia(){
  currentMode="india";currentPlace="India";show("mapView");setTitle("India","INDIA");initMap();clearLayers();$("infoPanel").innerHTML="<h3>🇮🇳 India</h3><p>Click a state to open its district map. Add general India facts with +.</p>";$("listTitle").textContent="India notes";
  try{const geo=await fetch(INDIA_URL).then(r=>r.json());layer=L.geoJSON(geo,{style:styleFeature,onEachFeature:(f,l)=>{const n=getName(f.properties);l.bindTooltip(n);l.on({mouseover:hover,mouseout:reset,click:()=>openState(n)});}}).addTo(map);map.fitBounds(layer.getBounds(),{padding:[20,20]});renderNotes();renderMarkers()}catch(e){toast("India map failed to load");console.error(e)}
}
async function openState(name){
  currentMode="india-state";currentPlace=name;show("mapView");setTitle(name,"INDIA / STATE");initMap();clearLayers();$("infoPanel").innerHTML=`<h3>${safe(name)}</h3><p>District boundaries load for this state. Click a district or add a pinned fact.</p>`;$("listTitle").textContent=`${name} notes`;
  try{const geo=await fetch(INDIA_STATE_URL(name)).then(r=>{if(!r.ok)throw Error(r.status);return r.json()});layer=L.geoJSON(geo,{style:styleFeature,onEachFeature:(f,l)=>{const n=getName(f.properties);l.bindTooltip(n);l.on({mouseover:hover,mouseout:reset,click:()=>selectDistrict(n,name)});}}).addTo(map);map.fitBounds(layer.getBounds(),{padding:[25,25]});renderNotes();renderMarkers()}catch(e){toast("District map unavailable for this state");console.error(e)}
}
function selectDistrict(d,state){currentPlace=d; $("infoPanel").innerHTML=`<h3>${safe(d)}</h3><p><span class="tag">${safe(state)}</span></p><p>Add facts and map pins specifically for this district.</p>`;$("listTitle").textContent=`${d} notes`;renderNotes();renderMarkers()}
async function openWorld(){
  currentMode="world";currentPlace="World";show("mapView");setTitle("World","WORLD");initMap();clearLayers();$("infoPanel").innerHTML="<h3>🌍 World</h3><p>Click a country to open its study view. World detail is intentionally lighter than India.</p>";$("listTitle").textContent="World notes";
  try{const geo=await fetch(WORLD_URL).then(r=>r.json());layer=L.geoJSON(geo,{style:styleFeature,onEachFeature:(f,l)=>{const n=getName(f.properties);l.bindTooltip(n);l.on({mouseover:hover,mouseout:reset,click:()=>selectCountry(n)});}}).addTo(map);map.fitBounds(layer.getBounds(),{padding:[20,20]});renderNotes();renderMarkers()}catch(e){toast("World map failed to load");console.error(e)}
}
function selectCountry(n){currentPlace=n;$("infoPanel").innerHTML=`<h3>${safe(n)}</h3><p>Country-level study notes and optional pins.</p>`;$("listTitle").textContent=`${n} notes`;renderNotes();renderMarkers()}
function renderNotes(){
  const scope=currentPlace==="India"||currentPlace==="World"?currentPlace:currentPlace;
  let arr=notesForRegion(scope);
  // For state/district screens, include notes whose region contains the current place or parent state.
  if(currentMode==="india-state"&&currentPlace)arr=notes.filter(n=>(n.region||"").toLowerCase().includes(currentPlace.toLowerCase()) || (n.region||"").toLowerCase().includes($("placeTitle").textContent.toLowerCase()));
  if(currentMode==="world"&&currentPlace==="World")arr=notes.filter(n=>/world|global/i.test(n.region||""));
  $("notesList").innerHTML=arr.length?arr.map(n=>`<div class="note" data-id="${n.id}"><div class="note-title">${n.important?"⭐ ":""}${safe(n.title)}</div><div class="note-meta">${safe(n.category)} · ${safe(n.region||"Unspecified")}</div><div class="note-body">${safe(n.notes||"")}</div></div>`).join(""):"<p class='muted small'>No saved facts here yet. Use + to add one.</p>";
  document.querySelectorAll(".note").forEach(el=>el.onclick=()=>editNote(el.dataset.id));
}
function renderMarkers(){
  if(!markerLayer)return;markerLayer.clearLayers();
  const scoped=notes.filter(n=>Number.isFinite(n.lat)&&Number.isFinite(n.lng));
  scoped.forEach(n=>{const m=L.circleMarker([n.lat,n.lng],{radius:7,color:"#fff",weight:2,fillColor:"#315cf6",fillOpacity:1});m.bindPopup(`<b>${safe(n.title)}</b><br><small>${safe(n.category)}</small><br>${safe(n.notes||"")}<br><button onclick="editNote('${n.id}')">Edit</button>`);m.addTo(markerLayer)});
}
function openNote(note=null){
  $("noteDialog").showModal();$("dialogTitle").textContent=note?"Edit fact":"Add a fact";$("noteId").value=note?.id||"";$("fTitle").value=note?.title||"";$("fCategory").value=note?.category||"Other";$("fRegion").value=note?.region||((currentMode==="india-state")?$("placeTitle").textContent:(currentPlace!=="India"&&currentPlace!=="World"?currentPlace:""));$("fLat").value=note?.lat??"";$("fLng").value=note?.lng??"";$("fNotes").value=note?.notes||"";$("fImportant").checked=!!note?.important;$("deleteBtn").classList.toggle("hidden",!note)}
window.editNote=id=>openNote(notes.find(n=>n.id===id));
async function submitNote(e){e.preventDefault();const id=$("noteId").value||crypto.randomUUID();const old=notes.find(n=>n.id===id);const n={id,title:$("fTitle").value.trim(),category:$("fCategory").value,region:$("fRegion").value.trim(),lat:$("fLat").value===""?null:Number($("fLat").value),lng:$("fLng").value===""?null:Number($("fLng").value),notes:$("fNotes").value.trim(),important:$("fImportant").checked};try{await upsertNote(n);$("noteDialog").close();toast(old?"Fact updated":"Fact added");renderNotes();renderMarkers()}catch(e){toast("Could not save fact");console.error(e)}}
async function removeCurrent(){const id=$("noteId").value;if(!id)return;if(!confirm("Delete this fact?"))return;try{await deleteNote(id);$("noteDialog").close();toast("Deleted");renderNotes();renderMarkers()}catch(e){toast("Could not delete");}}
function globalSearch(){const q=$("globalSearch").value.toLowerCase().trim();const arr=notes.filter(n=>`${n.title} ${n.category} ${n.region} ${n.notes}`.toLowerCase().includes(q));$("searchResults").innerHTML=arr.map(n=>`<div class="result" data-id="${n.id}"><b>${n.important?"⭐ ":""}${safe(n.title)}</b><p>${safe(n.category)} · ${safe(n.region||"")}<br>${safe(n.notes||"")}</p></div>`).join("")||"<p class='muted'>No results.</p>";document.querySelectorAll(".result").forEach(x=>x.onclick=()=>editNote(x.dataset.id))}
function study(){show("studyView");const arr=notes.filter(n=>n.title&&n.notes);if(!arr.length){$("quiz").innerHTML="<p>No usable notes yet. Add some facts first.</p>";return}const n=arr[Math.floor(Math.random()*arr.length)];$("quiz").innerHTML=`<div class="page-card" style="box-shadow:none;border:1px solid var(--line)"><span class="eyebrow">${safe(n.category)}</span><h2>What do you remember about “${safe(n.title)}”?</h2><p id="answer" class="hidden">${safe(n.notes)}</p><button class="primary" onclick="document.getElementById('answer').classList.remove('hidden')">Show my note</button></div>`}
async function authSubmit(e){e.preventDefault();if(!HAS_DB){toast("Add Supabase config first");return}const email=$("authEmail").value,password=$("authPassword").value;const r=authMode==="signin"?await sb.auth.signInWithPassword({email,password}):await sb.auth.signUp({email,password});if(r.error){$("authMsg").textContent=r.error.message;return}if(authMode==="signup"){$("authMsg").textContent="Account created. If email confirmation is enabled, check your email."}else{$("authDialog").close();toast("Signed in");}}
async function initAuth(){if(!HAS_DB){$("authBtn").textContent="Local mode";return}const {data}=await sb.auth.getSession();session=data.session;if(session){$("authBtn").textContent="Sign out";await loadNotes()}sb.auth.onAuthStateChange(async(_,s)=>{session=s;$("authBtn").textContent=s?"Sign out":"Sign in";await loadNotes()})}
function goBack(){if(currentMode==="india-state"){openIndia();return}show("homeView");if(map){map.remove();map=null}}
document.querySelectorAll("[data-open]").forEach(b=>b.onclick=()=>b.dataset.open==="india"?openIndia():openWorld());
$("backBtn").onclick=goBack;$("searchBtn").onclick=()=>{show("searchView");globalSearch()};$("studyBtn").onclick=study;$("addBtn").onclick=()=>openNote();$("noteForm").addEventListener("submit",submitNote);$("cancelBtn").onclick=()=>$("noteDialog").close();$("closeDialog").onclick=()=>$("noteDialog").close();$("deleteBtn").onclick=removeCurrent;$("globalSearch").oninput=globalSearch;$("refreshNotes").onclick=loadNotes;
$("authBtn").onclick=async()=>{if(!HAS_DB){$("authDialog").showModal();$("authMsg").textContent="This build is in Local mode. Add Supabase values to config.js to enable shared accounts.";return}if(session){await sb.auth.signOut();toast("Signed out")}else{$("authDialog").showModal()}};
$("closeAuth").onclick=()=>$("authDialog").close();$("authForm").addEventListener("submit",authSubmit);$("authToggle").onclick=()=>{authMode=authMode==="signin"?"signup":"signin";$("authTitle").textContent=authMode==="signin"?"Sign in":"Create account";$("authForm button[type=submit]").textContent=authMode==="signin"?"Sign in":"Create account";$("authToggle").textContent=authMode==="signin"?"Create account":"I already have an account"};
loadLocal();initAuth();
