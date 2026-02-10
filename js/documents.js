/**
 * Document Management Module
 * File upload, storage, and display functions
 */

let currentDocFilter = 'all';

// ============================================
// FILE UPLOAD HANDLERS
// ============================================

// Handle global file upload (from Documents tab)
async function handleGlobalUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Ask which job to link to (or none)
    const jobId = await promptJobSelection(file.name);

    try {
        const docId = await DocStore.saveDocument(jobId, file, detectDocType(file.name));
        await renderDocuments();
        updateStorageUsage();
        showNotification(`✓ Uploaded: ${file.name}`);
    } catch (err) {
        console.error('Upload failed:', err);
        alert('Failed to upload file: ' + err.message);
    }

    event.target.value = ''; // Reset input
}

// Handle file upload for specific job
async function handleJobUpload(event, jobId, docType) {
    const file = event.target.files[0];
    if (!file) return;

    try {
        await DocStore.saveDocument(jobId, file, docType);
        await renderDocuments();
        updateStorageUsage();
        showNotification(`✓ Uploaded: ${file.name}`);
        // Refresh job modal if open
        if (document.getElementById('jobModal').style.display === 'block') {
            const data = await initStorage();
            const job = data.jobs.find(j => j.id === jobId);
            if (job) openJobModal(job);
        }
    } catch (err) {
        console.error('Upload failed:', err);
        alert('Failed to upload file: ' + err.message);
    }

    event.target.value = '';
}

// Detect document type from filename
function detectDocType(filename) {
    const lower = filename.toLowerCase();
    if (lower.includes('resume') || lower.includes('cv')) return 'resume';
    if (lower.includes('cover') || lower.includes('letter')) return 'cover_letter';
    if (lower.includes('jd') || lower.includes('job') || lower.includes('description')) return 'job_description';
    if (lower.includes('research') || lower.includes('notes') || lower.includes('prep')) return 'research';
    return 'general';
}

// ============================================
// JOB SELECTION PROMPT
// ============================================

// Prompt user to select a job to link document to
async function promptJobSelection(filename) {
    const data = await initStorage();
    const jobs = data.jobs.filter(j => j.status !== 'archived');

    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'block';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 500px;">
                <h2>Link Document to Job</h2>
                <p style="color: #6c757d; margin: 10px 0;">Uploading: <strong>${escapeHtml(filename)}</strong></p>
                <p style="margin-bottom: 15px;">Select a job to link this document to, or choose "No Link" to upload without linking:</p>
                <select id="jobSelectForDoc" style="width: 100%; padding: 10px; border: 2px solid #e0e4e8; border-radius: 6px; margin-bottom: 15px;">
                    <option value="">-- No Link (General Document) --</option>
                    ${jobs.map(j => `<option value="${j.id}">${escapeHtml(j.company)} - ${escapeHtml(j.title)}</option>`).join('')}
                </select>
                <div style="display: flex; gap: 10px; justify-content: flex-end;">
                    <button onclick="this.closest('.modal').remove(); window._docResolve(null);" style="padding: 10px 20px; border: 2px solid #e0e4e8; background: white; border-radius: 6px; cursor: pointer;">Cancel</button>
                    <button onclick="const v = document.getElementById('jobSelectForDoc').value; this.closest('.modal').remove(); window._docResolve(v ? parseInt(v) : null);" class="btn-primary">Upload</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        window._docResolve = resolve;
    });
}

// ============================================
// DOCUMENT RENDERING
// ============================================

// Render documents in the Documents tab
async function renderDocuments() {
    const container = document.getElementById('documentsContainer');
    const noDocsMsg = document.getElementById('noDocuments');
    if (!container || !noDocsMsg) return;
    const data = await initStorage();

    try {
        const { documents, fileRefs } = await DocStore.getAllDocuments();
        const allDocs = [
            ...documents.map(d => ({ ...d, source: 'uploaded' })),
            ...fileRefs.map(r => ({ ...r, source: 'reference' }))
        ];

        // Filter by type
        const filtered = currentDocFilter === 'all'
            ? allDocs
            : allDocs.filter(d => d.type === currentDocFilter);

        if (filtered.length === 0) {
            container.innerHTML = '';
            noDocsMsg.style.display = 'block';
            return;
        }

        noDocsMsg.style.display = 'none';

        container.innerHTML = filtered.map(doc => {
            const job = doc.jobId ? data.jobs.find(j => j.id === doc.jobId) : null;
            const typeColors = {
                resume: '#10b981',
                cover_letter: '#3b82f6',
                job_description: '#f59e0b',
                research: '#8b5cf6',
                general: '#6c757d'
            };
            const typeLabels = {
                resume: '📄 Resume',
                cover_letter: '✉️ Cover Letter',
                job_description: '📋 Job Description',
                research: '🔍 Research',
                general: '📎 Document'
            };

            return `
                <div class="doc-card" style="background: white; border: 1px solid #e0e4e8; border-radius: 8px; padding: 15px; border-left: 4px solid ${typeColors[doc.type] || '#6c757d'};">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px;">
                        <span style="background: ${typeColors[doc.type] || '#6c757d'}; color: white; font-size: 11px; padding: 3px 8px; border-radius: 4px;">
                            ${typeLabels[doc.type] || 'Document'}
                        </span>
                        <button onclick="deleteDocument(${doc.id}, '${doc.source}')" style="background: none; border: none; color: #dc2626; cursor: pointer; font-size: 16px;" title="Delete">🗑️</button>
                    </div>
                    <h4 style="margin: 0 0 8px 0; font-size: 14px; word-break: break-word;">${escapeHtml(doc.name)}</h4>
                    ${job ? `<p style="color: #667eea; font-size: 12px; margin: 0 0 8px 0;">🔗 ${escapeHtml(job.company)}</p>` : ''}
                    <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: #6c757d;">
                        <span>${doc.source === 'uploaded' ? formatFileSize(doc.size || 0) : 'File Reference'}</span>
                        <span>${new Date(doc.uploadedAt || doc.addedAt).toLocaleDateString()}</span>
                    </div>
                    ${doc.source === 'uploaded' ? `
                        <button onclick="viewDocument(${doc.id})" style="margin-top: 10px; width: 100%; padding: 8px; background: #f7f9fc; border: 1px solid #e0e4e8; border-radius: 4px; cursor: pointer; font-size: 12px;">
                            👁️ View
                        </button>
                    ` : `
                        <div style="margin-top: 10px; padding: 8px; background: #f7f9fc; border-radius: 4px; font-size: 11px; color: #6c757d; word-break: break-all;">
                            ${escapeHtml(doc.path)}
                        </div>
                    `}
                </div>
            `;
        }).join('');

    } catch (err) {
        console.error('Failed to render documents:', err);
        container.innerHTML = '<p style="color: #dc2626;">Error loading documents</p>';
    }
}

// Filter documents by type
function filterDocuments(type) {
    currentDocFilter = type;
    document.querySelectorAll('#archive .filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.textContent.toLowerCase().includes(type) || (type === 'all' && btn.textContent.includes('All')));
    });
    renderDocuments();
}

// ============================================
// DOCUMENT VIEWING & DELETION
// ============================================

// View uploaded document
async function viewDocument(docId) {
    try {
        const { documents } = await DocStore.getAllDocuments();
        const doc = documents.find(d => d.id === docId);
        if (!doc) {
            alert('Document not found');
            return;
        }

        // Open in new tab
        const newWindow = window.open();
        if (doc.mimeType === 'application/pdf') {
            newWindow.document.write(`
                <html>
                <head><title>${escapeHtml(doc.name)}</title></head>
                <body style="margin:0;">
                    <embed src="${doc.data}" type="application/pdf" width="100%" height="100%" style="position:absolute;top:0;left:0;right:0;bottom:0;">
                </body>
                </html>
            `);
        } else {
            newWindow.document.write(`
                <html>
                <head><title>${escapeHtml(doc.name)}</title></head>
                <body>
                    <h1>${escapeHtml(doc.name)}</h1>
                    <p>File type: ${doc.mimeType}</p>
                    <a href="${doc.data}" download="${escapeHtml(doc.name)}">Download File</a>
                </body>
                </html>
            `);
        }
    } catch (err) {
        console.error('Failed to view document:', err);
        alert('Failed to open document');
    }
}

// Delete document
async function deleteDocument(id, source) {
    if (!confirm('Delete this document?')) return;

    try {
        if (source === 'uploaded') {
            await DocStore.deleteDocument(id);
        } else {
            await DocStore.deleteFileRef(id);
        }
        await renderDocuments();
        updateStorageUsage();
        showNotification('Document deleted');
    } catch (err) {
        console.error('Failed to delete:', err);
        alert('Failed to delete document');
    }
}

// Update storage usage display
async function updateStorageUsage() {
    try {
        const usage = await DocStore.getStorageUsage();
        document.getElementById('storageUsage').textContent = `${usage.count} files (${usage.formattedSize})`;
    } catch (err) {
        console.error('Failed to get storage usage:', err);
    }
}

// Show notification toast (document-specific)
function showNotification(message) {
    const toast = document.createElement('div');
    toast.style.cssText = 'position: fixed; bottom: 20px; right: 20px; background: #10b981; color: white; padding: 12px 20px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.2); z-index: 10000; animation: slideIn 0.3s ease;';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// ============================================
// SERVER-BASED DOCUMENT FUNCTIONS
// ============================================

// Scan existing files and auto-link to jobs via server API
async function scanExistingFiles() {
    if (!isLocalServer()) {
        alert('Auto-linking requires the local server.\n\nRun: npm start\nThen open: http://localhost:3000');
        return;
    }

    const btn = event.target;
    btn.disabled = true;
    btn.textContent = '⏳ Scanning...';

    try {
        const response = await fetch('/api/documents/auto-link', { method: 'POST' });
        const result = await response.json();

        if (result.success) {
            showToast(`Linked ${result.linkedCount} documents to jobs`, 'success');
            // Refresh documents display
            await renderDocumentsFromServer();
            // Also sync to localStorage if needed
            await importFromMCP();
        } else {
            throw new Error(result.error || 'Auto-link failed');
        }
    } catch (err) {
        console.error('Scan error:', err);
        showToast('Failed to scan files: ' + err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = '🔄 Scan & Link Existing PDFs';
    }
}

// Render documents from server API
async function renderDocumentsFromServer() {
    if (!isLocalServer()) {
        return; // Fall back to localStorage-based rendering
    }

    const container = document.getElementById('documentsContainer');
    const noDocsMsg = document.getElementById('noDocuments');
    if (!container || !noDocsMsg) return;

    try {
        const response = await fetch('/api/documents');
        const { documents } = await response.json();

        if (documents.length === 0) {
            container.innerHTML = '';
            noDocsMsg.style.display = 'block';
            return;
        }

        noDocsMsg.style.display = 'none';

        // Group by company
        const byCompany = {};
        documents.forEach(doc => {
            const company = doc.company || 'Other';
            if (!byCompany[company]) byCompany[company] = [];
            byCompany[company].push(doc);
        });

        container.innerHTML = Object.entries(byCompany)
            .sort((a, b) => {
                // Sort by most recent document
                const aLatest = new Date(a[1][0].created);
                const bLatest = new Date(b[1][0].created);
                return bLatest - aLatest;
            })
            .map(([company, docs]) => `
                <div style="background: white; border: 1px solid #e0e4e8; border-radius: 8px; padding: 15px;">
                    <h4 style="margin: 0 0 10px 0; color: #667eea;">${escapeHtml(company)}</h4>
                    <div style="display: flex; flex-direction: column; gap: 8px;">
                        ${docs.map(doc => `
                            <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px; background: #f8f9fa; border-radius: 4px;">
                                <div>
                                    <span style="font-size: 12px;">${doc.type === 'resume' ? '📄' : doc.type === 'cover_letter' ? '✉️' : '📎'}</span>
                                    <span style="font-size: 13px; margin-left: 5px;">${escapeHtml(doc.filename)}</span>
                                </div>
                                <a href="/documents/${encodeURIComponent(doc.filename)}" target="_blank"
                                   style="font-size: 12px; color: #667eea; text-decoration: none;">
                                   View →
                                </a>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `).join('');

        // Update count in tab header
        document.getElementById('existingFilesPreview').innerHTML = `
            <div style="background: white; padding: 10px; border-radius: 6px; font-size: 12px;">
                <strong>${documents.length} PDFs found</strong><br>
                <code style="color: #6c757d;">/Users/genre/Claude/resume/</code>
            </div>
        `;

    } catch (err) {
        console.error('Error loading documents:', err);
        container.innerHTML = `<p style="color: #ef4444;">Failed to load documents: ${err.message}</p>`;
    }
}
