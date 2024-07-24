document.addEventListener("DOMContentLoaded", function () {
    const calendarDays = document.getElementById("calendar-days");
    const calendarMonthYear = document.querySelector(".cal-month span");
    const calLeft = document.querySelector(".calendar-header .left");
    const calRight = document.querySelector(".calendar-header .right");
    const calendarInput = document.getElementById("calendar-input");
    const calendar = document.querySelector(".calendar");
    const pastDay = document.querySelector(".past-day");
    const nextDay = document.querySelector(".next-day");
    const gamesContainer = document.querySelector(".games-container");
    const dateFilter = document.getElementById("date-filter");
  
    let currentDate = new Date();
    let selectedDate = new Date();
  
    function formatDate(date) {
      const daysOfWeek = [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ];
      const months = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
      ];
      const dayOfWeek = daysOfWeek[date.getDay()];
      const month = months[date.getMonth()];
      const day = date.getDate();
      return `${dayOfWeek}, ${month} ${day}`;
    }
  
    function formatApiDate(date) {
      const day = date.getDate().toString().padStart(2, "0");
      const month = (date.getMonth() + 1).toString().padStart(2, "0");
      const year = date.getFullYear();
      return `${month}/${day}/${year}`;
    }
  
    function getStartDate(filter) {
      const date = new Date();
      switch (filter) {
        case "60days":
          date.setDate(date.getDate() - 60);
          break;
        case "30days":
          date.setDate(date.getDate() - 30);
          break;
        case "14days":
          date.setDate(date.getDate() - 14);
          break;
        case "7days":
          date.setDate(date.getDate() - 7);
          break;
        case "1stHalf":
          date.setFullYear(2024);
          date.setMonth(0);
          date.setDate(1);
          break;
        case "2ndHalf":
          date.setFullYear(2024);
          date.setMonth(6);
          date.setDate(17); // Fecha del All-Star Game
          break;
        default:
          date.setFullYear(2024);
          date.setMonth(0);
          date.setDate(1);
          break;
      }
      return formatApiDate(date);
    }
  
    async function fetchPitcherHand(pitcherId) {
      const response = await fetch(
        `https://statsapi.mlb.com/api/v1/people/${pitcherId}`
      );
      const data = await response.json();
      return data.people[0]?.pitchHand?.code || "";
    }
  
    async function fetchPlayerStats(playerId, startDate, endDate) {
      const response = await fetch(
        `https://statsapi.mlb.com/api/v1/stats?stats=byDateRange&group=hitting&startDate=${startDate}&endDate=${endDate}&sportIds=1&gameType=R&playerPool=All&limit=5000`
      );
      const data = await response.json();
      const stats =
        data.stats[0]?.splits.find((split) => split.player.id === playerId)
          ?.stat || {};
      return {
        avg: stats.avg || "-",
        obp: stats.obp || "-",
        ops: stats.ops || "-",
      };
    }
  
    async function fetchTeamStats(startDate, endDate) {
      const [avgResponse, opsResponse, runsResponse] = await Promise.all([
        fetch(
          `https://statsapi.mlb.com/api/v1/teams/stats?group=hitting&season=2024&sportIds=1&stats=byDateRange&startDate=${startDate}&endDate=${endDate}&sortStat=avg&gameType=R`
        ),
        fetch(
          `https://statsapi.mlb.com/api/v1/teams/stats?group=hitting&season=2024&sportIds=1&stats=byDateRange&startDate=${startDate}&endDate=${endDate}&sortStat=ops&gameType=R`
        ),
        fetch(
          `https://statsapi.mlb.com/api/v1/teams/stats?group=hitting&season=2024&sportIds=1&stats=byDateRange&startDate=${startDate}&endDate=${endDate}&sortStat=runs&gameType=R`
        ),
      ]);
  
      const [avgData, opsData, runsData] = await Promise.all([
        avgResponse.json(),
        opsResponse.json(),
        runsResponse.json(),
      ]);
      const avgStats = avgData.stats[0]?.splits || [];
      const opsStats = opsData.stats[0]?.splits || [];
      const runsStats = runsData.stats[0]?.splits || [];
  
      const stats = {};
  
      avgStats.forEach((stat) => {
        stats[stat.team.id] = {
          avg: stat.stat.avg,
          avgRank: stat.rank,
          ops: "-",
          opsRank: "-",
          runs: 0,
          runsRank: "-",
          games: stat.stat.gamesPlayed,
        };
      });
  
      opsStats.forEach((stat) => {
        if (stats[stat.team.id]) {
          stats[stat.team.id].ops = stat.stat.ops;
          stats[stat.team.id].opsRank = stat.rank;
        } else {
          stats[stat.team.id] = {
            avg: "-",
            avgRank: "-",
            ops: stat.stat.ops,
            opsRank: stat.rank,
            runs: 0,
            runsRank: "-",
            games: stat.stat.gamesPlayed,
          };
        }
      });
  
      runsStats.forEach((stat) => {
        if (stats[stat.team.id]) {
          stats[stat.team.id].runs = stat.stat.runs;
          stats[stat.team.id].runsRank = stat.rank;
        } else {
          stats[stat.team.id] = {
            avg: "-",
            avgRank: "-",
            ops: "-",
            opsRank: "-",
            runs: stat.stat.runs,
            runsRank: stat.rank,
            games: stat.stat.gamesPlayed,
          };
        }
      });
  
      return stats;
    }
  
    async function fetchGames(date) {
      const formattedDate = formatApiDate(date);
      const startDate = getStartDate(dateFilter.value);
      const endDate = formattedDate;
      const response = await fetch(
        `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${formattedDate}&hydrate=probablePitcher`
      );
      const data = await response.json();
      const games = data.dates[0]?.games || [];
  
      const teamStats = await fetchTeamStats(startDate, endDate);
  
      // Fetch pitcher's hand and update stats
      for (const game of games) {
        if (game.teams.away.probablePitcher) {
          const awayPitcherId = game.teams.away.probablePitcher.id;
          game.teams.away.probablePitcher.pitchHand = await fetchPitcherHand(
            awayPitcherId
          );
        }
        if (game.teams.home.probablePitcher) {
          const homePitcherId = game.teams.home.probablePitcher.id;
          game.teams.home.probablePitcher.pitchHand = await fetchPitcherHand(
            homePitcherId
          );
        }
  
        // Add stats from API if present
        const awayTeamStats = teamStats[game.teams.away.team.id];
        const homeTeamStats = teamStats[game.teams.home.team.id];
        game.teams.away.stats = {
          ...game.teams.away.stats,
          avg: awayTeamStats?.avg || "-",
          avgRank: awayTeamStats?.avgRank || "-",
          ops: awayTeamStats?.ops || "-",
          opsRank: awayTeamStats?.opsRank || "-",
          runs: awayTeamStats?.runs || "-",
          runsRank: awayTeamStats?.runsRank || "-",
          games: awayTeamStats?.games || 1, // Default to 1 to avoid division by zero
        };
        game.teams.home.stats = {
          ...game.teams.home.stats,
          avg: homeTeamStats?.avg || "-",
          avgRank: homeTeamStats?.avgRank || "-",
          ops: homeTeamStats?.ops || "-",
          opsRank: homeTeamStats?.opsRank || "-",
          runs: homeTeamStats?.runs || "-",
          runsRank: homeTeamStats?.runsRank || "-",
          games: homeTeamStats?.games || 1, // Default to 1 to avoid division by zero
        };
      }
  
      return games;
    }
  
    async function fetchLineups(gamePk, startDate, endDate) {
      const response = await fetch(
        `https://statsapi.mlb.com/api/v1.1/game/${gamePk}/feed/live`
      );
      const data = await response.json();
      const liveData = data.liveData;
  
      const awayBattingOrder = await Promise.all(
        liveData.boxscore.teams.away.battingOrder.map(async (id) => {
          const player = liveData.boxscore.teams.away.players[`ID${id}`];
          const playerStats = await fetchPlayerStats(id, startDate, endDate);
          return { ...player, ...playerStats };
        })
      );
  
      const homeBattingOrder = await Promise.all(
        liveData.boxscore.teams.home.battingOrder.map(async (id) => {
          const player = liveData.boxscore.teams.home.players[`ID${id}`];
          const playerStats = await fetchPlayerStats(id, startDate, endDate);
          return { ...player, ...playerStats };
        })
      );
  
      return { awayBattingOrder, homeBattingOrder };
    }
  
    function renderLineups(battingOrder, gamePk, teamType) {
      const lineupDiv = document.getElementById(`${teamType}-lineup-${gamePk}`);
      lineupDiv.innerHTML = '';
  
      const lineupCard = document.createElement('div');
      lineupCard.classList.add('lineup-card');
  
      const playerRows = document.createElement('div');
      playerRows.classList.add('player-rows');
  
      if (battingOrder.length === 0) {
        playerRows.innerHTML = '<div class="row"><div class="player-info"><span class="tbd-lineup">Lineup has not been confirmed yet</span></div></div>';
      } else {
        const lineupHeader = document.createElement('div');
        lineupHeader.classList.add('lineup-header');
        lineupHeader.innerHTML = `
          <div class="row">
            <div></div>
            <div class="stats-header">
              <span>AVG</span>
              <span>OBP</span>
              <span>OPS</span>
            </div>
          </div>
        `;
  
        battingOrder.forEach((player, index) => {
          const playerRow = document.createElement('div');
          playerRow.classList.add('row');
  
          // Formatear el nombre
          const fullName = player.person.fullName;
          const nameParts = fullName.split(' ');
          const initial = nameParts[0].charAt(0);
          const lastName = nameParts.slice(1).join(' ');
  
          playerRow.innerHTML = `
            <div class="player-info">
              <span class="bat-ord">${index + 1}.</span>
              <span class="bat-name">${initial}. ${lastName}</span>
              <span class="bat-pos">${player.position.abbreviation}</span>
            </div>
            <div class="player-stats">
              <span class="bat-avg">${player.avg || '-'}</span>
              <span class="bat-obp">${player.obp || '-'}</span>
              <span class="bat-ops">${player.ops || '-'}</span>
            </div>
          `;
          playerRows.appendChild(playerRow);
        });
  
        lineupCard.appendChild(lineupHeader); // Add the first header if there is a lineup
        lineupCard.appendChild(playerRows); // Add the player rows
      }
  
      lineupCard.appendChild(playerRows); // Add the player rows (will be empty if no lineup)
      lineupDiv.appendChild(lineupCard);
    }
  
    function getLogoUrl(teamId, teamName, isActive = false) {
      const logoType = isActive ? "team-cap-on-dark" : "team-cap-on-light";
      return `https://www.mlbstatic.com/team-logos/${logoType}/${teamId}.svg`;
    }
  
    async function renderGames(games) {
      const teamsDataResponse = await fetch('teams.json');
      const teamsData = await teamsDataResponse.json();
  
      // Ordenar los juegos por la hora de inicio
      games.sort((a, b) => new Date(a.gameDate) - new Date(b.gameDate));
  
      gamesContainer.innerHTML = '';
      for (const game of games) {
          const gameDiv = document.createElement('div');
          gameDiv.classList.add('game');
  
          const gameHeaderDiv = document.createElement('div');
          gameHeaderDiv.classList.add('game-header');
          gameHeaderDiv.innerHTML = `
              <span>${new Date(game.gameDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
              <span>@ ${game.venue.name}</span>
          `;
  
          const awayTeam = game.teams.away;
          const homeTeam = game.teams.home;
  
          const awayPitcherHand = awayTeam.probablePitcher?.pitchHand ? `${awayTeam.probablePitcher.pitchHand}HP` : '';
          const homePitcherHand = homeTeam.probablePitcher?.pitchHand ? `${homeTeam.probablePitcher.pitchHand}HP` : '';
  
          const awayRPG = (awayTeam.stats.runs / awayTeam.stats.games).toFixed(2);
          const homeRPG = (homeTeam.stats.runs / homeTeam.stats.games).toFixed(2);
  
          const matchupDiv = document.createElement('div');
          matchupDiv.classList.add('matchup');
          matchupDiv.innerHTML = `
              <div class="team away-team" data-team-id="${awayTeam.team.id}">
                  <div class="team-logo-container">
                      <div class="team-logo" id="away-team-logo-${awayTeam.team.id}">
                          <img src="${getLogoUrl(awayTeam.team.id, awayTeam.team.name)}" alt="${awayTeam.team.name} logo">
                      </div>
                  </div>
                  <div class="team-info">
                      <span class="team-name">${awayTeam.team.name}</span>
                      <span class="team-record">(${awayTeam.leagueRecord.wins}-${awayTeam.leagueRecord.losses})</span>
                      <span class="probable-pitcher">${awayTeam.probablePitcher?.fullName || 'TBD'}</span>
                      <span class="pitcher-hand">${awayPitcherHand}</span>
                  </div>
              </div>
              <div class="team home-team" data-team-id="${homeTeam.team.id}">
                  <div class="team-logo-container">
                      <div class="team-logo" id="home-team-logo-${homeTeam.team.id}">
                          <img src="${getLogoUrl(homeTeam.team.id, homeTeam.team.name)}" alt="${homeTeam.team.name} logo">
                      </div>
                  </div>
                  <div class="team-info">
                      <span class="team-name">${homeTeam.team.name}</span>
                      <span class="team-record">(${homeTeam.leagueRecord.wins}-${homeTeam.leagueRecord.losses})</span>
                      <span class="probable-pitcher">${homeTeam.probablePitcher?.fullName || 'TBD'}</span>
                      <span class="pitcher-hand">${homePitcherHand}</span>
                  </div>
              </div>
          `;
  
          const ranksDiv = document.createElement('div');
          ranksDiv.classList.add('ranks');
          ranksDiv.innerHTML = `
              <div class="rank-row">
                  <div class="rank-away">
                      <span class="stat" id="stat-avg-away">${awayTeam.stats.avg}</span>
                      <span class="rank" id="rank-avg-away">(#${awayTeam.stats.avgRank})</span>
                  </div>
                  <div class="rank-cat">
                      <span id="team-avg">AVG</span>
                  </div>
                  <div class="rank-home">
                      <span class="stat" id="stat-avg-home">${homeTeam.stats.avg}</span>
                      <span class="rank" id="rank-avg-home">(#${homeTeam.stats.avgRank})</span>
                  </div>
              </div>
              <div class="rank-row">
                  <div class="rank-away">
                      <span class="stat" id="stat-ops-away">${awayTeam.stats.ops}</span>
                      <span class="rank" id="rank-ops-away">(#${awayTeam.stats.opsRank})</span>
                  </div>
                  <div class="rank-cat">
                      <span id="team-ops">OPS</span>
                  </div>
                  <div class="rank-home">
                      <span class="stat" id="stat-ops-home">${homeTeam.stats.ops}</span>
                      <span class="rank" id="rank-ops-home">(#${homeTeam.stats.opsRank})</span>
                  </div>
              </div>
              <div class="rank-row">
                  <div class="rank-away">
                      <span class="stat" id="stat-rpg-away">${awayRPG}</span>
                      <span class="rank" id="rank-rpg-away">(#${awayTeam.stats.runsRank})</span>
                  </div>
                  <div class="rank-cat">
                      <span id="team-rpg">RPG</span>
                  </div>
                  <div class="rank-home">
                      <span class="stat" id="stat-rpg-home">${homeRPG}</span>
                      <span class="rank" id="rank-rpg-home">(#${homeTeam.stats.runsRank})</span>
                  </div>
              </div>
          `;
  
          const splitsDiv = document.createElement('div');
          splitsDiv.classList.add('splits');
          splitsDiv.innerHTML = `
              <div class="lineup-status" id="lineup-status-${game.gamePk}">
                  <span class="lineup-confirmed">Lineup Confirmed</span>
              </div>
              <div class="splits-btn-container">
                  <button class="splits-btn">Magic Splits</button>
              </div>
              <div class="filter">
                  <select name="date-filter" id="date-filter-${game.gamePk}">
                      <option selected value="season">Season</option>
                      <option value="60days">Last 60 days</option>
                      <option value="30days">Last 30 days</option>
                      <option value="14days">Last 14 days</option>
                      <option value="7days">Last 7 days</option>
                      <option value="1stHalf">1st Half</option>
                      <option value="2ndHalf">2nd Half</option>
                  </select>
              </div>
          `;
  
          const lineupsDiv = document.createElement('div');
          lineupsDiv.classList.add('lineups');
          lineupsDiv.innerHTML = `
              <div class="away-lineup" id="away-lineup-${game.gamePk}"></div>
              <div class="home-lineup" id="home-lineup-${game.gamePk}"></div>
          `;
  
          const dropdownDiv = document.createElement('div');
          dropdownDiv.classList.add('dropdown');
          dropdownDiv.innerHTML = `
              <div class="arrow-container">
                  <span>&#8595;</span>
              </div>
          `;
  
          gameDiv.appendChild(gameHeaderDiv);
          gameDiv.appendChild(matchupDiv);
          gameDiv.appendChild(ranksDiv);
          gameDiv.appendChild(splitsDiv);
          gameDiv.appendChild(lineupsDiv);
          gameDiv.appendChild(dropdownDiv);
          gamesContainer.appendChild(gameDiv);
  
          const lineupData = await fetchLineups(game.gamePk, getStartDate(dateFilter.value), formatApiDate(selectedDate));
          renderLineups(lineupData.awayBattingOrder, game.gamePk, 'away');
          renderLineups(lineupData.homeBattingOrder, game.gamePk, 'home');
  
          // Update lineup status
          const lineupStatus = document.getElementById(`lineup-status-${game.gamePk}`);
          if (lineupData.awayBattingOrder.length === 0 || lineupData.homeBattingOrder.length === 0) {
              lineupStatus.innerHTML = '<span class="lineup-projected">Projected Lineup</span>';
          } else {
              lineupStatus.innerHTML = '<span class="lineup-confirmed">Lineup Confirmed</span>';
          }
  
          // Add event listener for date filter change
          document.getElementById(`date-filter-${game.gamePk}`).addEventListener('change', async function() {
              const selectedFilter = this.value;
              const newStartDate = getStartDate(selectedFilter);
              const newEndDate = formatApiDate(selectedDate);
  
              const newTeamStats = await fetchTeamStats(newStartDate, newEndDate);
              const awayTeamStats = newTeamStats[game.teams.away.team.id];
              const homeTeamStats = newTeamStats[game.teams.home.team.id];
  
              awayTeam.stats = {
                  ...awayTeam.stats,
                  avg: awayTeamStats?.avg || "-",
                  avgRank: awayTeamStats?.avgRank || "-",
                  ops: awayTeamStats?.ops || "-",
                  opsRank: awayTeamStats?.opsRank || "-",
                  runs: awayTeamStats?.runs || "-",
                  runsRank: awayTeamStats?.runsRank || "-",
                  games: awayTeamStats?.games || 1
              };
              homeTeam.stats = {
                  ...homeTeam.stats,
                  avg: homeTeamStats?.avg || "-",
                  avgRank: homeTeamStats?.avgRank || "-",
                  ops: homeTeamStats?.ops || "-",
                  opsRank: homeTeamStats?.opsRank || "-",
                  runs: homeTeamStats?.runs || "-",
                  runsRank: homeTeamStats?.runsRank || "-",
                  games: homeTeamStats?.games || 1
              };
  
              const newAwayRPG = (awayTeam.stats.runs / awayTeam.stats.games).toFixed(2);
              const newHomeRPG = (homeTeam.stats.runs / homeTeam.stats.games).toFixed(2);
  
              ranksDiv.innerHTML = `
                  <div class="rank-row">
                      <div class="rank-away">
                          <span class="stat" id="stat-avg-away">${awayTeam.stats.avg}</span>
                          <span class="rank" id="rank-avg-away">(#${awayTeam.stats.avgRank})</span>
                      </div>
                      <div class="rank-cat">
                          <span id="team-avg">AVG</span>
                      </div>
                      <div class="rank-home">
                          <span class="stat" id="stat-avg-home">${homeTeam.stats.avg}</span>
                          <span class="rank" id="rank-avg-home">(#${homeTeam.stats.avgRank})</span>
                      </div>
                  </div>
                  <div class="rank-row">
                      <div class="rank-away">
                          <span class="stat" id="stat-ops-away">${awayTeam.stats.ops}</span>
                          <span class="rank" id="rank-ops-away">(#${awayTeam.stats.opsRank})</span>
                      </div>
                      <div class="rank-cat">
                          <span id="team-ops">OPS</span>
                      </div>
                      <div class="rank-home">
                          <span class="stat" id="stat-ops-home">${homeTeam.stats.ops}</span>
                          <span class="rank" id="rank-ops-home">(#${homeTeam.stats.opsRank})</span>
                      </div>
                  </div>
                  <div class="rank-row">
                      <div class="rank-away">
                          <span class="stat" id="stat-rpg-away">${newAwayRPG}</span>
                          <span class="rank" id="rank-rpg-away">(#${awayTeam.stats.runsRank})</span>
                      </div>
                      <div class="rank-cat">
                          <span id="team-rpg">RPG</span>
                      </div>
                      <div class="rank-home">
                          <span class="stat" id="stat-rpg-home">${newHomeRPG}</span>
                          <span class="rank" id="rank-rpg-home">(#${homeTeam.stats.runsRank})</span>
                      </div>
                  </div>
              `;
  
              // Update player stats
              const newLineupData = await fetchLineups(game.gamePk, newStartDate, newEndDate);
              renderLineups(newLineupData.awayBattingOrder, game.gamePk, 'away');
              renderLineups(newLineupData.homeBattingOrder, game.gamePk, 'home');
  
              // Update lineup status
              const newLineupStatus = document.getElementById(`lineup-status-${game.gamePk}`);
              if (newLineupData.awayBattingOrder.length === 0 || newLineupData.homeBattingOrder.length === 0) {
                  newLineupStatus.innerHTML = '<span class="lineup-projected">Projected Lineup</span>';
              } else {
                  newLineupStatus.innerHTML = '<span class="lineup-confirmed">Lineup Confirmed</span>';
              }
          });
  
          // Add event listeners for team and dropdown
          const awayTeamDiv = gameDiv.querySelector('.away-team');
          const homeTeamDiv = gameDiv.querySelector('.home-team');
          const dropdown = gameDiv.querySelector('.dropdown');
          const arrow = dropdown.querySelector('.arrow-container span');
  
          function setActiveClass(teamDiv) {
              const otherTeamDiv = teamDiv === awayTeamDiv ? homeTeamDiv : awayTeamDiv;
              const teamTypeClass = teamDiv === awayTeamDiv ? 'awaytm-active' : 'hometm-active';
              const otherTeamTypeClass = otherTeamDiv === awayTeamDiv ? 'awaytm-active' : 'hometm-active';
  
              if (teamDiv.classList.contains('tm-active')) {
                  teamDiv.classList.remove('tm-active');
                  teamDiv.style.backgroundColor = ''; // Remove background color
                  ranksDiv.classList.remove('tm-active');
                  ranksDiv.style.backgroundColor = '';
                  splitsDiv.classList.remove('tm-active');
                  splitsDiv.style.backgroundColor = '';
                  lineupsDiv.classList.remove(teamTypeClass); // Remove specific team type active class
                  lineupsDiv.style.backgroundColor = ''; // Remove background color from lineups
                  dropdown.classList.remove('tm-active');
                  arrow.innerHTML = '&#8595;';
  
                  // Change logo back to team-cap-on-light
                  const teamId = teamDiv.getAttribute('data-team-id');
                  const teamLogo = teamDiv.querySelector('.team-logo img');
                  teamLogo.src = getLogoUrl(teamId, teamDiv.querySelector('.team-name').textContent);
              } else {
                  teamDiv.classList.add('tm-active');
                  otherTeamDiv.classList.remove('tm-active');
                  otherTeamDiv.style.backgroundColor = ''; // Remove background color from other team
                  const otherTeamId = otherTeamDiv.getAttribute('data-team-id');
                  const otherTeamLogo = otherTeamDiv.querySelector('.team-logo img');
                  otherTeamLogo.src = getLogoUrl(otherTeamId, otherTeamDiv.querySelector('.team-name').textContent); // Change other team's logo back to team-cap-on-light
                  const teamId = teamDiv.getAttribute('data-team-id');
                  const teamData = teamsData.find(team => team.id == teamId);
                  if (teamData) {
                      teamDiv.style.backgroundColor = teamData.color;
                      lineupsDiv.style.backgroundColor = teamData.color; // Set background color for lineups
                  }
                  ranksDiv.classList.add('tm-active');
                  ranksDiv.style.backgroundColor = teamData.color;
                  splitsDiv.classList.add('tm-active');
                  splitsDiv.style.backgroundColor = teamData.color;
                  lineupsDiv.classList.add(teamTypeClass); // Add specific team type active class
                  lineupsDiv.classList.remove(otherTeamTypeClass); // Remove the other team type active class
                  dropdown.classList.add('tm-active');
                  arrow.innerHTML = '&#8593;';
  
                  // Change logo to team-cap-on-dark
                  const teamLogo = teamDiv.querySelector('.team-logo img');
                  teamLogo.src = getLogoUrl(teamId, teamDiv.querySelector('.team-name').textContent, true);
              }
          }
  
          awayTeamDiv.addEventListener('click', function() {
              setActiveClass(awayTeamDiv);
          });
  
          homeTeamDiv.addEventListener('click', function() {
              setActiveClass(homeTeamDiv);
          });
  
          dropdown.addEventListener('click', function() {
              const activeTeam = gameDiv.querySelector('.team.tm-active');
  
              if (dropdown.classList.contains('tm-active')) {
                  dropdown.classList.remove('tm-active');
                  arrow.innerHTML = '&#8595;'; // Flecha hacia abajo
                  if (activeTeam) {
                      activeTeam.classList.remove('tm-active');
                      activeTeam.style.backgroundColor = '';
                      ranksDiv.style.backgroundColor = '';
                      splitsDiv.style.backgroundColor = '';
  
                      // Change logo back to team-cap-on-light
                      const teamId = activeTeam.getAttribute('data-team-id');
                      const teamLogo = activeTeam.querySelector('.team-logo img');
                      teamLogo.src = getLogoUrl(teamId, activeTeam.querySelector('.team-name').textContent);
                  }
                  ranksDiv.classList.remove('tm-active');
                  splitsDiv.classList.remove('tm-active');
                  lineupsDiv.classList.remove('hometm-active', 'awaytm-active');
              } else {
                  dropdown.classList.add('tm-active');
                  arrow.innerHTML = '&#8593;';
                  setActiveClass(homeTeamDiv);
              }
          });
  
      }
    }
  
    function renderCalendar(date) {
      calendarDays.innerHTML = "";
      const month = date.getMonth();
      const year = date.getFullYear();
  
      const firstDay = new Date(year, month, 1).getDay();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
  
      calendarMonthYear.textContent = date.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      });
  
      // Adjusting firstDay to match calendar's Monday start
      let adjustedFirstDay = (firstDay + 6) % 7;
  
      for (let i = 0; i < adjustedFirstDay; i++) {
        const emptyDiv = document.createElement("div");
        calendarDays.appendChild(emptyDiv);
      }
  
      for (let day = 1; day <= daysInMonth; day++) {
        const dayDiv = document.createElement("div");
        dayDiv.textContent = day;
  
        // Check if the current day is the selected day
        if (
          year === selectedDate.getFullYear() &&
          month === selectedDate.getMonth() &&
          day === selectedDate.getDate()
        ) {
          dayDiv.classList.add("active");
        }
  
        dayDiv.addEventListener("click", async function () {
          // Remove 'active' class from all days
          const activeDay = document.querySelector(".days .active");
          if (activeDay) {
            activeDay.classList.remove("active");
          }
  
          // Add 'active' class to the selected day
          dayDiv.classList.add("active");
          selectedDate.setDate(day);
          selectedDate.setMonth(month);
          selectedDate.setFullYear(year);
  
          // Update the input placeholder with the selected date
          calendarInput.value = formatDate(selectedDate);
  
          // Hide the calendar after selecting a day
          calendar.style.display = "none";
  
          // Fetch and render games for the selected date
          const games = await fetchGames(selectedDate);
          renderGames(games);
        });
  
        calendarDays.appendChild(dayDiv);
      }
    }
  
    function changeMonth(offset) {
      currentDate.setMonth(currentDate.getMonth() + offset);
      renderCalendar(currentDate);
    }
  
    async function changeDay(offset) {
      selectedDate.setDate(selectedDate.getDate() + offset);
      calendarInput.value = formatDate(selectedDate);
  
      // If the month changes, re-render the calendar
      if (
        selectedDate.getMonth() !== currentDate.getMonth() ||
        selectedDate.getFullYear() !== currentDate.getFullYear()
      ) {
        currentDate = new Date(selectedDate);
        renderCalendar(currentDate);
      } else {
        // Update the active day without re-rendering the calendar
        const activeDay = document.querySelector(".days .active");
        if (activeDay) {
          activeDay.classList.remove("active");
        }
        const adjustedFirstDay =
          (new Date(
            selectedDate.getFullYear(),
            selectedDate.getMonth(),
            1
          ).getDay() +
            6) %
          7;
        const dayDivs = document.querySelectorAll(".days div");
        dayDivs[selectedDate.getDate() + adjustedFirstDay - 1].classList.add(
          "active"
        );
      }
  
      // Fetch and render games for the selected date
      const games = await fetchGames(selectedDate);
      renderGames(games);
    }
  
    calLeft.addEventListener("click", () => changeMonth(-1));
    calRight.addEventListener("click", () => changeMonth(1));
  
    // Toggle the calendar when clicking on the input
    calendarInput.addEventListener("click", function () {
      if (calendar.style.display === "block") {
        calendar.style.display = "none";
      } else {
        calendar.style.display = "block";
      }
    });
  
    // Change day when clicking on past-day and next-day
    pastDay.addEventListener("click", () => changeDay(-1));
    nextDay.addEventListener("click", () => changeDay(1));
  
    // Set initial placeholder with the current date
    calendarInput.value = formatDate(selectedDate);
    renderCalendar(currentDate);
  
    // Fetch and render games for the initial date
    fetchGames(selectedDate).then(renderGames);
  });
  