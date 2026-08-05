'use strict';
'require view';
'require poll';
'require rpc';
'require ui';

var callNpuStatus = rpc.declare({ object: 'luci.airoha_npu', method: 'getStatus' });
var callPpeEntries = rpc.declare({ object: 'luci.airoha_npu', method: 'getPpeEntries' });
var callFrameEngine = rpc.declare({ object: 'luci.airoha_npu', method: 'getFrameEngine' });
var callSetGovernor = rpc.declare({ object: 'luci.airoha_npu', method: 'setGovernor', params: ['governor'] });
var callSetMaxFreq = rpc.declare({ object: 'luci.airoha_npu', method: 'setMaxFreq', params: ['freq'] });
var callSetOverclock = rpc.declare({ object: 'luci.airoha_npu', method: 'setOverclock', params: ['freq_mhz'] });

/* ── Theme-adaptive CSS (with dark mode + responsive + Argon optimization) ── */
var themeCSS = '\
.soc-card{background:var(--soc-card-bg);border:1px solid var(--soc-border);border-radius:8px;padding:14px;transition:border-color .3s,background-color .3s}\
.soc-card-accent{border-left-width:3px;border-left-style:solid}\
.soc-muted{color:var(--soc-muted)}\
.soc-text{color:var(--soc-text)}\
.soc-label{font-size:11px;color:var(--soc-muted)}\
.soc-bar-track{background:var(--soc-bar-track);border-radius:4px;overflow:hidden}\
.soc-pse-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:6px}\
.soc-pse-cell{background:var(--soc-card-bg);border:1px solid var(--soc-border);border-radius:5px;padding:6px 8px;font-size:12px;transition:border-color .3s}\
.soc-gdm-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:10px}\
.soc-gdm-grid .soc-card{min-width:0}\
.soc-cdm-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:10px}\
/* PPE table responsive wrapper */\
.soc-table-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch;margin:0 -1px}\
.soc-table-wrap .table{min-width:600px;margin-bottom:0}\
/* Touch optimization */\
.soc-card select,.soc-card input,.soc-card button{min-height:36px}\
/* ── Responsive: Tablet ( < 768px ) ── */\
@media(max-width:768px){\
  .soc-gdm-grid{grid-template-columns:1fr;gap:8px}\
  .soc-cdm-grid{grid-template-columns:1fr;gap:8px}\
  .soc-pse-grid{grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:4px}\
  .soc-card{padding:12px}\
  #fe-diagram .soc-card{padding:10px 12px}\
}\
/* ── Responsive: Mobile ( < 480px ) ── */\
@media(max-width:480px){\
  .soc-pse-grid{grid-template-columns:repeat(2,1fr);gap:4px}\
  .soc-pse-cell{padding:5px 6px;font-size:11px}\
  .soc-card{padding:10px;border-radius:6px}\
  .soc-label{font-size:10px}\
  .soc-text{font-size:13px}\
  #cpu-freq-bar-wrap{flex-direction:column;align-items:stretch;gap:6px}\
  #cpu-freq-bar-wrap > span{text-align:center;font-size:11px}\
  #cpu-freq-bar-wrap > div{min-width:0;max-width:none}\
  .soc-card select,.soc-card input,.soc-card button{min-height:44px}\
}\
';

function isDarkMode() {
	// Sample multiple elements to get a reliable reading
	var els = [document.body, document.querySelector('.main-content'), document.querySelector('#maincontent'), document.querySelector('.cbi-map')];
	for (var i = 0; i < els.length; i++) {
		if (!els[i]) continue;
		var bg = window.getComputedStyle(els[i]).backgroundColor;
		var m = bg.match(/\d+/g);
		if (m && m.length >= 3) {
			var a = m.length >= 4 ? parseFloat(m[3]) : 1;
			if (a < 0.1) continue; // transparent, skip
			var lum = (parseInt(m[0]) * 299 + parseInt(m[1]) * 587 + parseInt(m[2]) * 114) / 1000;
			return lum < 128;
		}
	}
	// Fallback: check if any known dark theme stylesheet is loaded
	var sheets = document.querySelectorAll('link[href*="dark"], link[href*="glass"]');
	return sheets.length > 0;
}

function isArgonTheme() {
	// Detect Argon theme by checking for known classes or attributes (light or dark)
	var body = document.body;
	if (body.classList.contains('dark-theme') || body.classList.contains('argon-dark')) return true;
	if (body.classList.contains('light-theme') || body.classList.contains('argon-light')) return true;
	if (body.getAttribute('data-theme') === 'dark' || body.getAttribute('data-theme') === 'light') return true;
	// Check for Argon-specific CSS variables
	var testEl = document.createElement('div');
	testEl.style.display = 'none';
	document.body.appendChild(testEl);
	var cs = window.getComputedStyle(testEl);
	var hasArgonVar = cs.getPropertyValue('--argon-primary') !== '' || cs.getPropertyValue('--primary-color') !== '';
	document.body.removeChild(testEl);
	return hasArgonVar;
}

var _lastDarkMode = null;
var _lastIsArgon = null;

function injectCSS() {
	var el = document.getElementById('soc-theme-css');
	if (!el) { el = document.createElement('style'); el.id = 'soc-theme-css'; document.head.appendChild(el); }
	var dark = isDarkMode();
	var argon = isArgonTheme();
	if (dark === _lastDarkMode && argon === _lastIsArgon) return;
	_lastDarkMode = dark;
	_lastIsArgon = argon;

	var vars;
	if (dark) {
		if (argon) {
			// Argon dark theme - optimized for Argon's visual language
			vars = ':root{' +
				'--soc-card-bg:#1c1c1e;' +
				'--soc-border:#2c2c2e;' +
				'--soc-muted:#8e8e93;' +
				'--soc-text:#e5e5ea;' +
				'--soc-bar-track:#2c2c2e;' +
				'--soc-table-header-bg:#2c2c2e;' +
				'--soc-table-border:#2c2c2e;' +
				'}';
		} else {
			// Generic dark theme
			vars = ':root{' +
				'--soc-card-bg:#1a1a1a;' +
				'--soc-border:#333;' +
				'--soc-muted:#9e9e9e;' +
				'--soc-text:#e8e8e8;' +
				'--soc-bar-track:#2d2d2d;' +
				'--soc-table-header-bg:#252525;' +
				'--soc-table-border:#333;' +
				'}';
		}
	} else {
		// Light mode - keep clean and bright
		vars = ':root{' +
			'--soc-card-bg:#ffffff;' +
			'--soc-border:#e0e0e0;' +
			'--soc-muted:#757575;' +
			'--soc-text:#212121;' +
			'--soc-bar-track:#eeeeee;' +
			'--soc-table-header-bg:#fafafa;' +
			'--soc-table-border:#e0e0e0;' +
			'}';
	}
	el.textContent = themeCSS + vars;
}

/* ── Helpers ── */

var psePortMap = [
	{ name: 'GDM1', label: 'Switch 1G',   color: '#ff9800' },
	{ name: 'GDM2', label: 'WAN 10G',     color: '#4caf50' },
	{ name: 'CDM1', label: 'CPU DMA 1',   color: '#607d8b' },
	{ name: 'GDM3', label: 'GDM3',        color: '#607d8b' },
	{ name: 'CDM2', label: 'CPU DMA 2',   color: '#607d8b' },
	{ name: 'PPE0', label: 'PPE Eng 0',   color: '#2196f3' },
	{ name: 'PPE1', label: 'PPE Eng 1',   color: '#2196f3' },
	{ name: 'PPE2', label: 'PPE Eng 2',   color: '#2196f3' },
	{ name: 'CDM3', label: 'CPU DMA 3',   color: '#607d8b' },
	{ name: 'GDM4', label: 'LAN2 10G',    color: '#4caf50' }
];

function fmtFreq(khz) { return (!khz || khz === 0) ? 'N/A' : (khz / 1000).toFixed(0) + ' MHz'; }
function fmtK(n) {
	if (!n || n === 0) return '0';
	if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
	if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
	return n.toString();
}
function calcTotalMem(regions) {
	var t = 0;
	(regions || []).forEach(function(r) {
		var m = (r.size || '').match(/(\d+)\s*(KiB|MiB|GiB)/i);
		if (m) { var s = parseInt(m[1]); var u = m[2][0].toUpperCase(); t += u === 'G' ? s*1048576 : u === 'M' ? s*1024 : s; }
	});
	return t >= 1024 ? (t/1024).toFixed(0)+' MiB' : t+' KiB';
}


/* ── Frame Engine Diagram (NPU, PPE, and Ethernet offload) ── */
function renderFeDiagram(fe, st) {
	st = st || {};
	if (!fe || fe.error) return E('div', { 'class': 'soc-muted' }, _('devmem not available on this build'));
	var ports = Array.isArray(fe.pse_ports) ? fe.pse_ports : [];

	// Helper: GDM card
	function gdmCard(key, name, label, color, pse) {
		var d = fe[key] || {};
		var active = d.tx > 0 || d.rx > 0;
		return E('div', { 'class': 'soc-card soc-card-accent', 'style': 'border-left-color:'+color + (active?';border-color:'+color:'') }, [
			E('div', { 'style': 'display:flex;justify-content:space-between;align-items:baseline;margin-bottom:2px' }, [
				E('span', { 'style': 'font-weight:bold;color:'+color+';font-size:14px' }, name),
				E('span', { 'class': 'soc-label' }, pse)
			]),
			E('div', { 'class': 'soc-label', 'style': 'margin-bottom:6px' }, label),
			E('div', { 'style': 'display:grid;grid-template-columns:auto 1fr;gap:2px 10px;font-size:12px' }, [
				E('span', { 'class': 'soc-muted' }, 'TX'), E('span', { 'class': 'soc-text', 'style': 'text-align:right' }, fmtK(d.tx)),
				E('span', { 'class': 'soc-muted' }, 'RX'), E('span', { 'class': 'soc-text', 'style': 'text-align:right' }, fmtK(d.rx))
			].concat(d.tx_drop > 0 ? [
				E('span', { 'style': 'color:#f44336' }, 'TX Drop'), E('span', { 'style': 'color:#f44336;text-align:right' }, fmtK(d.tx_drop))
			] : []).concat(d.rx_drop > 0 ? [
				E('span', { 'style': 'color:#f44336' }, 'RX Drop'), E('span', { 'style': 'color:#f44336;text-align:right' }, fmtK(d.rx_drop))
			] : []))
		]);
	}

	// Helper: CDM offload bar
	function cdmCard(key, name, label, pse) {
		var d = fe[key] || {};
		var total = (d.rx_cpu||0) + (d.rx_hwf||0);
		var pct = total > 0 ? ((d.rx_hwf/total)*100).toFixed(1) : '0.0';
		var barCol = total===0 ? 'var(--soc-border)' : parseFloat(pct)>80 ? '#4caf50' : parseFloat(pct)>50 ? '#ff9800' : '#f44336';
		return E('div', { 'class': 'soc-card' }, [
			E('div', { 'style': 'display:flex;justify-content:space-between;margin-bottom:4px' }, [
				E('span', { 'style': 'font-weight:bold;color:#607d8b;font-size:13px' }, name+' '+pse),
				E('span', { 'class': 'soc-label' }, label)
			]),
			E('div', { 'class': 'soc-text', 'style': 'font-size:12px;margin-bottom:4px' }, _('HW Offload: ') + pct + '%'),
			E('div', { 'class': 'soc-bar-track', 'style': 'height:6px' }, [
				E('div', { 'style': 'background:'+barCol+';height:100%;width:'+pct+'%;transition:width .5s;border-radius:4px' })
			]),
			E('div', { 'style': 'display:flex;justify-content:space-between;font-size:11px;margin-top:4px' }, [
				E('span', { 'class': 'soc-muted' }, _('CPU: ') + fmtK(d.rx_cpu||0)),
				E('span', { 'class': 'soc-muted' }, _('HWF: ') + fmtK(d.rx_hwf||0)),
				E('span', { 'class': 'soc-muted' }, _('TX: ') + fmtK(d.tx||0))
			])
		]);
	}


	// NPU indicator
	var npuActive = st.npu_loaded;
	var npuCard = E('div', { 'class': 'soc-card', 'style': 'border-color:'+(npuActive?'#00bcd4':'var(--soc-border)') }, [
		E('div', { 'style': 'display:flex;justify-content:space-between;align-items:center;margin-bottom:4px' }, [
			E('span', { 'style': 'font-weight:bold;color:#00bcd4;font-size:14px' }, 'NPU'),
			E('span', { 'style': 'background:'+(npuActive?'#00695c':'#666')+';color:#fff;padding:1px 7px;border-radius:3px;font-size:10px;font-weight:600' }, npuActive ? _('ACTIVE') : _('OFF'))
		]),
		E('div', { 'class': 'soc-label', 'style': 'margin-bottom:4px' }, '8x RISC-V via PCIe RAM'),
		E('div', { 'style': 'font-size:11px' }, [
			E('span', { 'class': 'soc-muted' }, _('Manages: ')),
			E('span', { 'class': 'soc-text', 'style': 'font-size:11px' }, _('PPE init, flow offload, packet processing'))
		])
	]);

	// PPE engines with flow count
	var ppeCard = E('div', { 'class': 'soc-card', 'style': 'border-color:#2196f3' }, [
		E('div', { 'style': 'display:flex;justify-content:space-between;align-items:center;margin-bottom:4px' }, [
			E('span', { 'style': 'font-weight:bold;color:#2196f3;font-size:14px' }, 'PPE Engines'),
			E('span', { 'class': 'soc-label' }, 'P5 / P6 / P7')
		]),
		E('div', { 'style': 'display:flex;gap:16px;font-size:12px' }, [
			E('span', {}, [
				E('span', { 'class': 'soc-muted' }, _('Bound ')),
				E('span', { 'class': 'soc-text', 'style': 'font-weight:bold', 'id': 'fe-ppe-bound' }, (st.offload_bound||0).toString())
			]),
			E('span', {}, [
				E('span', { 'class': 'soc-muted' }, _('Total ')),
				E('span', { 'class': 'soc-text', 'id': 'fe-ppe-total' }, (st.offload_total||0).toString())
			])
		])
	]);

	// PSE buffer
	var pseT = (fe.pse_used||0)+(fe.pse_free||0);
	var pseP = pseT>0 ? ((fe.pse_used/pseT)*100).toFixed(1) : '0';
	var pseCol = parseFloat(pseP)>80?'#f44336':parseFloat(pseP)>50?'#ff9800':'#4caf50';

	// PSE port cells (all ports except P3/GDM3, which is unused on XG-040G-MD)
	var portCells = ports.filter(function(p) { return p.port !== 3; }).map(function(p) {
		var info = psePortMap[p.port] || { name:'P'+p.port, label:'?', color:'#666' };
		var drop = p.drops > 0;
		return E('div', { 'class': 'soc-pse-cell', 'style': drop ? 'border-color:#f44336' : '' }, [
			E('div', { 'style': 'font-weight:600;color:'+info.color+';font-size:11px' }, 'P'+p.port+' '+info.name),
			E('div', { 'style': 'display:flex;gap:8px;font-size:11px;margin-top:2px' }, [
				E('span', { 'class': 'soc-muted' }, 'IQ '+p.iq),
				E('span', { 'class': 'soc-muted' }, 'OQ '+p.oq),
				drop ? E('span', { 'style': 'color:#f44336' }, fmtK(p.drops)) : null
			].filter(Boolean))
		]);
	});

	return E('div', { 'id': 'fe-diagram' }, [
		// PSE buffer bar
		E('div', { 'class': 'soc-card', 'style': 'margin-bottom:10px' }, [
			E('div', { 'style': 'display:flex;justify-content:space-between;margin-bottom:4px' }, [
				E('span', { 'class': 'soc-text', 'style': 'font-weight:bold;font-size:13px' }, _('PSE Shared Buffer')),
				E('span', { 'class': 'soc-muted', 'style': 'font-size:12px' }, (fe.pse_used||0) + _(' used / ') + (fe.pse_free||0) + _(' free (') + pseP + '%)')
			]),
			E('div', { 'class': 'soc-bar-track', 'style': 'height:8px' }, [
				E('div', { 'style': 'background:'+pseCol+';height:100%;width:'+pseP+'%;border-radius:4px;transition:width .5s' })
			])
		]),
		// Row 1: GDM ports
		E('div', { 'class': 'soc-gdm-grid' }, [
			gdmCard('gdm1', 'GDM1', 'Internal Switch (1G LAN3/4)', '#ff9800', 'P0'),
			gdmCard('gdm2', 'GDM2', 'WAN (USXGMII 10G)', '#4caf50', 'P1'),
			gdmCard('gdm4', 'GDM4', 'LAN2 (USXGMII 10G)', '#4caf50', 'P9')
		]),
		// Row 2: CDM1/CDM2 (CPU DMA)
		E('div', { 'style': 'display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px' }, [
			cdmCard('cdm1', 'CDM1', 'CPU DMA 1', 'P2'),
			cdmCard('cdm2', 'CDM2', 'CPU DMA 2', 'P4'),
		]),
		// Row 3: PPE + NPU
		E('div', { 'style': 'display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px' }, [
			ppeCard,
			npuCard
		]),
		// PSE port grid
		E('div', { 'class': 'soc-text', 'style': 'font-size:12px;font-weight:600;margin-bottom:6px' }, _('PSE Port Queue Status')),
		E('div', { 'class': 'soc-pse-grid' }, portCells)
	]);
}

/* ── CPU Frequency ── */
function freqBarState(hw, min, max, pll, gov, freqSource) {
	var oc = gov==='performance' && pll>0 && (pll*1000)>max;
	return { freq: oc ? pll*1000 : Math.min(hw,max), max: oc ? pll*1000 : max, oc: oc, source: freqSource || 'cpufreq' };
}
function renderFreqBar(hw, min, max, pll, gov, freqSource) {
	if (!max) return E('span',{},'N/A');
	var s = freqBarState(hw,min,max,pll,gov,freqSource);
	var pct = Math.round(((s.freq-min)/(s.max-min))*100);
	pct = Math.max(0,Math.min(100,pct));
	var bg = s.oc ? 'linear-gradient(90deg,#e65100,#ff9800)' : 'linear-gradient(90deg,#2e7d32,#66bb6a)';
	var label = s.oc ? (pll+' MHz (OC)') : fmtFreq(s.freq);
	// PLL fallback indicator
	var pllBadge = '';
	if (s.source === 'pll') {
		pllBadge = ' <span style="background:#ff9800;color:#fff;padding:1px 5px;border-radius:3px;font-size:9px;font-weight:600;margin-left:6px;">' + _('PLL Estimate') + '</span>';
	}
	return E('div', { 'id':'cpu-freq-bar-wrap', 'style':'display:flex;align-items:center;gap:10px' }, [
		E('span', { 'class':'soc-muted', 'style':'font-size:90%' }, fmtFreq(min)),
		E('div', { 'style':'flex:1;border-radius:4px;height:22px;position:relative;min-width:180px;max-width:350px;overflow:hidden', 'class':'soc-bar-track' }, [
			E('div', { 'id':'cpu-freq-fill', 'style':'background:'+bg+';height:100%;border-radius:4px;width:'+pct+'%;transition:width .5s' }),
			E('span', { 'id':'cpu-freq-text', 'style':'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:13px;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.6)' }, 
				E('span', { 'id': 'cpu-freq-label' }, label + pllBadge)
			)
		]),
		E('span', { 'id':'cpu-freq-max-label', 'class':'soc-muted', 'style':'font-size:90%' }, fmtFreq(s.max))
	]);
}
function updateFreqBar(hw, min, max, pll, gov, freqSource) {
	var s = freqBarState(hw,min,max,pll,gov,freqSource);
	var el = document.getElementById('cpu-freq-label'), fl = document.getElementById('cpu-freq-fill'), ml = document.getElementById('cpu-freq-max-label');
	if (el) {
		var label = s.oc ? (pll+' MHz (OC)') : fmtFreq(s.freq);
		var pllBadge = s.source === 'pll' ? ' <span style="background:#ff9800;color:#fff;padding:1px 5px;border-radius:3px;font-size:9px;font-weight:600;margin-left:6px;">' + _('PLL Estimate') + '</span>' : '';
		el.innerHTML = label + pllBadge;
	}
	if (fl && s.max>0) { var pct=Math.max(0,Math.min(100,Math.round(((s.freq-min)/(s.max-min))*100))); fl.style.width=pct+'%'; fl.style.background=s.oc?'linear-gradient(90deg,#e65100,#ff9800)':'linear-gradient(90deg,#2e7d32,#66bb6a)'; }
	if (ml) ml.textContent = fmtFreq(s.max);
}

function renderGovSelect(avail, active) {
	var gs = (avail||'').trim().split(/\s+/).filter(Boolean);
	if (!gs.length) return E('span',{},'N/A');
	return E('select', { 'id':'cpu-governor-select','class':'cbi-input-select','style':'min-width:140px','change':function(ev){
		var g=ev.target.value; ev.target.disabled=true;
		callSetGovernor(g).then(function(r){ev.target.disabled=false;if(r&&r.error) ui.addNotification(null,E('p',{},_('Error: ')+r.error),'error');}).catch(function(){ev.target.disabled=false;});
	}}, gs.map(function(g){return E('option',{'value':g,'selected':g===active?'':null},g);}));
}
function renderMaxFreqSelect(avail, cur) {
	var fs = (avail||'').trim().split(/\s+/).filter(Boolean);
	if (!fs.length) return E('span',{},'N/A');
	return E('select', { 'id':'cpu-maxfreq-select','class':'cbi-input-select','style':'min-width:140px','change':function(ev){
		var f=ev.target.value; ev.target.disabled=true;
		callSetMaxFreq(parseInt(f)).then(function(r){ev.target.disabled=false;if(r&&r.error) ui.addNotification(null,E('p',{},_('Error: ')+r.error),'error');}).catch(function(){ev.target.disabled=false;});
	}}, fs.map(function(f){return E('option',{'value':f,'selected':parseInt(f)===parseInt(cur)?'':null},(parseInt(f)/1000).toFixed(0)+' MHz');}));
}
function renderOcControls() {
	var inp = E('input',{'id':'oc-freq-input','type':'number','min':'500','max':'1600','step':'50','value':'1400','class':'cbi-input-text','style':'width:100px'});
	var btn = E('button',{'class':'cbi-button cbi-button-action','style':'margin-left:8px','click':function(){
		var f=parseInt(document.getElementById('oc-freq-input').value);
		if(isNaN(f)||f<500||f>1600){ui.addNotification(null,E('p',{},_('Frequency must be 500-1600 MHz')),'error');return;}
		if(f>1400&&!confirm(_('Frequencies above 1400 MHz may be unstable. Continue?'))) return;
		btn.disabled=true;btn.textContent=_('Applying...');
		callSetOverclock(f).then(function(r){btn.disabled=false;btn.textContent=_('Apply');
			if(r&&r.error) ui.addNotification(null,E('p',{},_('Overclock failed: ')+r.error),'error');
			else if(r&&r.result==='ok') ui.addNotification(null,E('p',{},_('CPU set to ')+r.actual_mhz+' MHz'),'info');
		}).catch(function(e){btn.disabled=false;btn.textContent=_('Apply');});
	}},_('Apply'));
	return E('div',{'style':'display:flex;align-items:center;gap:8px;flex-wrap:wrap'},[
		inp, E('span',{'class':'soc-muted'},'MHz'), btn,
		E('span',{'class':'soc-muted','style':'font-size:85%;margin-left:8px'},_('Direct PLL programming. Governor locked to performance. Stock max: 1200 MHz. Tested stable up to 1500 MHz.'))
	]);
}

/* ── PPE Table ── */
function renderPpeRows(entries) {
	return entries.slice(0,100).map(function(e) {
		var eth = e.eth||''; if(eth==='00:00:00:00:00:00->00:00:00:00:00:00') eth='-';
		return E('tr',{'class':'tr'},[
			E('td',{'class':'td'},e.index), E('td',{'class':'td'},E('span',{'class':e.state==='BND'?'label-success':''},e.state)),
			E('td',{'class':'td'},e.type), E('td',{'class':'td'},e.orig||'-'), E('td',{'class':'td'},e.new_flow||'-'), E('td',{'class':'td'},eth)
		]);
	});
}

/* ── Main View ── */
return view.extend({
	load: function() {
		return Promise.all([ callNpuStatus(), callPpeEntries(), callFrameEngine() ]);
	},
	render: function(data) {
		injectCSS();
		var st = data[0]||{}, ppe = data[1]||{}, fe = data[2]||{};
		var entries = Array.isArray(ppe.entries) ? ppe.entries : [];
		var memR = Array.isArray(st.memory_regions) ? st.memory_regions : [];
		var freqSource = st.cpu_freq_source || 'cpufreq';
		var cpuTemp = st.cpu_temp || 0;
		var tempDisplay = cpuTemp > 0 ? (cpuTemp + ' °C') : 'N/A';

		var view = E('div',{'class':'cbi-map'},[
			E('h2',{},_('Airoha SoC Status')),
			// CPU Frequency
			E('div',{'class':'cbi-section'},[
				E('h3',{},_('CPU Frequency')),
				E('table',{'class':'table'},[
					E('tr',{'class':'tr'},[ E('td',{'class':'td','width':'33%'},E('strong',{},_('Current Frequency'))), E('td',{'class':'td'}, renderFreqBar(st.cpu_hw_freq,st.cpu_min_freq,st.cpu_max_freq,st.pll_freq_mhz,st.cpu_governor,freqSource)) ]),
					E('tr',{'class':'tr'},[ E('td',{'class':'td'},E('strong',{},_('CPU Temperature'))), E('td',{'class':'td','id':'cpu-temp'}, tempDisplay) ]),
					E('tr',{'class':'tr'},[ E('td',{'class':'td'},E('strong',{},_('Governor'))), E('td',{'class':'td'}, renderGovSelect(st.cpu_avail_governors,st.cpu_governor)) ]),
					E('tr',{'class':'tr'},[ E('td',{'class':'td'},E('strong',{},_('Max Frequency'))), E('td',{'class':'td'}, renderMaxFreqSelect(st.cpu_avail_freqs,st.cpu_max_freq)) ]),
					E('tr',{'class':'tr'},[ E('td',{'class':'td'},E('strong',{},_('Overclock'))), E('td',{'class':'td'}, renderOcControls()) ]),
					E('tr',{'class':'tr'},[ E('td',{'class':'td'},E('strong',{},_('CPU Cores'))), E('td',{'class':'td'},(st.cpu_count||0).toString()) ])
				])
			]),
			// NPU & Frame Engine (unified)
			E('div',{'class':'cbi-section'},[
				E('h3',{},_('NPU & Offload Engine')),
				E('table',{'class':'table'},[
					E('tr',{'class':'tr'},[ E('td',{'class':'td','width':'33%'},E('strong',{},_('NPU Status'))),
						E('td',{'class':'td','id':'npu-status'}, st.npu_loaded ?
							E('span',{'class':'label-success'},_('Active')+(st.npu_device?' ('+st.npu_device+')':'')) :
							E('span',{'class':'label-danger'},_('Not Active'))) ]),
					E('tr',{'class':'tr'},[ E('td',{'class':'td'},E('strong',{},_('Firmware / Clock / Cores'))),
						E('td',{'class':'td','id':'npu-info'}, (st.npu_version||'N/A')+' | '+(st.npu_clock?(st.npu_clock/1e6).toFixed(0)+' MHz':'N/A')+' | '+(st.npu_cores||0)+' cores') ]),
					E('tr',{'class':'tr'},[ E('td',{'class':'td'},E('strong',{},_('Reserved Memory'))),
						E('td',{'class':'td','id':'npu-memory'}, calcTotalMem(memR)+' ('+memR.length+' regions)') ])
				]),
				// Frame Engine diagram (includes PPE flows, NPU, and Ethernet ports)
				E('div',{'style':'margin-top:12px'},[ E('h4',{'class':'soc-text','style':'font-size:14px;margin-bottom:8px'},_('Frame Engine'))]),
				E('div',{'id':'fe-container'}, renderFeDiagram(fe, st))
			]),
			// PPE Flow Table - with responsive scroll wrapper
			E('div',{'class':'cbi-section'},[
				E('h3',{},_('PPE Flow Offload Entries')),
				E('div',{'class':'soc-table-wrap'},[
					E('table',{'class':'table','id':'ppe-entries-table'},[
						E('tr',{'class':'tr cbi-section-table-titles'},[
							E('th',{'class':'th'},_('Index')), E('th',{'class':'th'},_('State')), E('th',{'class':'th'},_('Type')),
							E('th',{'class':'th'},_('Original Flow')), E('th',{'class':'th'},_('New Flow')), E('th',{'class':'th'},_('Ethernet'))
						])
					].concat(renderPpeRows(entries)))
				])
			])
		]);

		poll.add(L.bind(function() {
			return Promise.all([ callNpuStatus(), callPpeEntries(), callFrameEngine() ]).then(L.bind(function(d) {
				injectCSS();
				var st=d[0]||{}, ppe=d[1]||{}, fe=d[2]||{};
				var entries = Array.isArray(ppe.entries)?ppe.entries:[];
				var freqSrc = st.cpu_freq_source || 'cpufreq';

				updateFreqBar(st.cpu_hw_freq,st.cpu_min_freq,st.cpu_max_freq,st.pll_freq_mhz,st.cpu_governor,freqSrc);

				// Update CPU temperature
				var tempEl = document.getElementById('cpu-temp');
				if (tempEl) {
					var t = st.cpu_temp || 0;
					tempEl.textContent = t > 0 ? (t + ' °C') : 'N/A';
				}

				var gs=document.getElementById('cpu-governor-select'); if(gs&&!gs.matches(':focus')) gs.value=st.cpu_governor||'';
				var fs=document.getElementById('cpu-maxfreq-select'); if(fs&&!fs.matches(':focus')) fs.value=(st.cpu_max_freq||0).toString();

				var se=document.getElementById('npu-status');
				if(se){se.innerHTML='';var sp=document.createElement('span');sp.className=st.npu_loaded?'label-success':'label-danger';sp.textContent=st.npu_loaded?(_('Active')+(st.npu_device?' ('+st.npu_device+')':'')):_('Not Active');se.appendChild(sp);}

				var fc=document.getElementById('fe-container'); if(fc){fc.innerHTML='';fc.appendChild(renderFeDiagram(fe, st));}

				var tb=document.getElementById('ppe-entries-table');
				if(tb){while(tb.rows.length>1)tb.deleteRow(1);renderPpeRows(entries).forEach(function(r){tb.appendChild(r);});}
			},this));
		},this), 5);

		return view;
	},
	handleSaveApply: null, handleSave: null, handleReset: null
});
