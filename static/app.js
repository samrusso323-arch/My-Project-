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

// ---------------------------------------------------------------- SVG ---

function patternDefs(id, pattern, c1, c2){
  switch(pattern){
    case "hoops":
      return {
        defs:`<pattern id="${id}" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(90)">
                <rect width="10" height="10" fill="${c1}"/>
                <rect width="10" height="5" fill="${c2}"/>
              </pattern>`,
        fill:`url(#${id})`
      };
    case "stripes":
      return {
        defs:`<pattern id="${id}" width="8" height="8" patternUnits="userSpaceOnUse">
                <rect width="8" height="8" fill="${c1}"/>
                <rect width="4" height="8" fill="${c2}"/>
              </pattern>`,
        fill:`url(#${id})`
      };
    case "spots":
      return {
        defs:`<pattern id="${id}" width="9" height="9" patternUnits="userSpaceOnUse">
                <rect width="9" height="9" fill="${c1}"/>
                <circle cx="4.5" cy="4.5" r="2.1" fill="${c2}"/>
              </pattern>`,
        fill:`url(#${id})`
      };
    case "stars":
      return {
        defs:`<pattern id="${id}" width="12" height="12" patternUnits="userSpaceOnUse">
                <rect width="12" height="12" fill="${c1}"/>
                <path d="M6 1.5 L7.2 4.6 L10.5 4.8 L7.9 6.9 L8.8 10.1 L6 8.2 L3.2 10.1 L4.1 6.9 L1.5 4.8 L4.8 4.6 Z" fill="${c2}"/>
              </pattern>`,
        fill:`url(#${id})`
      };
    case "quarters":
      return {
        defs:`<pattern id="${id}" width="10" height="10" patternUnits="userSpaceOnUse">
                <rect width="10" height="10" fill="${c1}"/>
                <rect width="5" height="5" fill="${c2}"/>
                <rect x="5" y="5" width="5" height="5" fill="${c2}"/>
              </pattern>`,
        fill:`url(#${id})`
      };
    case "sash":
      return {
        defs:`<pattern id="${id}" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect width="14" height="14" fill="${c1}"/>
                <rect width="14" height="6" fill="${c2}"/>
              </pattern>`,
        fill:`url(#${id})`
      };
    default:
      return { defs:"", fill:c1 };
  }
}

function horseSVG(h){
  const pid = "pat-"+h.id;
  const body = h.horsecolor;
  let silkFill, capFill, defsMarkup;

  if(h.silk_filename){
    const imgId = "silkimg-"+h.id;
    const url = `/silks/${h.silk_filename}`;
    defsMarkup = `<pattern id="${imgId}" patternUnits="objectBoundingBox" patternContentUnits="objectBoundingBox" width="1" height="1">
                    <image href="${url}" x="0" y="0" width="1" height="1" preserveAspectRatio="xMidYMid slice"/>
                  </pattern>`;
    silkFill = `url(#${imgId})`;
    capFill = `url(#${imgId})`;
  } else {
    const p = patternDefs(pid, h.pattern, h.silk1, h.silk2);
    defsMarkup = p.defs;
    silkFill = p.fill;
    capFill = h.cap;
  }

  return `
  <svg class="horse-svg" viewBox="0 -12 260 150" xmlns="http://www.w3.org/2000/svg">
    <defs>${defsMarkup}</defs>
    <path d="M62 76 C44 70, 24 62, 6 44 C18 58, 26 68, 30 78 C40 74, 50 73, 62 76 Z" fill="${body}"/>
    <path d="M78 78 C62 90, 46 102, 32 116 C29 119, 32 123, 36 122 C50 108, 64 96, 82 84 Z" fill="${body}"/>
    <path d="M92 80 C82 92, 74 106, 68 122 C67 126, 71 128, 74 125 C82 110, 90 96, 98 84 Z" fill="${body}"/>
    <path d="M60 74
             C64 58, 80 48, 98 45
             C116 42, 132 41, 146 42
             C155 43, 160 48, 162 56
             C163 63, 160 70, 155 76
             C138 88, 114 90, 94 86
             C82 84, 72 80, 66 76
             C64 75, 62 75, 60 74 Z" fill="${body}"/>
    <path d="M152 70 C147 82, 143 96, 140 110 C139 114, 143 116, 146 113 C151 100, 156 87, 160 74 Z" fill="${body}"/>
    <path d="M158 54 C175 60, 192 68, 207 79 C210 82, 208 86, 204 84 C189 75, 174 67, 156 62 Z" fill="${body}"/>
    <path d="M148 40
             L165 28
             L182 18
             L200 10
             L216 7
             L233 15
             L226 21
             L208 22
             L192 28
             L176 36
             L154 46 Z" fill="${body}"/>
    <path d="M197 10 L195 -2 L206 6 Z" fill="${body}"/>
    <path d="M155 42 C146 37, 139 29, 134 19 C143 25, 151 31, 160 35 Z" fill="${body}"/>
    <path d="M124 34 C118 44, 113 58, 116 72 C117 76, 122 76, 124 72 C126 61, 130 51, 136 43 Z" fill="${capFill}"/>
    <path d="M114 18 C125 12, 138 14, 145 24 C151 33, 149 44, 139 50 C128 56, 116 52, 111 43 C107 34, 106 24, 114 18 Z" fill="${silkFill}"/>
    <path d="M128 22 C140 17, 151 10, 159 1 C163 4, 162 9, 158 13 C150 20, 141 25, 133 28 Z" fill="${silkFill}"/>
    <circle cx="124" cy="13" r="8" fill="${capFill}"/>
    <path d="M118 8 L131 5 L129 12 Z" fill="${capFill}"/>
  </svg>`;
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
        ${horseSVG(h)}
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
    document.getElementById("f-pattern").value = match.pattern;
    document.getElementById("f-silk1").value = match.silk1;
    document.getElementById("f-silk2").value = match.silk2;
    document.getElementById("f-cap").value = match.cap;
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
  document.getElementById("f-horsecolor").value = h.horsecolor;
  document.getElementById("f-pattern").value = h.pattern;
  document.getElementById("f-silk1").value = h.silk1;
  document.getElementById("f-silk2").value = h.silk2;
  document.getElementById("f-cap").value = h.cap;
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
  document.getElementById("f-horsecolor").value = "#1c1b17";
  document.getElementById("f-pattern").value = "solid";
  document.getElementById("f-silk1").value = "#0b6e4f";
  document.getElementById("f-silk2").value = "#ffffff";
  document.getElementById("f-cap").value = "#0b6e4f";
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
  const horseData = {
    name,
    horsecolor: document.getElementById("f-horsecolor").value,
    pattern: document.getElementById("f-pattern").value,
    silk1: document.getElementById("f-silk1").value,
    silk2: document.getElementById("f-silk2").value,
    cap: document.getElementById("f-cap").value,
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
  const entry = {...horse, col, position: existingIdx>=0 ? entries[existingIdx].position : entries.filter(h=>h.col===col).length};
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

document.getElementById("raceTitle").addEventListener("input", debounce(persistRace, 500));
document.getElementById("speedInput").addEventListener("input", debounce(persistRace, 500));

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
    entries: entries.map(e=>({horse_id:e.id, col:e.col, position:e.position}))
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
  await fetchHorses();
  await fetchSilks("");
  await fetchRaces();
  resetForm();
  render();
}

boot();
