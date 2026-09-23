import { Beam } from '@beamable/sdk';
import { MatchServiceClient } from './beamable/clients/MatchServiceClient';
import type { MatchHistory, MatchView } from './beamable/clients/types';

type Move = 'rock' | 'paper' | 'scissors';

const HANDS: Record<Move, string> = { rock: '✊', paper: '✋', scissors: '✌️' };
const RESULT_TEXT: Record<string, string> = {
  won: 'You won the match! 🎉',
  lost: 'The CPU won the match.',
  draw: 'Match ended in a draw.',
  forfeit: 'You forfeited the match.',
};

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const ui = {
  player: $('player'),
  board: $('board'),
  playerWins: $('player-wins'),
  cpuWins: $('cpu-wins'),
  playerHand: $('player-hand'),
  cpuHand: $('cpu-hand'),
  status: $('status'),
  moves: [...document.querySelectorAll<HTMLButtonElement>('#moves button')],
  forfeit: $<HTMLButtonElement>('forfeit'),
  newMatch: $<HTMLButtonElement>('new-match'),
  history: $('history'),
  record: $('record'),
  recent: $('recent'),
  error: $('error'),
};

let beam: Beam;
let match: MatchView | null = null;
let busy = false;

async function main() {
  // Beam.init signs the browser in as a guest player (tokens persist in localStorage).
  beam = await Beam.init({
    cid: import.meta.env.VITE_BEAM_CID,
    pid: import.meta.env.VITE_BEAM_PID,
    gameEngine: 'Vanilla TS',
  });
  beam.use(MatchServiceClient);
  ui.player.innerHTML = `Playing as guest <code>${beam.player.id}</code>`;

  ui.moves.forEach((btn) => btn.addEventListener('click', () => play(btn.dataset.move as Move)));
  ui.forfeit.addEventListener('click', forfeit);
  ui.newMatch.addEventListener('click', startMatch);

  ui.board.hidden = false;
  await Promise.all([startMatch(), refreshHistory()]);
}

async function startMatch() {
  await run(async () => {
    match = await beam.matchServiceClient.startMatch();
    ui.playerHand.textContent = '❔';
    ui.cpuHand.textContent = '❔';
    setStatus(`New match — first to ${match.winsNeeded} wins. Pick your move.`);
    render();
  });
}

async function play(move: Move) {
  if (!match) return;
  await run(async () => {
    const result = await beam.matchServiceClient.playRound({ matchId: match!.matchId, move });
    match = result.match;
    showHand(ui.playerHand, result.playerMove as Move);
    showHand(ui.cpuHand, result.cpuMove as Move);

    if (match.status !== 'in_progress') {
      setStatus(RESULT_TEXT[match.status] ?? match.status, match.status);
      await refreshHistory();
    } else if (result.roundWinner === 'tie') {
      setStatus('Tie round — go again.');
    } else {
      setStatus(result.roundWinner === 'player' ? 'You take the round!' : 'CPU takes the round.');
    }
    render();
  });
}

async function forfeit() {
  if (!match) return;
  await run(async () => {
    match = await beam.matchServiceClient.forfeit({ matchId: match!.matchId });
    setStatus(RESULT_TEXT.forfeit, 'forfeit');
    render();
    await refreshHistory();
  });
}

async function refreshHistory() {
  const history: MatchHistory = await beam.matchServiceClient.getMyHistory({ limit: 8 });
  const tiles: [string, number][] = [
    ['Wins', history.wins],
    ['Losses', history.losses],
    ['Draws', history.draws],
    ['Forfeits', history.forfeits],
  ];
  ui.record.innerHTML = tiles.map(([label, n]) => `<div><b>${n}</b><span>${label}</span></div>`).join('');
  ui.recent.innerHTML = history.recent
    .map(
      (m) => `<li>
        <span class="tag ${m.status}">${m.status}</span>
        <span>${m.playerWins}–${m.cpuWins} in ${m.roundsPlayed} round${m.roundsPlayed === 1 ? '' : 's'}</span>
        <time datetime="${m.endedAt}">${new Date(m.endedAt).toLocaleString()}</time>
      </li>`,
    )
    .join('');
  ui.history.hidden = false;
}

function render() {
  const live = match?.status === 'in_progress';
  ui.playerWins.textContent = String(match?.playerWins ?? 0);
  ui.cpuWins.textContent = String(match?.cpuWins ?? 0);
  ui.moves.forEach((b) => (b.disabled = busy || !live));
  ui.forfeit.disabled = busy || !live;
  ui.forfeit.hidden = !live;
  ui.newMatch.hidden = live;
  ui.newMatch.disabled = busy;
}

function showHand(el: HTMLElement, move: Move) {
  el.textContent = HANDS[move] ?? '❔';
  el.classList.remove('pop');
  void el.offsetWidth; // restart the animation
  el.classList.add('pop');
}

function setStatus(text: string, kind = '') {
  ui.status.textContent = text;
  ui.status.className = `status ${kind}`;
}

async function run(action: () => Promise<void>) {
  if (busy) return;
  busy = true;
  ui.error.hidden = true;
  render();
  try {
    await action();
  } catch (err) {
    showError(err);
  } finally {
    busy = false;
    render();
  }
}

function showError(err: unknown) {
  console.error(err);
  ui.error.textContent = `Something went wrong: ${err instanceof Error ? err.message : String(err)}`;
  ui.error.hidden = false;
}

main().catch(showError);
