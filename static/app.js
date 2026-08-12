// Speed Map Builder — board logic + REST calls to the local Flask API.

let raceId = null;
let entries = [];           // current board: [{id, name, col, position, horsecolor, pattern, silk1, silk2, cap, namecolor, silk_filename}]
let editingHorseId = null;  // horse id currently being edited on the board, or null when adding
let pendingSilkFilename = null;

let horsesCache = [];       // all known horses, for autocomplete + autofill
let bulkUploaded = [];      // silks uploaded in the bulk-import modal, awaiting assignment

function uid(){ return Math.random().toString(36).slice(2,9); }

function escapeHtml(s){
  return s.replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function normalizeName(s){
  return (s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function debounce(fn, wait){
  let t;
  return (...args)=>{
    clearTimeout(t);
    t = setTimeout(()=>fn(...args), wait);
  };
}

// -------------------------------------------------------------- image ---

// pose id -> [leftFrac, topFrac] for the number-badge anchor, fetched from /api/poses
let poseMeta = {};
const DEFAULT_POSE = "pose1";

async function fetchPoses(){
  const res = await fetch("/api/poses");
  const poses = await res.json();
  poseMeta = {};
  poses.forEach(p=>{ poseMeta[p.id] = p.cloth_center_fraction; });
}

function horseImageUrl(h){
  const params = new URLSearchParams({
    pose: h.pose || DEFAULT_POSE,
    body: h.horsecolor,
    pattern: h.pattern,
    silk1: h.silk1,
    silk2: h.silk2,
  });
  if(h.silk_filename) params.set("silk", h.silk_filename);
  return `/render/horse.png?${params.toString()}`;
}

function horseCardMarkup(h){
  const [leftFrac, topFrac] = poseMeta[h.pose || DEFAULT_POSE] || [0.4, 0.35];
  const numberBadge = h.number
    ? `<div class="cloth-number" style="left:${(leftFrac*100).toFixed(2)}%; top:${(topFrac*100).toFixed(2)}%;">${escapeHtml(String(h.number))}</div>`
    : "";
  return `
    <div class="horse-art">
      <img class="horse-img" src="${horseImageUrl(h)}" alt="${escapeHtml(h.name)}">
      ${numberBadge}
    </div>`;
}

// -------------------------------------------------------------- board ---

function render(){
  ["back","mid","lead"].forEach(col=>{
    const el = document.getElementById("col-"+col);
    const list = entries.filter(h=>h.col===col);
    if(list.length===0){
      el.innerHTML = `<div class="empty-slot">No horses yet</div>`;
      return;
    }
    el.innerHTML = list.map(h=>`
      <div class="horse-card" data-id="${h.id}">
        <div class="horse-actions">
          <button class="icon-btn edit-btn" title="Edit">✎</button>
          <button class="icon-btn del-btn" title="Remove from race">✕</button>
        </div>
        <div class="horse-name" style="color:${h.namecolor}">${escapeHtml(h.name)}</div>
        ${horseCardMarkup(h)}
      </div>
    `).join("");
  });

  document.querySelectorAll(".edit-btn").forEach(btn=>{
    btn.onclick = (e)=>{
      const id = Number(e.target.closest(".horse-card").dataset.id);
      startEdit(id);
    };
  });
  document.querySelectorAll(".del-btn").forEach(btn=>{
    btn.onclick = (e)=>{
      const id = Number(e.target.closest(".horse-card").dataset.id);
      entries = entries.filter(h=>h.id!==id);
      if(editingHorseId===id) resetForm();
      persistRace();
      render();
    };
  });
}

// ----------------------------------------------------------- horses  ---

async function fetchHorses(){
  const res = await fetch("/api/horses");
  horsesCache = await res.json();
  const dl = document.getElementById("horseNames");
  dl.innerHTML = horsesCache.map(h=>`<option value="${escapeHtml(h.name)}">`).join("");
}

document.getElementById("f-name").addEventListener("blur", ()=>{
  const name = document.getElementById("f-name").value.trim();
  const hint = document.getElementById("nameHint");
  if(!name){ hint.textContent = ""; return; }
  const match = horsesCache.find(h=>normalizeName(h.name)===normalizeName(name));
  if(match){
    document.getElementById("f-horsecolor").value = match.horsecolor;
    document.getElementById("f-pose").value = match.pose || DEFAULT_POSE;
    document.getElementById("f-pattern").value = match.pattern;
    document.getElementById("f-silk1").value = match.silk1;
    document.getElementById("f-silk2").value = match.silk2;
    document.getElementById("f-namecolor").value = match.namecolor;
    pendingSilkFilename = match.silk_filename || null;
    if(pendingSilkFilename){
      document.getElementById("silkPreview").src = `/silks/${pendingSilkFilename}`;
      document.getElementById("silkPreviewWrap").classList.add("show");
    } else {
      document.getElementById("silkPreviewWrap").classList.remove("show");
    }
    hint.textContent = `Loaded existing profile for "${match.name}".`;
    renderSilkGrid(currentSilks);
  } else {
    hint.textContent = "";
  }
});

// ------------------------------------------------------------- silks ---

let currentSilks = [];

async function fetchSilks(q){
  const res = await fetch("/api/silks" + (q ? `?q=${encodeURIComponent(q)}` : ""));
  currentSilks = await res.json();
  renderSilkGrid(currentSilks);
}

function renderSilkGrid(list){
  const grid = document.getElementById("silkGrid");
  if(!list || list.length===0){
    grid.innerHTML = `<div class="lib-empty">Silks you upload will appear here for quick reuse.</div>`;
    return;
  }
  grid.innerHTML = list.map(s=>`
    <button type="button" class="silk-swatch ${pendingSilkFilename===s.filename ? 'selected':''}"
      data-filename="${s.filename}" title="${escapeHtml(s.horse_name || s.label || s.original_name)}">
      <img src="${s.url}" alt="silk swatch">
    </button>
  `).join("");
  grid.querySelectorAll(".silk-swatch").forEach(btn=>{
    btn.onclick = ()=>{
      pendingSilkFilename = btn.dataset.filename;
      document.getElementById("silkPreview").src = btn.querySelector("img").src;
      document.getElementById("silkPreviewWrap").classList.add("show");
      document.getElementById("f-silkimage").value = "";
      renderSilkGrid(currentSilks);
    };
  });
}

document.getElementById("silkSearch").addEventListener("input", debounce((e)=>{
  fetchSilks(e.target.value.trim());
}, 250));

document.getElementById("f-silkimage").addEventListener("change", async (e)=>{
  const file = e.target.files[0];
  if(!file) return;
  const fd = new FormData();
  fd.append("files", file);
  try{
    const res = await fetch("/api/silks/upload", {method:"POST", body:fd});
    const created = await res.json();
    if(created.length===0){ setStatus("Couldn't read that image — try another file."); return; }
    const silk = created[0];
    pendingSilkFilename = silk.filename;
    document.getElementById("silkPreview").src = silk.url;
    document.getElementById("silkPreviewWrap").classList.add("show");
    await fetchSilks(document.getElementById("silkSearch").value.trim());
  }catch(err){
    setStatus("Couldn't upload that image — try another file.");
  }
});

document.getElementById("removeSilkImg").addEventListener("click", ()=>{
  pendingSilkFilename = null;
  document.getElementById("f-silkimage").value = "";
  document.getElementById("silkPreviewWrap").classList.remove("show");
  renderSilkGrid(currentSilks);
});

// -------------------------------------------------------- add/edit ----

function startEdit(id){
  const h = entries.find(x=>x.id===id);
  if(!h) return;
  editingHorseId = id;
  document.getElementById("formTitle").textContent = "Edit Horse";
  document.getElementById("f-name").value = h.name;
  document.getElementById("f-col").value = h.col;
  document.getElementById("f-number").value = h.number || "";
  document.getElementById("f-horsecolor").value = h.horsecolor;
  document.getElementById("f-pose").value = h.pose || DEFAULT_POSE;
  document.getElementById("f-pattern").value = h.pattern;
  document.getElementById("f-silk1").value = h.silk1;
  document.getElementById("f-silk2").value = h.silk2;
  document.getElementById("f-namecolor").value = h.namecolor;
  document.getElementById("f-silkimage").value = "";
  document.getElementById("nameHint").textContent = "";
  pendingSilkFilename = h.silk_filename || null;
  if(h.silk_filename){
    document.getElementById("silkPreview").src = `/silks/${h.silk_filename}`;
    document.getElementById("silkPreviewWrap").classList.add("show");
  } else {
    document.getElementById("silkPreviewWrap").classList.remove("show");
  }
  document.getElementById("saveBtn").textContent = "Save Changes";
  document.getElementById("cancelEditBtn").style.display = "inline-block";
  renderSilkGrid(currentSilks);
  window.scrollTo({top: document.body.scrollHeight, behavior:"smooth"});
}

function resetForm(){
  editingHorseId = null;
  document.getElementById("formTitle").textContent = "Add a Horse";
  document.getElementById("f-name").value = "";
  document.getElementById("f-col").value = "lead";
  document.getElementById("f-number").value = "";
  document.getElementById("f-horsecolor").value = "#1c1b17";
  document.getElementById("f-pose").value = DEFAULT_POSE;
  document.getElementById("f-pattern").value = "solid";
  document.getElementById("f-silk1").value = "#0b6e4f";
  document.getElementById("f-silk2").value = "#ffffff";
  document.getElementById("f-namecolor").value = "#1c1b17";
  document.getElementById("f-silkimage").value = "";
  document.getElementById("nameHint").textContent = "";
  pendingSilkFilename = null;
  document.getElementById("silkPreviewWrap").classList.remove("show");
  document.getElementById("saveBtn").textContent = "Add Horse";
  document.getElementById("cancelEditBtn").style.display = "none";
  renderSilkGrid(currentSilks);
}

document.getElementById("saveBtn").onclick = async ()=>{
  const name = document.getElementById("f-name").value.trim();
  if(!name){
    setStatus("Give the horse a name first.");
    return;
  }
  const col = document.getElementById("f-col").value;
  const number = document.getElementById("f-number").value.trim() || null;
  const horseData = {
    name,
    horsecolor: document.getElementById("f-horsecolor").value,
    pose: document.getElementById("f-pose").value,
    pattern: document.getElementById("f-pattern").value,
    silk1: document.getElementById("f-silk1").value,
    silk2: document.getElementById("f-silk2").value,
    namecolor: document.getElementById("f-namecolor").value,
    silk_filename: pendingSilkFilename
  };

  const res = await fetch("/api/horses", {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body: JSON.stringify(horseData)
  });
  const horse = await res.json();
  if(!res.ok){
    setStatus(horse.error || "Couldn't save that horse.");
    return;
  }

  if(editingHorseId !== null && editingHorseId !== horse.id){
    entries = entries.filter(h=>h.id!==editingHorseId);
  }
  const existingIdx = entries.findIndex(h=>h.id===horse.id);
  const entry = {...horse, col, number, position: existingIdx>=0 ? entries[existingIdx].position : entries.filter(h=>h.col===col).length};
  if(existingIdx>=0){
    entries[existingIdx] = entry;
  } else {
    entries.push(entry);
  }

  setStatus(editingHorseId ? `Updated "${name}".` : `Added "${name}".`);
  resetForm();
  persistRace();
  render();
  fetchHorses();
};

document.getElementById("cancelEditBtn").onclick = resetForm;

document.getElementById("clearAllBtn").onclick = ()=>{
  if(confirm("Remove all horses from this race board? (Their saved profiles won't be deleted.)")){
    entries = [];
    resetForm();
    persistRace();
    render();
  }
};

let statusTimer;
function setStatus(msg){
  const el = document.getElementById("status");
  el.textContent = msg;
  clearTimeout(statusTimer);
  statusTimer = setTimeout(()=>{ el.textContent=""; }, 3000);
}

// --------------------------------------------------------- races ------

function setSaveIndicator(state){
  const el = document.getElementById("saveIndicator");
  el.className = "save-indicator" + (state ? " "+state : "");
  el.textContent = state==="saving" ? "Saving…" : state==="saved" ? "Saved" : "";
}

const persistRace = debounce(async ()=>{
  if(entries.length===0 && raceId===null) return;
  setSaveIndicator("saving");
  const payload = {
    title: document.getElementById("raceTitle").value,
    speed: document.getElementById("speedInput").value,
    entries: entries.map(e=>({horse_id:e.id, col:e.col, position:e.position, number:e.number||null}))
  };
  if(raceId===null){
    const res = await fetch("/api/races", {
      method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(payload)
    });
    const data = await res.json();
    raceId = data.id;
    await fetchRaces();
  } else {
    await fetch(`/api/races/${raceId}`, {
      method:"PUT", headers:{"Content-Type":"application/json"}, body: JSON.stringify(payload)
    });
    await fetchRaces();
  }
  setSaveIndicator("saved");
}, 300);

document.getElementById("raceTitle").addEventListener("input", debounce(persistRace, 500));
document.getElementById("speedInput").addEventListener("input", debounce(persistRace, 500));

async function fetchRaces(){
  const res = await fetch("/api/races");
  const races = await res.json();
  const sel = document.getElementById("raceSelect");
  const current = raceId;
  sel.innerHTML = `<option value="">— New Race —</option>` + races.map(r=>
    `<option value="${r.id}">${escapeHtml(r.title)} (${new Date(r.updated_at).toLocaleDateString()})</option>`
  ).join("");
  sel.value = current ? String(current) : "";
}

async function loadRace(id){
  const res = await fetch(`/api/races/${id}`);
  const data = await res.json();
  raceId = data.id;
  document.getElementById("raceTitle").value = data.title;
  document.getElementById("speedInput").value = data.speed || "";
  entries = data.entries.map(e=>({...e}));
  resetForm();
  render();
}

function newRace(){
  raceId = null;
  document.getElementById("raceTitle").value = "Predicted Speed Map – Race 1";
  document.getElementById("speedInput").value = "Good";
  entries = [];
  resetForm();
  render();
  setSaveIndicator("");
  document.getElementById("raceSelect").value = "";
}

document.getElementById("newRaceBtn").onclick = newRace;
document.getElementById("raceSelect").addEventListener("change", (e)=>{
  if(e.target.value) loadRace(Number(e.target.value));
  else newRace();
});

// ---------------------------------------------------- bulk import -----

const bulkModal = document.getElementById("bulkModal");

document.getElementById("bulkImportBtn").onclick = ()=>{
  bulkUploaded = [];
  document.getElementById("bulkAssignRows").innerHTML = "";
  document.getElementById("bulkConfirmBtn").style.display = "none";
  document.getElementById("bulkFileInput").value = "";
  document.getElementById("bulkStatus").textContent = "";
  bulkModal.classList.add("show");
};

document.getElementById("bulkCancelBtn").onclick = ()=>{
  bulkModal.classList.remove("show");
};

bulkModal.addEventListener("click", (e)=>{
  if(e.target===bulkModal) bulkModal.classList.remove("show");
});

document.getElementById("bulkFileInput").addEventListener("change", async (e)=>{
  const files = Array.from(e.target.files || []);
  if(files.length===0) return;
  const fd = new FormData();
  files.forEach(f=>fd.append("files", f));
  document.getElementById("bulkStatus").textContent = `Uploading ${files.length} file(s)…`;
  const res = await fetch("/api/silks/upload", {method:"POST", body:fd});
  bulkUploaded = await res.json();
  document.getElementById("bulkStatus").textContent = "";
  renderBulkAssignRows();
});

function renderBulkAssignRows(){
  const wrap = document.getElementById("bulkAssignRows");
  wrap.innerHTML = bulkUploaded.map(s=>{
    const match = horsesCache.find(h=>normalizeName(h.name)===normalizeName(s.label));
    const guess = match ? match.name : s.label;
    return `
      <div class="assign-row" data-silk-id="${s.id}">
        <img src="${s.url}" alt="">
        <input type="text" value="${escapeHtml(guess)}" list="horseNames">
        <span class="match-badge ${match ? 'existing':'new'}">${match ? 'Existing horse' : 'New horse'}</span>
      </div>`;
  }).join("");
  document.getElementById("bulkConfirmBtn").style.display = bulkUploaded.length ? "inline-block" : "none";
}

document.getElementById("bulkConfirmBtn").onclick = async ()=>{
  const rows = Array.from(document.querySelectorAll(".assign-row")).map(row=>({
    silk_id: Number(row.dataset.silkId),
    horse_name: row.querySelector("input").value.trim()
  })).filter(r=>r.horse_name);

  if(rows.length===0){
    document.getElementById("bulkStatus").textContent = "Give each silk a horse name first.";
    return;
  }

  const res = await fetch("/api/silks/bulk-assign", {
    method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(rows)
  });
  const results = await res.json();
  document.getElementById("bulkStatus").textContent = `Imported and matched ${results.length} silk(s).`;
  await fetchHorses();
  await fetchSilks(document.getElementById("silkSearch").value.trim());
  setTimeout(()=>{ bulkModal.classList.remove("show"); }, 900);
};

// ------------------------------------------------------------- boot ---

async function boot(){
  await fetchPoses();
  await fetchHorses();
  await fetchSilks("");
  await fetchRaces();
  resetForm();
  render();
}

boot();
