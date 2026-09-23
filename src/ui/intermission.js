import { encounters, enemyCount } from '../game/encounters.js';

export function renderIntermission(container, run, onContinue, onHangar, selectedId) {
  container.innerHTML = `
    <div class="result-eyebrow">ROUND ${run.round} CLEARED / ${run.roundKills} CONTACTS ELIMINATED</div>
    <h2 id="dialog-title">SELECT NEXT <em>ENGAGEMENT.</em></h2>
    <p class="dialog-description">Continue to round ${run.round + 1}. Airframe, ammunition and score carry forward.</p>
    <div class="intermission-summary"><span>SCORE <b>${String(run.score).padStart(6, '0')}</b></span><span>TOTAL KILLS <b>${run.totalKills}</b></span></div>
    <fieldset class="encounter-choices"><legend>NEXT ENCOUNTER</legend>
      ${encounters.map((encounter, index) => `<label class="encounter-card">
        <input type="radio" name="encounter" value="${encounter.id}" ${(selectedId ? selectedId === encounter.id : index === 0) ? 'checked' : ''}>
        <span><small>${encounter.category} / ${enemyCount(encounter)} CONTACT${enemyCount(encounter) === 1 ? '' : 'S'}</small><strong>${encounter.title}</strong><span>${encounter.description}</span></span>
      </label>`).join('')}
    </fieldset>
    <button class="launch-button" id="dialog-primary">CONTINUE SORTIE →</button>
    <button class="secondary-button" id="hangar-btn">HANGAR / CHANGE PIXY</button>`;
  container.querySelector('#dialog-primary').onclick = () => {
    onContinue(container.querySelector('input[name="encounter"]:checked').value);
  };
  container.querySelector('#hangar-btn').onclick = () => onHangar(container.querySelector('input[name="encounter"]:checked').value);
}
