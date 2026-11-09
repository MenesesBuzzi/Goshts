import { LEAFLET_CSS, LEAFLET_JS } from "./leafletAssets";
import { MAX_Z, TILE_URL } from "./tiles";
import { AQUIDAUANA } from "../lib/geo";
import { C } from "../lib/theme";

/**
 * Página do mapa (Leaflet embutido, sem CDN). Fica salva em <documentos>/fantasma-map/map.html,
 * ao lado da pasta tiles/, então os tiles locais são lidos pelo caminho relativo tiles/z/x/y.png.
 * Tile local que faltar -> tenta o tile online do OSM.
 *
 * Mensagens:
 *   RN -> mapa: window.fantasmaUpdate({ me, pins, route, fit, events, heat }), window.fantasmaCenter(),
 *               // Foto do Ghost sem internet: troca pelo fantasminha
  document.addEventListener('error', function(ev){
    var t = ev.target;
    if (t && t.tagName === 'IMG' && t.dataset && t.dataset.fb && !t.dataset.tried) { t.dataset.tried = '1'; t.src = t.dataset.fb; }
  }, true);
  window.fantasmaFocus(lat, lng, raioM) e window.fantasmaSetMe(img, fallback)
 *   mapa -> RN: { type: "ready" } | { type: "tap", id } | { type: "tiles", local, online, failed }
 */
export function buildMapHtml(hasPack: boolean) {
  const cfg = { center: [AQUIDAUANA.lat, AQUIDAUANA.lng], hasPack, maxLocal: MAX_Z, online: TILE_URL, colors: C };
  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<style>${LEAFLET_CSS}</style>
<style>
html,body,#map{margin:0;padding:0;height:100%;width:100%;background:${C.bg};}
.leaflet-container{background:${C.bg};font-family:-apple-system,Roboto,sans-serif;}
/* tiles escurecidos para o tema fantasma */
.leaflet-tile-pane{filter:invert(1) hue-rotate(200deg) brightness(.9) contrast(.9) saturate(.6);}
.leaflet-control-attribution{background:rgba(11,11,20,.75)!important;color:${C.mut}!important;font-size:10px;}
.leaflet-control-attribution a{color:${C.ghost}!important;}
.pin{display:flex;align-items:center;justify-content:center;border-radius:50% 50% 50% 0;transform:rotate(-45deg);
  width:30px;height:30px;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.6);}
.pin span{transform:rotate(45deg);color:#fff;font-weight:800;font-size:13px;}
.me{width:38px;height:38px;border-radius:50%;background:${C.accent};border:3px solid #fff;display:flex;align-items:center;
  justify-content:center;font-size:20px;box-shadow:0 0 0 8px rgba(124,108,255,.25),0 2px 8px rgba(0,0,0,.6);}
.me img{width:100%;height:100%;object-fit:cover;border-radius:50%;}
.me.img{background:#1c1c33;padding:0;overflow:hidden;}
/* pedidos disponíveis esperando demais: anéis pulsando (estilo Pokémon Go) */
.pw{position:relative;width:30px;height:30px;}
.pw .ring{position:absolute;left:50%;top:50%;width:30px;height:30px;margin:-15px 0 0 -15px;border-radius:50%;
  border:3px solid var(--pc);background:var(--pf);opacity:0;animation:pulse var(--pd) ease-out infinite;pointer-events:none;}
.pw .ring.r2{animation-delay:calc(var(--pd) / 3);}
.pw .ring.r3{animation-delay:calc(var(--pd) * 2 / 3);}
.pw .pin{position:relative;animation:wobble var(--pd) ease-in-out infinite;}
.pw.l1{--pc:#ffb74d;--pf:rgba(255,183,77,.18);--pd:2.2s;--ps:2.6;}
.pw.l2{--pc:#ff8a50;--pf:rgba(255,138,80,.22);--pd:1.5s;--ps:3.2;}
.pw.l3{--pc:#ff4f6d;--pf:rgba(255,79,109,.28);--pd:.95s;--ps:3.9;}
@keyframes pulse{0%{transform:scale(.6);opacity:.95;}100%{transform:scale(var(--ps));opacity:0;}}
@keyframes wobble{0%,100%{transform:rotate(-45deg) scale(1);}50%{transform:rotate(-45deg) scale(1.14);}}
.wait{position:absolute;left:22px;top:-8px;background:#ff4f6d;color:#fff;font:800 10px/1 -apple-system,Roboto,sans-serif;
  padding:3px 5px;border-radius:8px;border:1.5px solid #fff;white-space:nowrap;}
.pw.l1 .wait{background:#e69526;} .pw.l2 .wait{background:#ff6f3c;}
/* eventos */
.evlabel{background:rgba(20,20,37,.92)!important;border:1px solid #ffd166!important;color:#fff!important;border-radius:10px!important;
  font-weight:800;font-size:12px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,.5)!important;padding:4px 8px!important;}
.evlabel b{color:#ffd166;display:block;font-size:11px;}
.evlabel:before{display:none!important;}
/* áreas de mais saída: círculos borrados = mancha de calor suave */
.leaflet-heat-pane{filter:blur(14px);opacity:.75;}
.store{width:30px;height:30px;border-radius:8px;background:#7b2cbf;border:2px solid #fff;display:flex;align-items:center;justify-content:center;font-size:16px;}
</style></head><body><div id="map"></div>
<script>${LEAFLET_JS}</script>
<script>
(function(){
  var CFG = ${JSON.stringify(cfg)};
  function post(m){ try{ window.ReactNativeWebView.postMessage(JSON.stringify(m)); }catch(e){} }
  var map = L.map('map', { zoomControl:false, attributionControl:true, maxZoom:19, minZoom:11 }).setView(CFG.center, 14);
  var stats = { local:0, online:0, failed:0 };
  var OfflineFirst = L.TileLayer.extend({
    createTile: function(c, done){
      var t = document.createElement('img'); t.alt=''; t.setAttribute('role','presentation');
      var online = CFG.online.replace('{z}',c.z).replace('{x}',c.x).replace('{y}',c.y);
      var useLocal = CFG.hasPack && c.z <= CFG.maxLocal, fell = !useLocal;
      t.onload = function(){ fell ? stats.online++ : stats.local++; done(null, t); };
      t.onerror = function(){
        if (!fell) { fell = true; t.src = online; }
        else { stats.failed++; done(new Error('tile'), t); }
      };
      t.src = useLocal ? ('tiles/'+c.z+'/'+c.x+'/'+c.y+'.png') : online;
      return t;
    }
  });
  new OfflineFirst('', {
    maxZoom: 19,
    maxNativeZoom: CFG.hasPack ? CFG.maxLocal : 19,   // com mapa baixado, zoom maior amplia o 16 (funciona sem internet)
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(map);
  setInterval(function(){ post({ type:'tiles', local:stats.local, online:stats.online, failed:stats.failed }); }, 5000);

  map.createPane('heat'); map.getPane('heat').classList.add('leaflet-heat-pane'); map.getPane('heat').style.zIndex = 350; map.getPane('heat').style.pointerEvents = 'none';
  map.createPane('events'); map.getPane('events').style.zIndex = 380;
  var heatLayer = L.layerGroup().addTo(map), eventLayer = L.layerGroup().addTo(map), heatKey = '', eventKey = '';
  var meMarker = null, meHtml = '<div class="me">👻</div>', pinLayer = L.layerGroup().addTo(map), pinMap = {}, routeLine = null, routeHalo = null, routeDash = null, following = false, lastMe = null, firstFit = true;
  // Arrastou o mapa com o dedo: sai do modo seguir
  map.on('dragstart', function(){ if (following) { following = false; post({ type:'follow', on:false }); } });
  function icon(html, size){ return L.divIcon({ className:'', html:html, iconSize:[size,size], iconAnchor:[size/2,size] }); }
  function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(ch){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch];}); }

  window.fantasmaUpdate = function(d){
    if (d.me) {
      lastMe = [d.me.lat, d.me.lng];
      if (!meMarker) meMarker = L.marker(lastMe, { icon: meIcon(), zIndexOffset:1000 }).addTo(map);
      else meMarker.setLatLng(lastMe);
    }
    // Pinos: atualiza no lugar (pelo id) para a animação de pulso não reiniciar a cada atualização
    var seen = {};
    (d.pins||[]).forEach(function(p){
      seen[p.id] = true;
      var pin = '<div class="pin" style="background:'+(p.kind==='avail'?CFG.colors.avail:CFG.colors.pin)+'"><span>'+esc(p.n)+'</span></div>';
      var html = p.kind==='store' ? '<div class="store">🏪</div>'
        : (p.kind==='avail' && p.pulse > 0)
          ? '<div class="pw l'+Math.min(3,p.pulse)+'"><i class="ring"></i><i class="ring r2"></i><i class="ring r3"></i>'+pin+'<span class="wait">'+esc(p.wait)+' min</span></div>'
          : pin;
      var cur = pinMap[p.id];
      if (!cur) {
        var m = L.marker([p.lat,p.lng], { icon: icon(html, 30), zIndexOffset: p.pulse > 0 ? 500 + p.pulse * 10 : 0 }).bindTooltip(esc(p.label), { direction:'top', offset:[0,-28] });
        m.on('click', function(){ post({ type:'tap', id:p.id }); });
        pinLayer.addLayer(m); pinMap[p.id] = { m:m, html:html, label:p.label };
      } else {
        var ll = cur.m.getLatLng();
        if (ll.lat !== p.lat || ll.lng !== p.lng) cur.m.setLatLng([p.lat,p.lng]);
        if (cur.html !== html) { cur.m.setIcon(icon(html, 30)); cur.m.setZIndexOffset(p.pulse > 0 ? 500 + p.pulse * 10 : 0); cur.html = html; }
        if (cur.label !== p.label) { cur.m.setTooltipContent(esc(p.label)); cur.label = p.label; }
      }
    });
    Object.keys(pinMap).forEach(function(id){ if (!seen[id]) { pinLayer.removeLayer(pinMap[id].m); delete pinMap[id]; } });

    // Eventos (área com bônus): círculo dourado + etiqueta fixa
    var ek = JSON.stringify(d.events||[]);
    if (ek !== eventKey) {
      eventKey = ek; eventLayer.clearLayers();
      (d.events||[]).forEach(function(e){
        var c = L.circle([e.lat,e.lng], { radius:e.r, pane:'events', color:'#ffd166', weight:2.5, dashArray:'6 6', fillColor:'#ffd166', fillOpacity:.12 });
        c.on('click', function(){ post({ type:'event', id:e.id }); });
        eventLayer.addLayer(c);
        eventLayer.addLayer(L.marker([e.lat,e.lng], { icon: L.divIcon({ className:'', html:'', iconSize:[0,0] }), interactive:false, pane:'events' })
          .bindTooltip('🎉 '+esc(e.title)+'<b>'+esc(e.extra)+' por entrega</b>', { permanent:true, direction:'center', className:'evlabel' }));
      });
    }
    // Áreas de mais saída (mancha de calor)
    var hk = JSON.stringify(d.heat||[]);
    if (hk !== heatKey) {
      heatKey = hk; heatLayer.clearLayers();
      (d.heat||[]).forEach(function(h){
        var w = Math.max(0.15, Math.min(1, h.w));
        var col = w > .66 ? '#ff3d5a' : w > .33 ? '#ff9f43' : '#ffe066';
        heatLayer.addLayer(L.circle([h.lat,h.lng], { radius: 260 + 140 * w, pane:'heat', stroke:false, fillColor:col, fillOpacity: .25 + .45 * w, interactive:false }));
      });
    }
    // Rota: atualiza a mesma linha no lugar (não pisca e não some entre atualizações)
    if (d.route && d.route.length > 1) {
      var dash = d.routeStraight ? '8 8' : null;
      if (!routeLine) {
        routeHalo = L.polyline(d.route, { color: '#0b0b14', weight: 9, opacity: .55, interactive:false }).addTo(map);
        routeLine = L.polyline(d.route, { color: CFG.colors.ghost, weight: 5, opacity: .95, dashArray: dash, interactive:false }).addTo(map);
      } else {
        routeHalo.setLatLngs(d.route); routeLine.setLatLngs(d.route);
        if (routeDash !== dash) routeLine.setStyle({ dashArray: dash });
      }
      routeDash = dash;
    } else if (routeLine) { map.removeLayer(routeLine); map.removeLayer(routeHalo); routeLine = null; routeHalo = null; }
    // Modo seguir: mantém o mapa centrado no Ghost
    following = !!d.follow;
    if (following && lastMe) { map.panTo(lastMe, { animate:true, duration:.6 }); firstFit = false; }
    if (d.fit || (firstFit && !following)) {
      var pts = (d.pins||[]).filter(function(p){return p.kind!=='store';}).map(function(p){return [p.lat,p.lng];});
      if (lastMe) pts.push(lastMe);
      if (pts.length > 1) { map.fitBounds(pts, { padding:[60,60], maxZoom:16 }); firstFit = false; }
      else if (pts.length === 1) { map.setView(pts[0], 15); firstFit = false; }
    }
  };
  function meIcon(){ return L.divIcon({ className:'', html: meHtml, iconSize:[38,38], iconAnchor:[19,19] }); }
  window.fantasmaSetMe = function(img, fallback){
    meHtml = img ? '<div class="me img"><img src="'+esc(img)+'" data-fb="'+esc(fallback||'')+'"></div>' : '<div class="me">👻</div>';
    if (meMarker) meMarker.setIcon(meIcon());
  };
  // Foto do Ghost sem internet: troca pelo fantasminha
  document.addEventListener('error', function(ev){
    var t = ev.target;
    if (t && t.tagName === 'IMG' && t.dataset && t.dataset.fb && !t.dataset.tried) { t.dataset.tried = '1'; t.src = t.dataset.fb; }
  }, true);
  window.fantasmaFocus = function(lat, lng, r){
    try { map.fitBounds(L.latLng(lat,lng).toBounds((r||500)*2.4), { maxZoom:16 }); } catch(e) { map.setView([lat,lng], 15); }
  };
  window.fantasmaCenter = function(){ if (lastMe) map.setView(lastMe, Math.max(map.getZoom(), 15)); };
  post({ type:'ready' });
})();
</script></body></html>`;
}
