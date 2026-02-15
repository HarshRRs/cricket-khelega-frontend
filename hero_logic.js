
/* Feature: Hero Match Poster */

/**
 * Determines the "Best" match to feature in the Hero section.
 * Priority: Premium (Scraped) > International > League > Others
 * Status: Live > Upcoming > Completed
 */
function getFeaturedMatch(matches) {
    if (!matches || matches.length === 0) return null;

    // Sort matches by priority score
    const sorted = [...matches].sort((a, b) => {
        return getMatchPriority(b) - getMatchPriority(a);
    });

    return sorted[0];
}

function getMatchPriority(match) {
    let score = 0;
    const name = match.name.toLowerCase();
    const type = match.matchType ? match.matchType.toLowerCase() : "";
    const status = match.status.toLowerCase();

    // 1. Premium / Scraped (Highest Priority - Usually Men's Big Matches)
    if (match.is_premium) score += 2000;

    // 2. Status
    if (status.includes('live')) score += 1000;
    else if (status.includes('common') || status.includes('upcoming')) score += 200;

    // 3. Tournaments / Keywords
    if (name.includes('world cup')) score += 500;

    // Explicit Men vs Women Priority
    if (name.includes('women')) {
        score += 500; // Women's Matches get +500 (as requested)
    } else {
        // MEN'S MATCH (Implicitly, if not "Women")
        score += 1500; // AGGRESSIVE BOOST (+1500) so they always beat Women's matches
    }

    if (name.includes('final')) score += 500;
    if (name.includes('semi-final')) score += 500;

    if (name.includes('ipl') || name.includes('league')) score += 200;
    if (type.includes('test') || type.includes('odi') || type.includes('t20i')) score += 100;

    // 4. Big Teams (India, Aus, Eng, Pak)
    if (name.includes('india') || name.includes('ind ')) score += 100;
    if (name.includes('australia') || name.includes('aus ')) score += 80;
    if (name.includes('england') || name.includes('eng ')) score += 80;
    if (name.includes('pakistan') || name.includes('pak ')) score += 80;

    return score;
}

function renderHero(match) {
    const heroContainer = document.getElementById('hero-container');
    if (!match || !heroContainer) return;

    // Extract Team Names (Split by 'vs')
    let teams = match.name.split(' vs ');
    if (teams.length < 2) teams = match.name.split(' v ');
    if (teams.length < 2) teams = [match.name, ""];

    const team1 = teams[0].trim();
    const team2 = teams[1] ? teams[1].replace(/,.*/, '').trim() : ""; // Remove date/venue from name if present

    // Score Formatting
    let scoreText = "";
    if (Array.isArray(match.score)) {
        scoreText = match.score.map(s => {
            const r = s.r || '';
            const w = s.w ? `/${s.w}` : '';
            const o = s.o ? ` (${s.o})` : '';
            return `${r}${w}${o}`;
        }).join('  vs  ');
    } else {
        scoreText = match.status;
    }
    // Clean up empty scores
    scoreText = scoreText.replace(/- \(-\)/g, '').replace(/  vs  $/, '');
    if (!scoreText || scoreText === 'vs') scoreText = match.status;

    // Status Class
    const isLive = match.status.toLowerCase().includes('live');
    const statusClass = isLive ? 'hero-status' : 'hero-status completed';

    heroContainer.innerHTML = `
        <div class="hero-card">
            <div class="hero-content">
                <div class="hero-series">${match.matchType || "Trending Match"}</div>
                
                <div class="hero-teams">
                    <span class="hero-team">${team1}</span>
                    <span class="hero-vs">VS</span>
                    <span class="hero-team">${team2}</span>
                </div>

                <div class="hero-score-badge">
                    ${scoreText}
                </div>

                <div class="${statusClass}">
                    ${isLive ? '🔴 LIVE' : match.status} • ${match.venue || 'Match Center'}
                </div>

                <div class="hero-actions">
                    ${match.is_premium ? `<button class="btn-hero" onclick="openCommentary('${match.cricbuzz_id}')"><i class="fas fa-microphone"></i> Live Commentary</button>` : ''}
                    ${match.details_url ? `<a href="${match.details_url}" target="_blank" class="btn-hero" style="background:transparent; border:1px solid #fff; margin-left:10px;">More Info</a>` : ''}
                </div>
            </div>
        </div>
    `;

    heroContainer.classList.remove('hidden');
}
