# Plano — Reconstrução do showroom 3D externo (do zero, a partir do .skp real)

Data: 25/08/2026

Autor do plano: Claude (agente de planejamento). Implementação: Codex, em outro chat, sem depender desta conversa.

## 1. Objetivo e contexto

O showroom externo em 3D (pasta `showroom3d/`) foi criado numa sessão anterior (provavelmente pelo Codex) a partir de um `.obj` exportado do SketchUp, usando um conversor próprio (triangulação manual, filtros de malha por nome, paleta de cores fixa) e o componente `<model-viewer>` do Google para exibir o `.glb` resultante.

Os documentos de handoff da rodada anterior (`HANDOFF.md`, `BASELINE.md`, `HANDOFF-CLAUDE.md`, nesta mesma pasta) afirmam que essa versão foi validada com sucesso ("Modelo pronto", testes passando). **Isso foi checado ao vivo nesta sessão de planejamento e não se confirmou**: abrindo `http://localhost:5173/` no navegador (com o servidor de dev já rodando), o modelo trava em "Carregando modelo 3D… 99%" e cai no painel de erro "O modelo 3D não carregou", de forma reproduzível em recarregamentos sucessivos. O console mostra avisos internos do `<model-viewer>`/Lit (`BAILING OUT EARLY`, `rAF timed out in updateSource`) — um travamento no ciclo de atualização do componente, não um erro de rede (o `casa.glb` responde `200 OK`).

Andrew confirmou que essa versão está mesmo quebrada na experiência dele ("sumiu coisas, paredes ficaram invisíveis, um verdadeiro caos") e pediu para refazer o showroom **do zero**, hoje, priorizando um resultado bonito, com cores reais e "quase renderizado".

**Este plano substitui a abordagem técnica descrita em `BASELINE.md` e nos handoffs anteriores.** Os arquivos antigos não devem ser apagados (ficam como histórico), mas não são mais a referência de arquitetura a seguir.

### Arquivos de origem fornecidos por Andrew nesta rodada

- `C:\Users\Andrew\Downloads\casa geminada bruno.skp` (arquivo nativo do SketchUp, 1,63 MB)
- `C:\Users\Andrew\Downloads\casa geminada bruno.obj` (exportação OBJ do mesmo projeto, 3,15 MB — **byte-a-byte idêntico** ao arquivo já usado como fonte em `showroom3d/public/modelos/CASA-GEMINADA-BRUNO.obj`, ou seja, é a mesma fonte que já gerou o resultado quebrado)

## 2. Descoberta técnica validada nesta sessão de planejamento

Antes de propor a abordagem, foi feito um teste de viabilidade real (fora da pasta do projeto, em um diretório de scratch) para confirmar que dá para ler o `.skp` original diretamente, sem depender do `.obj` nem de um parser escrito à mão. Resultado: **funciona**, e é estritamente melhor que a abordagem anterior. Os fatos abaixo são verificados, não suposição:

- Biblioteca usada: pacote npm `openskp` (`https://github.com/iamahsanmehmood/openskp`, MIT, ~32 estrelas, parser open-source feito por engenharia reversa do formato `.skp`, não afiliado à Trimble). Suporta o container moderno VFF (2021+) e o clássico MFC (2013–2020).
- **Armadilha real encontrada:** a build ESM do pacote (`dist/index.mjs`) tem um bug — faz `require('fs')` dentro de um módulo ES, o que o Node rejeita (`Dynamic require of "fs" is not supported`). **Use sempre a build CJS** (`const { SkpFile, buildScene, toGLB } = require('openskp')`, em um arquivo `.cjs` ou com `"type": "commonjs"`), não `import` de um `.mjs`/`.js` com `"type": "module"`.
- API confirmada por teste real, no arquivo `casa geminada bruno.skp` do Andrew:
  ```js
  const { SkpFile, buildScene, toGLB } = require('openskp');
  const fs = require('fs');

  // 1. parse() dá acesso a metadados (materiais nomeados, camadas, unidades)
  const model = SkpFile.open(path).parse();
  model.units; // "Meter" — confirmado
  model.layers; // [{name:'Layer0'}, {name:'PEÇAS'}, {name:'Guia'}] — só 3 camadas
  model.materials; // objeto com 91 materiais nomeados reais (cor RGB real, transparência real, textura embutida em alguns)

  // 2. buildScene() recebe o ArrayBuffer do arquivo (não o model já parseado) e devolve a cena já triangulada e resolvida
  const buf = fs.readFileSync(path);
  const arrayBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const scene = buildScene(arrayBuffer);
  // scene.glbPrimitives: 242 primitivos, cada um com positions/normals/uvs/indices/materialIndex
  // scene.gltfMaterials: 29 materiais já resolvidos por primitivo (cor final, sem precisar casar nome com o .obj)
  // scene.textures: 8 texturas embutidas

  // 3. toGLB() exporta o glTF binário direto
  const glb = toGLB(scene, { embedTextures: true });
  fs.writeFileSync('casa.glb', Buffer.from(glb)); // gerou 3,55 MB, sem erros
  ```
- **Isso elimina a maior fonte de bugs do pipeline anterior**: não é mais necessário escrever triangulação manual de faces côncavas, nem casar nomes de malha (`Mesh214`, `Mesh215`...) com uma paleta fixa. O `openskp` já resolve os materiais reais por primitivo em `scene.gltfMaterials` — **não é necessário usar o `.obj` para nada no pipeline novo**. Ele pode ficar só como referência manual de conferência, se quiser.
- Malha bruta (sem filtro nenhum): 56.535 triângulos, bounding box de **36,76 m × 5,2 m × 48,83 m** (largura × altura × profundidade). A altura de 5,2 m bate com a medida da casa já conhecida — confirma que a orientação/escala está correta. Mas a largura/profundidade são bem maiores que os ~5 m × 30 m documentados no pipeline antigo. Isso quase certamente significa que a cena completa do `.skp` inclui, além da casa em si:
  - a camada **"Guia"** (guides do SketchUp — normalmente geometria de referência/apoio de modelagem, não deveria aparecer na apresentação final);
  - possivelmente uma figura humana de escala: entre os 91 materiais nomeados aparecem vários prefixados `Sree_...` (`Sree_Complexion`, `Sree_Hair`, `Sree_Dress`, `Sree_Laptop`, `Sree_Pearls`) — esse é o nome de um modelo de pessoa gratuito e muito comum no 3D Warehouse, usado só como referência de escala dentro do SketchUp. **Não deve aparecer no showroom final.**
  - O nome do projeto "casa geminada" (casa geminada = duas unidades conjugadas) também pode legitimamente explicar parte da largura maior — não presuma que é bug; **confirme visualmente** antes de excluir qualquer volume.

Isso é uma pista real de por que a versão anterior tinha "paredes sumindo": o pipeline antigo tentava filtrar geometria indesejada usando nomes de malha genéricos (`room_56_*`, `room_57_*`) e presunções sobre "segunda casa", em vez de usar a estrutura real de camadas/instâncias do arquivo de origem. Um filtro errado nesse estilo pode ter apagado parede real em vez da figura de escala/guias.

## 3. Decisões aprovadas por Andrew (não reabrir sem falar com ele)

1. **Recomeçar do zero.** Não tentar remendar o pipeline `.obj` → triangulação manual → `<model-viewer>` atual. Pode reaproveitar a estrutura do projeto Vite (`showroom3d/`), mas o pipeline de conversão e a renderização devem ser reescritos.
2. **Estilizado com boa iluminação**, aproveitando as cores/transparência reais extraídas do `.skp` (ver seção 2) em vez de uma paleta hexadecimal escolhida à mão. Isso **substitui** a paleta aprovada em `BASELINE.md` (`#ded6ca`, `#89867f`, `#414542` etc.) — aquela paleta era um ajuste manual para compensar a falta de acesso aos materiais reais, que agora temos. Sem mapas PBR fotográficos completos (o `.mtl`/texturas originais não foram entregues à parte, mas o `.skp` já embute pelo menos 8 texturas reais — use-as onde existirem).
3. **Aproveitar o `.skp` diretamente** via `openskp` (não só o `.obj`) para geometria, materiais, cores e transparência reais.
4. **Precisa continuar podendo ser embutido na galeria de casas depois** — preservar o contrato `?embed=1` (oculta cabeçalho/texto editorial, mantém só o visualizador) que já existe em `showroom3d/src/main.js` e `index.html`.

## 4. Comportamento esperado da entrega

- Uma única página web (mesma pasta `showroom3d/`) mostra o exterior da casa geminada do Bruno em 3D, com cores reais dos materiais do projeto (fachada, muros, portas, esquadrias, vidros, metais, madeira conforme definidos no `.skp`), com iluminação de estúdio/ambiente que dá aparência "quase renderizada" (sombras suaves, reflexo sutil em vidro/metal, sem parecer modelo CAD cru).
- O usuário consegue orbitar (arrastar), aproximar/afastar (roda/pinça) livremente ao redor da casa, sem travar, sem paredes sumindo, sem triângulos soltos.
- A figura humana de escala (materiais `Sree_*`) e qualquer geometria da camada "Guia" que seja claramente auxiliar (não arquitetura real) **não aparecem** no resultado final — a menos que a inspeção visual mostre que fazem parte da apresentação pretendida, caso em que Codex deve reportar a dúvida em vez de decidir sozinho.
- A casa aparece apoiada numa base/plano de apresentação neutro (mesmo princípio já aprovado antes: uma superfície de chão simples, sem inventar objetos que não existem no arquivo de origem — sem árvores, carros, calçadas, portões, telhados ou paredes que não estejam no `.skp`).
- Captura de imagem (botão "Salvar imagem"), alternância de tema e modo `?embed=1` continuam funcionando como hoje.

## 5. Escopo e fora do escopo

**Dentro do escopo:**
- Novo script de conversão `.skp` → `.glb` usando `openskp`.
- Filtro de geometria indesejada (guia, figura de escala) baseado em inspeção real da estrutura do arquivo (camadas/instâncias), documentando o que foi excluído e por quê.
- Novo motor de renderização no navegador (ver seção 6 — recomendação técnica).
- Ajuste de iluminação/ambiente para efeito "quase renderizado".
- Preservar o contrato de UI existente (cabeçalho, medidas, captura de imagem, tema, `?embed=1`) como ponto de partida — pode ajustar detalhes visuais, mas não é para redesenhar a página inteira sem necessidade.

**Fora do escopo (não implementar sem autorização explícita do Andrew):**
- Ambientes internos, navegação por cômodos, edição de paredes, seleção/ocultação de cômodos, etapas de construção, câmeras internas.
- Parser completo do Sweet Home 3D (`.sh3d`) — o código legado em `src/sh3d/`, `src/engine/`, `tests/sh3d.test.js` fica como está, não participa da experiência atual, não precisa ser tocado nem quebrado.
- AR, deploy, publicação, login, commit/push/merge (nada disso deve ser feito sem autorização explícita do Andrew).
- Qualquer geometria arquitetônica nova que não exista no `.skp` de origem.
- Não subir o `.skp`/`.obj` do Andrew para nenhum serviço externo de conversão online — todo o processamento deve ser local, com a lib `openskp` rodando no Node.

## 6. Arquitetura recomendada (decisão técnica do plano, Codex pode ajustar detalhes de implementação mas não a direção geral)

### 6.1 Pipeline de conversão (build-time, Node, fora do navegador)

- Novo arquivo `showroom3d/scripts/converter-skp-glb.mjs` (substitui `converter-projeto-obj-glb.mjs` e `adicionar-terreno-glb.mjs`, que devem ser removidos).
- Usa `openskp` (adicionar como `devDependency`) na build CJS (ver armadilha da seção 2).
- Lê o `.skp` de `showroom3d/fontes/casa-geminada-bruno.skp` (novo diretório — ver seção 6.3).
- Antes de gerar o GLB final, o script deve inspecionar `model.layers` e a árvore de instâncias em `model.root` para decidir o que incluir/excluir. Os nomes de propriedades reais podem ser diferentes do que a documentação sugere — **confirme lendo `node_modules/openskp/dist/index.d.ts` e testando com `console.log` no arquivo real**, não adivinhe.
- Exporta `public/modelos/casa.glb` via `toGLB(scene, { embedTextures: true })`.
- Gera também `public/modelos/casa-meta.json` com: dimensões reais (bounding box) calculadas a partir da geometria já filtrada (não reaproveitar os números antigos de 5×30×5,2 m sem checar — eles vieram de um pipeline que pode ter cortado geometria errada), unidade (`meters`), e o alvo/distância de câmera inicial sugerido.
- Materiais: usar a cor RGB real de `scene.gltfMaterials`; aplicar heurística por nome do material para ajustar `roughness`/`metalness`/`transparent` no lado do Three.js (glass/translúcido → baixa rugosidade e usa a transparência real do `.skp`; metais/cromado → alto metalness; madeira → não-metal, rugosidade média); usar textura embutida (`scene.textures`) quando o material tiver uma associada.

### 6.2 Renderização no navegador

- **Trocar `<model-viewer>` por uma cena Three.js própria** (`three` já é dependência do projeto). Motivo: o travamento reproduzido nesta sessão (`rAF timed out in updateSource`, preso em 99%) está dentro do ciclo interno do componente `<model-viewer>`/Lit, fora do nosso controle direto; uma cena Three.js própria dá controle total sobre carregamento, progresso, erro e iluminação, e permite obter o efeito "quase renderizado" com `ACESFilmicToneMapping`, `PMREMGenerator` + `RoomEnvironment` (de `three/addons/environments/RoomEnvironment.js`) para reflexos, e sombra suave via `DirectionalLight` com shadow map.
- Remover a dependência `@google/model-viewer` do `package.json` (reduz o bundle, que hoje passa de 500 kB majoritariamente por causa dela).
- Usar `GLTFLoader` (de `three/examples/jsm/loaders/GLTFLoader.js`) para carregar `public/modelos/casa.glb`, e `OrbitControls` para girar/zoom, com os mesmos limites de ângulo/distância já usados antes (não deixar girar para baixo do chão, não deixar afastar demais).
- Progresso e erro: usar os callbacks nativos do `GLTFLoader.load(url, onLoad, onProgress, onError)` — são diretos e não dependem de heurística de timeout.
- Enquadramento inicial da câmera: calcular a partir do bounding box real do modelo carregado (`Box3` do Three.js), não de números fixos herdados do pipeline antigo.
- Manter a UI existente (`index.html`, `estilos.css`) como ponto de partida: trocar o elemento `<model-viewer>` por um `<canvas>`, manter cabeçalho, rodapé de medidas, botão de captura (adaptar para `renderer.domElement.toBlob(...)` ou `canvas.toBlob(...)`), alternância de tema e o contrato `?embed=1`.

### 6.3 Organização de arquivos

- Copiar (não mover, deixar o original do Andrew intacto em Downloads) os dois arquivos de origem para dentro do projeto, em uma pasta nova **não pública**: `showroom3d/fontes/casa-geminada-bruno.skp` e `showroom3d/fontes/casa-geminada-bruno.obj` (o `.obj` fica só como referência manual, não é usado pelo pipeline). Colocar fora de `public/` evita que o arquivo `.skp`/`.obj` de origem (proprietário, vários MB) fique publicamente baixável quando o site for publicado.
- Remover de `public/modelos/`: `CASA-GEMINADA-BRUNO.obj` (não é mais necessário publicamente; a cópia de referência já está em `fontes/`).
- **Não mexer** em `TESTE-CASA.obj` / `TESTE-CASA.sh3d` em `public/modelos/` — foram preservados a pedido do Andrew em rodada anterior por outro motivo, não fazem parte deste trabalho.
- **Não mexer** na pasta `modelos/` na raiz do projeto (`BANHEIRO-ENTRE-QUARTOS.*`) nem em `mockups/galeria-casas/`, `plans/galeria-casas/`, `video-analysis/` — são trabalhos separados do Andrew, fora do escopo desta tarefa.

## 7. Etapas de implementação sugeridas

1. Copiar os dois arquivos de origem para `showroom3d/fontes/` (ver 6.3).
2. Adicionar `openskp` como devDependency (`npm install --save-dev openskp` dentro de `showroom3d/`).
3. Escrever `showroom3d/scripts/converter-skp-glb.mjs`, usando o exemplo funcional da seção 2 como ponto de partida. Rodar manualmente e inspecionar a saída (contagem de primitivos, materiais, bounding box) antes de integrar ao app.
4. Investigar a estrutura de camadas/instâncias do `.skp` (script exploratório separado, pode descartar depois) para decidir com segurança o que excluir (guia, figura de escala) sem cortar parede real. Documentar a decisão no `HANDOFF.md` final.
5. Gerar `public/modelos/casa.glb` e `public/modelos/casa-meta.json` definitivos.
6. Remover `@google/model-viewer` do `package.json`; remover `converter-projeto-obj-glb.mjs` e `adicionar-terreno-glb.mjs`; remover `CASA-GEMINADA-BRUNO.obj` de `public/modelos/`.
7. Reescrever `showroom3d/src/main.js` (e o que mais for necessário em `index.html`/`estilos.css`) para usar Three.js: `GLTFLoader`, `OrbitControls`, `PMREMGenerator` + `RoomEnvironment`, `ACESFilmicToneMapping`, luz direcional com sombra, cálculo de enquadramento por `Box3`.
8. Ajustar heurística de material (glass/metal/madeira/default) e aplicar texturas embutidas quando existirem.
9. Testar localmente (`npm run dev`), incluindo pelo menos 3 recarregamentos consecutivos para garantir que o travamento em 99% não se repete.
10. Escrever/ajustar testes automatizados (seção 8).
11. Rodar `npm test` e `npm run build`.
12. Atualizar `plans/showroom-3d/HANDOFF.md` com resultado real (ver seção 11). Não sobrescrever `BASELINE.md`/`HANDOFF-CLAUDE.md` — apenas adicionar uma nota no topo do `HANDOFF.md` apontando que este `PLAN.md` é a referência atual.

## 8. Testes obrigatórios

- **Testes existentes**: `tests/sh3d.test.js` deve continuar passando sem alteração (é código legado fora de escopo, mas não pode quebrar).
- **Novo teste do conversor** (Node puro, sem jsdom): validar, usando o arquivo real `showroom3d/fontes/casa-geminada-bruno.skp` como fixture —
  - `openskp` consegue abrir e fazer `buildScene()` sem lançar exceção;
  - a cena resultante tem pelo menos 1 primitivo e pelo menos 1 material;
  - nenhuma coordenada de posição é `NaN` ou `Infinity`;
  - a altura do bounding box da geometria final (já filtrada) é plausível para uma casa (ordem de grandeza de metros, não milímetros nem quilômetros);
  - pelo menos alguns materiais têm cores RGB diferentes entre si (prova de que não caiu tudo num cinza padrão);
  - materiais com nome contendo "glass"/"vidro"/"translucent" têm transparência real menor que 1.
- **`npm run build`** deve passar sem erro. O bundle deve ficar menor que o anterior (que era ~1,04 MB de JS) já que `@google/model-viewer` sai da lista de dependências — não é obrigatório atingir um número exato, mas documentar o tamanho final no `HANDOFF.md`.

## 9. Roteiro de teste no navegador (obrigatório antes de declarar pronto)

Usar o preview local (`npm run dev`, ou o navegador do harness de implementação) em `http://127.0.0.1:5173/`:

1. Abrir a página. Verificar que o status muda para "pronto" (ou equivalente) e **não aparece painel de erro**.
2. Recarregar a página pelo menos 3 vezes seguidas — em nenhuma delas pode travar em progresso parcial nem exibir erro.
3. Orbitar 360° ao redor da casa (arrastar em vários ângulos, inclusive de cima e de baixo dentro dos limites configurados). Confirmar visualmente que nenhuma parede, porta ou volume conhecido desaparece, não há triângulos soltos/diagonais, e nada parece "flutuando".
4. Conferir que vidro, metal e madeira ficam visualmente diferentes entre si (não tudo da mesma cor/textura).
5. Conferir que a figura humana de escala (materiais `Sree_*`) e qualquer geometria de "Guia" **não aparecem** na cena.
6. Testar zoom in/out (roda/pinça) dentro dos limites.
7. Testar o botão "Salvar imagem" — confirmar que dispara o download (mesmo que o harness automatizado não consiga inspecionar o arquivo baixado, confirmar ao menos que não lança erro e que o estado da UI volta ao normal).
8. Testar `http://127.0.0.1:5173/?embed=1` — cabeçalho e texto editorial devem sumir, o visualizador continua funcional.
9. Verificar o console do navegador: nenhuma mensagem de nível `error`.
10. Tirar pelo menos uma captura de tela do resultado final e anexar/descrever no `HANDOFF.md`.

## 10. Riscos e cuidados

- **Não presuma que a largura/profundidade maior que 5×30 m é erro.** É "casa geminada" (duas unidades conjugadas) — pode ser real. Só exclua geometria depois de identificar visualmente e por camada/instância que ela é guia ou figura de escala, não parede.
- **Não repita o erro do pipeline anterior de filtrar geometria por nome de malha genérico** (`Mesh214`, `room_56_*`) sem confirmar visualmente o que está sendo removido — foi provavelmente a causa da "parede invisível" relatada pelo Andrew.
- A paleta de cores vai mudar em relação à aprovada em `BASELINE.md`, porque agora vem do `.skp` real em vez de escolha manual. Isso é esperado e aprovado nesta rodada (seção 3, item 2) — não é regressão, é melhoria; ainda assim, deixe evidente no `HANDOFF.md` (com captura de tela) que a paleta mudou e por quê, para o Andrew avaliar o resultado.
- Ao rodar `openskp`, use a build CJS (`require`), não `import` de um contexto ESM — ver a armadilha documentada na seção 2, já validada nesta sessão.
- Não subir os arquivos `.skp`/`.obj` do Andrew para nenhum conversor online de terceiros — processamento deve ficar local.
- Não fazer commit, push, merge, deploy ou publicação sem autorização explícita do Andrew (este projeto nem é um repositório git hoje).
- Preservar tudo que não faz parte deste trabalho: `TESTE-CASA.*`, pasta `modelos/` da raiz, `mockups/galeria-casas/`, `video-analysis/`, `vlc-help.txt`.

## 11. Instruções para o HANDOFF.md final

Ao terminar, atualizar `plans/showroom-3d/HANDOFF.md` (pode reescrever o conteúdo, já que a abordagem mudou) com, no mínimo:

- Data da atualização e uma linha deixando claro que a abordagem mudou de `.obj` + `<model-viewer>` para `.skp` direto + Three.js, com link para este `PLAN.md`.
- Lista real do que foi incluído/excluído da geometria do `.skp` (camadas, instâncias, e por quê), com evidência (captura de tela ou contagem de primitivos antes/depois do filtro).
- Dimensões reais medidas do resultado final (não reaproveitar os números antigos).
- Resultado real de `npm test` e `npm run build` (números reais, não "deve passar").
- Resultado real do roteiro de teste no navegador da seção 9, item por item, com o que foi de fato observado (não "parece que funciona").
- Tamanho final do bundle de produção, comparado ao anterior.
- Lista de arquivos alterados/removidos/criados.
- Limitações conhecidas (ex.: se alguma textura não foi recuperada, se algum material ficou sem cor real e caiu em um padrão, etc.).
- Confirmação explícita de que nenhum commit/push/deploy foi feito.
