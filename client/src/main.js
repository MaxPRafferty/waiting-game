import '../styles.css';
import { getCopy } from '../copy.js';
import { registerView, navigateTo, initRouter } from './router.js';
import { loadSettings, getSetting, initSettingsView, applySettings } from './settings.js';

loadSettings();

const token = (function () {
  let t = sessionStorage.getItem('wg_token');
  if (!t) {
    t = crypto.randomUUID();
    sessionStorage.setItem('wg_token', t);
  }
  return t;
})();

// ── State ──
let mySeq = null;
let myPosition = null;
let myWaitingPosition = null;
let myStartingPosition = null;
let myChecked = false;
let departuresTotal = 0;
let totalSlots = 0;
let joinedAtMs = null;

let scrollOffset = 0;
let viewportWidth = 0;
const SLOT_WIDTH = 48;
const DOM_POOL_SIZE = 120;

const slots = new Map();
const domPool = [];
const labelPool = [];

// ── DOM Refs ──
const $posNumber = document.getElementById('pos-number');
const $departureCounter = document.getElementById('departure-counter');
const $announcement = document.getElementById('announcement');
const $status = document.getElementById('status');
const $connectingMsg = document.getElementById('connecting-msg');
const $stripContainer = document.getElementById('strip-container');
const $strip = document.getElementById('strip');
const $stripLabels = document.getElementById('strip-labels');
const $stripPointer = document.getElementById('strip-pointer');
const $lineTuner = document.getElementById('line-tuner');
const $rangeReadout = document.getElementById('range-readout');
const $signalReadout = document.getElementById('signal-readout');
const $clockReadout = document.getElementById('clock-readout');
const $elapsedReadout = document.getElementById('elapsed-readout');
const $lowerThirdLabel = document.getElementById('lower-third-label');
const $lowerThirdText = document.getElementById('lower-third-text');
const $btnFront = document.getElementById('btn-front');
const $btnMe = document.getElementById('btn-me');
const $btnBack = document.getElementById('btn-back');

const $chatPanel = document.getElementById('chat-panel');
const $chatLog = document.getElementById('chat-log');
const $chatInput = document.getElementById('chat-input');
const $chatPeerCount = document.getElementById('chat-peer-count');
let announcementTimer = null;

// ── Menu ──
const $menuBtn = document.getElementById('menu-btn');
const $menuDropdown = document.getElementById('menu-dropdown');

$menuBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  $menuDropdown.classList.toggle('open');
});

document.addEventListener('click', () => {
  $menuDropdown.classList.remove('open');
});

document.querySelectorAll('.menu-item').forEach((item) => {
  item.addEventListener('click', () => {
    const target = item.dataset.view;
    if (target) navigateTo(target);
    $menuDropdown.classList.remove('open');
    document.querySelectorAll('.menu-item').forEach((m) => m.classList.remove('active'));
    item.classList.add('active');
  });
});

// ── Views ──
registerView('queue', document.getElementById('view-queue'));
registerView('settings', document.getElementById('view-settings'));

initSettingsView(document.getElementById('settings-content'));
applySettings();
initRouter();

// ── P2P Chat (Trystero) ──
let p2pRoom = null;
let p2pSendAction = null;
let currentNeighborhood = -1;

async function initP2P() {
  try {
    const { joinRoom } = await import('https://cdn.skypack.dev/trystero/torrent');
    const config = { appId: 'the-waiting-game-neighborhood' };

    window.updateNeighborhood = (bucketId) => {
      if (bucketId === currentNeighborhood) return;
      currentNeighborhood = bucketId;

      if (p2pRoom) p2pRoom.leave();

      p2pRoom = joinRoom(config, `neighborhood-${bucketId}`);
      const [send, receive] = p2pRoom.makeAction('chat');
      p2pSendAction = send;

      $chatLog.innerHTML = `<div class="chat-msg"><em>Entered neighborhood ${bucketId + 1}</em></div>`;
      $chatPeerCount.textContent = '0 nearby';

      p2pRoom.onPeerJoin(() => updatePeerCount());
      p2pRoom.onPeerLeave(() => updatePeerCount());

      receive((data, peerId) => {
        addChatMessage(peerId.substring(0, 5), data, false);
      });

      updatePeerCount();
    };

    function updatePeerCount() {
      const count = Object.keys(p2pRoom.getPeers()).length;
      $chatPeerCount.textContent = `${count} nearby`;
    }

    $chatInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && $chatInput.value.trim()) {
        const text = $chatInput.value.trim();
        if (p2pSendAction) p2pSendAction(text);
        addChatMessage('you', text, true);
        $chatInput.value = '';
      }
    });

    if (getSetting('chatVisible')) {
      $chatPanel.style.display = 'flex';
    }
  } catch (err) {
    console.warn('[P2P] Failed to initialize Trystero:', err);
    $chatLog.innerHTML = `<div class="chat-msg"><em>Chat unavailable in this neighborhood</em></div>`;
    $chatInput.disabled = true;
    $chatInput.placeholder = 'Chat unavailable';
    if (getSetting('chatVisible')) {
      $chatPanel.style.display = 'flex';
    }
  }
}

function addChatMessage(author, text, isSelf) {
  const el = document.createElement('div');
  el.className = 'chat-msg';
  const nameClass = isSelf ? 'self' : 'peer';
  el.innerHTML = `<span class="${nameClass}">${author}:</span> ${text}`;
  $chatLog.appendChild(el);
  $chatLog.scrollTop = $chatLog.scrollHeight;
}

// ── Initialization ──
function initDomPool() {
  for (let i = 0; i < DOM_POOL_SIZE; i++) {
    const el = document.createElement('div');
    el.className = 'slot';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    el.appendChild(cb);
    el.style.display = 'none';
    $strip.appendChild(el);
    domPool.push({ el, cb });
  }
  for (let i = 0; i < DOM_POOL_SIZE / 5; i++) {
    const lbl = document.createElement('div');
    lbl.className = 'strip-label';
    lbl.style.display = 'none';
    $stripLabels.appendChild(lbl);
    labelPool.push(lbl);
  }
}
initDomPool();

const wsUrl = (location.protocol === 'https:' ? 'wss' : 'ws') + '://' + location.host + '/ws';
let ws = null;

function connect() {
  ws = new WebSocket(wsUrl);
  ws.addEventListener('open', () => send({ type: 'join', token }));
  ws.addEventListener('message', handleWsMessage);
  ws.addEventListener('close', () => {
    if (pingInterval) clearInterval(pingInterval);
    showStatus('The connection has been lost. Reload to rejoin.', 'negative');
  });
  ws.addEventListener('error', () => {
    console.warn('WebSocket encountered a difficulty.');
    showStatus('The connection encountered a difficulty.', 'negative');
  });
}

function send(msg) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

let pingInterval = null;
function startPingLoop() {
  if (pingInterval) clearInterval(pingInterval);
  pingInterval = setInterval(() => send({ type: 'ping' }), 5000);
}

document.addEventListener('visibilitychange', () => {
  const visible = document.visibilityState === 'visible';
  send({ type: 'visibility', visible });
  if (visible) {
    startPingLoop();
  } else if (pingInterval) {
    clearInterval(pingInterval);
    pingInterval = null;
  }
});

async function restAction(path, method = 'POST', body = null) {
  try {
    const options = {
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (body) options.body = JSON.stringify(body);
    const res = await fetch(path, options);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn(`REST action ${path} failed:`, err);
    return null;
  }
}

function render() {
  if (totalSlots === 0 || mySeq === null) return;
  if (viewportWidth === 0) viewportWidth = $strip.clientWidth || window.innerWidth - 64;
  $lineTuner.max = Math.max(0, totalSlots - 1);
  $lineTuner.value = Math.floor(scrollOffset);

  const visibleCount = Math.ceil(viewportWidth / SLOT_WIDTH) + 2;
  const startPos = Math.floor(scrollOffset);
  const endPos = startPos + visibleCount;

  domPool.forEach((item) => (item.el.style.display = 'none'));
  labelPool.forEach((lbl) => (lbl.style.display = 'none'));
  $stripPointer.innerHTML = '';

  const visiblePositions = [];
  for (let i = startPos; i <= endPos; i++) {
    if (i >= 0 && i < totalSlots) visiblePositions.push(i);
  }

  const isEligible =
    !myChecked &&
    Array.from(slots.values()).filter((s) => s.seq < mySeq && s.state === 'waiting' && s.seq >= 0).length === 0;

  let poolIdx = 0;
  let labelIdx = 0;

  visiblePositions.forEach((pos) => {
    const slot = Array.from(slots.values()).find((s) => s.position === pos);
    if (!slot || poolIdx >= DOM_POOL_SIZE) return;

    const item = domPool[poolIdx++];
    item.el.style.display = 'flex';
    item.el.dataset.seq = slot.seq;
    const left = (pos - scrollOffset) * SLOT_WIDTH;
    item.el.style.left = left + 'px';

    item.cb.disabled = true;
    item.cb.checked = slot.state === 'checked';
    item.cb.onchange = null;

    item.el.className = 'slot';
    const isMine = slot.seq === mySeq;

    if (isMine) {
      item.el.classList.add('mine');
      if (isEligible && !myChecked) {
        item.el.classList.add('eligible');
        item.cb.disabled = false;
        item.cb.onchange = async () => {
          if (item.cb.checked) {
            const res = await restAction('/check', 'POST', { token });
            if (!res) item.cb.checked = false;
          }
        };
      }
    }

    if (slot.state === 'ghost') item.el.classList.add('ghost');

    if (pos % 5 === 0 && labelIdx < labelPool.length) {
      const lbl = labelPool[labelIdx++];
      lbl.style.display = 'block';
      lbl.style.left = left + SLOT_WIDTH / 2 + 'px';
      lbl.textContent = '#' + slot.seq;
    }

    if (isMine) {
      const ptr = document.createElement('div');
      ptr.className = 'pointer-label';
      ptr.style.left = left + SLOT_WIDTH / 2 + 'px';
      ptr.textContent = myChecked ? '✓ you' : '▲ you';
      $stripPointer.appendChild(ptr);
    }
  });

  updateBroadcastReadout(startPos, Math.min(endPos, totalSlots - 1));
}

let lastSubscribedRange = { from: -1, to: -1 };

function updateScroll(delta, isAbsolute = false) {
  const prevOffset = scrollOffset;
  if (isAbsolute) {
    scrollOffset = Math.max(0, Math.min(totalSlots - 1, delta));
  } else {
    scrollOffset = Math.max(0, Math.min(totalSlots - 1, scrollOffset + delta / SLOT_WIDTH));
  }

  if (scrollOffset !== prevOffset || isAbsolute) {
    render();
    syncViewport();
    $signalReadout.textContent = 'Viewport subscribed';

    if (window.updateNeighborhood) {
      window.updateNeighborhood(Math.floor(scrollOffset / 100));
    }
  }
}

function syncViewport(force = false) {
  const visibleCount = Math.ceil(viewportWidth / SLOT_WIDTH) + 10;
  const from = Math.max(0, Math.floor(scrollOffset) - 5);
  const to = from + visibleCount;

  if (force || Math.abs(from - lastSubscribedRange.from) > 5 || Math.abs(to - lastSubscribedRange.to) > 5) {
    send({ type: 'viewport_subscribe', from_position: from, to_position: to });
    lastSubscribedRange = { from, to };
  }
}

window.addEventListener('wheel', (e) => updateScroll(e.deltaY || e.deltaX), { passive: true });
window.addEventListener('resize', () => {
  viewportWidth = $strip.clientWidth;
  render();
});

$btnFront.addEventListener('click', () => updateScroll(0, true));
$btnMe.addEventListener('click', () => {
  if (myPosition === null) return;
  const targetOffset = Math.max(0, myPosition - Math.floor(viewportWidth / SLOT_WIDTH / 2));
  updateScroll(targetOffset, true);
});
$btnBack.addEventListener('click', () => {
  const targetOffset = Math.max(0, totalSlots - Math.floor(viewportWidth / SLOT_WIDTH / 2));
  updateScroll(targetOffset, true);
});
$lineTuner.addEventListener('input', () => updateScroll(Number($lineTuner.value), true));
document.addEventListener('click', (event) => {
  if (!$announcement.classList.contains('visible')) return;
  if ($announcement.contains(event.target)) return;
  hideAnnouncement();
});

function getOrdinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function updatePosition(absPos, waitPos) {
  myPosition = absPos;
  myWaitingPosition = waitPos;

  if (myStartingPosition === null && waitPos !== null) {
    myStartingPosition = waitPos;
    const $started = document.getElementById('started-status');
    $started.textContent = `Started ${getOrdinal(waitPos + 1)} in line`;
    $started.style.display = 'block';
  }

  const $current = document.getElementById('current-status');
  const seqDisplay = mySeq !== null ? `#${mySeq}` : '—';

  if (myChecked) {
    $posNumber.textContent = `✓ ${seqDisplay}`;
    $posNumber.style.color = 'var(--green)';
    $posNumber.title = `Sequence ${mySeq}`;
    $current.textContent = 'The contest recognizes your completed box.';
    showStatus('The contest notes your victory.', 'positive');
    document.title = `✓ ${seqDisplay} — The Waiting Game`;
  } else if (waitPos === 0) {
    $posNumber.textContent = seqDisplay;
    $posNumber.style.color = 'var(--red)';
    $posNumber.title = `Sequence ${mySeq}`;
    $current.textContent = 'First in line. Your box is now relevant.';
    document.title = `${seqDisplay} — The Waiting Game`;
  } else {
    $posNumber.textContent = seqDisplay;
    $posNumber.style.color = '';
    $posNumber.title = `Sequence ${mySeq}`;
    $current.textContent = `${getOrdinal(waitPos + 1)} in line. Remain tuned.`;
    document.title = `${seqDisplay} — The Waiting Game`;
  }
}

function updateDepartures() {
  if (departuresTotal === 0) {
    $departureCounter.innerHTML = '<span>Departures today</span>Awaiting report';
    return;
  }
  $departureCounter.innerHTML = '<span>Departures today</span>' + departuresTotal.toLocaleString() + ' returned';
}

function showAnnouncement(text, tone = 'positive') {
  if (!getSetting('announcements')) return;
  if (announcementTimer) clearTimeout(announcementTimer);
  $announcement.innerHTML = '';

  const content = document.createElement('span');
  content.className = 'announcement-content';
  content.textContent = text;

  const close = document.createElement('button');
  close.className = 'announcement-close';
  close.type = 'button';
  close.setAttribute('aria-label', 'Dismiss broadcast interruption');
  close.textContent = '×';
  close.addEventListener('click', (event) => {
    event.stopPropagation();
    hideAnnouncement();
  });

  $announcement.append(content, close);
  $announcement.style.backgroundColor = tone === 'positive' ? 'var(--green)' : 'var(--red)';
  $announcement.style.color = tone === 'positive' ? 'var(--black)' : '#fff8df';
  $announcement.classList.add('visible');
  announcementTimer = setTimeout(hideAnnouncement, 12000);
}

function hideAnnouncement() {
  if (announcementTimer) {
    clearTimeout(announcementTimer);
    announcementTimer = null;
  }
  $announcement.classList.remove('visible');
}

function showStatus(text, tone = 'neutral') {
  $status.textContent = text;
  $lowerThirdLabel.textContent =
    tone === 'negative' ? 'Signal Alert' : tone === 'positive' ? 'Line Recognition' : 'Line Update';
  $lowerThirdText.textContent = text;
  $signalReadout.textContent = tone === 'negative' ? 'Signal troubled' : 'Viewport subscribed';
}

function formatDuration(ms) {
  const s = Math.floor(ms / 1000);
  if (s < 60) return s + 's';
  const m = Math.floor(s / 60);
  if (m < 60) return m + 'm ' + (s % 60) + 's';
  const h = Math.floor(m / 60);
  return h + 'h ' + (m % 60) + 'm';
}

function updateBroadcastReadout(startPos, endPos) {
  if (totalSlots === 0) {
    $rangeReadout.textContent = 'Awaiting viewport assignment';
    return;
  }
  const start = Math.max(0, startPos + 1).toLocaleString();
  const end = Math.max(0, endPos + 1).toLocaleString();
  $rangeReadout.textContent = `Viewing positions #${start} - #${end} of ${totalSlots.toLocaleString()} active boxes`;
}

function updateClock() {
  const now = new Date();
  $clockReadout.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  if (joinedAtMs === null) {
    $elapsedReadout.textContent = 'Elapsed --:--:--';
    return;
  }
  $elapsedReadout.textContent = `Elapsed ${formatDuration(Date.now() - joinedAtMs)}`;
}

function handleWsMessage(ev) {
  let msg;
  try {
    msg = JSON.parse(ev.data);
  } catch (_) {
    return;
  }

  switch (msg.type) {
    case 'joined':
      mySeq = msg.seq;
      joinedAtMs = Date.now();
      $connectingMsg.style.display = 'none';
      $stripContainer.style.display = 'grid';
      viewportWidth = $strip.clientWidth || window.innerWidth - 64;
      scrollOffset = Math.max(0, msg.position - Math.floor(viewportWidth / SLOT_WIDTH / 2));
      updatePosition(msg.position, msg.waiting_position);
      startPingLoop();
      showStatus(
        msg.waiting_position === 0
          ? 'You are first in line. It is your turn when you are ready.'
          : 'You are in line. The broadcast has located your box.',
        msg.waiting_position === 0 ? 'positive' : 'neutral'
      );
      syncViewport(true);
      initP2P();
      break;

    case 'range_state': {
      totalSlots = msg.total;
      $signalReadout.textContent = 'Viewport subscribed';
      const mine = mySeq !== null ? slots.get(mySeq) : null;
      slots.clear();
      if (mine) slots.set(mySeq, mine);
      for (const s of msg.slots) {
        slots.set(s.seq, { seq: s.seq, position: s.position, state: s.state });
      }
      render();
      break;
    }

    case 'range_update':
      slots.set(msg.seq, { seq: msg.seq, position: msg.position, state: msg.state });
      if (msg.position >= totalSlots) totalSlots = msg.position + 1;
      if (msg.seq === mySeq && msg.state === 'checked') myChecked = true;
      render();
      break;

    case 'position_update':
      updatePosition(msg.position, msg.waiting_position);
      if (mySeq !== null && slots.has(mySeq)) {
        slots.get(mySeq).position = msg.position;
      }
      render();
      break;

    case 'left': {
      const s = slots.get(msg.seq);
      if (s) {
        s.state = 'ghost';
        render();
        setTimeout(() => {
          slots.delete(msg.seq);
          render();
        }, 30000);
      }
      departuresTotal = msg.departures_today;
      updateDepartures();
      showStatus(`Contestant #${msg.seq} has departed. The line has adjusted.`, 'negative');
      break;
    }

    case 'check_ok':
      myChecked = true;
      if (slots.has(mySeq)) slots.get(mySeq).state = 'checked';
      updatePosition(msg.position, 0);
      showStatus('You have checked your box. The contest notes your participation.', 'positive');
      render();
      break;

    case 'winner':
      showAnnouncement(
        `Contestant #${msg.seq} completed after ${formatDuration(msg.duration_ms)}. ${getCopy('winner')}`
      );
      if (msg.seq !== mySeq)
        showStatus('Someone ahead of you has finished. The line adjusts.', 'neutral');
      refreshActivityPanel();
      break;
  }
}

// ── Activity & Endurance Panels ──
const $activityPanel = document.getElementById('activity-panel');
const $activityList = document.getElementById('activity-list');
const $endurancePanel = document.getElementById('endurance-panel');
const $enduranceList = document.getElementById('endurance-list');

async function refreshActivityPanel() {
  try {
    const res = await fetch('/activity');
    if (!res.ok) return;
    const data = await res.json();
    $activityPanel.style.display = 'block';
    $activityList.innerHTML =
      (data.activity || [])
        .map((w) => `<div style="margin-bottom:2px;">#${w.seq} — ${formatDuration(w.duration_ms)}</div>`)
        .join('') || '<div style="color:var(--muted);">No activity yet.</div>';
  } catch (_) {}
}

async function refreshEndurancePanel() {
  try {
    const res = await fetch('/endurance');
    if (!res.ok) return;
    const data = await res.json();
    $endurancePanel.style.display = 'block';
    $enduranceList.innerHTML =
      (data.entries || [])
        .map(
          (e, i) => `<div style="margin-bottom:2px;">${i + 1}. #${e.seq} — ${formatDuration(e.duration_ms)}</div>`
        )
        .join('') || '<div style="color:var(--muted);">No records yet.</div>';
  } catch (_) {}
}

updateClock();
setInterval(updateClock, 1000);
connect();
refreshActivityPanel();
refreshEndurancePanel();
setInterval(refreshEndurancePanel, 30000);
