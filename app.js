import * as J from './jogo.js';
import { CONFIG_PADRAO, CORES_TIMES, MODOS } from './jogo.js';
import { TODAS } from './sugestoes.js';
import { liberarSom, sons } from './som.js';

const $app = document.getElementById('app');
const $camada = document.getElementById('camada');
const TESTE = new URLSearchParams(location.search).has('teste'); // tempo de 5 s e contagem rápida
const TEMPOS = TESTE ? [5, 30, 45, 60, 90, 120] : [30, 45, 60, 90, 120];

// ---------- Guardar no aparelho (sobrevive a recarregar a página) ----------

const CH = { jogo: 'africa:jogo', rascunho: 'africa:rascunho', escrita: 'africa:escrita' };
function guardar(chave, valor) {
  try {
    if (valor == null) localStorage.removeItem(chave);
    else localStorage.setItem(chave, JSON.stringify(valor));
  } catch { /* modo privado: o jogo funciona, só não guarda */ }
}
function ler(chave) {
  try { return JSON.parse(localStorage.getItem(chave)); } catch { return null; }
}

let estado = ler(CH.jogo);
if (estado?.versao !== 1) estado = null;

const rascunhoSalvo = ler(CH.rascunho);
let rascunho = {
  nTimes: 2,
  jogadores: [{ nome: '', time: 0 }, { nome: '', time: 1 }, { nome: '', time: 0 }, { nome: '', time: 1 }],
  ...rascunhoSalvo,
  config: { ...CONFIG_PADRAO, ...rascunhoSalvo?.config },
};

const salvarJogo = () => guardar(CH.jogo, estado);
const salvarRascunho = () => guardar(CH.rascunho, rascunho);

/** Estado só da tela (não faz parte das regras). */
const ui = {
  tela: 'inicio',          // 'inicio' | 'config' | 'jogo'
  erros: [],
  escrita: novaEscrita(),
  contagem: null,          // 3, 2, 1 antes da vez começar
  pausado: false,
};

function novaEscrita() {
  const salva = ler(CH.escrita);
  const valida = salva && estado?.fase === 'escrita' && salva.escritor === estado.escritor;
  return { liberada: !!valida, minhas: valida ? salva.minhas : [] };
}
const salvarEscrita = () => guardar(CH.escrita, { escritor: estado.escritor, minhas: ui.escrita.minhas });

// ---------- Utilidades ----------

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const corTime = (i) => CORES_TIMES[i].cor;
const nomeTime = (i) => CORES_TIMES[i].nome;
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
const segundos = (ms) => Math.ceil(ms / 1000);

function rotuloRodada(e = estado) {
  const modo = MODOS[J.modoAtual(e)];
  return `Rodada ${e.rodada + 1} de ${e.config.modos.length} · ${modo.icone} ${modo.nome}`;
}

function placarMini() {
  return `<div class="placar-mini">${J.placar(estado).map((l) => `
    <span style="--cor:${l.cor}"><i></i>${esc(l.nome)} <b>${l.total}</b></span>`).join('')}
  </div>`;
}

function botaoMenu() {
  return '<button class="icone" data-acao="menu" aria-label="Menu">⋯</button>';
}

// ---------- Corretor (roda num worker para não travar a digitação) ----------

let worker = null;
let seq = 0;
const pendentes = new Map();
function iniciarCorretor() {
  if (worker || typeof Worker === 'undefined') return;
  try {
    worker = new Worker('corretor-worker.js', { type: 'module' });
    worker.onmessage = ({ data }) => {
      pendentes.get(data.id)?.(data);
      pendentes.delete(data.id);
    };
  } catch { worker = null; }
}
/** Sugestão para o texto; se o dicionário ainda não carregou, desiste depois de `espera` ms. */
function corrigir(texto, espera = 1500) {
  iniciarCorretor();
  const nada = { texto, sugestao: null, alternativas: [] };
  if (!worker) return Promise.resolve(nada);
  return new Promise((resolve) => {
    const id = ++seq;
    pendentes.set(id, resolve);
    worker.postMessage({ id, texto });
    setTimeout(() => { if (pendentes.delete(id)) resolve(nada); }, espera);
  });
}

// ---------- Telas ----------

function render() {
  fecharCamadaSeVazia();
  let html;
  if (ui.tela === 'inicio' || (ui.tela === 'jogo' && !estado)) html = telaInicio();
  else if (ui.tela === 'config') html = telaConfig();
  else html = {
    escrita: telaEscrita,
    passagem: telaPassagem,
    vez: telaVez,
    revisao: telaRevisao,
    fimRodada: telaFimRodada,
    convite: telaConvite,
    fim: telaFim,
  }[estado.fase]();
  $app.innerHTML = html;
  $app.classList.remove('acabando');
  $app.dataset.tela = ui.tela === 'jogo' ? estado.fase : ui.tela;
  document.querySelector('meta[name=theme-color]').content =
    ui.tela === 'jogo' && ['passagem', 'vez'].includes(estado.fase) ? corTime(J.explicadorAtual(estado).time) : '#f5a524';
  if (ui.tela === 'jogo' && estado.fase === 'vez') atualizarRelogio();
  manterTelaLigada();
}

function telaInicio() {
  return `
  <section class="tela inicio">
    <img class="logo" src="icons/icon.svg" alt="">
    <h1>África</h1>
    <p class="sub">O jogo do pote de palavras</p>
    <div class="acoes">
      ${estado ? '<button class="btn primario grande" data-acao="continuar">Continuar jogo</button>' : ''}
      <button class="btn ${estado ? 'secundario' : 'primario grande'}" data-acao="configurar">Novo jogo</button>
      <button class="btn link" data-acao="regras">Como jogar</button>
    </div>
  </section>`;
}

function resumoTimes() {
  const { jogadores, nTimes } = rascunho;
  return [...Array(nTimes).keys()].map((t) => {
    const nomes = jogadores.filter((j) => j.time === t && j.nome.trim()).map((j) => esc(j.nome.trim()));
    return `<li style="--cor:${corTime(t)}"><i></i><b>${nomeTime(t)}</b> ${nomes.join(', ') || '<em>ninguém</em>'}</li>`;
  }).join('');
}

function estimativa() {
  const { jogadores, config } = rascunho;
  const preenchidos = jogadores.filter((j) => j.nome.trim()).length;
  return `${plural(preenchidos * config.palavrasPorPessoa, 'palavra', 'palavras')} no pote ·
    ≈ ${J.duracaoEstimada({ qtdJogadores: Math.max(preenchidos, 1), config })} min de jogo`;
}

/** Atualiza só os resumos enquanto a pessoa digita nomes (redesenhar tiraria o foco do campo). */
function atualizarResumoConfig() {
  const $t = $app.querySelector('.resumo-times');
  const $e = $app.querySelector('.estimativa');
  if ($t) $t.innerHTML = resumoTimes();
  if ($e) $e.innerHTML = estimativa();
}

function telaConfig() {
  const { jogadores, nTimes, config } = rascunho;
  return `
  <section class="tela config">
    <header class="topo">
      <button class="icone" data-acao="inicio" aria-label="Voltar">←</button>
      <h2>Novo jogo</h2>
    </header>

    <div class="cartao">
      <h3>Quem vai jogar?</h3>
      <ul class="jogadores">
        ${jogadores.map((j, i) => `
        <li>
          <input data-campo="nome" data-i="${i}" value="${esc(j.nome)}" placeholder="Nome ${i + 1}" maxlength="18" autocomplete="off" enterkeyhint="next">
          <button class="chip-time" style="--cor:${corTime(j.time)}" data-acao="trocar-time" data-i="${i}">${nomeTime(j.time)}</button>
          <button class="icone pequeno" data-acao="remover-jogador" data-i="${i}" aria-label="Remover">×</button>
        </li>`).join('')}
      </ul>
      <button class="btn secundario" data-acao="adicionar-jogador">+ Jogador</button>
    </div>

    <div class="cartao">
      <h3>Times</h3>
      <div class="segmentado" role="group" aria-label="Número de times">
        ${[2, 3, 4].map((n) => `<button class="${n === nTimes ? 'ativo' : ''}" data-acao="n-times" data-n="${n}">${n} times</button>`).join('')}
      </div>
      <button class="btn secundario" data-acao="sortear">🎲 Sortear times</button>
      <ul class="resumo-times">${resumoTimes()}</ul>
      <p class="dica">Toque no time de alguém para trocar. Para jogar em duplas, use times de 2.</p>
    </div>

    <div class="cartao">
      <h3>Partida</h3>
      <div class="linha">
        <span>Palavras por pessoa</span>
        <div class="passo">
          <button data-acao="palavras" data-d="-1" aria-label="Menos">−</button>
          <b>${config.palavrasPorPessoa}</b>
          <button data-acao="palavras" data-d="1" aria-label="Mais">+</button>
        </div>
      </div>
      <div class="linha coluna">
        <span>Tempo de cada vez</span>
        <div class="segmentado">
          ${TEMPOS.map((s) => `<button class="${s === config.segundos ? 'ativo' : ''}" data-acao="tempo" data-s="${s}">${s}s</button>`).join('')}
        </div>
      </div>
    </div>

    <div class="cartao">
      <h3>Rodadas</h3>
      ${J.MODOS_NORMAIS.map((id) => [id, MODOS[id]]).map(([id, m], i) => `
      <label class="alternador">
        <input type="checkbox" data-campo="modo" data-modo="${id}" ${config.modos.includes(id) ? 'checked' : ''}>
        <span class="texto"><b>${m.icone} ${m.nome}</b><small>${m.regra}</small></span>
        <span class="trilho"></span>
      </label>`).join('')}
    </div>

    <div class="cartao">
      <h3>Regras da casa</h3>
      ${alternador('permitirPular', 'Pode pular palavra', 'A palavra pulada volta para o pote.')}
      ${alternador('faltaEncerraUmaPalavra', 'Falta na rodada de uma palavra encerra a vez', 'Falou mais de uma palavra? Passa a vez.')}
      ${alternador('sobraDeTempo', 'Tempo que sobra passa para a próxima rodada', 'Se o pote esvaziar no meio da vez, a mesma pessoa começa a próxima rodada com o tempo que sobrou.')}
    </div>

    <p class="estimativa">${estimativa()}</p>
    ${ui.erros.length ? `<ul class="erros">${ui.erros.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>` : ''}
    <button class="btn primario grande" data-acao="comecar">Começar</button>
  </section>`;
}

function alternador(campo, titulo, detalhe) {
  return `
  <label class="alternador">
    <input type="checkbox" data-campo="regra" data-regra="${campo}" ${rascunho.config[campo] ? 'checked' : ''}>
    <span class="texto"><b>${titulo}</b><small>${detalhe}</small></span>
    <span class="trilho"></span>
  </label>`;
}

function telaEscrita() {
  const jogador = estado.jogadores[estado.escritor];
  const n = estado.config.palavrasPorPessoa;
  if (!ui.escrita.liberada) {
    return `
    <section class="tela portao" style="--cor:${corTime(jogador.time)}">
      <header class="topo"><span class="selo">Escrevendo: ${estado.escritor + 1} de ${estado.jogadores.length}</span>${botaoMenu()}</header>
      <div class="centro">
        <p>Passe o celular para</p>
        <div class="nome-grande">${esc(jogador.nome)}</div>
        <p>Não deixe ninguém ver suas palavras 🤫</p>
      </div>
      <button class="btn claro grande" data-acao="liberar-escrita">Sou ${esc(jogador.nome)}, vamos lá!</button>
    </section>`;
  }
  const minhas = ui.escrita.minhas;
  const cheio = minhas.length >= n;
  return `
  <section class="tela escrita">
    <header class="topo">
      <h2>${esc(jogador.nome)}, escreva ${plural(n, 'palavra', 'palavras')}</h2>
      <span class="contador ${cheio ? 'cheio' : ''}">${minhas.length}/${n}</span>
    </header>
    ${cheio ? '<p class="feito">Tudo certo! Confira a lista e toque em <b>Pronto</b>.</p>' : `
    <p class="dica">Vale tudo: objetos, famosos, filmes, lugares, gente da família. Fuja do óbvio: quanto menos comum a palavra, mais divertido fica!</p>
    <form id="form-palavra" class="campo-palavra" autocomplete="off">
      <input id="palavra" maxlength="40" placeholder="Ex.: basquete, Torre Eiffel…" enterkeyhint="done" autocomplete="off" aria-label="Palavra">
      <button class="btn primario" type="submit">Adicionar</button>
    </form>
    <div id="ajuda" class="ajuda" aria-live="polite"></div>
    <button class="btn link" type="button" data-acao="ideia">💡 Me dá uma ideia</button>`}
    <ol class="minhas">
      ${minhas.map((p, i) => `<li><span>${esc(p)}</span><button class="icone pequeno" data-acao="remover-palavra" data-i="${i}" aria-label="Apagar ${esc(p)}">×</button></li>`).join('')}
    </ol>
    <button class="btn primario grande" data-acao="entregar" ${cheio ? '' : 'disabled'}>Pronto! Colocar no pote</button>
  </section>`;
}

function telaPassagem() {
  const quem = J.explicadorAtual(estado);
  const modo = MODOS[J.modoAtual(estado)];
  const primeira = estado.historico.length === 0;
  return `
  <section class="tela portao" style="--cor:${corTime(quem.time)}">
    <header class="topo"><span class="selo">${rotuloRodada()}</span>${botaoMenu()}</header>
    ${placarMini()}
    <div class="centro">
      ${primeira ? `<p class="destaque">Todas as ${estado.palavras.length} palavras estão no pote! 🎉</p>` : ''}
      <p>Vez de</p>
      <div class="nome-grande">${esc(quem.nome)}</div>
      <p>Time ${nomeTime(quem.time)} adivinha</p>
      <p class="regra">${modo.icone} ${modo.regra}</p>
      <p class="info">${plural(estado.pote.length, 'palavra', 'palavras')} no pote${estado.sobraMs ? ` · começa com ${segundos(estado.sobraMs)} s que sobraram` : ''}</p>
    </div>
    ${ui.contagem !== null
      ? `<div class="contagem" aria-live="assertive">${ui.contagem || 'Já!'}</div>`
      : `<button class="btn claro grande" data-acao="pronto">Estou pronto!</button>`}
  </section>`;
}

function telaVez() {
  const v = estado.vez;
  const texto = J.textoDe(estado, v.atual);
  const acertos = v.eventos.filter((e) => e.tipo === 'acerto').length;
  return `
  <section class="tela vez" style="--cor:${corTime(v.time)}">
    <header class="topo">
      <span class="selo">${rotuloRodada()}</span>
      <button class="icone" data-acao="pausar" aria-label="Pausar">⏸</button>
    </header>
    <div class="relogio">
      <div class="barra"><span id="barra"></span></div>
      <div id="segundos" class="segundos">${segundos(v.restanteMs)}</div>
    </div>
    <div class="cartao-palavra">
      ${ui.pausado
        ? '<div class="pausa"><p>Pausado</p><button class="btn primario grande" data-acao="continuar-vez">Continuar</button></div>'
        : `<div id="palavra-atual" class="palavra ${texto.length > 14 ? 'longa' : ''}">${esc(texto)}</div>`}
      <small>${plural(estado.pote.length, 'palavra', 'palavras')} no pote · ✓ ${acertos} nesta vez</small>
    </div>
    <div class="botoes-vez">
      <div class="lado">
        ${estado.config.permitirPular ? '<button class="btn pular" data-acao="pular">↷ Pular</button>' : ''}
        <button class="btn falta" data-acao="falta">⚠ Falta</button>
      </div>
      <button class="btn acertou" data-acao="acertou">✓ Acertou!</button>
    </div>
  </section>`;
}

function telaRevisao() {
  const v = estado.vez;
  const lista = J.palavrasDaVez(estado);
  const pontos = lista.filter((p) => p.acertou).length;
  const titulo = { tempo: '⏰ Tempo!', 'pote-vazio': '🎉 O pote esvaziou!', falta: '⚠ Falta! Acabou a vez.' }[v.fim];
  return `
  <section class="tela revisao" style="--cor:${corTime(v.time)}">
    <header class="topo"><span class="selo">${rotuloRodada()}</span>${botaoMenu()}</header>
    <h2>${titulo}</h2>
    <p class="quem">${esc(estado.jogadores[v.jogador].nome)} · Time ${nomeTime(v.time)}</p>
    ${lista.length ? `
    <ul class="lista-revisao">
      ${lista.map((p) => `
      <li>
        <button class="${p.acertou ? 'ok' : ''} ${p.noApito ? 'apito' : ''}" data-acao="alternar" data-id="${p.id}" aria-pressed="${p.acertou}">
          <span class="marca">${p.acertou ? '✓' : '✗'}</span>
          <span class="txt">${esc(p.texto)}${p.noApito && !p.acertou ? '<small>Estava na tela quando o tempo acabou. Acertaram no apito? Toque para contar.</small>' : ''}</span>
        </button>
      </li>`).join('')}
    </ul>
    <p class="dica">Tocou errado? Toque na palavra para corrigir.</p>` : '<p class="dica">Nenhuma palavra nesta vez.</p>'}
    <p class="pontos-vez">+${plural(pontos, 'ponto', 'pontos')} para o Time ${nomeTime(v.time)}</p>
    <button class="btn primario grande" data-acao="confirmar">Confirmar</button>
  </section>`;
}

function tabelaPlacar() {
  const p = J.placar(estado);
  const modos = estado.config.modos;
  return `
  <table class="placar">
    <thead><tr><th>Time</th>${modos.map((m) => `<th title="${MODOS[m].nome}">${MODOS[m].icone}</th>`).join('')}<th>Total</th></tr></thead>
    <tbody>${p.map((l) => `
      <tr style="--cor:${l.cor}"><td><span class="nome-time"><i></i>${esc(l.nome)}</span></td>${l.porRodada.map((n, r) => `<td>${r < estado.rodada || ['fim', 'convite'].includes(estado.fase) ? n : '–'}</td>`).join('')}<td><b>${l.total}</b></td></tr>`).join('')}
    </tbody>
  </table>`;
}

function telaFimRodada() {
  const anterior = estado.rodada; // já avançou: "rodada" é a próxima
  const modo = MODOS[J.modoAtual(estado)];
  const quem = J.explicadorAtual(estado);
  return `
  <section class="tela fim-rodada">
    <header class="topo"><span class="selo">Fim da rodada ${anterior}</span>${botaoMenu()}</header>
    <h2>Fim da rodada ${anterior}! 🎉</h2>
    ${tabelaPlacar()}
    <div class="proxima">
      <p>Agora é a</p>
      <h3>Rodada ${estado.rodada + 1}: ${modo.icone} ${modo.nome}</h3>
      <p class="regra">${modo.regra}</p>
      <p>As mesmas palavras voltaram para o pote.</p>
    </div>
    <p class="info">Começa: <b>${esc(quem.nome)}</b> (Time ${nomeTime(quem.time)})${estado.sobraMs ? `, com os ${segundos(estado.sobraMs)} s que sobraram` : ''}</p>
    <button class="btn primario grande" data-acao="comecar-rodada">Começar rodada ${estado.rodada + 1}</button>
  </section>`;
}

function telaConvite() {
  const modo = MODOS[J.MODO_SECRETO];
  return `
  <section class="tela convite">
    <header class="topo"><span class="selo">Fim da rodada ${estado.rodada + 1}</span>${botaoMenu()}</header>
    <h2>Fim da rodada ${estado.rodada + 1}! 🎉</h2>
    ${tabelaPlacar()}
    <div class="segredo">
      <div class="cadeado">🤫</div>
      <h3>Psiu… existe uma rodada secreta!</h3>
      <p>As mesmas palavras voltam para o pote mais uma vez, agora com a regra mais difícil de todas:</p>
      <p class="regra">${modo.icone} ${modo.regra}</p>
      <p>Topam?</p>
    </div>
    <div class="acoes">
      <button class="btn primario grande" data-acao="aceitar-secreta">Bora! ${modo.icone}</button>
      <button class="btn secundario" data-acao="recusar-secreta">Não, ver o resultado</button>
    </div>
  </section>`;
}

function telaFim() {
  const venc = J.vencedores(estado);
  const st = J.estatisticas(estado);
  const titulo = venc.length > 1 ? `Empate entre ${venc.map((l) => l.nome).join(' e ')}!` : `Time ${venc[0].nome} venceu!`;
  const craque = st.ranking[0];
  return `
  <section class="tela fim">
    <div class="trofeu">🏆</div>
    <h2 style="--cor:${venc.length > 1 ? 'var(--marca)' : venc[0].cor}">${esc(titulo)}</h2>
    ${tabelaPlacar()}
    <ul class="curiosidades">
      ${craque?.pontos ? `<li>⭐ <span>Quem mais fez o time acertar: <b>${esc(craque.nome)}</b> (${plural(craque.pontos, 'ponto', 'pontos')})</span></li>` : ''}
      ${st.maisRapida ? `<li>⚡ <span>Mais rápida: <b>${esc(st.maisRapida.palavra)}</b> em ${(st.maisRapida.duracao / 1000).toFixed(1).replace('.', ',')} s (${esc(st.maisRapida.jogador)})</span></li>` : ''}
      ${st.maisDificil ? `<li>🧱 <span>Mais difícil: <b>${esc(st.maisDificil.palavra)}</b> (pulada ou com falta ${plural(st.maisDificil.vezes, 'vez', 'vezes')})</span></li>` : ''}
    </ul>
    <div class="acoes">
      <button class="btn primario grande" data-acao="revanche">Jogar de novo (mesma turma)</button>
      <button class="btn secundario" data-acao="configurar">Novo jogo</button>
    </div>
  </section>`;
}

// ---------- Camada por cima (menu, regras, confirmações) ----------

function abrirCamada(html) {
  $camada.innerHTML = `<div class="janela" role="dialog" aria-modal="true">${html}</div>`;
  $camada.hidden = false;
}
function fecharCamada() {
  $camada.hidden = true;
  $camada.innerHTML = '';
}
function fecharCamadaSeVazia() {
  if (!$camada.innerHTML) $camada.hidden = true;
}

const REGRAS = `
  <h2>Como jogar</h2>
  <p>Cada pessoa escreve palavras secretas, que vão para o pote. Os times se revezam: alguém do time pega o celular e tenta fazer o próprio time adivinhar o máximo de palavras antes do tempo acabar. Cada acerto vale 1 ponto.</p>
  <p>Quando o pote esvazia, a rodada acaba e <b>todas as palavras voltam</b> para a rodada seguinte, com uma regra mais difícil:</p>
  <ol class="lista-regras">
    ${J.MODOS_NORMAIS.map((id) => MODOS[id]).map((m) => `<li><b>${m.icone} ${m.nome}</b>: ${m.regra}</li>`).join('')}
  </ol>
  <p>Dica: preste atenção na rodada 1. As dicas que funcionaram nela salvam o time nas rodadas seguintes!</p>
  <p><b>Falta</b> é quando quem explica quebra a regra (falou a palavra, usou mais de uma palavra na rodada 2, fez som na mímica). A palavra volta para o pote sem ponto.</p>
  <button class="btn primario" data-acao="fechar">Entendi</button>`;

function abrirMenu() {
  const emJogo = ui.tela === 'jogo' && estado;
  abrirCamada(`
    <h2>Menu</h2>
    <div class="acoes">
      <button class="btn secundario" data-acao="regras">Como jogar</button>
      ${emJogo && estado.fase !== 'escrita' && estado.fase !== 'fim' ? '<button class="btn secundario" data-acao="pedir-terminar">Terminar o jogo agora</button>' : ''}
      ${emJogo ? '<button class="btn secundario" data-acao="pedir-abandonar">Abandonar e voltar ao início</button>' : ''}
      <button class="btn primario" data-acao="fechar">Voltar ao jogo</button>
    </div>`);
}

// ---------- Relógio da vez ----------

let relogio = null; // { baseMs, inicio (performance.now ou null se pausado), ultimoSegundo }

function decorrido() {
  if (!relogio) return 0;
  return relogio.baseMs + (relogio.inicio === null ? 0 : performance.now() - relogio.inicio);
}

function iniciarRelogio(baseMs = 0) {
  relogio = { baseMs, inicio: performance.now(), ultimoSegundo: null };
}

function pausar() {
  if (!relogio || relogio.inicio === null) return;
  relogio.baseMs = decorrido();
  relogio.inicio = null;
  ui.pausado = true;
  salvarJogo();
  render();
}

function atualizarRelogio() {
  const v = estado.vez;
  const $s = document.getElementById('segundos');
  const $b = document.getElementById('barra');
  if (!$s) return;
  const resto = Math.max(0, v.totalMs - decorrido());
  $s.textContent = segundos(resto);
  $b.style.width = `${(resto / (estado.config.segundos * 1000)) * 100}%`;
  $app.classList.toggle('acabando', resto <= 5000);
}

function tique() {
  if (ui.tela !== 'jogo' || estado?.fase !== 'vez' || !relogio || relogio.inicio === null) return;
  const v = estado.vez;
  const resto = Math.max(0, v.totalMs - decorrido());
  v.restanteMs = resto;
  atualizarRelogio();
  const s = segundos(resto);
  if (s !== relogio.ultimoSegundo) {
    relogio.ultimoSegundo = s;
    if (s > 0 && s <= 5) sons.ultimosSegundos();
    salvarJogo(); // se o navegador fechar, volta pausado com o tempo certo
  }
  if (resto <= 0) {
    relogio = null;
    estado = J.tempoEsgotado(estado);
    sons.fim();
    salvarJogo();
    render();
  }
}
setInterval(tique, 100);

// ---------- Tela sempre ligada durante o jogo ----------

let trava = null;
async function manterTelaLigada() {
  const precisa = ui.tela === 'jogo' && estado && !['escrita', 'fim'].includes(estado.fase);
  try {
    if (precisa && !trava && document.visibilityState === 'visible' && navigator.wakeLock) {
      trava = await navigator.wakeLock.request('screen');
      trava.addEventListener('release', () => { trava = null; });
    } else if (!precisa && trava) {
      await trava.release();
      trava = null;
    }
  } catch { trava = null; }
}

document.addEventListener('visibilitychange', () => {
  // Saiu do app no meio da vez (ligação, notificação): pausa para ninguém perder tempo.
  if (document.visibilityState === 'hidden' && estado?.fase === 'vez' && ui.tela === 'jogo') pausar();
  manterTelaLigada();
});

// ---------- Ações ----------

let travadoAte = 0;
/** Evita que um toque duplo marque a palavra seguinte sem querer. */
function travarToques(ms = 350) {
  if (performance.now() < travadoAte) return true;
  travadoAte = performance.now() + ms;
  return false;
}

function atualizar(novo, { som } = {}) {
  estado = novo;
  salvarJogo();
  som?.();
  render();
}

function contarAteComecar() {
  liberarSom();
  ui.contagem = 3;
  render();
  const passo = TESTE ? 150 : 800;
  const proximo = () => {
    if (ui.contagem > 0) {
      sons.contagem();
      setTimeout(() => {
        ui.contagem--;
        if (ui.contagem > 0) { render(); proximo(); return; }
        ui.contagem = 0;
        render();
        sons.vai();
        setTimeout(() => {
          ui.contagem = null;
          ui.pausado = false;
          estado = J.iniciarVez(estado);
          iniciarRelogio(0);
          salvarJogo();
          render();
        }, passo / 2);
      }, passo);
    }
  };
  proximo();
}

function balancearTime() {
  const contagem = Array(rascunho.nTimes).fill(0);
  rascunho.jogadores.forEach((j) => { if (j.time < rascunho.nTimes) contagem[j.time]++; });
  return contagem.indexOf(Math.min(...contagem));
}

const acoes = {
  inicio() { ui.tela = 'inicio'; render(); },
  continuar() {
    ui.tela = 'jogo';
    ui.escrita = novaEscrita();
    if (estado.fase === 'vez') {
      // Voltou para um jogo que estava no meio da vez: fica pausado com o tempo que restava.
      relogio = { baseMs: estado.vez.totalMs - estado.vez.restanteMs, inicio: null, ultimoSegundo: null };
      ui.pausado = true;
    }
    render();
  },
  configurar() {
    if (estado && estado.fase !== 'fim' && !confirm('Começar um jogo novo? O jogo atual será perdido.')) return;
    ui.tela = 'config';
    ui.erros = [];
    iniciarCorretor(); // o dicionário já vai carregando
    render();
    window.scrollTo(0, 0);
  },
  regras() { abrirCamada(REGRAS); },
  menu() { abrirMenu(); },
  fechar() { fecharCamada(); },

  'adicionar-jogador'() {
    rascunho.jogadores.push({ nome: '', time: balancearTime() });
    salvarRascunho();
    render();
    const campos = $app.querySelectorAll('[data-campo=nome]');
    campos[campos.length - 1]?.focus();
  },
  'remover-jogador'({ i }) {
    rascunho.jogadores.splice(Number(i), 1);
    salvarRascunho();
    render();
  },
  'trocar-time'({ i }) {
    const j = rascunho.jogadores[Number(i)];
    j.time = (j.time + 1) % rascunho.nTimes;
    salvarRascunho();
    render();
  },
  'n-times'({ n }) {
    rascunho.nTimes = Number(n);
    for (const j of rascunho.jogadores) if (j.time >= rascunho.nTimes) j.time = balancearTime();
    salvarRascunho();
    render();
  },
  sortear() {
    const ativos = rascunho.jogadores.filter((j) => j.nome.trim());
    J.sortearTimes(ativos.length, rascunho.nTimes).forEach((t, i) => { ativos[i].time = t; });
    salvarRascunho();
    render();
  },
  palavras({ d }) {
    rascunho.config.palavrasPorPessoa = Math.min(20, Math.max(3, rascunho.config.palavrasPorPessoa + Number(d)));
    salvarRascunho();
    render();
  },
  tempo({ s }) {
    rascunho.config.segundos = Number(s);
    salvarRascunho();
    render();
  },
  comecar() {
    const jogadores = rascunho.jogadores.filter((j) => j.nome.trim());
    const config = { ...rascunho.config, modos: J.MODOS_NORMAIS.filter((m) => rascunho.config.modos.includes(m)) };
    ui.erros = J.validar({ jogadores, nTimes: rascunho.nTimes, config });
    if (ui.erros.length) {
      render();
      $app.querySelector('.erros')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    // Intercala os times na escrita, para o celular circular pela roda.
    const ordem = [...jogadores].sort((a, b) => jogadores.filter((x) => x.time === a.time).indexOf(a) - jogadores.filter((x) => x.time === b.time).indexOf(b) || a.time - b.time);
    estado = J.novoJogo({ jogadores: ordem, nTimes: rascunho.nTimes, config });
    guardar(CH.escrita, null);
    ui.escrita = novaEscrita();
    ui.tela = 'jogo';
    salvarJogo();
    render();
    window.scrollTo(0, 0);
  },

  'liberar-escrita'() {
    ui.escrita.liberada = true;
    salvarEscrita();
    render();
    document.getElementById('palavra')?.focus();
  },
  'remover-palavra'({ i }) {
    ui.escrita.minhas.splice(Number(i), 1);
    salvarEscrita();
    render();
    document.getElementById('palavra')?.focus();
  },
  ideia() {
    const livres = TODAS.filter((s) => !repetida(s.texto));
    if (!livres.length) return;
    const { categoria, texto } = livres[Math.floor(Math.random() * livres.length)];
    const $p = document.getElementById('palavra');
    $p.value = texto;
    mostrarAjuda(`<p class="ideia">💡 ${esc(categoria)}. Gostou? Toque em <b>Adicionar</b>. Ou peça outra ideia.</p>`);
  },
  'usar-sugestao'({ t }) {
    const $p = document.getElementById('palavra');
    $p.value = t;
    mostrarAjuda('');
    $p.focus();
  },
  'aceitar-sugestao'({ t }) { adicionarPalavra(t, { checar: false }); },
  manter({ t }) { adicionarPalavra(t, { checar: false }); },
  entregar() {
    estado = J.entregarPalavras(estado, ui.escrita.minhas);
    guardar(CH.escrita, null);
    ui.escrita = { liberada: false, minhas: [] };
    salvarJogo();
    render();
    window.scrollTo(0, 0);
  },

  pronto() { if (ui.contagem === null) contarAteComecar(); },
  pausar() { pausar(); },
  'continuar-vez'() {
    liberarSom();
    ui.pausado = false;
    if (relogio) relogio.inicio = performance.now();
    render();
  },
  acertou() {
    if (ui.pausado || travarToques()) return;
    const novo = J.acertou(estado, Math.min(decorrido(), estado.vez.totalMs));
    if (novo.fase !== 'vez') relogio = null;
    atualizar(novo, { som: novo.fase === 'vez' ? sons.acerto : sons.vitoria });
  },
  pular() {
    if (ui.pausado || travarToques()) return;
    atualizar(J.pular(estado, Math.min(decorrido(), estado.vez.totalMs)), { som: sons.pulo });
  },
  falta() {
    if (ui.pausado || travarToques()) return;
    const novo = J.falta(estado, Math.min(decorrido(), estado.vez.totalMs));
    if (novo.fase !== 'vez') relogio = null;
    atualizar(novo, { som: sons.falta });
  },
  alternar({ id }) { atualizar(J.alternar(estado, Number(id))); },
  confirmar() {
    if (travarToques(600)) return;
    atualizar(J.confirmarVez(estado));
    window.scrollTo(0, 0);
    if (estado.fase === 'fim') sons.vitoria();
  },
  'comecar-rodada'() { atualizar(J.comecarRodada(estado)); },
  'aceitar-secreta'() { atualizar(J.aceitarRodadaSecreta(estado)); window.scrollTo(0, 0); },
  'recusar-secreta'() { atualizar(J.recusarRodadaSecreta(estado)); window.scrollTo(0, 0); sons.vitoria(); },
  revanche() {
    estado = J.revanche(estado);
    guardar(CH.escrita, null);
    ui.escrita = novaEscrita();
    salvarJogo();
    render();
    window.scrollTo(0, 0);
  },

  'pedir-terminar'() {
    abrirCamada(`
      <h2>Terminar agora?</h2>
      <p>O jogo acaba com o placar de agora${estado.fase === 'vez' || estado.fase === 'revisao' ? ' (a vez em andamento não conta)' : ''}.</p>
      <div class="acoes">
        <button class="btn primario" data-acao="terminar">Sim, ver o resultado</button>
        <button class="btn secundario" data-acao="fechar">Não, continuar jogando</button>
      </div>`);
  },
  terminar() {
    relogio = null;
    ui.pausado = false;
    ui.contagem = null;
    fecharCamada();
    atualizar(J.terminarAgora(estado));
  },
  'pedir-abandonar'() {
    abrirCamada(`
      <h2>Abandonar o jogo?</h2>
      <p>O jogo atual será apagado deste celular.</p>
      <div class="acoes">
        <button class="btn primario" data-acao="abandonar">Sim, apagar</button>
        <button class="btn secundario" data-acao="fechar">Não</button>
      </div>`);
  },
  abandonar() {
    relogio = null;
    estado = null;
    ui.pausado = false;
    ui.contagem = null;
    guardar(CH.jogo, null);
    guardar(CH.escrita, null);
    fecharCamada();
    ui.tela = 'inicio';
    render();
  },
};

// ---------- Escrita das palavras: repetidas e corretor ----------

const normalizar = J.normalizar;
function repetida(texto) {
  return J.jaNoPote(estado, texto) || ui.escrita.minhas.some((p) => normalizar(p) === normalizar(texto));
}

function mostrarAjuda(html) {
  const $a = document.getElementById('ajuda');
  if ($a) $a.innerHTML = html;
}

async function adicionarPalavra(bruto, { checar = true } = {}) {
  clearTimeout(esperaDigitacao);
  geracao++; // descarta a sugestão "ao vivo" que ainda estiver a caminho
  const texto = bruto.trim().replace(/\s+/g, ' ');
  if (!texto || ui.escrita.minhas.length >= estado.config.palavrasPorPessoa) return;
  if (!/\p{L}/u.test(texto)) {
    mostrarAjuda('<p class="aviso">Escreva uma palavra de verdade 🙂</p>');
    return;
  }
  if (repetida(texto)) {
    mostrarAjuda(`<p class="aviso">“${esc(texto)}” já está no pote! Escolha outra.</p>`);
    return;
  }
  if (checar) {
    const r = await corrigir(texto, 800);
    const $p = document.getElementById('palavra');
    if ($p && $p.value.trim().replace(/\s+/g, ' ') !== texto) return; // a pessoa mudou o texto enquanto isso
    if (r.sugestao && r.sugestao !== texto) {
      const opcoes = r.alternativas.filter((a) => !repetida(a));
      if (opcoes.length) {
        mostrarAjuda(`
          <div class="confirmar">
            <p>Você quis dizer…</p>
            <div class="opcoes">
              ${opcoes.map((a) => `<button class="btn primario" type="button" data-acao="aceitar-sugestao" data-t="${esc(a)}">${esc(a)}</button>`).join('')}
            </div>
            <button class="btn link" type="button" data-acao="manter" data-t="${esc(texto)}">Não, quero “${esc(texto)}” mesmo</button>
          </div>`);
        return;
      }
    }
  }
  ui.escrita.minhas.push(texto);
  salvarEscrita();
  render();
  document.getElementById('palavra')?.focus();
}

let esperaDigitacao = null;
let geracao = 0;
function aoDigitar(valor) {
  clearTimeout(esperaDigitacao);
  const minha = ++geracao;
  const texto = valor.trim().replace(/\s+/g, ' ');
  if (!texto) { mostrarAjuda(''); return; }
  esperaDigitacao = setTimeout(async () => {
    if (repetida(texto)) {
      mostrarAjuda(`<p class="aviso">“${esc(texto)}” já está no pote! Escolha outra.</p>`);
      return;
    }
    const r = await corrigir(texto);
    const $p = document.getElementById('palavra');
    if (minha !== geracao || !$p || $p.value.trim().replace(/\s+/g, ' ') !== texto) return;
    const opcoes = r.sugestao && r.sugestao !== texto ? r.alternativas.filter((a) => !repetida(a)) : [];
    mostrarAjuda(opcoes.length
      ? `<p class="quis-dizer">Quis dizer ${opcoes.map((a) => `<button type="button" class="chip" data-acao="usar-sugestao" data-t="${esc(a)}">${esc(a)}</button>`).join(' ')}?</p>`
      : '');
  }, 350);
}

// ---------- Eventos (delegados: a tela é redesenhada o tempo todo) ----------

function aoClicar(ev) {
  const alvo = ev.target.closest('[data-acao]');
  if (!alvo || alvo.disabled) return;
  if (ev.currentTarget === $camada && ev.target === $camada) return;
  const acao = acoes[alvo.dataset.acao];
  if (acao) {
    ev.preventDefault();
    acao(alvo.dataset);
  }
}
$app.addEventListener('click', aoClicar);
$camada.addEventListener('click', (ev) => {
  if (ev.target === $camada) { fecharCamada(); return; }
  aoClicar(ev);
});

$app.addEventListener('input', (ev) => {
  const el = ev.target;
  if (el.dataset.campo === 'nome') {
    rascunho.jogadores[Number(el.dataset.i)].nome = el.value;
    salvarRascunho();
    atualizarResumoConfig();
  } else if (el.id === 'palavra') {
    aoDigitar(el.value);
  }
});

$app.addEventListener('change', (ev) => {
  const el = ev.target;
  if (el.dataset.campo === 'modo') {
    const modos = new Set(rascunho.config.modos);
    if (el.checked) modos.add(el.dataset.modo); else modos.delete(el.dataset.modo);
    rascunho.config.modos = J.MODOS_NORMAIS.filter((m) => modos.has(m));
    salvarRascunho();
    render();
  } else if (el.dataset.campo === 'regra') {
    rascunho.config[el.dataset.regra] = el.checked;
    salvarRascunho();
  }
});

$app.addEventListener('keydown', (ev) => {
  // Enter num nome pula para o próximo (ou cria um jogador novo no último).
  if (ev.key !== 'Enter' || ev.target.dataset.campo !== 'nome') return;
  ev.preventDefault();
  const i = Number(ev.target.dataset.i);
  const campos = $app.querySelectorAll('[data-campo=nome]');
  if (i < campos.length - 1) campos[i + 1].focus();
  else if (ev.target.value.trim()) acoes['adicionar-jogador']();
});

$app.addEventListener('submit', (ev) => {
  if (ev.target.id !== 'form-palavra') return;
  ev.preventDefault();
  adicionarPalavra(document.getElementById('palavra').value);
});

// ---------- Começo ----------

if (estado) {
  ui.tela = 'inicio'; // oferece "Continuar jogo"
}
render();

if ('serviceWorker' in navigator && !TESTE) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
