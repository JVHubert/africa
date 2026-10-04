// Teste ponta a ponta: joga uma partida inteira no Chrome (celular simulado).
// 4 jogadores, 2 times, 3 palavras cada, 5 s por vez, rodadas 1 a 3.
// Uso: npm run test:browser   (CHROME=<caminho do executável> para outro navegador)
import { spawn } from 'node:child_process';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const CHROME = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORTA = 8766;
const pasta = await mkdtemp(join(tmpdir(), 'africa-'));
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

const servidor = spawn(process.execPath, [fileURLToPath(new URL('servidor.mjs', import.meta.url))], {
  env: { ...process.env, PORT: String(PORTA) },
});
await new Promise((r) => servidor.stdout.once('data', r));

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
const resultados = [];
function confere(nome, ok, detalhe = '') {
  console.log(`${ok ? '✔' : '✘'} ${nome}${detalhe ? ` ${detalhe}` : ''}`);
  resultados.push(ok);
}

try {
  const page = await browser.newPage();
  const errosJs = [];
  page.on('pageerror', (e) => errosJs.push(e.message));
  page.on('dialog', (d) => d.accept());
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await page.goto(`http://localhost:${PORTA}/?teste`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  const tela = () => page.$eval('#app', (el) => el.dataset.tela);
  const clicar = async (acao, extra = '') => {
    await page.waitForSelector(`[data-acao="${acao}"]${extra}`, { visible: true });
    await page.click(`[data-acao="${acao}"]${extra}`);
  };
  const foto = (nome) => page.screenshot({ path: join(pasta, `${nome}.png`), fullPage: true });

  // ---- Configuração
  await foto('01-inicio');
  await clicar('configurar');
  const nomes = ['Ana', 'Beto', 'Caio', 'Duda'];
  const campos = await page.$$('[data-campo=nome]');
  for (let i = 0; i < 4; i++) await campos[i].type(nomes[i]);
  for (let i = 0; i < 7; i++) await clicar('palavras', '[data-d="-1"]');
  await clicar('tempo', '[data-s="5"]');
  const resumo = await page.$eval('.estimativa', (el) => el.textContent);
  confere('estimativa mostra 12 palavras', resumo.includes('12 palavras'), resumo.trim().replace(/\s+/g, ' '));
  await foto('02-config');
  await clicar('comecar');

  // ---- Escrita (passa o celular)
  const palavras = [['marquiz', 'Pipoca', 'Torre Eiffel'], ['girafa', 'Pelé', 'avião'], ['pizza', 'Xuxa', 'skate'], ['banana', 'Batman', 'circo']];
  for (let j = 0; j < 4; j++) {
    await clicar('liberar-escrita');
    for (const p of palavras[j]) {
      await page.waitForSelector('#palavra');
      await page.$eval('#palavra', (el) => { el.value = ''; });
      await page.type('#palavra', p);
      const antes = await page.$$eval('.minhas li', (l) => l.length);
      await page.keyboard.press('Enter');
      // Com sugestão, aparece a confirmação; senão, a palavra entra na lista.
      await page.waitForFunction((n) => document.querySelectorAll('.minhas li').length > n || document.querySelector('.confirmar'), {}, antes);
      if (await page.$('.confirmar')) {
        const opcoes = await page.$$eval('[data-acao=aceitar-sugestao]', (b) => b.map((x) => x.dataset.t));
        if (p === 'marquiz') {
          confere('corretor sugere marquise para marquiz', opcoes[0] === 'marquise', JSON.stringify(opcoes));
          await foto('03-sugestao');
          await clicar('aceitar-sugestao', '[data-t="marquise"]');
        } else {
          await clicar('manter');
        }
        await page.waitForFunction((n) => document.querySelectorAll('.minhas li').length > n, {}, antes);
      }
      if (p === 'Pipoca') {
        // Palavra repetida (sem acento/maiúscula igual) é recusada.
        await page.type('#palavra', 'pipoca');
        await page.keyboard.press('Enter');
        await page.waitForSelector('.ajuda .aviso', { timeout: 3000 }).catch(() => {});
        confere('palavra repetida é avisada', !!(await page.$('.ajuda .aviso')));
      }
    }
    if (j === 0) {
      const lista = await page.$$eval('.minhas li span', (l) => l.map((x) => x.textContent));
      confere('lista da Ana', JSON.stringify(lista) === JSON.stringify(['marquise', 'Pipoca', 'Torre Eiffel']), JSON.stringify(lista));
      await foto('04-escrita');
    }
    await clicar('entregar');
  }

  // ---- Partida
  let recarregou = false;
  let vezes = 0;
  const vistas = new Set();
  while ((await tela()) !== 'fim' && vezes < 60) {
    const t = await tela();
    if (!vistas.has(t)) { vistas.add(t); await foto(`05-${t}`); }
    if (t === 'passagem') {
      await clicar('pronto');
      await page.waitForFunction(() => document.getElementById('app').dataset.tela === 'vez');
    } else if (t === 'vez') {
      vezes++;
      // Acerta duas palavras e deixa o tempo acabar.
      for (let i = 0; i < 2 && (await tela()) === 'vez'; i++) {
        await esperar(450);
        if ((await tela()) === 'vez' && !(await page.$('.pausa'))) await page.click('[data-acao=acertou]');
      }
      if (!recarregou && (await tela()) === 'vez') {
        // Fecha o navegador sem querer no meio da vez: o jogo volta pausado.
        recarregou = true;
        await page.reload();
        await clicar('continuar');
        confere('depois de recarregar, a vez volta pausada', !!(await page.$('.pausa')));
        await clicar('continuar-vez');
      }
      await page.waitForFunction(() => document.getElementById('app').dataset.tela !== 'vez', { timeout: 10000 });
    } else if (t === 'revisao') {
      await clicar('confirmar');
      await esperar(650);
    } else if (t === 'fimRodada') {
      await clicar('comecar-rodada');
    } else {
      throw new Error(`tela inesperada: ${t}`);
    }
  }
  confere('passou por todas as telas do jogo', ['passagem', 'vez', 'revisao', 'fimRodada'].every((t) => vistas.has(t)), [...vistas].join(', '));
  await foto('06-fim');
  const placar = await page.$$eval('.placar tbody tr', (linhas) => linhas.map((l) => Number(l.querySelector('td:last-child').textContent)));
  confere('placar final soma 36 (12 palavras × 3 rodadas)', placar.reduce((a, b) => a + b, 0) === 36, JSON.stringify(placar));
  const titulo = await page.$eval('.fim h2', (el) => el.textContent);
  confere('mostra o vencedor', /venceu|Empate/.test(titulo), titulo);
  confere('sem erros de JavaScript', errosJs.length === 0, errosJs.join(' | '));

  // Revanche mantém a turma.
  await clicar('revanche');
  confere('revanche volta para a escrita', (await tela()) === 'escrita');
} finally {
  await browser.close();
  servidor.kill();
}
console.log(`Capturas de tela em ${pasta}`);
process.exit(resultados.every(Boolean) ? 0 : 1);
