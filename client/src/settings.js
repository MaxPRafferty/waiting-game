const STORAGE_KEY = 'wg_settings';

const defaults = {
  soundEnabled: false,
  chatVisible: true,
  chatMinimized: false,
  announcements: true,
  scanlineEffect: true,
};

let settings = { ...defaults };

export function loadSettings() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      settings = { ...defaults, ...JSON.parse(stored) };
    }
  } catch (_) {
    settings = { ...defaults };
  }
  return settings;
}

export function saveSettings() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function getSetting(key) {
  return settings[key];
}

export function setSetting(key, value) {
  settings[key] = value;
  saveSettings();
  applySettings();
}

export function toggleSetting(key) {
  settings[key] = !settings[key];
  saveSettings();
  applySettings();
  return settings[key];
}

export function applySettings() {
  const chatPanel = document.getElementById('chat-panel');
  const chatTab = document.getElementById('chat-tab');
  const chatEnabled = settings.chatVisible;
  const chatMinimized = settings.chatMinimized;

  if (chatPanel) {
    chatPanel.style.display = chatEnabled && !chatMinimized ? 'flex' : 'none';
    chatPanel.setAttribute('aria-hidden', String(!chatEnabled || chatMinimized));
  }

  if (chatTab) {
    chatTab.style.display = chatEnabled && chatMinimized ? 'inline-flex' : 'none';
    chatTab.setAttribute('aria-expanded', String(chatEnabled && !chatMinimized));
  }

  const scanline = document.body;
  if (scanline) {
    scanline.classList.toggle('no-scanlines', !settings.scanlineEffect);
  }
}

export function initSettingsView(container) {
  const sections = [
    {
      title: 'Broadcast Preferences',
      settings: [
        {
          key: 'announcements',
          label: 'Winner Announcements',
          description: 'Show broadcast interruptions when someone checks their box',
        },
        {
          key: 'scanlineEffect',
          label: 'CRT Scanline Effect',
          description: 'The vintage broadcast overlay across the screen',
        },
      ],
    },
    {
      title: 'Communication',
      settings: [
        {
          key: 'chatVisible',
          label: 'Neighborhood Chat',
          description: 'Show the P2P chat panel for nearby contestants',
        },
      ],
    },
  ];

  container.innerHTML = '';

  for (const section of sections) {
    const sectionEl = document.createElement('div');
    sectionEl.className = 'settings-section';

    const titleEl = document.createElement('div');
    titleEl.className = 'settings-section-title';
    titleEl.textContent = section.title;
    sectionEl.appendChild(titleEl);

    for (const setting of section.settings) {
      const row = document.createElement('div');
      row.className = 'setting-row';

      const labelWrap = document.createElement('div');

      const label = document.createElement('div');
      label.className = 'setting-label';
      label.textContent = setting.label;
      labelWrap.appendChild(label);

      if (setting.description) {
        const desc = document.createElement('div');
        desc.className = 'setting-description';
        desc.textContent = setting.description;
        labelWrap.appendChild(desc);
      }

      const toggle = document.createElement('button');
      toggle.className = 'toggle' + (settings[setting.key] ? ' on' : '');
      toggle.setAttribute('role', 'switch');
      toggle.setAttribute('aria-checked', String(settings[setting.key]));
      toggle.setAttribute('aria-label', setting.label);

      toggle.addEventListener('click', () => {
        const newVal = toggleSetting(setting.key);
        toggle.classList.toggle('on', newVal);
        toggle.setAttribute('aria-checked', String(newVal));
      });

      row.appendChild(labelWrap);
      row.appendChild(toggle);
      sectionEl.appendChild(row);
    }

    container.appendChild(sectionEl);
  }
}
