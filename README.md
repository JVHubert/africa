# África

O jogo **África** (também conhecido como Monikers, Fishbowl ou Salad Bowl) num celular só: cada pessoa escreve suas palavras secretas, o celular vira o pote e passa de mão em mão, e o app cronometra as vezes e conta os pontos.

**Jogar agora:** https://jvhubert.github.io/africa/

- 3 rodadas com as mesmas palavras: **explicar**, **uma palavra só** e **mímica**, mais uma quarta opcional de **sons**.
- Times (2 a 4) sorteados ou montados à mão; duplas são times de 2.
- Palavras por pessoa e tempo de cada vez ajustáveis (padrão: 10 palavras, 60 s).
- Corretor que sugere a grafia certa ("marquiz" → "marquise") sem impedir nomes próprios.
- Botões de pular e de falta, revisão no fim de cada vez para desfazer um toque errado, tempo que sobra passa para a próxima rodada.
- O jogo fica salvo no aparelho: se o navegador fechar, continua de onde parou.
- Funciona sem internet depois do primeiro acesso.

Regras para a família: [COMO-JOGAR.md](COMO-JOGAR.md).

## Como funciona

| Arquivo | Papel |
|---|---|
| `jogo.js` | Regras puras: pote, revezamento, pular, falta, rodadas, placar |
| `corretor.js` | Sugestões de grafia (chave fonética + distância de Damerau-Levenshtein) |
| `corretor-worker.js` | Carrega o dicionário e corrige fora da thread da tela |
| `dicionario-pt.txt` | Gerado por `npm run dicionario` |
| `app.js` | Telas, relógio, tela sempre ligada, salvamento |
| `sw.js` | Guarda os arquivos no aparelho para funcionar offline |

HTML, CSS e JavaScript puros, sem etapa de build.

## Desenvolvimento

Requer Node.js 20+.

```sh
npm install            # só para os ícones e o teste no navegador
npm test               # regras do jogo e corretor
npm run test:browser   # joga uma partida inteira no Chrome
npm run serve          # http://localhost:8080  (com ?teste aparece a opção de 5 s)
npm run icons          # regenera os PNGs a partir de icons/icon.svg
npm run dicionario     # regenera dicionario-pt.txt
```

Ao publicar uma mudança, aumente `VERSAO` em `sw.js` para os celulares baixarem a versão nova.

## Créditos do dicionário

- Lista de palavras do [VERO](https://github.com/LibreOffice/dictionaries/tree/master/pt_BR), dicionário pt-BR do LibreOffice (LGPLv3 / MPL).
- Frequências do [FrequencyWords](https://github.com/hermitdave/FrequencyWords) (OpenSubtitles, CC-BY-SA 4.0).

## Licença

Código sob MIT. O arquivo `dicionario-pt.txt` segue as licenças das fontes acima.
