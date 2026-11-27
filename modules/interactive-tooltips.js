// modules/interactive-tooltips.js

export function initInteractiveTooltips(config) {
    const tooltipEl = document.getElementById(config.tooltipId || 'kim-tooltip');
    const onNavigate = config.onNavigate; // The callback function
    let activeTrigger = null;
    let hideTimeout = null;

    if (!tooltipEl) {
        console.error("Interactive Tooltips: Container element not found.");
        return;
    }

    // --- Core Logic ---

    const showTooltip = (trigger, htmlContent) => {
        if (hideTimeout) {
            clearTimeout(hideTimeout);
            hideTimeout = null;
        }

        activeTrigger = trigger;
        tooltipEl.innerHTML = htmlContent;
        tooltipEl.classList.add('visible');

        // Positioning Logic
        const rect = trigger.getBoundingClientRect();
        const tooltipRect = tooltipEl.getBoundingClientRect();
        
        // Default: Bottom-Right of cursor
        let top = rect.bottom + 10; 
        let left = rect.left;

        // Boundary Checks
        if (left + tooltipRect.width > window.innerWidth) {
            left = window.innerWidth - tooltipRect.width - 10;
        }
        if (top + tooltipRect.height > window.innerHeight) {
            top = rect.top - tooltipRect.height - 10; // Flip to top
        }

        tooltipEl.style.top = `${top}px`;
        tooltipEl.style.left = `${left}px`;
    };

    const hideTooltip = (immediate = false) => {
        if (immediate) {
            tooltipEl.classList.remove('visible');
            activeTrigger = null;
            return;
        }
        // Grace period allows mouse to move from icon -> tooltip
        hideTimeout = setTimeout(() => {
            tooltipEl.classList.remove('visible');
            activeTrigger = null;
        }, 500);
    };

    // --- Event Listeners ---

    // 1. Mouse enters a help icon (Delegation)
    document.body.addEventListener('mouseover', (e) => {
        if (e.target.classList.contains('help-trigger') || e.target.classList.contains('help-badge')) {
            const title = e.target.dataset.tooltipTitle || "Help";
            const content = e.target.dataset.tooltipContent || "";
            const section = e.target.dataset.helpSection; // The ID of the help section

            // Build HTML
            // Note: We add a data attribute to the link, NOT an onclick handler
            let html = `<h5>${title}</h5><p>${content}</p>`;
            if (section) {
                html += `<a href="#" data-section-target="${section}">Read Guide &raquo;</a>`;
            }

            showTooltip(e.target, html);
        }
    });

    // 2. Mouse leaves a help icon
    document.body.addEventListener('mouseout', (e) => {
        if (e.target.classList.contains('help-icon-trigger')) {
            hideTooltip();
        }
    });

    // 3. Mouse interaction with the Tooltip itself
    tooltipEl.addEventListener('mouseenter', () => {
        if (hideTimeout) clearTimeout(hideTimeout);
    });

    tooltipEl.addEventListener('mouseleave', () => {
        hideTooltip();
    });

    // 4. Handling clicks inside the tooltip (The Navigation Callback)
    tooltipEl.addEventListener('click', (e) => {
        // Check if the clicked element is our "Read Guide" link
        if (e.target.matches('a[data-section-target]')) {
            e.preventDefault();
            const sectionId = e.target.dataset.sectionTarget;
            
            // Execute the callback passed from script.js
            if (typeof onNavigate === 'function') {
                onNavigate(sectionId);
            }

            hideTooltip(true); // Close immediately
        }
    });

    console.log("Interactive Tooltips Module Initialized.");
}