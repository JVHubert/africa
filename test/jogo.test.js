import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CONFIG_PADRAO, acertou, alternar, comecarRodada, confirmarVez, duracaoEstimada, entregarPalavras,
  estatisticas, explicadorAtual, falta, iniciarVez, jaNoPote, novoJogo, palavrasDaVez, placar, pular,
  revanche, sortearTimes, tempoEsgotado, validar, vencedores, aceitarRodadaSecreta, recusarRodadaSecreta,
} from '../jogo.js';

/** Gerador previsível (mulberry32) para os sorteios darem sempre o mesmo resultado. */
function semente(s) {
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const JOGADORES = [
  { nome: 'Ana', time: 0 }, { nome: 'Beto', time: 1 },
  { nome: 'Caio', time: 0 }, { nome: 'Duda', time: 1 },
];

/** Jogo pronto para a primeira vez, com 2 palavras por pessoa (8 no pote). */
function jogoPronto(config = {}) {
  const rand = semente(1);
  let e = novoJogo({ jogadores: JOGADORES, nTimes: 2, config: { ...CONFIG_PADRAO, palavrasPorPessoa: 2, ...config } });
  for (let i = 0; i < 4; i++) e = entregarPalavras(e, [`p${i}a`, `p${i}b`], rand);
  return e;
}

const textoAtual = (e) => e.palavras[e.vez.atual].texto;

test('escrita: cada um entrega e o pote fica com todas as palavras', () => {
  let e = novoJogo({ jogadores: JOGADORES, nTimes: 2 });
  assert.equal(e.fase, 'escrita');
  e = entregarPalavras(e, ['Basquete', 'pão  de queijo ']);
  assert.equal(e.escritor, 1);
  assert.equal(e.palavras[1].texto, 'pão de queijo');
  assert.ok(jaNoPote(e, 'Pao de Queijo'));
  assert.ok(!jaNoPote(e, 'queijo'));
  const pronto = jogoPronto();
  assert.equal(pronto.fase, 'passagem');
  assert.equal(pronto.pote.length, 8);
  assert.deepEqual([...pronto.pote].sort((a, b) => a - b), [0, 1, 2, 3, 4, 5, 6, 7]);
});

test('validar e sortear times', () => {
  assert.deepEqual(validar({ jogadores: JOGADORES, nTimes: 2, config: CONFIG_PADRAO }), []);
  const erros = validar({ jogadores: [...JOGADORES.slice(0, 3), { nome: 'ana', time: 0 }], nTimes: 2, config: CONFIG_PADRAO });
  assert.ok(erros.some((x) => x.includes('mesmo nome')));
  assert.ok(erros.some((x) => x.includes('Vermelho')));
  const times = sortearTimes(7, 3, semente(3));
  const contagem = [0, 1, 2].map((t) => times.filter((x) => x === t).length).sort();
  assert.deepEqual(contagem, [2, 2, 3]);
  assert.ok(duracaoEstimada({ qtdJogadores: 6, config: CONFIG_PADRAO }) >= 30);
});

test('revezamento: os times alternam e o explicador gira dentro do time', () => {
  let e = jogoPronto();
  const ordem = [];
  for (let i = 0; i < 4; i++) {
    ordem.push(explicadorAtual(e).nome);
    e = iniciarVez(e);
    e = tempoEsgotado(e);
    e = confirmarVez(e);
  }
  assert.deepEqual(ordem, ['Ana', 'Beto', 'Caio', 'Duda']);
  assert.equal(explicadorAtual(e).nome, 'Ana');
});

test('pular: a palavra volta ao pote e não reaparece na mesma vez', () => {
  let e = iniciarVez(jogoPronto());
  const pulada = e.vez.atual;
  e = pular(e, 1000);
  assert.notEqual(e.vez.atual, pulada);
  assert.equal(e.pote.at(-1), pulada);
  for (let i = 0; i < 6; i++) e = acertou(e, 2000 + i * 1000);
  // Só sobrou uma palavra além da pulada; acertando ela, a pulada volta a valer.
  e = acertou(e, 9000);
  assert.equal(e.vez.atual, pulada);
  assert.equal(e.pote.length, 1);
});

test('falta na rodada de uma palavra encerra a vez; na rodada 1 não', () => {
  let e = iniciarVez(jogoPronto());
  e = falta(e, 1000);
  assert.equal(e.fase, 'vez');
  e = { ...e, rodada: 1, vez: { ...e.vez, rodada: 1 } };
  e = falta(e, 2000);
  assert.equal(e.fase, 'revisao');
  assert.equal(e.vez.fim, 'falta');
  assert.equal(e.pote.length, 8);

  let semEncerrar = iniciarVez(jogoPronto({ faltaEncerraUmaPalavra: false }));
  semEncerrar = { ...semEncerrar, rodada: 1 };
  assert.equal(falta(semEncerrar, 1000).fase, 'vez');
});

test('pular desligado não deixa pular', () => {
  const e = iniciarVez(jogoPronto({ permitirPular: false }));
  assert.throws(() => pular(e, 1000));
});

test('revisão: desfaz um acerto errado e marca o acerto no apito', () => {
  let e = iniciarVez(jogoPronto());
  const primeira = e.vez.atual;
  e = acertou(e, 3000);
  const naTela = e.vez.atual;
  e = tempoEsgotado(e);
  const lista = palavrasDaVez(e);
  assert.deepEqual(lista.map((p) => [p.id, p.acertou, p.noApito]), [[primeira, true, false], [naTela, false, true]]);
  e = alternar(e, primeira);
  e = alternar(e, naTela);
  assert.ok(e.pote.includes(primeira));
  assert.ok(!e.pote.includes(naTela));
  e = confirmarVez(e);
  assert.equal(placar(e)[0].total, 1);
  assert.equal(estatisticas(e).maisRapida, null); // acerto corrigido não conta tempo
});

test('pote vazio: fim da rodada, sobra de tempo fica com a mesma pessoa', () => {
  const rand = semente(9);
  let e = iniciarVez(jogoPronto());
  for (let i = 1; i <= 8; i++) e = acertou(e, i * 2000);
  assert.equal(e.fase, 'revisao');
  assert.equal(e.vez.fim, 'pote-vazio');
  assert.equal(e.vez.restanteMs, 44000);
  e = confirmarVez(e, rand);
  assert.equal(e.fase, 'fimRodada');
  assert.equal(e.rodada, 1);
  assert.equal(e.pote.length, 8);
  assert.equal(e.sobraMs, 44000);
  e = comecarRodada(e);
  assert.equal(explicadorAtual(e).nome, 'Ana');
  e = iniciarVez(e);
  assert.equal(e.vez.totalMs, 44000);
  e = tempoEsgotado(e);
  e = confirmarVez(e);
  assert.equal(explicadorAtual(e).nome, 'Beto');
  e = iniciarVez(e);
  assert.equal(e.vez.totalMs, 60000);
});

test('sem sobra de tempo, a rodada seguinte começa com o próximo time', () => {
  let e = iniciarVez(jogoPronto({ sobraDeTempo: false }));
  for (let i = 1; i <= 8; i++) e = acertou(e, i * 1000);
  e = comecarRodada(confirmarVez(e));
  assert.equal(explicadorAtual(e).nome, 'Beto');
  assert.equal(iniciarVez(e).vez.totalMs, 60000);
});

test('jogo completo: 3 rodadas, placar, vencedor e curiosidades', () => {
  const rand = semente(5);
  let e = jogoPronto({ sobraDeTempo: false });
  let vezes = 0;
  while (e.fase !== 'fim') {
    if (e.fase === 'convite') { e = recusarRodadaSecreta(e); break; }
    if (e.fase === 'fimRodada') e = comecarRodada(e);
    e = iniciarVez(e);
    // Time Azul acerta 3 por vez; Vermelho acerta 2 e pula uma.
    const acertos = e.vez.time === 0 ? 3 : 2;
    if (e.vez.time === 1 && e.pote.length > 1) e = pular(e, 500);
    for (let i = 0; i < acertos && e.fase === 'vez'; i++) e = acertou(e, 1000 * (i + 1));
    if (e.fase === 'vez') e = tempoEsgotado(e);
    e = confirmarVez(e, rand);
    assert.ok(++vezes < 50, 'o jogo precisa terminar');
  }
  const p = placar(e);
  assert.equal(p[0].total + p[1].total, 24);
  p.forEach((l) => assert.equal(l.porRodada.reduce((a, b) => a + b), l.total));
  assert.equal(vencedores(e)[0].nome, 'Azul');
  const st = estatisticas(e);
  assert.equal(st.ranking.reduce((s, r) => s + r.pontos, 0), 24);
  assert.ok(st.maisDificil.vezes >= 1);
  assert.ok(st.maisRapida.duracao >= 0);

  // Estado salvo em JSON e lido de volta continua igual (localStorage).
  assert.deepEqual(JSON.parse(JSON.stringify(e)), e);

  const de2 = revanche(e);
  assert.equal(de2.fase, 'escrita');
  assert.equal(de2.palavras.length, 0);
  assert.equal(de2.jogadores.length, 4);
});

test('modos opcionais: só com a rodada de sons', () => {
  let e = jogoPronto({ modos: ['sons'] });
  e = iniciarVez(e);
  for (let i = 1; i <= 8; i++) e = acertou(e, i * 1000);
  e = confirmarVez(e);
  assert.equal(e.fase, 'fim');
});

test('revisão: desmarcar um acerto não tira a palavra da lista', () => {
  let e = iniciarVez(jogoPronto());
  const a = e.vez.atual;
  e = acertou(e, 1000);
  const b = e.vez.atual;
  e = acertou(e, 2000);
  e = tempoEsgotado(e);
  e = alternar(e, a);
  let lista = palavrasDaVez(e);
  assert.deepEqual(lista.slice(0, 2).map((p) => [p.id, p.acertou]), [[a, false], [b, true]]);
  e = alternar(e, a); // volta a ser acerto, com o tempo original
  lista = palavrasDaVez(e);
  assert.deepEqual(lista.slice(0, 2).map((p) => [p.id, p.acertou]), [[a, true], [b, true]]);
  assert.ok(!e.pote.includes(a));
  e = alternar(e, a);
  e = confirmarVez(e);
  assert.equal(placar(e)[0].total, 1);
  assert.equal(estatisticas(e).maisDificil, null); // desfazer não conta como palavra difícil
});

/** Joga todas as rodadas acertando tudo na primeira vez de cada uma. */
function jogarRodadas(e) {
  while (e.fase === 'passagem' || e.fase === 'fimRodada') {
    if (e.fase === 'fimRodada') e = comecarRodada(e);
    e = iniciarVez(e);
    while (e.fase === 'vez') e = acertou(e, 1000);
    e = confirmarVez(e);
  }
  return e;
}

test('rodada secreta: oferecida só no fim da 3ª rodada', () => {
  let e = jogarRodadas(jogoPronto({ sobraDeTempo: false }));
  assert.equal(e.fase, 'convite');
  assert.equal(recusarRodadaSecreta(e).fase, 'fim');
  e = aceitarRodadaSecreta(e);
  assert.equal(e.fase, 'fimRodada');
  assert.deepEqual(e.config.modos, ['explicar', 'uma-palavra', 'mimica', 'sons']);
  assert.equal(e.pote.length, 8);
  e = jogarRodadas(e);
  assert.equal(e.fase, 'fim');
  assert.equal(placar(e)[0].porRodada.length, 4);
  assert.equal(placar(e).reduce((s, l) => s + l.total, 0), 32);
});
