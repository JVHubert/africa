// Regras do jogo África. Tudo aqui é puro: recebe o estado, devolve um estado novo.
// Nada de tela, relógio ou localStorage. O tempo chega pronto (ms desde o início da vez).

export const MODOS = {
  explicar: { nome: 'Explicar', regra: 'Explique sem dizer a palavra (nem partes dela).', icone: '🗣️' },
  'uma-palavra': { nome: 'Uma palavra', regra: 'Dê só UMA palavra de dica. Lembre-se da rodada 1!', icone: '☝️' },
  mimica: { nome: 'Mímica', regra: 'Só gestos. Nada de som nem de palavras!', icone: '🙌' },
  sons: { nome: 'Sons', regra: 'Só sons e onomatopeias. Nada de palavras nem de gestos!', icone: '🔊' },
};

export const CORES_TIMES = [
  { nome: 'Azul', cor: '#2f80ed' },
  { nome: 'Vermelho', cor: '#e5484d' },
  { nome: 'Verde', cor: '#27ae60' },
  { nome: 'Roxo', cor: '#9b51e0' },
];

export const CONFIG_PADRAO = {
  palavrasPorPessoa: 10,
  segundos: 60,
  modos: ['explicar', 'uma-palavra', 'mimica'],
  permitirPular: true,
  faltaEncerraUmaPalavra: true,
  sobraDeTempo: true,
};

/** Sobra de tempo menor que isso não vale a pena: a próxima vez começa normal. */
export const SOBRA_MINIMA_MS = 5000;

/** Fisher-Yates com gerador injetável (os testes usam um gerador previsível). */
export function embaralhar(lista, rand = Math.random) {
  const a = [...lista];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Divide as pessoas em `nTimes` times do mesmo tamanho (±1). Devolve o índice do time de cada uma. */
export function sortearTimes(qtdJogadores, nTimes, rand = Math.random) {
  const times = new Array(qtdJogadores);
  embaralhar([...Array(qtdJogadores).keys()], rand).forEach((pessoa, i) => { times[pessoa] = i % nTimes; });
  return times;
}

/** Problemas que impedem de começar, em português, para mostrar na tela. */
export function validar({ jogadores, nTimes, config }) {
  const erros = [];
  const nomes = jogadores.map((j) => j.nome.trim().toLowerCase());
  if (nomes.some((n) => !n)) erros.push('Tem jogador sem nome.');
  if (new Set(nomes).size !== nomes.length) erros.push('Tem dois jogadores com o mesmo nome.');
  for (let t = 0; t < nTimes; t++) {
    if (jogadores.filter((j) => j.time === t).length < 2) {
      erros.push(`O time ${CORES_TIMES[t].nome} precisa de pelo menos 2 pessoas.`);
    }
  }
  if (!config.modos.length) erros.push('Escolha pelo menos uma rodada.');
  return erros;
}

/** Estimativa grosseira, em minutos, para calibrar o número de palavras. */
export function duracaoEstimada({ qtdJogadores, config }) {
  const porPalavra = { explicar: 12, 'uma-palavra': 7, mimica: 11, sons: 13 };
  const n = qtdJogadores * config.palavrasPorPessoa;
  let s = qtdJogadores * config.palavrasPorPessoa * 8; // escrever
  for (const modo of config.modos) {
    const jogando = n * porPalavra[modo];
    s += jogando + Math.ceil(jogando / config.segundos) * 20; // + passar o celular
  }
  return Math.max(5, Math.round(s / 60 / 5) * 5);
}

export function novoJogo({ jogadores, nTimes, config = CONFIG_PADRAO }) {
  return {
    versao: 1,
    config: { ...config },
    times: CORES_TIMES.slice(0, nTimes).map((t) => ({ ...t })),
    jogadores: jogadores.map((j, id) => ({ id, nome: j.nome.trim(), time: j.time })),
    palavras: [],
    fase: 'escrita',
    escritor: 0,
    rodada: 0,
    pote: [],
    ordem: { time: 0, proximo: Array(nTimes).fill(0) },
    vez: null,
    sobraMs: null,
    historico: [],
  };
}

/** Mesma turma e mesmas regras, palavras novas. */
export function revanche(estado) {
  return novoJogo({ jogadores: estado.jogadores, nTimes: estado.times.length, config: estado.config });
}

const clonar = (e) => structuredClone(e);
export const modoAtual = (e) => e.config.modos[e.rodada];
export const textoDe = (e, id) => e.palavras[id].texto;

/** Normaliza para comparar palavras repetidas: "Pão de Queijo" = "pao de queijo". */
export function normalizar(texto) {
  return texto.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

export function jaNoPote(estado, texto) {
  const n = normalizar(texto);
  return estado.palavras.some((p) => normalizar(p.texto) === n);
}

/** A pessoa da vez (`estado.escritor`) entrega suas palavras. */
export function entregarPalavras(estado, textos, rand = Math.random) {
  if (estado.fase !== 'escrita') throw new Error('Não é hora de escrever.');
  const e = clonar(estado);
  for (const texto of textos) {
    e.palavras.push({ id: e.palavras.length, texto: texto.trim().replace(/\s+/g, ' '), autor: e.escritor });
  }
  e.escritor++;
  if (e.escritor === e.jogadores.length) {
    e.fase = 'passagem';
    e.pote = embaralhar(e.palavras.map((p) => p.id), rand);
  }
  return e;
}

/** Quem explica agora: o próximo do time da vez. */
export function explicadorAtual(estado) {
  const time = estado.ordem.time;
  const doTime = estado.jogadores.filter((j) => j.time === time);
  return doTime[estado.ordem.proximo[time] % doTime.length];
}

/** Próxima palavra do pote, evitando as que a pessoa já pulou nesta vez. */
function proxima(e) {
  const v = e.vez;
  let id = e.pote.find((p) => !v.puladas.includes(p));
  if (id === undefined && e.pote.length) {
    v.puladas = []; // só sobraram puladas: voltam a valer
    id = e.pote[0];
  }
  v.atual = id ?? null;
}

export function iniciarVez(estado) {
  if (estado.fase !== 'passagem') throw new Error('Não é hora de começar uma vez.');
  const e = clonar(estado);
  const quem = explicadorAtual(e);
  const totalMs = e.sobraMs ?? e.config.segundos * 1000;
  e.sobraMs = null;
  e.vez = {
    jogador: quem.id,
    time: quem.time,
    rodada: e.rodada,
    totalMs,
    restanteMs: totalMs,
    eventos: [],
    puladas: [],
    atual: null,
    mostradaEm: 0,
    fim: null,
  };
  proxima(e);
  e.fase = 'vez';
  return e;
}

function exigirVez(estado) {
  if (estado.fase !== 'vez' || estado.vez.atual === null) throw new Error('Nenhuma palavra na tela.');
}

function registrar(e, tipo, ms) {
  const v = e.vez;
  v.eventos.push({ tipo, palavra: v.atual, ms, duracao: ms - v.mostradaEm });
  v.mostradaEm = ms;
  v.restanteMs = Math.max(0, v.totalMs - ms);
}

function encerrar(e, fim) {
  e.vez.fim = fim;
  e.fase = 'revisao';
}

export function acertou(estado, ms) {
  exigirVez(estado);
  const e = clonar(estado);
  const id = e.vez.atual;
  registrar(e, 'acerto', ms);
  e.pote = e.pote.filter((p) => p !== id);
  if (!e.pote.length) {
    e.vez.atual = null;
    encerrar(e, 'pote-vazio');
  } else {
    proxima(e);
  }
  return e;
}

/** A palavra volta para o fundo do pote e não aparece de novo nesta vez. */
function devolver(e, tipo, ms) {
  const id = e.vez.atual;
  registrar(e, tipo, ms);
  e.pote = [...e.pote.filter((p) => p !== id), id];
  e.vez.puladas.push(id);
  proxima(e);
}

export function pular(estado, ms) {
  exigirVez(estado);
  if (!estado.config.permitirPular) throw new Error('Pular está desligado.');
  const e = clonar(estado);
  devolver(e, 'pulo', ms);
  return e;
}

/** Quebrou a regra da rodada: sem ponto; na rodada de uma palavra, pode encerrar a vez. */
export function falta(estado, ms) {
  exigirVez(estado);
  const e = clonar(estado);
  devolver(e, 'falta', ms);
  if (modoAtual(e) === 'uma-palavra' && e.config.faltaEncerraUmaPalavra) {
    e.vez.atual = null;
    encerrar(e, 'falta');
  }
  return e;
}

/** O relógio da tela avisa que o tempo acabou. A palavra da tela fica em `vez.atual`. */
export function tempoEsgotado(estado) {
  if (estado.fase !== 'vez') throw new Error('Nenhuma vez em andamento.');
  const e = clonar(estado);
  e.vez.restanteMs = 0;
  encerrar(e, 'tempo');
  return e;
}

const acertouNaVez = (vez, id) => vez.eventos.some((ev) => ev.tipo === 'acerto' && ev.palavra === id);

/** Palavras que passaram pela tela nesta vez, na ordem, com o resultado de cada uma. */
export function palavrasDaVez(estado) {
  const v = estado.vez;
  const ids = [];
  for (const ev of v.eventos) if (!ids.includes(ev.palavra)) ids.push(ev.palavra);
  if (v.atual !== null && !ids.includes(v.atual)) ids.push(v.atual);
  return ids.map((id) => ({
    id,
    texto: textoDe(estado, id),
    acertou: acertouNaVez(v, id),
    noApito: id === v.atual && v.fim === 'tempo',
  }));
}

/** Na revisão: corrige um toque errado (acerto ↔ não acerto). */
export function alternar(estado, id) {
  if (estado.fase !== 'revisao') throw new Error('Só dá para corrigir na revisão.');
  const e = clonar(estado);
  const v = e.vez;
  if (acertouNaVez(v, id)) {
    v.eventos = v.eventos.filter((ev) => !(ev.tipo === 'acerto' && ev.palavra === id));
    e.pote.push(id);
  } else {
    v.eventos.push({ tipo: 'acerto', palavra: id, ms: v.totalMs - v.restanteMs, duracao: null, corrigido: true });
    e.pote = e.pote.filter((p) => p !== id);
  }
  return e;
}

function avancarOrdem(e) {
  e.ordem.proximo[e.ordem.time]++;
  e.ordem.time = (e.ordem.time + 1) % e.times.length;
}

/** Fecha a vez: soma os pontos e decide se a rodada (ou o jogo) acabou. */
export function confirmarVez(estado, rand = Math.random) {
  if (estado.fase !== 'revisao') throw new Error('Nenhuma vez para confirmar.');
  const e = clonar(estado);
  const v = e.vez;
  e.historico.push({
    rodada: v.rodada,
    jogador: v.jogador,
    time: v.time,
    eventos: v.eventos,
  });
  e.vez = null;
  if (e.pote.length) {
    avancarOrdem(e);
    e.fase = 'passagem';
    return e;
  }
  // Pote vazio: fim da rodada.
  const sobra = e.config.sobraDeTempo && v.fim === 'pote-vazio' && v.restanteMs >= SOBRA_MINIMA_MS ? v.restanteMs : null;
  if (e.rodada + 1 >= e.config.modos.length) {
    e.fase = 'fim';
    return e;
  }
  e.rodada++;
  e.pote = embaralhar(e.palavras.map((p) => p.id), rand);
  e.sobraMs = sobra;
  if (sobra === null) avancarOrdem(e); // com sobra, a mesma pessoa começa a próxima rodada
  e.fase = 'fimRodada';
  return e;
}

export function comecarRodada(estado) {
  if (estado.fase !== 'fimRodada') throw new Error('A rodada não acabou.');
  return { ...clonar(estado), fase: 'passagem' };
}

/** Encerra antes do fim (ex.: ficou tarde). A vez em andamento é descartada. */
export function terminarAgora(estado) {
  return { ...clonar(estado), vez: null, fase: 'fim' };
}

/** Placar: pontos de cada time, no total e em cada rodada. */
export function placar(estado) {
  const linhas = estado.times.map((t, i) => ({
    time: i,
    nome: t.nome,
    cor: t.cor,
    porRodada: estado.config.modos.map(() => 0),
    total: 0,
  }));
  for (const h of estado.historico) {
    const n = h.eventos.filter((ev) => ev.tipo === 'acerto').length;
    linhas[h.time].porRodada[h.rodada] += n;
    linhas[h.time].total += n;
  }
  return linhas;
}

/** Vencedores (mais de um = empate). */
export function vencedores(estado) {
  const p = placar(estado);
  const max = Math.max(...p.map((l) => l.total));
  return p.filter((l) => l.total === max);
}

/** Curiosidades para a tela final. */
export function estatisticas(estado) {
  const pontos = new Map(estado.jogadores.map((j) => [j.id, 0]));
  const dificuldade = new Map();
  let maisRapida = null;
  for (const h of estado.historico) {
    for (const ev of h.eventos) {
      if (ev.tipo === 'acerto') {
        pontos.set(h.jogador, pontos.get(h.jogador) + 1);
        if (ev.duracao !== null && (!maisRapida || ev.duracao < maisRapida.duracao)) {
          maisRapida = { palavra: textoDe(estado, ev.palavra), duracao: ev.duracao, jogador: estado.jogadores[h.jogador].nome };
        }
      } else {
        dificuldade.set(ev.palavra, (dificuldade.get(ev.palavra) ?? 0) + 1);
      }
    }
  }
  const ranking = [...pontos]
    .map(([id, n]) => ({ nome: estado.jogadores[id].nome, time: estado.jogadores[id].time, pontos: n }))
    .sort((a, b) => b.pontos - a.pontos);
  const [difId, difN] = [...dificuldade].sort((a, b) => b[1] - a[1])[0] ?? [];
  return {
    ranking,
    maisRapida,
    maisDificil: difId === undefined ? null : { palavra: textoDe(estado, difId), vezes: difN },
  };
}
