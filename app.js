/* =============================================================================
   CRICKET KHELEGA — FRONTEND APP
   ============================================================================= */

// ---- CONFIGURATION ----
// Change this to your Railway backend URL
const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:5000'
    : 'https://cricket-mcp-server-main-production.up.railway.app';

// Auto-refresh interval for live scores (ms)
const LIVE_REFRESH_INTERVAL = 120000; // 2 minutes

// ---- STATE ----
let currentPage = 'live';
let rankingsData = [];
let currentRankingCategory = 'Batsmen';
let currentRankingFormat = 'TEST';
let liveRefreshTimer = null;

// =============================================================================
// NAVIGATION
// =============================================================================
function navigate(page) {
    currentPage = page;

    // Update active nav link (desktop)
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.toggle('active', link.dataset.page === page);
    });

    // Update active bottom nav link (mobile)
    document.querySelectorAll('.bottom-nav-link').forEach(link => {
        link.classList.toggle('active', link.dataset.page === page);
    });

    // Show active page
    document.querySelectorAll('.page').forEach(p => {
        p.classList.toggle('active', p.id === `page-${page}`);
    });

    // Load data for the page
    loadPageData(page);

    // Manage auto-refresh
    clearInterval(liveRefreshTimer);
    if (page === 'live') {
        liveRefreshTimer = setInterval(() => loadLiveMatches(), LIVE_REFRESH_INTERVAL);
    }

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Close mobile menu if open
    const menu = document.getElementById('mobileMenu');
    if (menu && menu.classList.contains('open')) {
        menu.classList.remove('open');
    }
}

function toggleMobileMenu() {
    const menu = document.getElementById('mobileMenu');
    menu.classList.toggle('open');
}

// =============================================================================
// DATA LOADING
// =============================================================================
function loadPageData(page) {
    switch (page) {
        case 'live': loadLiveMatches(); break;
        case 'schedule': loadSchedule(); break;
        case 'rankings': loadRankings(); break;
        case 'news': loadNews(); break;
        case 'players': break; // Only loads on search
    }
}

async function apiFetch(endpoint) {
    const url = `${API_BASE}${endpoint}`;
    try {
        const res = await fetch(url, {
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(30000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } catch (err) {
        console.error(`API Error [${endpoint}]:`, err);
        throw err;
    }
}

// =============================================================================
// LIVE MATCHES
// =============================================================================
async function loadLiveMatches() {
    const container = document.getElementById('live-matches');
    const heroContainer = document.getElementById('hero-container');

    try {
        const matches = await apiFetch('/live');

        // Featured Match Hero Logic
        if (matches && matches.length > 0 && typeof getFeaturedMatch === 'function') {
            try {
                const featured = getFeaturedMatch(matches);
                if (featured) {
                    renderHero(featured);
                } else if (heroContainer) {
                    heroContainer.classList.add('hidden');
                }
            } catch (e) { console.error("Hero Error:", e); }
        }

        if (!matches || matches.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">🏏</div>
                    <h3>No Live Matches Right Now</h3>
                    <p>Check back later or view the upcoming schedule</p>
                </div>`;
            if (heroContainer) heroContainer.classList.add('hidden');
            return;
        }

        container.innerHTML = matches.map(m => renderMatchCard(m)).join('');
    } catch (err) {
        container.innerHTML = `<div class="error-msg">⚠️ Could not load live matches. Backend may be starting up — try again in a moment.</div>`;
    }
}

function renderMatchCard(match) {
    const statusClass = match.status === 'Live' ? 'live' :
        match.status === 'Completed' ? 'completed' : 'upcoming';

    let scoreHTML = '';
    if (Array.isArray(match.score)) {
        match.score.forEach((s, i) => {
            const teamName = s.title || (match.teams && match.teams[i]) || `Team ${i + 1}`;
            const scoreText = s.r && s.r !== '-' ? `${s.r}/${s.w}` : '-';
            const oversText = s.o && s.o !== '-' ? `(${s.o} ov)` : '';

            scoreHTML += `
                <div class="team-row">
                    <span class="team-name">${escapeHtml(teamName)}</span>
                    <div>
                        <span class="team-score">${scoreText}</span>
                        <span class="team-overs">${oversText}</span>
                    </div>
                </div>`;
        });
    } else {
        // Fallback if score format is different
        if (match.teams) {
            match.teams.forEach(t => {
                scoreHTML += `
                    <div class="team-row">
                        <span class="team-name">${escapeHtml(t)}</span>
                        <span class="team-score">-</span>
                    </div>`;
            });
        }
    }

    let footerBtn = '';
    if (match.is_premium) {
        // Scraped Match (Cricbuzz) -> Show Commentary
        // Use cricbuzz_id if available (for mapped matches), else match.id
        const commId = match.cricbuzz_id || match.id;
        footerBtn = `
            <div class="match-card-footer">
                <button class="btn-commentary" onclick="openCommentary('${commId}')">View Commentary 🎙️</button>
            </div>`;
    } else if (match.url || match.details_url) {
        // Official Match -> Show Google Link
        const url = match.details_url || match.url;
        footerBtn = `
            <div class="match-card-footer">
                <a href="${escapeHtml(url)}" target="_blank" class="view-details-btn">View Scorecard →</a>
            </div>`;
    }

    return `
        <article class="match-card">
            <div class="match-card-header">
                <span class="match-name" title="${escapeHtml(match.name || '')}">${escapeHtml(match.name || 'Match')}</span>
                <span class="match-status ${statusClass}">${match.status || 'Live'}</span>
            </div>
            <div class="match-teams">
                ${scoreHTML}
            </div>
            ${footerBtn}
        </article>`;
}

// =============================================================================
// SCHEDULE
// =============================================================================
async function loadSchedule() {
    const container = document.getElementById('schedule-list');

    try {
        const schedule = await apiFetch('/schedule');

        if (!schedule || schedule.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📅</div>
                    <h3>No Upcoming Matches</h3>
                    <p>Check back later for the latest schedule</p>
                </div>`;
            return;
        }

        container.innerHTML = schedule.map(s => {
            const dateInfo = parseDateStr(s.date);

            return `
                <article class="schedule-card">
                    <div class="schedule-date">
                        <div class="schedule-date-day">${dateInfo.day}</div>
                        <div class="schedule-date-month">${dateInfo.month}</div>
                    </div>
                    <div class="schedule-info">
                        <div class="schedule-match-name">${escapeHtml(s.name || 'TBA')}</div>
                        <div class="schedule-venue">📍 ${escapeHtml(s.venue || 'TBA')}</div>
                    </div>
                </article>`;
        }).join('');
    } catch (err) {
        container.innerHTML = `<div class="error-msg">⚠️ Could not load schedule. Please try again.</div>`;
    }
}

function parseDateStr(dateStr) {
    if (!dateStr) return { day: '?', month: '' };
    try {
        // Try parsing the date string
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) {
            return { day: d.getDate(), month: months[d.getMonth()] };
        }
    } catch (e) { }

    // Fallback: just show the string
    const parts = dateStr.split(' ');
    return { day: parts[0] || dateStr, month: parts[1] || '' };
}

// =============================================================================
// RANKINGS
// =============================================================================
async function loadRankings() {
    const container = document.getElementById('rankings-table');

    try {
        rankingsData = await apiFetch('/rankings');
        renderRankingsTable();
    } catch (err) {
        container.innerHTML = `<div class="error-msg">⚠️ Could not load rankings. Please try again.</div>`;
    }
}

function filterRankings(category) {
    const catMap = {
        'batting': 'Batsmen',
        'bowling': 'Bowlers',
        'all-rounder': 'All-Rounders',
        'teams': 'Teams'
    };
    currentRankingCategory = catMap[category] || category;

    // Update active tab
    document.querySelectorAll('#ranking-category-tabs .filter-tab').forEach(tab => {
        tab.classList.toggle('active', tab.textContent.toLowerCase().includes(category.split('-')[0]));
    });

    renderRankingsTable();
}

function filterRankingFormat(format) {
    currentRankingFormat = format;

    document.querySelectorAll('#ranking-format-tabs .filter-tab').forEach(tab => {
        tab.classList.toggle('active', tab.textContent === format);
    });

    renderRankingsTable();
}

function renderRankingsTable() {
    const container = document.getElementById('rankings-table');

    // Find matching ranking data
    const match = rankingsData.find(r =>
        r.type === currentRankingCategory && r.format === currentRankingFormat
    );

    if (!match || !match.rank || match.rank.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🏆</div>
                <h3>No rankings data available</h3>
                <p>Try a different category or format</p>
            </div>`;
        return;
    }

    const isTeams = currentRankingCategory === 'Teams';
    const headerCols = isTeams
        ? '<th>#</th><th>Team</th><th>Rating</th><th>Points</th>'
        : '<th>#</th><th>Player</th><th>Country</th><th>Rating</th>';

    const rows = match.rank.map((item, i) => {
        const rankClass = i < 3 ? `rank-${i + 1}` : '';
        const pos = item.rank || (i + 1);

        if (isTeams) {
            return `<tr>
                <td><span class="rank-num ${rankClass}">${pos}</span></td>
                <td class="rank-player">${escapeHtml(item.team || item.player || '-')}</td>
                <td class="rank-rating">${item.rating || '-'}</td>
                <td>${item.points || '-'}</td>
            </tr>`;
        } else {
            return `<tr>
                <td><span class="rank-num ${rankClass}">${pos}</span></td>
                <td class="rank-player">${escapeHtml(item.name || item.player || '-')}</td>
                <td class="rank-country">${escapeHtml(item.country || '-')}</td>
                <td class="rank-rating">${item.rating || '-'}</td>
            </tr>`;
        }
    }).join('');

    container.innerHTML = `
        <table class="rankings-table">
            <thead><tr>${headerCols}</tr></thead>
            <tbody>${rows}</tbody>
        </table>`;
}

// =============================================================================
// NEWS
// =============================================================================
async function loadNews() {
    const container = document.getElementById('news-list');

    try {
        const news = await apiFetch('/news');

        if (!news || news.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📰</div>
                    <h3>No News Available</h3>
                    <p>Check back later for the latest cricket news</p>
                </div>`;
            return;
        }

        container.innerHTML = news.map(n => `
            <article class="news-card">
                <span class="news-category">${escapeHtml(n.category || 'Cricket')}</span>
                <h3 class="news-title">${escapeHtml(n.title || 'Untitled')}</h3>
                <p class="news-desc">${escapeHtml(n.description || '')}</p>
                ${n.timestamp ? `<div class="news-timestamp">🕐 ${escapeHtml(n.timestamp)}</div>` : ''}
                ${n.url ? `<a href="${escapeHtml(n.url)}" target="_blank" class="news-link">Read more →</a>` : ''}
            </article>
        `).join('');
    } catch (err) {
        container.innerHTML = `<div class="error-msg">⚠️ Could not load news. Please try again.</div>`;
    }
}

// =============================================================================
// PLAYER SEARCH
// =============================================================================
async function searchPlayer() {
    const input = document.getElementById('player-search-input');
    const container = document.getElementById('player-result');
    const name = input.value.trim();

    if (!name) {
        container.innerHTML = `<div class="error-msg">Please enter a player name</div>`;
        return;
    }

    container.innerHTML = `
        <div style="text-align:center; padding:40px; color:var(--text-muted);">
            <div class="loading-spinner"></div>
            <p style="margin-top:16px;">Searching for ${escapeHtml(name)}...</p>
        </div>`;

    try {
        const data = await apiFetch(`/players/${encodeURIComponent(name)}`);

        if (data.error) {
            container.innerHTML = `<div class="error-msg">❌ ${escapeHtml(data.error)}</div>`;
            return;
        }

        container.innerHTML = renderPlayerCard(data);
    } catch (err) {
        container.innerHTML = `<div class="error-msg">⚠️ Could not find player. Please check the name and try again.</div>`;
    }
}

function renderPlayerCard(p) {
    const avatarHTML = p.image
        ? `<img class="player-avatar" src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" onerror="this.style.display='none'">`
        : `<div class="player-avatar" style="display:flex;align-items:center;justify-content:center;background:var(--bg-secondary);font-size:2.5rem;">👤</div>`;

    // Batting stats
    let battingHTML = '';
    if (p.batting_stats && Object.keys(p.batting_stats).length > 0) {
        for (const [format, stats] of Object.entries(p.batting_stats)) {
            battingHTML += `
                <span class="format-label">${format.toUpperCase()}</span>
                <div class="stats-grid">
                    ${statItem('Matches', stats.matches)}
                    ${statItem('Runs', stats.runs)}
                    ${statItem('Average', stats.average || stats.avg)}
                    ${statItem('Strike Rate', stats.strike_rate || stats.sr)}
                    ${statItem('Highest', stats.highest_score)}
                    ${statItem('100s', stats.hundreds)}
                    ${statItem('50s', stats.fifties)}
                </div>`;
        }
    }

    // Bowling stats
    let bowlingHTML = '';
    if (p.bowling_stats && Object.keys(p.bowling_stats).length > 0) {
        for (const [format, stats] of Object.entries(p.bowling_stats)) {
            bowlingHTML += `
                <span class="format-label">${format.toUpperCase()}</span>
                <div class="stats-grid">
                    ${statItem('Wickets', stats.wickets)}
                    ${statItem('Economy', stats.economy)}
                    ${statItem('Best', stats.best_bowling_innings)}
                    ${statItem('5W', stats.five_wickets)}
                    ${statItem('Balls', stats.balls)}
                    ${statItem('Runs', stats.runs)}
                </div>`;
        }
    }

    // Rankings
    let rankingsHTML = '';
    if (p.rankings) {
        const bat = p.rankings.batting || {};
        const bowl = p.rankings.bowling || {};
        rankingsHTML = `
            <div class="player-stats-section">
                <h3>🏆 ICC Rankings</h3>
                <div class="stats-grid">
                    ${statItem('Test Bat', bat.test || '-')}
                    ${statItem('ODI Bat', bat.odi || '-')}
                    ${statItem('T20 Bat', bat.t20 || '-')}
                    ${statItem('Test Bowl', bowl.test || '-')}
                    ${statItem('ODI Bowl', bowl.odi || '-')}
                    ${statItem('T20 Bowl', bowl.t20 || '-')}
                </div>
            </div>`;
    }

    return `
        <div class="player-card">
            <div class="player-header">
                ${avatarHTML}
                <div class="player-info">
                    <h2>${escapeHtml(p.name || 'Unknown')}</h2>
                    <div class="player-country">${escapeHtml(p.country || '')}</div>
                    <div class="player-role">${escapeHtml(p.role || '')}</div>
                </div>
            </div>
            ${rankingsHTML}
            ${battingHTML ? `<div class="player-stats-section"><h3>🏏 Batting Statistics</h3>${battingHTML}</div>` : ''}
            ${bowlingHTML ? `<div class="player-stats-section"><h3>🎳 Bowling Statistics</h3>${bowlingHTML}</div>` : ''}
        </div>`;
}

function statItem(label, value) {
    if (!value && value !== 0) return '';
    return `
        <div class="stat-item">
            <div class="stat-label">${label}</div>
            <div class="stat-value">${value}</div>
        </div>`;
}

// =============================================================================
// UTILITIES
// =============================================================================
function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// =============================================================================
// SIDEBAR — TRENDING NEWS
// =============================================================================
async function loadSidebarNews() {
    const container = document.getElementById('sidebar-news');
    if (!container) return;

    try {
        const news = await apiFetch('/news');
        if (!news || news.length === 0) {
            container.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;">No trending news</p>';
            return;
        }

        container.innerHTML = news.slice(0, 4).map(n => `
            <div class="sidebar-news-item">
                <a href="${n.url ? escapeHtml(n.url) : '#'}" target="_blank">${escapeHtml(n.title || 'Untitled')}</a>
            </div>
        `).join('');
    } catch (err) {
        container.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;">Could not load news</p>';
    }
}

// =============================================================================
// INITIALIZATION
// =============================================================================
document.addEventListener('DOMContentLoaded', () => {
    navigate('live');
    loadSidebarNews();
});
// =============================================================================
// COMMENTARY
// =============================================================================
function openCommentary(matchId) {
    const modal = document.getElementById('commentary-modal');
    const content = document.getElementById('commentary-content');

    modal.classList.add('active');
    content.innerHTML = '<div class="loading-spinner"></div> Loading live commentary...';

    // Fetch commentary
    apiFetch(`/commentary/${matchId}`)
        .then(res => {
            if (res.status === 'success' && Array.isArray(res.data)) {
                if (res.data.length === 0) {
                    content.innerHTML = '<div class="empty-state"><p>No commentary available yet.</p></div>';
                    return;
                }
                const html = res.data.map(line => `<div class="comm-line">${escapeHtml(line)}</div>`).join('');
                content.innerHTML = html;
            } else {
                content.innerHTML = '<div class="error-msg">Failed to load commentary.</div>';
            }
        })
        .catch(err => {
            content.innerHTML = '<div class="error-msg">Error loading commentary. Check connection.</div>';
        });
}

function closeCommentary() {
    const modal = document.getElementById('commentary-modal');
    modal.classList.remove('active');
}

// Close modal when clicking outside
document.getElementById('commentary-modal').addEventListener('click', (e) => {
    if (e.target.id === 'commentary-modal') closeCommentary();
});
