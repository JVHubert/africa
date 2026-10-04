// Gera dicionario-pt.txt: uma palavra por linha, das mais comuns para as mais raras.
// Fontes (baixadas para .cache/ na primeira execução):
//  - VERO, dicionário pt-BR do LibreOffice (LGPLv3/MPL): diz o que é palavra de verdade;
//  - FrequencyWords pt_br, legendas do OpenSubtitles (CC-BY-SA 4.0): diz o que é comum.
// Uso: npm run dicionario
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const cache = new URL('../.cache/', import.meta.url);
const FONTES = {
  'pt_BR.dic': 'https://raw.githubusercontent.com/LibreOffice/dictionaries/master/pt_BR/pt_BR.dic',
  'pt_br_full.txt': 'https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/pt_br/pt_br_full.txt',
};

await mkdir(cache, { recursive: true });
for (const [nome, url] of Object.entries(FONTES)) {
  if (existsSync(new URL(nome, cache))) continue;
  console.log(`Baixando ${url}`);
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  await writeFile(new URL(nome, cache), Buffer.from(await r.arrayBuffer()));
}

const semAcento = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
const ehPalavra = (s) => /^\p{L}[\p{L}'-]*$/u.test(s) && s.length <= 24;

// Raízes do VERO (substantivos no singular, verbos no infinitivo...), com a grafia original.
const vero = new Map();
for (const linha of (await readFile(new URL('pt_BR.dic', cache), 'utf8')).split(/\r?\n/).slice(1)) {
  const palavra = linha.split(/[/\s]/)[0];
  if (ehPalavra(palavra)) vero.set(palavra.toLowerCase(), vero.get(palavra.toLowerCase()) ?? palavra);
}

const freq = new Map();
for (const linha of (await readFile(new URL('pt_br_full.txt', cache), 'utf8')).split(/\r?\n/)) {
  const [palavra, n] = linha.split(' ');
  if (palavra && ehPalavra(palavra)) freq.set(palavra, Number(n));
}

// Formas das legendas que não estão no VERO (plurais, nomes) entram se forem comuns
// e se não forem só a versão sem acento de algo bem mais comum ("voce" de "você").
const maiorPorChave = new Map();
for (const [p, n] of freq) {
  const k = semAcento(p);
  maiorPorChave.set(k, Math.max(maiorPorChave.get(k) ?? 0, n));
}
const entra = (p, n) => vero.has(p) || (n >= 40 && n >= maiorPorChave.get(semAcento(p)) / 4);

const comFreq = [...freq].filter(([p, n]) => entra(p, n)).sort((a, b) => b[1] - a[1]).map(([p]) => p);
const vistas = new Set(comFreq);
const raras = [...vero.keys()].filter((p) => !vistas.has(p)).sort();

// Formato: palavras comuns (as que podem ser sugeridas), "*" no fim das que não estão
// no VERO (nomes, plurais, estrangeirismos); depois "---" e as raras, que só servem
// para não marcar como erro uma palavra certa.
const linhas = [
  ...comFreq.map((p) => (vero.has(p) ? vero.get(p) : `${p}*`)),
  '---',
  ...raras.map((p) => vero.get(p)),
];
const destino = fileURLToPath(new URL('../dicionario-pt.txt', import.meta.url));
await writeFile(destino, linhas.join('\n') + '\n');
console.log(`${comFreq.length} palavras comuns + ${raras.length} raras em dicionario-pt.txt`);
