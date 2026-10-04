// Bipes gerados na hora (sem arquivos de áudio) e vibração.
let ctx = null;

/** Precisa ser chamado num toque da pessoa: o navegador só libera o som depois disso. */
export function liberarSom() {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') ctx.resume();
  } catch { /* sem som, o jogo segue */ }
}

function tom(freq, segundos, { volume = 0.25, atraso = 0, tipo = 'sine' } = {}) {
  if (!ctx) return;
  const t = ctx.currentTime + atraso;
  const osc = ctx.createOscillator();
  const ganho = ctx.createGain();
  osc.type = tipo;
  osc.frequency.value = freq;
  ganho.gain.setValueAtTime(0, t);
  ganho.gain.linearRampToValueAtTime(volume, t + 0.01);
  ganho.gain.exponentialRampToValueAtTime(0.001, t + segundos);
  osc.connect(ganho).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + segundos + 0.05);
}

const vibrar = (padrao) => { try { navigator.vibrate?.(padrao); } catch { /* iPhone não vibra */ } };

export const sons = {
  contagem: () => tom(660, 0.15),
  vai: () => tom(990, 0.3),
  ultimosSegundos: () => { tom(880, 0.12, { tipo: 'square', volume: 0.12 }); vibrar(60); },
  acerto: () => { tom(784, 0.1); tom(1175, 0.18, { atraso: 0.08 }); vibrar(30); },
  pulo: () => tom(330, 0.12, { tipo: 'triangle' }),
  falta: () => { tom(220, 0.35, { tipo: 'sawtooth', volume: 0.15 }); vibrar([80, 60, 80]); },
  fim: () => {
    tom(523, 0.25, { tipo: 'square', volume: 0.15 });
    tom(392, 0.25, { tipo: 'square', volume: 0.15, atraso: 0.25 });
    tom(262, 0.6, { tipo: 'square', volume: 0.15, atraso: 0.5 });
    vibrar([300, 100, 300]);
  },
  vitoria: () => [523, 659, 784, 1047].forEach((f, i) => tom(f, 0.3, { atraso: i * 0.12 })),
};
