import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chave, criarCorretor, distancia } from '../corretor.js';

const corretor = criarCorretor(readFileSync(new URL('../dicionario-pt.txt', import.meta.url), 'utf8'));
const sugestao = (t) => corretor.corrigir(t).sugestao;

test('distância conta trocas, faltas e letras invertidas', () => {
  assert.equal(distancia('casa', 'casa'), 0);
  assert.equal(distancia('caza', 'casa'), 1);
  assert.equal(distancia('csaa', 'casa'), 1);
  assert.equal(distancia('cachoro', 'cachorro'), 1);
  assert.equal(distancia('abc', 'xyzabc', 2), 3);
});

test('a chave junta grafias que soam igual', () => {
  assert.equal(chave('marquiz'), chave('marquise'));
  assert.equal(chave('xícara'), chave('chicara'));
  assert.equal(chave('ipopótamo'), chave('hipopótamo'));
});

test('sugere a grafia certa', () => {
  assert.equal(sugestao('marquiz'), 'marquise');
  assert.equal(sugestao('basquet'), 'basquete');
  assert.equal(sugestao('cachoro'), 'cachorro');
  assert.equal(sugestao('geladera'), 'geladeira');
  assert.equal(sugestao('ipopotamo'), 'hipopótamo');
  assert.equal(sugestao('bicicreta'), 'bicicleta');
  assert.equal(sugestao('telefoni'), 'telefone');
  assert.equal(sugestao('aviao'), 'avião');
  assert.equal(sugestao('pao de queijo'), 'pão de queijo');
  assert.equal(sugestao('Harry Poter'), 'Harry Potter');
});

test('mantém a inicial maiúscula de quem digitou', () => {
  assert.equal(sugestao('Marquiz'), 'Marquise');
});

test('não reclama do que já está certo nem de nomes desconhecidos', () => {
  for (const ok of ['basquete', 'Torre Eiffel', 'escova de dente', 'pipoca', 'Neymar', 'Beyoncé', 'Bionce', 'Xuxa', 'vó', 'ornitorrinco']) {
    assert.equal(sugestao(ok), null, ok);
  }
});

test('alternativas para uma palavra só', () => {
  const { alternativas } = corretor.corrigir('marquiz');
  assert.equal(alternativas[0], 'marquise');
  assert.ok(alternativas.length <= 3);
});
