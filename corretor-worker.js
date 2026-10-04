// Carrega o dicionário e corrige fora da thread da tela, para a digitação não travar.
import { criarCorretor } from './corretor.js';

let corretor = null;
const pronto = fetch('dicionario-pt.txt')
  .then((r) => (r.ok ? r.text() : Promise.reject(new Error(r.status))))
  .then((texto) => { corretor = criarCorretor(texto); })
  .catch(() => {}); // sem dicionário o jogo segue, só sem sugestões

onmessage = async ({ data }) => {
  await pronto;
  const r = corretor ? corretor.corrigir(data.texto) : { sugestao: null, alternativas: [] };
  postMessage({ id: data.id, texto: data.texto, ...r });
};
