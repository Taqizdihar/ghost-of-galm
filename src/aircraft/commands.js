export const WingmanCommand = Object.freeze({ ATTACK: 'ATTACK', REGROUP: 'REGROUP' });

export function createWingmanCommandState() {
  let current = WingmanCommand.ATTACK;
  return {
    get current() { return current; },
    accept(command, active, alive) {
      if (!active || !alive || !Object.values(WingmanCommand).includes(command) || current === command) return false;
      current = command; return true;
    },
    reset() { current = WingmanCommand.ATTACK; },
  };
}
