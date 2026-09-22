import { wingmanAircraft } from '../aircraft/catalog.js';

export function renderHangar(container, { selectedId, wingman, round, onLaunch }) {
  container.innerHTML = `
    <div class="result-eyebrow">${round ? `ROUND ${round + 1} / FLIGHT OPERATIONS` : 'NEW RUN / FLIGHT OPERATIONS'}</div>
    <h2 id="dialog-title">CHOOSE YOUR <em>WINGMAN.</em></h2>
    <p class="dialog-description">GALM 1 · F-15C EAGLE — current aircraft<br>GALM 2 · Select your supporting aircraft.</p>
    ${wingman ? `<p class="hangar-status">CURRENT GALM 2: ${wingman.alive ? `${Math.ceil(wingman.hp)} / ${wingman.definition.maxHP} HP` : 'DESTROYED'}</p>` : ''}
    <fieldset class="encounter-choices aircraft-choices"><legend>GALM 2 AIRCRAFT</legend>
      ${wingmanAircraft.map(aircraft => `<label class="encounter-card">
        <input type="radio" name="aircraft" value="${aircraft.id}" ${aircraft.id === selectedId ? 'checked' : ''}>
        <span><small>${aircraft.maxHP} HP / FRIENDLY</small><strong>${aircraft.name}</strong>
        <span>Homing missile · ${aircraft.weapons.missile.damage} damage<br>Cannon · ${aircraft.weapons.cannon.damage} damage / bullet<br>${aircraft.weapons.laser ? `Linear Laser · ${aircraft.weapons.laser.damagePerSecond} damage / sec<br>${aircraft.weapons.laser.duration} sec burst · ${aircraft.weapons.laser.cooldown} sec cooldown` : 'Special weapon · None'}</span></span>
      </label>`).join('')}
    </fieldset>
    <p class="dialog-tip">${round ? 'Airframe condition, ammunition and score carry forward. Switching GALM 2 to a different aircraft supplies a full-health replacement. Keeping the same aircraft preserves its damage or loss.' : 'Your wingman follows, engages and defends itself using local combat AI.'}</p>
    <p id="hangar-feedback" class="hangar-status" role="status"></p>
    <button class="launch-button" id="dialog-primary">${round ? 'CONTINUE SORTIE' : 'LAUNCH SORTIE'} →</button>`;
  const button = container.querySelector('#dialog-primary');
  button.onclick = async () => {
    button.disabled = true;
    container.querySelectorAll('input').forEach(input => { input.disabled = true; });
    container.querySelector('#hangar-feedback').textContent = 'Preparing GALM 2…';
    try { await onLaunch(container.querySelector('input[name="aircraft"]:checked').value); }
    catch (error) {
      console.error('Flight operations preparation failed.', error);
      container.querySelector('#hangar-feedback').textContent = 'Preparation failed. Please try again.';
    } finally {
      button.disabled = false; container.querySelectorAll('input').forEach(input => { input.disabled = false; });
    }
  };
}
