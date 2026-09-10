/**
 * DLS Cotizador — Embed v2
 * ─────────────────────────────────────────────
 * INSTALACIÓN (sin acceso al servidor):
 *   1. Sube este archivo a tu hosting como "dls-cotizador-embed.js"
 *   2. Agrega ANTES de </body> en el HTML de tu sitio:
 *      <script src="dls-cotizador-embed.js"></script>
 *
 * O bien, pega el contenido directamente en un bloque <script>...</script>
 * ─────────────────────────────────────────────
 */
(function(){
  'use strict';

  /* ── MODAL CSS ── */
  const STYLE = `
    #dls-modal-bg{
      display:none;position:fixed;inset:0;z-index:99999;
      background:rgba(10,15,25,.75);backdrop-filter:blur(5px);
      align-items:center;justify-content:center;padding:0;
    }
    #dls-modal-bg.open{display:flex}
    #dls-modal{
      background:#EDECE8;border-radius:14px;
      width:min(980px,96vw);height:min(700px,94dvh);
      display:flex;flex-direction:column;
      box-shadow:0 28px 90px rgba(0,0,0,.5);
      overflow:hidden;
      animation:dlsUp .25s cubic-bezier(.2,.9,.3,1);
    }
    @keyframes dlsUp{from{opacity:0;transform:translateY(30px)}to{opacity:1;transform:translateY(0)}}
    #dls-modal-bar{
      background:#1B2A4A;display:flex;align-items:center;
      justify-content:space-between;padding:.5rem 1.125rem;flex-shrink:0;
    }
    #dls-modal-bar-lbl{
      font-family:'DM Serif Display',Georgia,serif;font-size:.95rem;
      color:#fff;letter-spacing:.01em;
    }
    #dls-modal-bar-lbl em{font-style:normal;color:#B0823C}
    #dls-modal-close{
      background:rgba(255,255,255,.12);border:none;color:#fff;
      width:30px;height:30px;border-radius:50%;cursor:pointer;
      font-size:1.1rem;display:flex;align-items:center;justify-content:center;
      transition:background .15s;line-height:1;
    }
    #dls-modal-close:hover{background:rgba(255,255,255,.28)}
    #dls-modal iframe{flex:1;border:none;width:100%;display:block}
    @media(max-width:600px){
      #dls-modal{width:100vw;height:100dvh;border-radius:0}
    }
  `;

  /* ── COTIZADOR HTML (self-contained) ── */
  const COTIZADOR_HTML = `<title>Cotizador DLS</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&display=swap" rel="stylesheet">

<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}

:root{
  --bg:#EDECE8; --surf:#F8F7F4; --surf-hi:#FFFFFF; --surf-lo:#E4E1DB;
  --navy:#1B2A4A; --navy-hv:#253A60; --on-navy:#FFFFFF;
  --gold:#B0823C; --gold-lo:#F2E8D8;
  --text:#1B2A4A; --text-2:#5A5448; --text-3:#9A9088;
  --border:#CCC9C2; --green:#1A7A3C; --green-lo:#E6F4EC; --red:#C0392B;
  --sh:0 2px 8px rgba(27,42,74,.08); --sh-md:0 6px 20px rgba(27,42,74,.12);
  --r:10px; --r-sm:6px;
}
@media(prefers-color-scheme:dark){
  :root:not([data-theme="light"]){
    --bg:#0D1420; --surf:#16202E; --surf-hi:#1E2C3E; --surf-lo:#09101A;
    --navy:#3A5E90; --navy-hv:#4A6EA0;
    --gold:#C89A50; --gold-lo:#281E10;
    --text:#E8E4DC; --text-2:#9AA4B4; --text-3:#5A6878;
    --border:#28384E; --green:#22A04A; --green-lo:#0A2018;
    --sh:0 2px 8px rgba(0,0,0,.35); --sh-md:0 6px 20px rgba(0,0,0,.45);
  }
}
:root[data-theme="dark"]{
  --bg:#0D1420; --surf:#16202E; --surf-hi:#1E2C3E; --surf-lo:#09101A;
  --navy:#3A5E90; --navy-hv:#4A6EA0;
  --gold:#C89A50; --gold-lo:#281E10;
  --text:#E8E4DC; --text-2:#9AA4B4; --text-3:#5A6878;
  --border:#28384E; --green:#22A04A; --green-lo:#0A2018;
  --sh:0 2px 8px rgba(0,0,0,.35); --sh-md:0 6px 20px rgba(0,0,0,.45);
}

body{font-family:'DM Sans',system-ui,sans-serif;background:var(--bg);color:var(--text);min-height:100vh;line-height:1.5;-webkit-font-smoothing:antialiased}

/* ── Header ── */
.hdr{background:var(--navy);color:var(--on-navy);padding:0 1.75rem;height:54px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100;box-shadow:var(--sh-md)}
.logo{font-family:'DM Serif Display',serif;font-size:1.1rem;display:flex;align-items:center;gap:.4rem}
.logo-g{color:var(--gold)}
.track{display:flex;align-items:center;gap:0}
.snode{width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:.72rem;font-weight:600;background:rgba(255,255,255,.15);color:rgba(255,255,255,.45);transition:all .2s}
.snode.done{background:var(--gold);color:#fff}
.snode.active{background:#fff;color:var(--navy)}
.sline{width:24px;height:2px;background:rgba(255,255,255,.2);transition:background .2s}
.sline.done{background:var(--gold)}

/* ── Mobile strip ── */
.mstrip{display:none;background:var(--surf);border-bottom:1px solid var(--border);padding:.625rem 1.25rem;align-items:center;justify-content:space-between}
.mstrip.on{display:flex}
.mstrip-lbl{font-size:.72rem;text-transform:uppercase;letter-spacing:.07em;color:var(--text-3)}
.mstrip-val{font-family:'DM Serif Display',serif;font-size:1.05rem;color:var(--gold)}

/* ── Layout ── */
.layout{display:grid;grid-template-columns:1fr 320px;min-height:calc(100vh - 54px);align-items:start}
.form-col{padding:2.25rem 2rem 5.5rem;max-width:600px}
.prev-col{border-left:1px solid var(--border);background:var(--surf);padding:1.75rem 1.375rem;position:sticky;top:54px;height:calc(100vh - 54px);overflow-y:auto}

/* ── Steps ── */
.step{display:none}
.step.on{display:block;animation:fade .2s ease}
@keyframes fade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
.stitle{font-family:'DM Serif Display',serif;font-size:1.55rem;text-wrap:balance;margin-bottom:.3rem}
.ssub{font-size:.875rem;color:var(--text-2);margin-bottom:1.625rem}

/* ── Type cards ── */
.tgrid{display:grid;grid-template-columns:1fr 1fr;gap:.75rem}
.tcard{border:2px solid var(--border);border-radius:var(--r);padding:1.125rem .9rem;cursor:pointer;background:var(--surf-hi);transition:all .15s;text-align:left;display:flex;flex-direction:column;gap:.5rem}
.tcard:hover,.tcard.sel{border-color:var(--gold);background:var(--gold-lo)}
.tcard.sel{box-shadow:0 0 0 3px rgba(176,130,60,.15)}
.ticon{width:38px;height:38px;background:var(--surf-lo);border-radius:var(--r-sm);display:flex;align-items:center;justify-content:center;color:var(--gold);transition:background .15s}
.tcard:hover .ticon,.tcard.sel .ticon{background:rgba(176,130,60,.14)}
.tname{font-weight:600;font-size:.9rem}
.tuf{font-size:.775rem;color:var(--text-3);font-variant-numeric:tabular-nums}

/* ── Form controls ── */
.fg{margin-bottom:1.375rem}
.flbl{display:block;font-size:.75rem;font-weight:600;text-transform:uppercase;letter-spacing:.07em;color:var(--text-3);margin-bottom:.45rem}
.m2row{display:flex;align-items:center;gap:.625rem}
input[type=range]{flex:1;-webkit-appearance:none;appearance:none;height:4px;border-radius:2px;background:var(--border);outline:none;cursor:pointer}
input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:20px;height:20px;border-radius:50%;background:var(--gold);cursor:pointer;transition:transform .15s}
input[type=range]::-webkit-slider-thumb:hover{transform:scale(1.15)}
input[type=range]::-moz-range-thumb{width:20px;height:20px;border-radius:50%;background:var(--gold);border:none;cursor:pointer}
.m2in{width:80px;padding:.45rem .625rem;border:2px solid var(--border);border-radius:var(--r-sm);background:var(--surf-hi);color:var(--text);font-family:inherit;font-size:.95rem;font-weight:600;text-align:center;transition:border-color .15s}
.m2in:focus{outline:none;border-color:var(--gold)}
.pills{display:flex;gap:.5rem;flex-wrap:wrap}
.pill{flex:1;min-width:88px;padding:.5rem .625rem;border:2px solid var(--border);border-radius:var(--r-sm);background:var(--surf-hi);cursor:pointer;text-align:center;transition:all .15s}
.pill:hover,.pill.on{border-color:var(--gold);background:var(--gold-lo)}
.pname{font-weight:600;font-size:.85rem;display:block;color:var(--text)}
.pdesc{font-size:.7rem;color:var(--text-3);display:block;margin-top:.15rem;line-height:1.35}
.tin{width:100%;padding:.575rem .875rem;border:2px solid var(--border);border-radius:var(--r-sm);background:var(--surf-hi);color:var(--text);font-family:inherit;font-size:.95rem;transition:border-color .15s}
.tin:focus{outline:none;border-color:var(--gold)}
.tin.err{border-color:var(--red)}
.ferr{font-size:.775rem;color:var(--red);margin-top:.275rem;display:none}
.ferr.on{display:block}

/* ── Nav bar ── */
.nav{position:fixed;bottom:0;left:0;right:0;background:var(--surf);border-top:1px solid var(--border);padding:.875rem 1.75rem;display:flex;justify-content:space-between;align-items:center;z-index:50;box-shadow:0 -3px 12px rgba(27,42,74,.06)}
.btn{display:inline-flex;align-items:center;gap:.4rem;padding:.6rem 1.375rem;border-radius:var(--r-sm);font-family:inherit;font-size:.875rem;font-weight:600;cursor:pointer;border:none;transition:all .15s}
.btn-ghost{background:transparent;color:var(--text-2);border:2px solid var(--border)}
.btn-ghost:hover{border-color:var(--text-2);color:var(--text)}
.btn-navy{background:var(--navy);color:#fff}
.btn-navy:hover{background:var(--navy-hv)}
.btn-navy:disabled{opacity:.4;cursor:not-allowed}
.btn-green{background:var(--green);color:#fff;font-size:.975rem;padding:.8rem 1.625rem;width:100%;justify-content:center}
.btn-green:hover{filter:brightness(1.08)}
.btn-email{background:var(--navy);color:#fff;font-size:.875rem;padding:.7rem 1.375rem;width:100%;justify-content:center}
.btn-email:hover{background:var(--navy-hv)}
.btn-plain{background:transparent;color:var(--text-3);border:1px solid var(--border);font-size:.825rem;width:100%;justify-content:center}
.btn-plain:hover{color:var(--text);border-color:var(--text-3)}

/* ── Live preview card ── */
.pcard{background:var(--surf-hi);border:1px solid var(--border);border-radius:var(--r);overflow:hidden;box-shadow:var(--sh)}
.phdr{background:var(--navy);padding:.875rem 1.125rem;display:flex;align-items:center;justify-content:space-between}
.phdr-lbl{font-size:.68rem;text-transform:uppercase;letter-spacing:.1em;color:rgba(255,255,255,.55)}
.phdr-num{font-size:.68rem;color:rgba(255,255,255,.4);font-variant-numeric:tabular-nums}
.pbody{padding:1.125rem}
.prow{display:flex;justify-content:space-between;align-items:baseline;padding:.425rem 0;border-bottom:1px solid var(--border);gap:.5rem}
.prow:last-of-type{border:none}
.pkey{font-size:.75rem;color:var(--text-3);text-transform:uppercase;letter-spacing:.05em;flex-shrink:0}
.pval{font-size:.875rem;font-weight:600;color:var(--text);text-align:right}
.pprice{margin-top:.875rem;padding:.875rem;background:var(--gold-lo);border-radius:var(--r-sm);text-align:center;border:1px solid rgba(176,130,60,.2)}
.pp-lbl{font-size:.67rem;text-transform:uppercase;letter-spacing:.1em;color:var(--text-3);margin-bottom:.4rem}
.pp-uf{font-family:'DM Serif Display',serif;font-size:1.6rem;color:var(--gold);font-variant-numeric:tabular-nums;line-height:1.15}
.pp-clp{font-size:.8rem;color:var(--text-2);margin-top:.2rem;font-variant-numeric:tabular-nums}
.pp-empty{font-size:.82rem;color:var(--text-3);font-style:italic}
.pnote{font-size:.7rem;color:var(--text-3);text-align:center;margin-top:.75rem;line-height:1.55}

/* ── Results ── */
.rhero{background:var(--gold-lo);border:1px solid rgba(176,130,60,.25);border-radius:var(--r);padding:1.75rem;text-align:center;margin-bottom:1.375rem}
.rlbl{font-size:.68rem;text-transform:uppercase;letter-spacing:.12em;color:var(--text-3);margin-bottom:.4rem}
.ruf{font-family:'DM Serif Display',serif;font-size:2.25rem;color:var(--gold);line-height:1.1;font-variant-numeric:tabular-nums}
.rclp{font-size:1rem;color:var(--text-2);margin-top:.35rem;font-variant-numeric:tabular-nums}
.rnote{font-size:.75rem;color:var(--text-3);margin-top:.75rem}
.rsum{background:var(--surf-hi);border:1px solid var(--border);border-radius:var(--r);overflow:hidden;margin-bottom:1.375rem}
.rsum-ttl{background:var(--surf-lo);padding:.5rem 1.125rem;font-size:.72rem;text-transform:uppercase;letter-spacing:.08em;color:var(--text-3);font-weight:600}
.srow{display:flex;justify-content:space-between;padding:.575rem 1.125rem;border-bottom:1px solid var(--border);gap:1rem}
.srow:last-child{border:none}
.sk{font-size:.85rem;color:var(--text-2)}
.sv{font-size:.85rem;font-weight:600;color:var(--text);text-align:right}
.ctas{display:flex;flex-direction:column;gap:.625rem;margin-top:1.5rem}
.qtext{font-family:'DM Serif Display',serif;font-size:1.2rem;text-wrap:balance;margin-bottom:.875rem}

/* ── Responsive ── */
@media(max-width:768px){
  .layout{grid-template-columns:1fr}
  .prev-col{display:none}
  .mstrip.on{display:flex}
  .form-col{padding:1.375rem .9rem 5rem;max-width:none}
  .tgrid{gap:.5rem}
  .nav{padding:.75rem .9rem}
}
@media(max-width:400px){
  .pills{flex-direction:column}
  .stitle{font-size:1.3rem}
}
</style>

<!-- Header -->
<header class="hdr">
  <div class="logo">DLS <span class="logo-g">Arquitectura</span></div>
  <div class="track" id="track"></div>
</header>

<!-- Mobile strip -->
<div class="mstrip" id="mstrip">
  <span class="mstrip-lbl">Estimado</span>
  <span class="mstrip-val" id="mstrip-val">—</span>
</div>

<div class="layout">
  <!-- FORM -->
  <div class="form-col">

    <!-- STEP 1 -->
    <section class="step" id="s1">
      <h1 class="stitle">¿Qué proyecto necesitas?</h1>
      <p class="ssub">Elige el tipo — el estimado se calcula al instante.</p>
      <div class="tgrid" id="tgrid"></div>
      <p style="font-size:.78rem;color:var(--text-3);margin-top:1rem;text-align:center">Elige un proyecto para continuar →</p>
    </section>

    <!-- STEP 2 -->
    <section class="step" id="s2">
      <h2 class="stitle">Cuéntanos más</h2>
      <p class="ssub">Ajusta los detalles para afinar el estimado.</p>

      <div class="fg">
        <label class="flbl" for="sl">Superficie a intervenir</label>
        <div class="m2row">
          <input type="range" id="sl" min="5" max="500" step="5" value="80">
          <input type="number" class="m2in" id="m2in" min="5" max="500" value="80" aria-label="m²">
          <span style="font-size:.875rem;color:var(--text-3);flex-shrink:0">m²</span>
        </div>
      </div>

      <div class="fg">
        <label class="flbl">Nivel de terminaciones</label>
        <div class="pills" id="cpills"></div>
      </div>

      <div class="fg">
        <label class="flbl" for="com">Comuna del proyecto</label>
        <input type="text" class="tin" id="com" placeholder="Ej: Las Condes, Vitacura, Ñuñoa…" list="cl" autocomplete="off">
        <datalist id="cl">
          <option value="Las Condes"><option value="Providencia"><option value="Vitacura">
          <option value="Ñuñoa"><option value="Santiago Centro"><option value="La Reina">
          <option value="Peñalolén"><option value="La Florida"><option value="Maipú">
          <option value="Lo Barnechea"><option value="San Miguel"><option value="Quilicura">
          <option value="Pudahuel"><option value="Macul"><option value="Estación Central">
        </datalist>
      </div>
    </section>

    <!-- STEP 3 -->
    <section class="step" id="s3">
      <h2 class="stitle">¿A quién le enviamos el presupuesto?</h2>
      <p class="ssub">Tus datos son confidenciales y solo se usan para contactarte.</p>

      <div class="fg">
        <label class="flbl" for="nom">Tu nombre</label>
        <input type="text" class="tin" id="nom" placeholder="Nombre y apellido" autocomplete="name">
        <p class="ferr" id="e-nom">Por favor ingresa tu nombre.</p>
      </div>
      <div class="fg">
        <label class="flbl" for="tel">WhatsApp / Teléfono</label>
        <input type="tel" class="tin" id="tel" placeholder="+56 9 1234 5678" autocomplete="tel">
        <p class="ferr" id="e-con">Ingresa al menos teléfono o email para poder contactarte.</p>
      </div>
      <div class="fg">
        <label class="flbl" for="ema">Email <span style="font-weight:400;text-transform:none;letter-spacing:0">(opcional)</span></label>
        <input type="email" class="tin" id="ema" placeholder="nombre@correo.cl" autocomplete="email">
      </div>
    </section>

    <!-- STEP 4: Results -->
    <section class="step" id="s4">
      <h2 class="stitle">Tu estimado DLS</h2>
      <div class="rhero">
        <div class="rlbl">Rango estimado del proyecto</div>
        <div class="ruf" id="ruf">—</div>
        <div class="rclp" id="rclp">—</div>
        <div class="rnote">Estimado ± 10 % • sujeto a visita técnica gratuita</div>
      </div>

      <div class="rsum" id="rsum"></div>

      <div class="qtext">¿Este rango se ajusta a lo que tienes disponible?</div>
      <div class="ctas">
        <button class="btn btn-green" id="bwa" onclick="doWA()">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
          Sí, me interesa — hablar con un experto
        </button>
        <button class="btn btn-email" onclick="doEmail()">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
          Solicitar presupuesto formal por email
        </button>
        <button class="btn btn-plain" onclick="reset()">← Hacer otro estimado</button>
      </div>

      <p style="font-size:.7rem;color:var(--text-3);text-align:center;margin-top:1.125rem;line-height:1.65">
        Visita técnica gratuita en Santiago Metropolitana.<br>
        Presupuesto formal en 48 hrs hábiles tras la visita.
      </p>
    </section>

  </div><!-- /form-col -->

  <!-- LIVE PREVIEW (desktop) -->
  <aside class="prev-col" aria-label="Estimado en vivo">
    <div class="pcard">
      <div class="phdr">
        <span class="phdr-lbl">DLS — Estimado</span>
        <span class="phdr-num" id="cnum">EST-HOY</span>
      </div>
      <div class="pbody">
        <div class="prow"><span class="pkey">Proyecto</span><span class="pval" id="ptipo">—</span></div>
        <div class="prow"><span class="pkey">Superficie</span><span class="pval" id="pm2">—</span></div>
        <div class="prow"><span class="pkey">Terminaciones</span><span class="pval" id="pcomp">—</span></div>
        <div class="prow"><span class="pkey">Comuna</span><span class="pval" id="pcom">—</span></div>
        <div class="pprice">
          <div class="pp-lbl">Rango estimado</div>
          <div id="ppval"><p class="pp-empty">Selecciona proyecto y m² para ver el estimado.</p></div>
        </div>
        <p class="pnote">UF hoy (<span id="ufdt"></span>): <strong>$<span id="ufv">37.500</span></strong><br>Estimado ± 10 % · Validez 15 días</p>
      </div>
    </div>
    <p style="font-size:.68rem;color:var(--text-3);text-align:center;margin-top:.875rem;line-height:1.65">DLS Arquitectura y Construcción<br>Remodelaciones — Santiago Metropolitana</p>
  </aside>
</div>

<!-- Nav bar (steps 2–3) -->
<nav class="nav" id="nav" style="display:none">
  <button class="btn btn-ghost" id="bback" onclick="goBack()">← Anterior</button>
  <button class="btn btn-navy" id="bnext" onclick="goNext()">Continuar →</button>
</nav>

<script>
/* ── CONFIG ── */
const T = {
  casa:    {label:'Casa / Dpto completo',   uf:19, icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>'},
  quincho: {label:'Quincho',                uf:28, icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M2 20h20"/><path d="M4 20V12"/><path d="M20 20V12"/><path d="M1 12l11-9 11 9"/><rect x="9" y="14" width="6" height="6"/></svg>'},
  cocina:  {label:'Cocina',                 uf:12, icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><circle cx="8" cy="10" r="1.5"/><circle cx="16" cy="10" r="1.5"/><circle cx="8" cy="16" r="1.5"/><circle cx="16" cy="16" r="1.5"/></svg>'},
  bano:    {label:'Baño',                   uf:14, icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h16a1 1 0 0 1 1 1v3a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4v-3a1 1 0 0 1 1-1z"/><path d="M6 12V5a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v1"/><line x1="4" y1="22" x2="4" y2="20"/><line x1="20" y1="22" x2="20" y2="20"/></svg>'},
  closet:  {label:'Walking Closet',         uf:8,  icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="18" rx="2"/><line x1="12" y1="3" x2="12" y2="21"/><line x1="7" y1="8" x2="9" y2="8"/><line x1="7" y1="12" x2="9" y2="12"/><line x1="15" y1="8" x2="17" y2="8"/><line x1="15" y1="12" x2="17" y2="12"/></svg>'},
  estac:   {label:'Estacionamiento',        uf:4,  icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="8" width="20" height="10" rx="3"/><path d="M6 8V6a6 6 0 0 1 12 0v2"/><circle cx="7.5" cy="17.5" r="1.5"/><circle cx="16.5" cy="17.5" r="1.5"/></svg>'}
};
const C = [
  {k:'simple',   lbl:'Simple',    f:0.90, d:'Terminaciones básicas'},
  {k:'estandar', lbl:'Estándar',  f:1.00, d:'Gama media, remodelación típica'},
  {k:'complejo', lbl:'Complejo',  f:1.15, d:'Materiales premium'}
];
let UF_CLP = 40885.63;         // fallback — se actualiza al cargar desde mindicador.cl
const WA_NUM = '56991380205';  // WhatsApp DLS (temporal — reemplazar con chip dedicado)
const EMAIL  = 'dls.lehmann@gmail.com';

/* ── STATE ── */
const S = {step:1,tipo:null,m2:80,comp:'estandar',com:'',nom:'',tel:'',ema:''};

/* ── CALC ── */
function calc(){
  if(!S.tipo||!S.m2) return null;
  const b = T[S.tipo].uf * S.m2 * C.find(c=>c.k===S.comp).f;
  return {minUF:+(b*.9).toFixed(1),maxUF:+(b*1.1).toFixed(1),minCLP:Math.round(b*.9*UF_CLP),maxCLP:Math.round(b*1.1*UF_CLP)};
}
const fUF  = n => n.toLocaleString('es-CL',{minimumFractionDigits:1,maximumFractionDigits:1})+' UF';
const fCLP = n => '$ '+n.toLocaleString('es-CL');

/* ── RENDER ── */
function renderTrack(){
  document.getElementById('track').innerHTML=[1,2,3,4].map((i,_,a)=>{
    const cls=i<S.step?'done':i===S.step?'active':'';
    return \`<div class="snode \${cls}">\${i<S.step?'✓':i}</div>\${i<4?\`<div class="sline \${i<S.step?'done':''}"></div>\`:''}\`
  }).join('');
}
function renderCards(){
  document.getElementById('tgrid').innerHTML=Object.entries(T).map(([k,v])=>\`
    <button class="tcard \${S.tipo===k?'sel':''}" onclick="pickTipo('\${k}')" aria-pressed="\${S.tipo===k}">
      <div class="ticon">\${v.icon}</div>
      <div class="tname">\${v.label}</div>
      <div class="tuf">\${v.uf} UF / m²</div>
    </button>\`).join('');
}
function renderPills(){
  document.getElementById('cpills').innerHTML=C.map(c=>\`
    <button class="pill \${S.comp===c.k?'on':''}" onclick="pickComp('\${c.k}')" aria-pressed="\${S.comp===c.k}">
      <span class="pname">\${c.lbl}</span><span class="pdesc">\${c.d}</span>
    </button>\`).join('');
}
function renderPreview(){
  const r=calc();
  document.getElementById('ptipo').textContent=S.tipo?T[S.tipo].label:'—';
  document.getElementById('pm2').textContent=S.m2?S.m2+' m²':'—';
  document.getElementById('pcomp').textContent=C.find(c=>c.k===S.comp)?.lbl||'—';
  document.getElementById('pcom').textContent=S.com||'—';
  const pv=document.getElementById('ppval');
  const ms=document.getElementById('mstrip');
  if(r){
    pv.innerHTML=\`<div class="pp-uf">\${fUF(r.minUF)} — \${fUF(r.maxUF)}</div><div class="pp-clp">\${fCLP(r.minCLP)} — \${fCLP(r.maxCLP)}</div>\`;
    ms.classList.add('on');
    document.getElementById('mstrip-val').textContent=fUF(r.minUF)+' – '+fUF(r.maxUF);
  } else {
    pv.innerHTML=\`<p class="pp-empty">Selecciona proyecto y m² para ver el estimado.</p>\`;
    ms.classList.remove('on');
  }
}
function renderResults(){
  const r=calc();
  if(!r) return;
  document.getElementById('ruf').textContent=fUF(r.minUF)+' — '+fUF(r.maxUF);
  document.getElementById('rclp').textContent=fCLP(r.minCLP)+' — '+fCLP(r.maxCLP);
  document.getElementById('rsum').innerHTML=\`
    <div class="rsum-ttl">Resumen del proyecto</div>
    <div class="srow"><span class="sk">Tipo</span><span class="sv">\${T[S.tipo].label}</span></div>
    <div class="srow"><span class="sk">Superficie</span><span class="sv">\${S.m2} m²</span></div>
    <div class="srow"><span class="sk">Terminaciones</span><span class="sv">\${C.find(c=>c.k===S.comp).lbl}</span></div>
    <div class="srow"><span class="sk">Comuna</span><span class="sv">\${S.com||'No indicada'}</span></div>
    <div class="srow"><span class="sk">Precio unitario</span><span class="sv">\${T[S.tipo].uf} UF/m²</span></div>
    <div class="srow"><span class="sk">Solicitado por</span><span class="sv">\${S.nom}</span></div>\`;
}
function renderNav(){
  const nav=document.getElementById('nav');
  const bb=document.getElementById('bback');
  const bn=document.getElementById('bnext');
  if(S.step===1||S.step===4){nav.style.display='none';return;}
  nav.style.display='flex';
  bb.style.visibility=S.step>1?'visible':'hidden';
  bn.textContent=S.step===3?'Ver mi estimado →':'Continuar →';
}
function showStep(n){
  document.querySelectorAll('.step').forEach(p=>p.classList.remove('on'));
  document.getElementById('s'+n).classList.add('on');
  window.scrollTo({top:0,behavior:'smooth'});
}
function render(){
  renderTrack();
  if(S.step===1) renderCards();
  if(S.step===2) renderPills();
  if(S.step===4) renderResults();
  renderPreview();
  renderNav();
  showStep(S.step);
}

/* ── ACTIONS ── */
function pickTipo(k){
  S.tipo=k; render();
  setTimeout(()=>{S.step=2;render();},200);
}
function pickComp(k){S.comp=k;renderPills();renderPreview();}

function goNext(){
  if(S.step===2){
    const v=Math.max(5,Math.min(500,parseInt(document.getElementById('m2in').value)||80));
    S.m2=v; S.com=document.getElementById('com').value.trim(); S.step=3;
  } else if(S.step===3){
    const n=document.getElementById('nom').value.trim();
    const t=document.getElementById('tel').value.trim();
    const e=document.getElementById('ema').value.trim();
    let ok=true;
    if(!n){document.getElementById('e-nom').classList.add('on');document.getElementById('nom').classList.add('err');ok=false;}
    else{document.getElementById('e-nom').classList.remove('on');document.getElementById('nom').classList.remove('err');}
    if(!t&&!e){document.getElementById('e-con').classList.add('on');document.getElementById('tel').classList.add('err');ok=false;}
    else{document.getElementById('e-con').classList.remove('on');document.getElementById('tel').classList.remove('err');}
    if(!ok) return;
    S.nom=n;S.tel=t;S.ema=e;S.step=4;
  }
  render();
}
function goBack(){if(S.step>1){S.step--;render();}}
function reset(){S.step=1;S.tipo=null;S.m2=80;S.comp='estandar';S.com='';S.nom='';S.tel='';S.ema='';render();}

/* ── WHATSAPP ── */
function doWA(){
  const r=calc();if(!r)return;
  const msg=[
    \`Hola DLS 👋 Hice una cotización en su sitio web.\`,\`\`,
    \`📋 *Mi proyecto:*\`,
    \`• Tipo: \${T[S.tipo].label}\`,
    \`• Superficie: \${S.m2} m²\`,
    \`• Terminaciones: \${C.find(c=>c.k===S.comp).lbl}\`,
    \`• Comuna: \${S.com||'No indicada'}\`,\`\`,
    \`💰 *Rango estimado:* \${fUF(r.minUF)} – \${fUF(r.maxUF)}\`,
    \`   Equivalente: \${fCLP(r.minCLP)} – \${fCLP(r.maxCLP)}\`,\`\`,
    \`Me interesa avanzar. ¿Podemos coordinar la visita técnica sin costo?\`,\`\`,
    \`*\${S.nom}* | \${S.tel||S.ema}\`
  ].join('\\n');
  window.open(\`https://wa.me/\${WA_NUM}?text=\${encodeURIComponent(msg)}\`,'_blank');
}

/* ── EMAIL ── */
function doEmail(){
  const r=calc();if(!r)return;
  const sub=encodeURIComponent(\`Solicitud presupuesto — \${T[S.tipo].label} \${S.m2}m² — \${S.nom}\`);
  const bod=encodeURIComponent([
    \`Estimado equipo DLS,\`,\`\`,
    \`Realicé una cotización en su sitio web y me interesa un presupuesto formal.\`,\`\`,
    \`PROYECTO\`,\`─────────────────\`,
    \`Tipo: \${T[S.tipo].label}\`,\`Superficie: \${S.m2} m²\`,
    \`Terminaciones: \${C.find(c=>c.k===S.comp).lbl}\`,\`Comuna: \${S.com||'No indicada'}\`,\`\`,
    \`ESTIMADO OBTENIDO\`,\`─────────────────\`,
    \`Rango: \${fUF(r.minUF)} – \${fUF(r.maxUF)}\`,
    \`CLP: \${fCLP(r.minCLP)} – \${fCLP(r.maxCLP)}\`,\`\`,
    \`MIS DATOS\`,\`─────────────────\`,
    \`Nombre: \${S.nom}\`,\`Teléfono: \${S.tel||'—'}\`,\`Email: \${S.ema||'(desde este correo)'}\`,\`\`,
    \`Quedo atento para coordinar la visita técnica.\`,\`\`,\`Saludos,\`,\`\${S.nom}\`
  ].join('\\n'));
  window.location.href=\`mailto:\${EMAIL}?subject=\${sub}&body=\${bod}\`;
}

/* ── SYNC sliders ── */
document.getElementById('sl').addEventListener('input',e=>{S.m2=+e.target.value;document.getElementById('m2in').value=S.m2;renderPreview();});
document.getElementById('m2in').addEventListener('input',e=>{const v=Math.max(5,Math.min(500,+e.target.value||5));S.m2=v;document.getElementById('sl').value=v;renderPreview();});

/* ── INIT ── */
const d=new Date();
document.getElementById('ufdt').textContent=d.toLocaleDateString('es-CL',{day:'2-digit',month:'2-digit',year:'numeric'});
document.getElementById('cnum').textContent='EST-'+d.toISOString().slice(0,10).replace(/-/g,'');
// Fetch UF del día desde mindicador.cl (API pública, sin key, CORS habilitado)
(async()=>{
  try{
    const res=await fetch('https://mindicador.cl/api/uf');
    const data=await res.json();
    if(data.serie&&data.serie[0]&&data.serie[0].valor){
      UF_CLP=Math.max(data.serie[0].valor, 40885.63); // piso DLS: nunca menor a $40.885,63
    }
  }catch(e){/* usa fallback 37500 si API no responde */}
  render();
})();
</script>
`;

  /* ── CREAR MODAL ── */
  function buildModal(){
    const el = document.createElement('style');
    el.textContent = STYLE;
    document.head.appendChild(el);

    const bg = document.createElement('div');
    bg.id = 'dls-modal-bg';
    bg.setAttribute('role','dialog');
    bg.setAttribute('aria-modal','true');
    bg.setAttribute('aria-label','Cotizador DLS');
    bg.innerHTML = `
      <div id="dls-modal">
        <div id="dls-modal-bar">
          <span id="dls-modal-bar-lbl">DLS <em>Arquitectura</em> — Cotizador</span>
          <button id="dls-modal-close" aria-label="Cerrar">✕</button>
        </div>
        <iframe id="dls-modal-iframe" title="Cotizador DLS" allow="popups"></iframe>
      </div>`;
    document.body.appendChild(bg);

    // Cerrar
    document.getElementById('dls-modal-close').addEventListener('click', closeModal);
    bg.addEventListener('click', e => { if(e.target === bg) closeModal(); });
    document.addEventListener('keydown', e => { if(e.key==='Escape') closeModal(); });
  }

  let modalReady = false;

  function openModal(){
    if(!modalReady){ buildModal(); modalReady = true; }
    const iframe = document.getElementById('dls-modal-iframe');
    if(!iframe.src && !iframe.srcdoc){
      // Embed cotizador via srcdoc (sin cross-origin, sin hosting externo)
      iframe.srcdoc = COTIZADOR_HTML;
    }
    document.getElementById('dls-modal-bg').classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeModal(){
    const bg = document.getElementById('dls-modal-bg');
    if(bg) bg.classList.remove('open');
    document.body.style.overflow = '';
  }

  /* ── INTERCEPT BOTÓN .quote-circle ── */
  function hookButtons(){
    const circle = document.querySelector('.quote-circle');
    if(circle){
      circle.style.cursor = 'pointer';
      circle.onclick = e => { e.preventDefault(); e.stopPropagation(); openModal(); };
    }
    // También el .btn-solid "Cotizar mi proyecto"
    document.querySelectorAll('.btn.btn-solid').forEach(btn => {
      if(/cotiz/i.test(btn.textContent)){
        btn.addEventListener('click', e => { e.preventDefault(); openModal(); });
      }
    });
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', hookButtons);
  } else {
    hookButtons();
  }

  // API global
  window.dlsCotizador = { open: openModal, close: closeModal };

})();
