// Corretor offline: sugere a grafia certa ("marquiz" → "marquise") sem nunca impedir
// a pessoa de escrever o que quiser (nomes, apelidos da família...).

/** Minúsculas, sem acento: "Café" → "cafe". */
export function semAcento(s) {
  return s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
}

/**
 * Chave "como se fala": grafias que soam igual em português viram a mesma chave,
 * para "marquiz", "marquise" e "markise" ficarem próximas.
 */
export function chave(s) {
  return semAcento(s.toLowerCase().replace(/ç/g, 's'))
    .replace(/[^a-z]/g, '')
    .replace(/[cs]h/g, 'x').replace(/ph/g, 'f')
    .replace(/sc([ei])/g, 's$1').replace(/xc([ei])/g, 's$1')
    .replace(/c([ei])/g, 's$1')
    .replace(/qu([ei])/g, 'k$1').replace(/gu([ei])/g, 'g$1')
    .replace(/q/g, 'k').replace(/c/g, 'k')
    .replace(/^h/, '').replace(/([^lnx])h/g, '$1')
    .replace(/z/g, 's').replace(/y/g, 'i').replace(/w/g, 'u')
    .replace(/(.)\1+/g, '$1')
    .replace(/([^aeiou])[ei]$/, '$1'); // "telefone" se fala "telefoni"
}

// Linhas reaproveitadas entre chamadas: a busca compara milhares de palavras.
let l0 = new Int32Array(64), l1 = new Int32Array(64), l2 = new Int32Array(64);

/** Distância de Damerau-Levenshtein (transposições contam 1); desiste acima de `max`. */
export function distancia(a, b, max = 99) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  if (b.length + 1 > l0.length) l0 = new Int32Array(b.length + 1), l1 = new Int32Array(b.length + 1), l2 = new Int32Array(b.length + 1);
  let ante = l0, prev = l1, cur = l2;
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    let menor = i;
    const ai = a.charCodeAt(i - 1);
    for (let j = 1; j <= b.length; j++) {
      const bj = b.charCodeAt(j - 1);
      let v = prev[j - 1] + (ai === bj ? 0 : 1);
      if (prev[j] + 1 < v) v = prev[j] + 1;
      if (cur[j - 1] + 1 < v) v = cur[j - 1] + 1;
      if (i > 1 && j > 1 && ai === b.charCodeAt(j - 2) && a.charCodeAt(i - 2) === bj && ante[j - 2] + 1 < v) v = ante[j - 2] + 1;
      cur[j] = v;
      if (v < menor) menor = v;
    }
    if (menor > max) return max + 1;
    [ante, prev, cur] = [prev, cur, ante];
  }
  return prev[b.length];
}

const ehMaiuscula = (t) => t[0] !== t[0].toLowerCase();
const capitalizar = (t) => t[0].toUpperCase() + t.slice(1);

/**
 * @param {string} texto dicionário gerado por tools/gerar-dicionario.mjs: palavras comuns
 *   (da mais comum para a menos; "*" = fora do dicionário formal), "---", palavras raras.
 */
export function criarCorretor(texto) {
  const linhas = texto.split('\n');
  const corte = linhas.indexOf('---');
  const comuns = corte < 0 ? linhas : linhas.slice(0, corte);
  const palavras = [];                // só as comuns: são as únicas sugeridas
  const formal = [];                  // está no dicionário VERO (preferida no empate)
  const semAcentos = [];
  const chaves = [];
  const posicao = new Map();          // "café" → 1234 (menor = mais comum); raras = Infinity
  const porAcento = new Map();        // "cafe" → posição da grafia mais comum ("café")
  const porTamanho = [];              // tamanho da chave → índices
  for (const linha of comuns) {
    if (!linha) continue;
    const p = linha.endsWith('*') ? linha.slice(0, -1) : linha;
    const i = palavras.length;
    palavras.push(p);
    formal.push(!linha.endsWith('*'));
    const min = p.toLowerCase();
    if (!posicao.has(min)) posicao.set(min, i);
    const sa = semAcento(p);
    semAcentos.push(sa);
    if (!porAcento.has(sa)) porAcento.set(sa, i);
    const k = chave(p);
    chaves.push(k);
    (porTamanho[k.length] ??= []).push(i);
  }
  if (corte >= 0) {
    for (let j = corte + 1; j < linhas.length; j++) {
      const min = linhas[j].toLowerCase();
      if (min && !posicao.has(min)) posicao.set(min, Infinity);
    }
  }

  const conhece = (palavra) => posicao.has(palavra.toLowerCase());

  /** Até `max` palavras do dicionário parecidas com `palavra`, a melhor primeiro. */
  function sugerir(palavra, { max = 3, rigoroso = false } = {}) {
    const k = chave(palavra);
    const sa = semAcento(palavra);
    if (k.length < 2) return [];
    const limiteChave = rigoroso || k.length <= 4 ? 1 : 2;
    const achados = [];
    for (let t = k.length - limiteChave; t <= k.length + limiteChave; t++) {
      for (const i of porTamanho[t] ?? []) {
        const dk = distancia(k, chaves[i], limiteChave);
        if (dk > limiteChave) continue;
        const dr = distancia(sa, semAcentos[i], 3);
        // Com inicial maiúscula pode ser nome próprio ("Xuxa"): só palavras bem comuns e bem parecidas.
        if (dr > 3 || (rigoroso && ((dk > 0 && dr > 1) || i > 60000 || semAcentos[i][0] !== sa[0]))) continue;
        achados.push({ i, dk, dr, f: formal[i] ? 0 : 1 });
      }
    }
    achados.sort((x, y) => x.dk - y.dk || x.f - y.f || x.dr - y.dr || x.i - y.i);
    const vistas = new Set();
    const saida = [];
    for (const { i } of achados) {
      const p = palavras[i];
      if (vistas.has(p.toLowerCase())) continue;
      vistas.add(p.toLowerCase());
      saida.push(p);
      if (saida.length === max) break;
    }
    return saida;
  }

  /** Grafia sugerida para uma palavra solta, ou null se ela já parece certa. */
  function corrigirPalavra(token) {
    const min = token.toLowerCase();
    const sa = semAcento(token);
    if (sa.length <= 2 || !/^\p{L}/u.test(token)) return null;
    if (conhece(min)) {
      // Faltou acento? "cafe" → "café" quando a versão acentuada é bem mais comum.
      const melhor = porAcento.get(sa);
      const atual = posicao.get(min);
      if (melhor !== undefined && melhor < atual / 3 && palavras[melhor].toLowerCase() !== min) {
        return ajustarCaixa(token, palavras[melhor]);
      }
      return null;
    }
    const [primeira] = sugerir(token, { max: 1, rigoroso: ehMaiuscula(token) });
    return primeira ? ajustarCaixa(token, primeira) : null;
  }

  /**
   * Analisa um texto (palavra ou expressão, ex.: "Torre Eiffel").
   * @returns {{ sugestao: string|null, alternativas: string[] }}
   */
  function corrigir(texto) {
    const limpo = texto.trim().replace(/\s+/g, ' ');
    const partes = limpo.split(' ');
    let mudou = false;
    const corrigidas = partes.map((parte) => {
      const [, antes, miolo, depois] = parte.match(/^([^\p{L}]*)(.*?)([^\p{L}]*)$/u);
      if (!miolo) return parte;
      const nova = corrigirPalavra(miolo);
      if (!nova) return parte;
      mudou = true;
      return antes + nova + depois;
    });
    if (!mudou) return { sugestao: null, alternativas: [] };
    const sugestao = corrigidas.join(' ');
    let alternativas = [sugestao];
    if (partes.length === 1 && !conhece(limpo)) {
      alternativas = sugerir(limpo, { rigoroso: ehMaiuscula(limpo) }).map((p) => ajustarCaixa(limpo, p));
      if (!alternativas.includes(sugestao)) alternativas.unshift(sugestao);
    }
    return { sugestao, alternativas: [...new Set(alternativas)].slice(0, 3) };
  }

  return { conhece, sugerir, corrigir, tamanho: palavras.length };
}

/** Mantém a inicial maiúscula que a pessoa digitou; nomes próprios do dicionário ficam como lá. */
function ajustarCaixa(original, sugestao) {
  return ehMaiuscula(original) && !ehMaiuscula(sugestao) ? capitalizar(sugestao) : sugestao;
}
