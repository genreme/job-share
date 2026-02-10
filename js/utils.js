/**
 * Utility Functions Module
 * Common helper functions used across the dashboard
 */

// ============================================
// FILE SIZE FORMATTING
// ============================================
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// ============================================
// SECURITY UTILITIES
// ============================================
// HTML escape to prevent XSS attacks
function escapeHtml(text) {
    if (typeof text !== 'string') return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Format notes with safe HTML (escape + allow limited formatting)
function formatNotes(text) {
    if (!text) return '';
    // First escape HTML to prevent XSS
    let safe = escapeHtml(text);
    // Then apply safe formatting
    safe = safe.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');  // Bold
    safe = safe.replace(/\*(.*?)\*/g, '<em>$1</em>');              // Italic
    safe = safe.replace(/\n/g, '<br>');                             // Line breaks
    // Convert URLs to links (safe because we escaped first)
    safe = safe.replace(
        /(https?:\/\/[^\s<]+)/g,
        '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
    );
    return safe;
}

// ============================================
// DATE FORMATTING
// ============================================
function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
}

function formatRelativeDate(dateStr, useEmoji = false) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return useEmoji ? '⚡ Today' : 'Today';
    if (diffDays === 1) return useEmoji ? '1 day ago' : 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return formatDate(dateStr);
}

// ============================================
// TOAST NOTIFICATIONS
// ============================================
function showToast(message, type = 'success') {
    // Remove any existing toasts
    const existing = document.querySelectorAll('.toast');
    existing.forEach(t => t.remove());

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    // Trigger animation
    setTimeout(() => toast.classList.add('show'), 10);

    // Auto-remove
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
