// kimap/modules/global-settings.js

import { getTheaterDestination } from "./top-bar/model.js";

export function initGlobalSettings(windowManager, constantsData, artifactsData) {
    const paneElement = document.getElementById('pane-global-settings');

    const sidebar = document.getElementById('settings-sidebar');
    const mainContent = document.getElementById('settings-main');

    // DEFINE THE LIFECYCLE HOOK
    // This runs whenever the theater is opened.
    const onShow = () => {
        // Only populate if empty (Load once)
        // Remove this 'if' block later for windows that need live refreshing
        if (sidebar && sidebar.children.length === 0) {
            console.log("Populating Global Settings UI...");
            populateSettingsUI(constantsData, artifactsData, sidebar, mainContent);
        }
    };

    // 1. Register with Window Manager (Passing the onShow callback!)
    if (windowManager && paneElement) {
        windowManager.register(
            'settings',
            getTheaterDestination('settings')?.label,
            paneElement,
            onShow
        );
    }

    console.log("Global Settings Module Initialized (Unified).");
}

function populateSettingsUI(constantsData, artifactsData, sidebar, mainContent) {
    // --- PART A: CONSTANTS ---
    if (constantsData) {
        const categories = categorizeConstants(constantsData);
        Object.keys(categories).forEach((categoryName, index) => {
            const btn = createSidebarBtn(categoryName, sidebar);
            btn.addEventListener('click', () => {
                setActiveBtn(btn, sidebar);
                renderCategoryInputs(categoryName, categories[categoryName], mainContent);
            });
            if (index === 0) btn.click();
        });
    }

    // --- PART B: ARTIFACTS ---
    if (artifactsData && Object.keys(artifactsData).length > 0) {
        const hr = document.createElement('hr');
        hr.style.margin = '0.5rem 0';
        hr.style.borderColor = 'var(--pico-muted-border-color)';
        sidebar.appendChild(hr);

        const artBtn = createSidebarBtn('Artifacts', sidebar);
        artBtn.addEventListener('click', () => {
            setActiveBtn(artBtn, sidebar);
            renderArtifactsTable(artifactsData, mainContent);
        });
    }
}

// --- Renderers ---

function renderCategoryInputs(categoryName, dataObj, container) {
    let html = `<h3>${categoryName}</h3><div class="setting-group">`;
    Object.entries(dataObj).forEach(([key, value]) => {
        let displayValue = value;
        if (typeof value === 'object' && value !== null) displayValue = JSON.stringify(value);
        html += `
            <div class="setting-row">
                <label>${formatLabel(key)}</label>
                <input type="text" value="${displayValue}" readonly disabled>
            </div>`;
    });
    html += `</div>`;
    container.innerHTML = html;
}

function renderArtifactsTable(artifactsData, container) {
    const firstEntry = Object.values(artifactsData || {})[0];
    const items = firstEntry?.ReferenceCategories?.items;

    if (!items || items.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>No artifact item data found.</p></div>';
        return;
    }

    let html = `<h3>Artifact Item Counts</h3>`;
    html += `<div class="setting-group" style="padding: 0; overflow: hidden;">`;
    html += `<table class="striped" style="margin-bottom: 0;">`;
    html += `<thead><tr><th style="padding: 1rem;">Item Name</th><th style="padding: 1rem;">World Count</th></tr></thead>`;
    html += `<tbody>`;

    const sortedItems = [...items].sort((a, b) => a.Name.localeCompare(b.Name));

    sortedItems.forEach(item => {
        html += `<tr>
            <td style="padding: 0.5rem 1rem;">${item.Name}</td>
            <td style="padding: 0.5rem 1rem;">${item.Value0}</td>
        </tr>`;
    });

    html += `</tbody></table></div>`;
    container.innerHTML = html;
}

// --- Helpers ---

function createSidebarBtn(text, sidebar) {
    const btn = document.createElement('button');
    btn.className = 'settings-category-btn';
    btn.textContent = text;
    sidebar.appendChild(btn);
    return btn;
}

function setActiveBtn(targetBtn, sidebar) {
    const allBtns = sidebar.querySelectorAll('.settings-category-btn');
    allBtns.forEach(b => b.classList.remove('active'));
    targetBtn.classList.add('active');
}

function categorizeConstants(constants) {
    const groups = {
        'Combat': ['attack', 'block', 'damage', 'slots'],
        'Health': ['bleed', 'blood', 'heal', 'medic', 'starvation'],
        'Progression': ['xp', 'skill', 'research', 'build'],
        'Economy': ['price', 'mult'],
        'Base Building': ['gate', 'wall', 'output']
    };
    const result = { 'Miscellaneous': {} };
    Object.keys(groups).forEach(k => result[k] = {});

    let valuesToMap = constants;
    const firstKey = Object.keys(constants)[0];
    if (constants[firstKey]?.Values) valuesToMap = constants[firstKey].Values;

    Object.entries(valuesToMap).forEach(([key, val]) => {
        let placed = false;
        for (const [groupName, keywords] of Object.entries(groups)) {
            if (keywords.some(word => key.includes(word))) {
                result[groupName][key] = val;
                placed = true;
                break;
            }
        }
        if (!placed) result['Miscellaneous'][key] = val;
    });
    Object.keys(result).forEach(k => {
        if (Object.keys(result[k]).length === 0) delete result[k];
    });
    return result;
}

function formatLabel(key) {
    return key.replace(/\b\w/g, l => l.toUpperCase());
}
