/**
 * Data Module - Export/Import and MCP Sync Functions
 * Handles data persistence, backup, and synchronization with MCP server
 */

// ============================================
// EXPORT/IMPORT FUNCTIONS
// ============================================
function exportData() {
    const data = window.currentData;
    if (!data) {
        showToast('No data to export', 'error');
        return;
    }

    const exportPayload = {
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        exportedFrom: 'Job Search Command Center',
        data: data
    };

    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `job-search-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast('Data exported successfully');
}

async function importData(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
        const text = await file.text();
        const imported = JSON.parse(text);

        // Validate structure
        if (!imported.data || !imported.data.jobs) {
            throw new Error('Invalid file format: missing jobs data');
        }

        // Version check
        if (imported.version && imported.version !== '1.0.0') {
            if (!confirm(`File version ${imported.version} may not be fully compatible. Continue?`)) {
                return;
            }
        }

        // Confirm import strategy
        const replace = confirm(
            `Found ${imported.data.jobs.length} jobs in backup.\n\n` +
            `OK = Replace all current data\n` +
            `Cancel = Merge (add new jobs, update existing)`
        );

        if (replace) {
            // Full replace
            await saveData(imported.data);
            window.currentData = imported.data;
        } else {
            // Merge strategy
            const currentData = window.currentData;
            const existingIds = new Set(currentData.jobs.map(j => j.id));

            let added = 0, updated = 0;
            imported.data.jobs.forEach(job => {
                if (existingIds.has(job.id)) {
                    // Update existing
                    const index = currentData.jobs.findIndex(j => j.id === job.id);
                    currentData.jobs[index] = job;
                    updated++;
                } else {
                    // Add new
                    currentData.jobs.push(job);
                    added++;
                }
            });

            // Merge search history (add any missing entries)
            if (imported.data.searchHistory) {
                const existingTimestamps = new Set(currentData.searchHistory.map(h => h.timestamp));
                imported.data.searchHistory.forEach(entry => {
                    if (!existingTimestamps.has(entry.timestamp)) {
                        currentData.searchHistory.push(entry);
                    }
                });
                currentData.searchHistory.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            }

            await saveData(currentData);
            showToast(`Merged: ${added} added, ${updated} updated`);
        }

        // Reload the page to reflect changes
        location.reload();

    } catch (e) {
        console.error('Import error:', e);
        showToast('Import failed: ' + e.message, 'error');
    }

    // Reset file input
    event.target.value = '';
}

// ============================================
// MCP SYNC FUNCTIONS
// ============================================

// Check if running on local server (enables auto-sync)
function isLocalServer() {
    return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
}

// Auto-sync to server API (when running on localhost)
async function autoSyncToServer() {
    if (!isLocalServer()) return false;

    const data = window.currentData;
    if (!data || !data.jobs) return false;

    try {
        const exportData = {
            jobs: data.jobs,
            searchHistory: data.searchHistory || [],
            settings: data.settings || {},
            exportedAt: new Date().toISOString()
        };

        const response = await fetch('/api/jobs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(exportData)
        });

        if (!response.ok) throw new Error('Server sync failed');
        return true;
    } catch (err) {
        return false;
    }
}

// Export jobs to JSON file for MCP server
async function syncToMCP() {
    const data = window.currentData;
    if (!data || !data.jobs) {
        showToast('No data to sync', 'error');
        return;
    }

    // Try server sync first if on localhost
    if (isLocalServer()) {
        const synced = await autoSyncToServer();
        if (synced) {
            showToast(`Synced ${data.jobs.length} jobs to MCP server`, 'success');
            return;
        }
    }

    // Fallback: download JSON file
    const exportPayload = {
        jobs: data.jobs,
        searchHistory: data.searchHistory || [],
        settings: data.settings || {},
        exportedAt: new Date().toISOString()
    };

    const json = JSON.stringify(exportPayload, null, 2);
    const blob = new Blob([json], {type: 'application/json'});
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'jobs.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast(`Exported ${data.jobs.length} jobs. Move to mcp-server/data/jobs.json`, 'success');
}

// Import jobs from MCP server or file
async function importFromMCP() {
    // Try server fetch first if on localhost
    if (isLocalServer()) {
        try {
            const response = await fetch('/api/jobs');
            if (response.ok) {
                const imported = await response.json();
                if (imported.jobs && imported.jobs.length > 0) {
                    await mergeImportedJobs(imported);
                    return;
                }
            }
        } catch (err) {
            console.warn('Server fetch failed, falling back to file picker:', err.message);
        }
    }

    // Fallback: file picker
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';

    input.onchange = async (e) => {
        try {
            const file = e.target.files[0];
            if (!file) return;

            const text = await file.text();
            const imported = JSON.parse(text);
            await mergeImportedJobs(imported);

        } catch (err) {
            console.error('Import from MCP error:', err);
            showToast('Import failed: ' + err.message, 'error');
        }
    };

    input.click();
}

// Combined sync: pull from MCP then push to MCP
async function syncMCP() {
    if (!isLocalServer()) {
        showToast('Sync only works on localhost server', 'error');
        return;
    }

    try {
        // Step 1: Pull from server
        const response = await fetch('/api/jobs');
        if (response.ok) {
            const serverData = await response.json();
            if (serverData.jobs && serverData.jobs.length > 0) {
                // Merge server data into local
                let pulled = 0;
                for (const job of serverData.jobs) {
                    const existingIndex = window.currentData.jobs.findIndex(j => j.id === job.id);
                    if (existingIndex >= 0) {
                        // Server has newer data? Use server's
                        window.currentData.jobs[existingIndex] = job;
                    } else {
                        window.currentData.jobs.push(job);
                        pulled++;
                    }
                }
            }
        }

        // Step 2: Push local data to server
        const synced = await autoSyncToServer();
        if (synced) {
            await saveData(window.currentData);
            renderJobs(window.currentData.jobs);
            updateStats(window.currentData);
            showToast(`Synced ${window.currentData.jobs.length} jobs with MCP`, 'success');
        } else {
            showToast('Sync failed', 'error');
        }
    } catch (err) {
        console.error('Sync error:', err);
        showToast('Sync error: ' + err.message, 'error');
    }
}

// Helper: merge imported jobs with current data
async function mergeImportedJobs(imported) {
    if (!imported.jobs || !Array.isArray(imported.jobs)) {
        showToast('Invalid data: no jobs array found', 'error');
        return;
    }

    const currentCount = window.currentData?.jobs?.length || 0;
    const importedCount = imported.jobs.length;

    if (currentCount > 0 && confirm(`Replace ${currentCount} current jobs with ${importedCount} imported jobs?\n\nClick OK to replace, Cancel to merge.`)) {
        // Full replace
        window.currentData = imported;
        await saveData(imported);
    } else if (currentCount > 0) {
        // Merge: add new jobs, update existing
        let added = 0, updated = 0;

        for (const job of imported.jobs) {
            const existingIndex = window.currentData.jobs.findIndex(j => j.id === job.id);
            if (existingIndex >= 0) {
                // Update existing job
                window.currentData.jobs[existingIndex] = job;
                updated++;
            } else {
                // Add new job
                window.currentData.jobs.push(job);
                added++;
            }
        }

        await saveData(window.currentData);
        showToast(`Merged: ${added} new, ${updated} updated`, 'success');
        renderJobs(window.currentData.jobs);
        return;
    } else {
        // No current data, just import
        window.currentData = imported;
        await saveData(imported);
    }

    renderJobs(window.currentData.jobs);
    showToast(`Imported ${importedCount} jobs from MCP`, 'success');
}
