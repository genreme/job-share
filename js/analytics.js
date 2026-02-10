/**
 * Analytics Module
 * Dashboard analytics, insights, and learning functions
 */

// =====================================================
// ANALYTICS FUNCTIONS
// =====================================================

async function loadAnalytics() {
    const container = document.getElementById('analyticsContainer');
    container.innerHTML = `
        <div style="text-align: center; padding: 40px; color: #6c757d;">
            <div style="font-size: 24px; margin-bottom: 10px;">⏳</div>
            Loading analytics...
        </div>
    `;

    try {
        // Try to fetch from server if available
        if (isLocalServer()) {
            const [summary, funnel, sources, fitAccuracy] = await Promise.all([
                fetch('/api/analytics').then(r => r.json()),
                fetch('/api/analytics/funnel').then(r => r.json()),
                fetch('/api/analytics/sources').then(r => r.json()),
                fetch('/api/analytics/fit-accuracy').then(r => r.json())
            ]);
            renderAnalytics(summary, funnel, sources, fitAccuracy);
        } else {
            // Calculate from local data
            const data = await initStorage();
            const localAnalytics = calculateLocalAnalytics(data.jobs);
            renderLocalAnalytics(localAnalytics);
        }
    } catch (e) {
        console.error('Analytics load error:', e);
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">⚠️</div>
                <h3>Could Not Load Analytics</h3>
                <p>Start the local server with <code>npm start</code> for full analytics, or check console for errors.</p>
            </div>
        `;
    }
}

function refreshAnalytics() {
    loadAnalytics();
}

function renderAnalytics(summary, funnel, sources, fitAccuracy) {
    const container = document.getElementById('analyticsContainer');

    container.innerHTML = `
        <!-- Summary Cards -->
        <div class="analytics-grid">
            <div class="analytics-card">
                <h3>📊 Pipeline Overview</h3>
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; text-align: center;">
                    <div>
                        <div class="analytics-big-number">${summary.summary.totalJobs}</div>
                        <div class="analytics-big-label">Total Jobs Tracked</div>
                    </div>
                    <div>
                        <div class="analytics-big-number">${summary.summary.activeJobs}</div>
                        <div class="analytics-big-label">Active Jobs</div>
                    </div>
                </div>
            </div>

            <div class="analytics-card">
                <h3>📈 Application Metrics</h3>
                <div class="analytics-metric">
                    <span class="analytics-metric-label">Total Applied</span>
                    <span class="analytics-metric-value">${summary.summary.totalApplied}</span>
                </div>
                <div class="analytics-metric">
                    <span class="analytics-metric-label">Response Rate</span>
                    <span class="analytics-metric-value">${summary.summary.responseRate}%</span>
                </div>
                <div class="analytics-metric">
                    <span class="analytics-metric-label">Interview Rate</span>
                    <span class="analytics-metric-value">${summary.summary.interviewRate}%</span>
                </div>
                <div class="analytics-metric">
                    <span class="analytics-metric-label">Avg Days to Apply</span>
                    <span class="analytics-metric-value">${summary.summary.avgDaysToApply}</span>
                </div>
            </div>

            <div class="analytics-card">
                <h3>🎯 Recent Activity (30 Days)</h3>
                <div class="analytics-metric">
                    <span class="analytics-metric-label">Jobs Added</span>
                    <span class="analytics-metric-value">${summary.recentActivity.addedLast30Days}</span>
                </div>
                <div class="analytics-metric">
                    <span class="analytics-metric-label">Applications Sent</span>
                    <span class="analytics-metric-value">${summary.recentActivity.appliedLast30Days}</span>
                </div>
            </div>
        </div>

        <!-- Funnel Visualization -->
        <div class="analytics-grid">
            <div class="analytics-card" style="grid-column: span 2;">
                <h3>🔄 Application Funnel</h3>
                <div class="analytics-funnel">
                    ${renderFunnelStage('Discovered', funnel.funnel.discovered, funnel.funnel.discovered)}
                    ${renderFunnelStage('Considering', funnel.funnel.considering, funnel.funnel.discovered)}
                    ${renderFunnelStage('Applied', funnel.funnel.applied, funnel.funnel.discovered)}
                    ${renderFunnelStage('Responded', funnel.funnel.responded, funnel.funnel.discovered)}
                    ${renderFunnelStage('Interviewed', funnel.funnel.interviewed, funnel.funnel.discovered)}
                    ${renderFunnelStage('Offered', funnel.funnel.offered, funnel.funnel.discovered)}
                </div>
                <div style="margin-top: 20px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; font-size: 12px; color: #6c757d;">
                    <div>Considering → Applied: <strong>${funnel.conversionRates.consideringToApplied}</strong></div>
                    <div>Applied → Responded: <strong>${funnel.conversionRates.appliedToResponded}</strong></div>
                    <div>Interviewed → Offered: <strong>${funnel.conversionRates.interviewedToOffered}</strong></div>
                </div>
            </div>
        </div>

        <!-- Source Effectiveness -->
        <div class="analytics-grid">
            <div class="analytics-card" style="grid-column: span 2;">
                <h3>📍 Source Effectiveness</h3>
                <div class="source-row header">
                    <div>Source</div>
                    <div>Jobs Found</div>
                    <div>Applied</div>
                    <div>Interviews</div>
                    <div>Score</div>
                </div>
                ${Object.entries(sources.bySource).map(([source, data]) => `
                    <div class="source-row">
                        <div style="font-weight: 500;">${source}</div>
                        <div class="source-bar-container">
                            <div class="source-bar" style="width: ${(data.totalJobs / Math.max(...Object.values(sources.bySource).map(s => s.totalJobs))) * 100}%"></div>
                        </div>
                        <div>${data.applied}</div>
                        <div>${data.interviewed}</div>
                        <div style="color: #667eea; font-weight: 600;">${data.effectiveness}</div>
                    </div>
                `).join('')}
                ${sources.recommendations.length > 0 ? `
                    <div style="margin-top: 20px;">
                        ${sources.recommendations.map(r => `
                            <div class="analytics-insight ${r.type}">
                                ${r.message}
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
        </div>

        <!-- Fit Score Accuracy -->
        <div class="analytics-grid">
            <div class="analytics-card" style="grid-column: span 2;">
                <h3>🎯 Fit Score Accuracy</h3>
                <p style="font-size: 13px; color: #6c757d; margin-bottom: 15px;">
                    How well do fit scores predict interview success?
                </p>
                <table class="fit-accuracy-table">
                    <thead>
                        <tr>
                            <th>Fit Range</th>
                            <th>Jobs</th>
                            <th>Applied</th>
                            <th>Interviewed</th>
                            <th>Interview Rate</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${Object.entries(fitAccuracy.byFitRange).map(([range, data]) => `
                            <tr>
                                <td style="font-weight: 500;">${range}</td>
                                <td>${data.totalJobs}</td>
                                <td>${data.applied}</td>
                                <td>${data.interviewed}</td>
                                <td style="color: ${parseFloat(data.interviewRate) > 20 ? '#22c55e' : '#6c757d'}; font-weight: 600;">
                                    ${data.interviewRate}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                ${fitAccuracy.insights.length > 0 ? `
                    <div style="margin-top: 20px;">
                        ${fitAccuracy.insights.map(i => `
                            <div class="analytics-insight ${i.type}">
                                ${i.message}
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
        </div>

        <!-- Status Breakdown -->
        <div class="analytics-grid">
            <div class="analytics-card">
                <h3>📋 Status Breakdown</h3>
                ${Object.entries(summary.statusBreakdown).map(([status, count]) => `
                    <div class="analytics-metric">
                        <span class="analytics-metric-label">${formatStatus(status)}</span>
                        <span class="analytics-metric-value">${count}</span>
                    </div>
                `).join('')}
            </div>

            <div class="analytics-card">
                <h3>🏢 Industry Breakdown</h3>
                ${Object.entries(summary.industryBreakdown)
                    .sort(([,a], [,b]) => b - a)
                    .slice(0, 8)
                    .map(([industry, count]) => `
                    <div class="analytics-metric">
                        <span class="analytics-metric-label">${industry}</span>
                        <span class="analytics-metric-value">${count}</span>
                    </div>
                `).join('')}
            </div>

            <div class="analytics-card">
                <h3>📊 Fit Score Distribution</h3>
                ${Object.entries(summary.fitScoreDistribution).map(([range, count]) => `
                    <div class="analytics-metric">
                        <span class="analytics-metric-label">${range}</span>
                        <span class="analytics-metric-value">${count}</span>
                    </div>
                `).join('')}
            </div>
        </div>

        <div style="text-align: center; color: #9ca3af; font-size: 12px; margin-top: 20px;">
            Analytics generated at ${new Date(summary.generatedAt).toLocaleString()}
        </div>
    `;
}

function renderFunnelStage(label, count, maxCount) {
    const percentage = maxCount > 0 ? (count / maxCount) * 100 : 0;
    return `
        <div class="funnel-stage">
            <div class="funnel-label">${label}</div>
            <div class="funnel-bar" style="width: ${Math.max(percentage, 2)}%; min-width: 20px;"></div>
            <div class="funnel-count">${count}</div>
        </div>
    `;
}

function formatStatus(status) {
    const statusMap = {
        'apply-now': '🟢 Apply Now',
        'maybe': '🟡 Maybe',
        'probably-not': '🔴 Probably Not',
        'applied': '📤 Applied',
        'archived': '📁 Archived'
    };
    return statusMap[status] || status;
}

// Calculate analytics from local data (fallback when server not running)
function calculateLocalAnalytics(jobs) {
    const statusCounts = {};
    const industryCounts = {};
    let totalApplied = 0;

    for (const job of jobs) {
        statusCounts[job.status] = (statusCounts[job.status] || 0) + 1;
        industryCounts[job.industry || 'Unknown'] = (industryCounts[job.industry || 'Unknown'] || 0) + 1;
        if (job.status === 'applied' || job.appliedDate) totalApplied++;
    }

    return {
        totalJobs: jobs.length,
        activeJobs: jobs.filter(j => j.status !== 'archived').length,
        totalApplied,
        statusCounts,
        industryCounts
    };
}

function renderLocalAnalytics(analytics) {
    const container = document.getElementById('analyticsContainer');

    container.innerHTML = `
        <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin-bottom: 20px; font-size: 13px; color: #92400e;">
            ⚠️ Showing basic analytics. Start the local server (<code>npm start</code>) for full analytics including funnel, source effectiveness, and fit score accuracy.
        </div>

        <div class="analytics-grid">
            <div class="analytics-card">
                <h3>📊 Pipeline Overview</h3>
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; text-align: center;">
                    <div>
                        <div class="analytics-big-number">${analytics.totalJobs}</div>
                        <div class="analytics-big-label">Total Jobs</div>
                    </div>
                    <div>
                        <div class="analytics-big-number">${analytics.activeJobs}</div>
                        <div class="analytics-big-label">Active Jobs</div>
                    </div>
                </div>
            </div>

            <div class="analytics-card">
                <h3>📋 Status Breakdown</h3>
                ${Object.entries(analytics.statusCounts).map(([status, count]) => `
                    <div class="analytics-metric">
                        <span class="analytics-metric-label">${formatStatus(status)}</span>
                        <span class="analytics-metric-value">${count}</span>
                    </div>
                `).join('')}
            </div>

            <div class="analytics-card">
                <h3>🏢 Industry Breakdown</h3>
                ${Object.entries(analytics.industryCounts)
                    .sort(([,a], [,b]) => b - a)
                    .map(([industry, count]) => `
                    <div class="analytics-metric">
                        <span class="analytics-metric-label">${industry}</span>
                        <span class="analytics-metric-value">${count}</span>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

function resetFilters() {
    document.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = true);
    alert('🔄 Filters reset to defaults');
}

// =====================================================
// INSIGHTS / LEARNING FUNCTIONS
// =====================================================

async function loadInsights() {
    const container = document.getElementById('insightsContainer');
    container.innerHTML = `
        <div style="text-align: center; padding: 40px; color: #6c757d;">
            <div style="font-size: 24px; margin-bottom: 10px;">⏳</div>
            Analyzing your job search patterns...
        </div>
    `;

    try {
        if (!isLocalServer()) {
            container.innerHTML = `
                <div style="background: #fef3c7; padding: 20px; border-radius: 8px; color: #92400e;">
                    ⚠️ Start the local server (<code>npm start</code>) to enable learning insights.
                </div>
            `;
            return;
        }

        const [learningData, suggestionsData] = await Promise.all([
            fetch('/api/learning').then(r => r.json()),
            fetch('/api/learning/suggestions').then(r => r.json())
        ]);

        renderInsights(suggestionsData.suggestions, learningData);
    } catch (e) {
        console.error('Insights load error:', e);
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">⚠️</div>
                <h3>Could Not Load Insights</h3>
                <p>Check that the server is running and try again.</p>
            </div>
        `;
    }
}

function refreshInsights() {
    loadInsights();
}

function renderInsights(suggestions, learningData) {
    const container = document.getElementById('insightsContainer');

    const suggestionsHTML = suggestions.length > 0
        ? suggestions.map(s => renderSuggestionCard(s)).join('')
        : `
            <div style="background: #d1fae5; padding: 20px; border-radius: 12px; margin-bottom: 20px; color: #065f46;">
                <strong>✨ No suggestions right now!</strong>
                <p style="margin-top: 8px; font-size: 14px;">
                    The system is learning from your job search. Keep tracking applications
                    and outcomes to generate insights.
                </p>
            </div>
        `;

    const evolutionHTML = learningData.evolutionHistory?.length > 0
        ? `
            <div class="analytics-card" style="margin-top: 30px;">
                <h3>📜 Evolution History</h3>
                <p style="color: #6c757d; font-size: 13px; margin-bottom: 15px;">
                    How the system has evolved based on your decisions
                </p>
                <div class="evolution-timeline">
                    ${learningData.evolutionHistory.slice(-10).reverse().map(e => `
                        <div class="evolution-item ${e.action.includes('Rejected') ? 'rejected' : ''}">
                            <div class="evolution-date">${new Date(e.date).toLocaleDateString()}</div>
                            <div class="evolution-action">${e.action}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `
        : '';

    const preferencesHTML = `
        <div class="preferences-section">
            <h3>⚙️ Current Preferences</h3>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px;">
                <div>
                    <strong style="font-size: 12px; color: #6c757d;">Fit Score Weights</strong>
                    ${Object.entries(learningData.preferences.fitScoreWeights || {}).map(([k, v]) => `
                        <div class="preference-item">
                            <span>${formatPreferenceKey(k)}</span>
                            <span style="font-weight: 600; color: #667eea;">${v}%</span>
                        </div>
                    `).join('')}
                </div>
                <div>
                    <strong style="font-size: 12px; color: #6c757d;">Source Tiers</strong>
                    ${Object.entries(learningData.preferences.sourceTiers || {}).map(([tier, sources]) => `
                        <div class="preference-item">
                            <span>${tier.replace('tier', 'Tier ')}</span>
                            <span style="color: #6c757d; font-size: 12px;">${(sources || []).join(', ') || 'None'}</span>
                        </div>
                    `).join('')}
                </div>
                <div>
                    <strong style="font-size: 12px; color: #6c757d;">Thresholds</strong>
                    ${Object.entries(learningData.preferences.thresholds || {}).map(([k, v]) => `
                        <div class="preference-item">
                            <span>${formatPreferenceKey(k)}</span>
                            <span style="font-weight: 600;">${v}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;

    container.innerHTML = `
        <div style="margin-bottom: 20px;">
            <h3 style="font-size: 16px; color: #374151; margin-bottom: 15px;">
                💡 Suggestions (${suggestions.length})
            </h3>
            ${suggestionsHTML}
        </div>
        ${evolutionHTML}
        ${preferencesHTML}
    `;
}

function renderSuggestionCard(suggestion) {
    const typeLabels = {
        'fit_weight_adjustment': 'Fit Score Calibration',
        'source_tier_change': 'Source Effectiveness',
        'timing_optimization': 'Application Timing',
        'industry_focus': 'Industry Focus',
        'threshold_adjustment': 'Threshold Change'
    };

    const evidenceTableHTML = suggestion.evidence?.dataPoints?.length > 0
        ? `
            <table class="suggestion-evidence-table">
                <thead>
                    <tr>
                        ${Object.keys(suggestion.evidence.dataPoints[0]).map(k => `<th>${formatPreferenceKey(k)}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${suggestion.evidence.dataPoints.map(dp => `
                        <tr>
                            ${Object.values(dp).map(v => `<td>${v}</td>`).join('')}
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `
        : '';

    return `
        <div class="suggestion-card priority-${suggestion.priority}">
            <div class="suggestion-header">
                <span class="suggestion-type">${typeLabels[suggestion.type] || suggestion.type}</span>
                <span class="suggestion-priority ${suggestion.priority}">${suggestion.priority} priority</span>
            </div>
            <div class="suggestion-message">${suggestion.message}</div>
            <div class="suggestion-evidence">
                <div class="suggestion-evidence-title">
                    Evidence (${suggestion.evidence?.sampleSize || 0} data points,
                    ${((suggestion.evidence?.confidence || 0) * 100).toFixed(0)}% confidence)
                </div>
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                    <span style="font-size: 12px; color: #6c757d;">Confidence:</span>
                    <div class="confidence-bar">
                        <div class="confidence-fill" style="width: ${(suggestion.evidence?.confidence || 0) * 100}%"></div>
                    </div>
                </div>
                ${evidenceTableHTML}
            </div>
            <div class="suggestion-actions">
                <button class="btn-approve" onclick="applySuggestion(${suggestion.id})">
                    ✓ Apply
                </button>
                <button class="btn-reject" onclick="rejectSuggestion(${suggestion.id})">
                    ✗ Reject
                </button>
                <button class="btn-defer" onclick="deferSuggestion(${suggestion.id})">
                    ⏸ Later
                </button>
            </div>
        </div>
    `;
}

async function applySuggestion(suggestionId) {
    const rationale = prompt('Why are you approving this? (optional)');

    try {
        const response = await fetch('/api/learning/apply', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ suggestionId, rationale: rationale || 'User approved' })
        });

        if (response.ok) {
            showToast('✅ Suggestion applied!', 'success');
            loadInsights();
        } else {
            const err = await response.json();
            showToast('Failed: ' + (err.error || 'Unknown error'), 'error');
        }
    } catch (e) {
        showToast('Error applying suggestion', 'error');
    }
}

async function rejectSuggestion(suggestionId) {
    const rationale = prompt('Why are you rejecting this? (helps the system learn)');
    if (rationale === null) return; // User cancelled

    try {
        const response = await fetch('/api/learning/reject', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ suggestionId, rationale: rationale || 'User rejected without reason' })
        });

        if (response.ok) {
            showToast('Suggestion rejected', 'info');
            loadInsights();
        } else {
            const err = await response.json();
            showToast('Failed: ' + (err.error || 'Unknown error'), 'error');
        }
    } catch (e) {
        showToast('Error rejecting suggestion', 'error');
    }
}

function deferSuggestion(suggestionId) {
    showToast('Suggestion deferred - will show again later', 'info');
}

function formatPreferenceKey(key) {
    return key
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, s => s.toUpperCase())
        .replace('Fit Score', 'Fit')
        .replace('Min ', 'Min. ')
        .trim();
}
