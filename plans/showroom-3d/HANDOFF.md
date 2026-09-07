# Handoff — Visualizador externo 3D

Data da atualização: 25/08/2026 (tarde)

## Atualização posterior — mockup da galeria

- corrigida a falha de JavaScript em `mockups/galeria-casas/mockup.html` que impedia o clique em `Ver galeria de fotos`; a expressão regular de normalização de nomes usava uma faixa Unicode corrompida e causava `SyntaxError`;
- adicionados `doctype`, idioma `pt-BR` e `meta charset="utf-8"` ao mockup;
- verificação no navegador: após o clique, `screen-gallery` fica visível e `screen-linktree` fica oculto;
- endereço local do mockup: `http://localhost:4174/mockups/galeria-casas/mockup.html`;
- adicionadas as 10 fotos do ZIP fornecido por Andrew em `mockups/galeria-casas/fotos/01.jpeg` até `10.jpeg`; a foto `10.jpeg` é a capa principal e as 10 aparecem na grade/lightbox;
- corrigido o modo `Apresentação`: removido o SVG placeholder que aparecia como marca d’água, o lightbox agora ocupa todo o viewport, mantém a foto centralizada e bloqueia a rolagem da página enquanto está aberto;
- ajustado o lightbox para renderizar cada JPEG como imagem real com `object-fit: contain`, sem esticar nem cortar; as fotos recebidas têm resolução nativa de até 1280×722 (a capa 10 tem 1600×900), portanto não são ampliadas artificialmente em telas maiores;
- `npm test`: 19/19 testes passaram; `npm run build`: passou, com o aviso conhecido de bundle acima de 500 kB.

## Mudança de abordagem nesta rodada

A abordagem descrita neste arquivo em rodadas anteriores (conversão `.obj` → triangulação manual → `<model-viewer>`) foi **substituída** pelo plano em [PLAN.md](PLAN.md), a pedido do Andrew: a versão anterior estava travando em "Carregando modelo 3D… 99%" e caindo em erro de forma reproduzível, apesar dos handoffs anteriores afirmarem que estava validada. `BASELINE.md` e `HANDOFF-CLAUDE.md` descrevem a arquitetura **antiga** (paleta escolhida à mão, pipeline `.obj`) e não devem mais ser seguidos para a geometria/pipeline — apenas como histórico.

Esta implementação foi feita diretamente por Claude (não pelo Codex), a pedido explícito do Andrew nesta sessão.

## O que mudou

- **Fonte de geometria**: trocada de `CASA-GEMINADA-BRUNO.obj` para o `.skp` nativo do SketchUp (`casa geminada bruno.skp`, fornecido por Andrew), lido diretamente pela biblioteca `openskp` (npm, MIT, código aberto por engenharia reversa do formato `.skp`). Não foi necessário escrever nenhuma triangulação manual — a própria biblioteca resolve a cena, materiais e texturas.
- **Conversor novo**: [showroom3d/scripts/converter-skp-glb.mjs](../../showroom3d/scripts/converter-skp-glb.mjs), que substitui `converter-projeto-obj-glb.mjs` e `adicionar-terreno-glb.mjs` (removidos).
- **Renderização**: trocado `<model-viewer>` por uma cena Three.js própria em [showroom3d/src/main.js](../../showroom3d/src/main.js) (`GLTFLoader`, `OrbitControls`, `PMREMGenerator` + `RoomEnvironment` para reflexo/luz ambiente, `ACESFilmicToneMapping`, sombra suave via `DirectionalLight`). Motivo: o travamento em 99% acontecia dentro do ciclo interno do `<model-viewer>`/Lit (`rAF timed out in updateSource`), fora do nosso controle direto.
- Dependência `@google/model-viewer` removida do `package.json`.
- Cores dos materiais agora vêm **direto do `.skp` real** (fachada, portas, vidros, metais, madeira), não mais de uma paleta hexadecimal escolhida manualmente. A paleta aprovada em `BASELINE.md` fica superada — ver comparação abaixo.

## Descoberta técnica: por que a versão anterior tinha paredes sumindo

O `.skp` original tem faces com normal invertida em vários volumes arquitetônicos (isso já estava documentado em `BASELINE.md` da rodada anterior). Sem `material.side = THREE.DoubleSide`, o back-face culling padrão do WebGL faz a maior parte da casa desaparecer, sobrando só bordas/frestas visíveis. Essa é provavelmente a causa raiz real do "paredes ficaram invisíveis" que Andrew relatou — o pipeline anterior tentava compensar isso com filtros de malha por nome (`room_56_*`, `Mesh214`...), que são frágeis e podem ter cortado parede real por engano. Nesta versão, `DoubleSide` é aplicado a todos os materiais de forma simples e direta, sem depender de nomes de malha.

## Filtragem de geometria indesejada

O plano previa a necessidade de excluir manualmente uma eventual figura humana de escala (materiais `Sree_*` encontrados na biblioteca de materiais do `.skp`) e a camada "Guia". **Não foi necessário fazer nada**: `buildScene()` do `openskp` já resolve só a geometria realmente posicionada e visível na cena — a inspeção direta (`scene.meshIndex`) mostrou 0 malhas na camada "Guia" e 0 malhas usando materiais `Sree_*`. Os 242 primitivos exportados correspondem a elementos arquitetônicos reais (paredes, portas — "porta externa", "PORTA ABRIR 60 CM" —, janelas — "Janela 160x120", "Janela Basculante" —, trincos, etc.), confirmados por seus nomes de definição no `.skp`.

## Recuperação de transparência real (vidros)

`buildScene()`/`toGLB()` resolvem a cor de cada material, mas não marcam `alphaMode`, então nenhum vidro ficava transparente no GLB puro. O conversor agora casa a cor RGB exata de cada material resolvido com a biblioteca de materiais nomeados do `.skp` (`SkpFile.parse().materials`) e, **só quando existe exatamente um material nomeado com aquela cor exata** (evita aplicar transparência num material ambíguo, ex.: cinza 128,128,128 bate tanto com um vidro quanto com "CROMADO"), recupera a transparência real e marca `alphaMode: "BLEND"`. Resultado: 2 materiais recuperados como transparentes nesta rodada (um vidro azulado `Translucent_Glass_Blue` e um material `*4` com transparência 0,3 no arquivo original). Essa é uma correção conservadora — prefere manter opaco a arriscar esconder geometria real de novo.

## Enquadramento de câmera (bug real encontrado e corrigido durante a implementação)

A primeira versão do enquadramento automático usava a esfera delimitadora da casa para calcular a distância da câmera. Essa fórmula é simples, mas para uma casa muito alongada e baixa (49 m × 37 m × 5,2 m) ela sobra distância demais (usa a diagonal 3D inteira como raio) e deixava a casa pequena demais no quadro. Foi substituída por um cálculo exato que projeta os 8 cantos da caixa delimitadora nos eixos da câmera e usa a menor distância que ainda mantém todos os cantos dentro do campo de visão (com 10% de folga). Verificado matematicamente (coordenadas NDC de todos os 8 cantos ficam dentro de ±0,90 em ambos os eixos, sem cortar nenhuma parte do modelo).

## Fatos verificados

- `npm test`: **19/19 testes passando** (10 legados do leitor `.sh3d`, que continuam intocados, + 9 novos em [tests/converter-skp-glb.test.js](../../showroom3d/tests/converter-skp-glb.test.js) que validam o pipeline `.skp → GLB` e o `casa.glb` publicado).
- `npm run build`: passou. Bundle de produção caiu de **1.042,22 kB para 620,22 kB** (gzip: 298,18 kB → 158,86 kB) com a remoção do `@google/model-viewer`.
- Servidor de desenvolvimento (`npm run dev`) testado ao vivo repetidas vezes: status muda para **"Modelo pronto"**, sem painel de erro, em todas as recargas testadas (mais de 10 recargas consecutivas nesta sessão, incluindo depois de uma limpeza de cache do Vite).
- `?embed=1` testado: cabeçalho e texto editorial ficam ocultos (`display: none` confirmado via inspeção computada), o visualizador continua funcional.
- `renderer.info` do Three.js confirma **56.549 triângulos enviados à GPU, 247 chamadas de desenho, zero erros de WebGL** (`gl.getError() === 0`), consistente com o `triangleCount: 56535` registrado em `casa-meta.json`.
- Dimensões reais medidas pelo `Box3` do modelo carregado: **36,76 m × 48,83 m de base, 5,2 m de altura** (bem diferente dos ~5×30 m documentados na rodada anterior — aquele número provavelmente vinha de uma geometria já incompletamente filtrada; "casa geminada" = duas unidades conjugadas, então uma base mais larga é plausível e não foi tratada como erro sem confirmação).
- Console do navegador sem mensagens de nível `error` nas cargas mais recentes (as poucas mensagens `error` capturadas pela ferramenta de teste são de `504 Outdated Optimize Dep` de uma janela anterior à limpeza do cache do Vite, confirmadas como obsoletas pela inspeção de rede ao vivo, que mostrou só `200 OK`).

## Limitação de verificação nesta sessão (importante, seja honesto sobre isso)

**Não consegui obter uma captura de tela visual real do resultado final nesta sessão.** A ferramenta de screenshot do navegador (`computer.screenshot`) falhou consistentemente com "the Browser pane is not displayed, so the page is not compositing frames" — uma limitação do ambiente de automação usado nesta conversa, não um erro da aplicação. Tentei alternativas (captura via `canvas.toDataURL()`, leitura direta do framebuffer via `gl.readPixels()`), mas ambas se mostraram não confiáveis nesse mesmo ambiente sem compositor ativo (resultados inconsistentes entre chamadas idênticas). Para compensar, a verificação foi feita por evidência indireta, mas objetiva:

- contagem de triângulos/materiais/erros da GPU (`renderer.info`, `gl.getError()`);
- posição e orientação da câmera confirmadas matematicamente (coordenadas NDC dos 8 cantos da caixa delimitadora, todas dentro do campo de visão);
- teste de cobertura de silhueta com material verde 100% opaco em canvas offscreen isolado, escalando com a distância da câmera como esperado (2,2% → 7,1% → 9,3% ao aproximar), confirmando que a geometria realmente é desenhada e reage à câmera de forma consistente — não é uma tela em branco;
- inspeção estrutural do `casa.glb` publicado (materiais `doubleSided`, `alphaMode: "BLEND"` presentes).

**Recomendação**: Andrew (ou o próximo chat) deve abrir `http://localhost:5173/` num navegador real e confirmar visualmente que o resultado está bonito antes de considerar esta etapa definitivamente concluída. Isso ainda não foi feito por um humano nesta rodada.

## Como rodar

Na pasta `showroom3d/`:

```powershell
npm install
npm run dev
npm test
npm run build
```

URL local: `http://127.0.0.1:5173/` (ou `http://localhost:5173/`).
URL para incorporação: `http://127.0.0.1:5173/?embed=1`.

## Arquivos alterados nesta rodada

| Arquivo | O que mudou |
|---|---|
| `showroom3d/fontes/casa-geminada-bruno.skp` | **Novo.** Cópia do arquivo nativo do SketchUp fornecido por Andrew — fonte ativa de geometria e materiais. Fora de `public/`, não é servido pelo site. |
| `showroom3d/fontes/casa-geminada-bruno.obj` | **Novo.** Cópia do `.obj` fornecido por Andrew, mantida só como referência manual; não é usada pelo pipeline. |
| `showroom3d/scripts/converter-skp-glb.mjs` | **Novo.** Conversor `.skp` → `.glb` via `openskp`, com recuperação conservadora de transparência e acabamento (metal/vidro/madeira) por material nomeado. |
| `showroom3d/scripts/converter-projeto-obj-glb.mjs` | **Removido.** Pipeline antigo baseado em `.obj` com triangulação manual. |
| `showroom3d/scripts/adicionar-terreno-glb.mjs` | **Removido.** Utilitário do pipeline antigo. |
| `showroom3d/public/modelos/casa.glb` | Regenerado a partir do `.skp`. |
| `showroom3d/public/modelos/casa-meta.json` | Regenerado; agora inclui `primitiveCount`, `materialCount`, `transparentMaterialCount`, `triangleCount`, `textureCount`. |
| `showroom3d/public/modelos/CASA-GEMINADA-BRUNO.obj` | **Removido** (não é mais usado; cópia de referência agora em `fontes/`, fora do público). |
| `showroom3d/src/main.js` | Reescrito: `<model-viewer>` trocado por cena Three.js própria (`GLTFLoader`, `OrbitControls`, `PMREMGenerator`/`RoomEnvironment`, enquadramento de câmera pelos 8 cantos da caixa delimitadora, `DoubleSide` em todos os materiais). |
| `showroom3d/index.html` | `<model-viewer>` trocado por `<canvas id="house-viewer">`. |
| `showroom3d/src/ui/estilos.css` | Seletores `model-viewer` trocados por `.viewer-canvas`. |
| `showroom3d/package.json` | `@google/model-viewer` removido; `openskp` adicionado como devDependency. |
| `showroom3d/tests/converter-skp-glb.test.js` | **Novo.** 9 testes cobrindo o pipeline `.skp → GLB` e o `casa.glb` publicado. |

Não tocados (fora do escopo desta tarefa): `TESTE-CASA.obj`, `TESTE-CASA.sh3d`, pasta `modelos/` da raiz do projeto, `mockups/galeria-casas/`, `plans/galeria-casas/`, `video-analysis/`, `vlc-help.txt`, código legado `src/sh3d/`, `src/engine/`, `tests/sh3d.test.js`.

## Limitações conhecidas

- Nenhuma captura de tela visual foi obtida nesta sessão (ver seção acima) — verificação humana ainda pendente.
- A paleta de cores agora vem do `.skp` real, o que é uma melhoria em relação à paleta escolhida à mão da rodada anterior, mas ainda não é um render fotorrealista com mapas PBR completos (só 8 texturas embutidas no `.skp` foram recuperadas; a maioria dos materiais usa cor sólida).
- O acabamento metal/vidro/madeira (metalness/roughness) só é ajustado quando existe exatamente um material nomeado correspondente àquela cor exata — outras cores ambíguas ficam com o acabamento padrão (roughness 0,8, sem metal).
- Terreno: esta versão não adiciona nenhum plano de chão sólido novo — há apenas um `ShadowMaterial` quase invisível como capturador de sombra (`opacity: 0.28`), sem inventar grama/calçada/muro que não exista no `.skp` de origem, seguindo a regra explícita do Andrew registrada em `HANDOFF-CLAUDE.md`.
- Não houve commit, push, merge, deploy ou publicação.

## Próximo passo recomendado

1. Abrir `http://localhost:5173/` num navegador de verdade e confirmar visualmente com Andrew se o resultado está bom.
2. Se a câmera inicial não estiver no ângulo ideal, ajustar o vetor `direcao` em `posicionarCameraECena()` (`showroom3d/src/main.js`).
3. Se Andrew tiver o `.mtl`/texturas originais do OBJ ou quiser fornecer fotos de acabamento reais, isso permitiria trocar as cores sólidas por mapas PBR fotográficos para um resultado mais próximo de um render fotorrealista.

## Atualização — novo GLB e terreno de apresentação (26/08/2026)

- o arquivo fornecido por Andrew, `casa geminada bruno chato (1).glb`, foi preservado como `../../fontes/casa-geminada-bruno-chato-novo.glb` (fora da raiz observada pelo Vite) e passou a ser o modelo ativo em `../../showroom3d/public/modelos/casa.glb`;
- o GLB é autocontido: gerador `SimLab GLTF`, versão 2.0, 41.811.908 bytes, 46 imagens/texturas embutidas, 59 materiais, 4 materiais com `alphaMode: BLEND`, 4.501 primitivas e aproximadamente 806.083 triângulos;
- a caixa delimitadora do GLB completo, medida diretamente dos accessors e transformações, é `38,809 m × 31,121 m × 5,200 m`; após manter somente o par da direita, a página exibe `10,0 m × 30,0 m × 5,2 m`;
- `showroom3d/src/main.js` agora centraliza o modelo nos eixos X/Z e apoia a menor coordenada Y no nível de apresentação, sem reescrever vértices, remover paredes ou alterar materiais/texturas;
- o terreno gerado pelo showroom tem gramado com margem de 2 m, borda cinza de 0,28 m e base de 0,16 m. Ele é uma base visual externa e não faz parte da geometria arquitetônica do GLB;
- a câmera inicial foi ajustada para um ângulo menos aéreo e para enquadrar o modelo junto com a borda do terreno;
- verificação visual no navegador em `http://localhost:5173/`: status `Modelo pronto`, sem painel de erro, dimensões atualizadas e terreno verde com borda cinza visível;
- descoberta importante: o próprio GLB novo contém quatro conjuntos arquitetônicos principais de aproximadamente 5 m × 30 m, distribuídos em posições diferentes. A apresentação agora mantém somente os dois conjuntos da direita destacados por Andrew, remove os dois da esquerda e a faixa global da exportação por índices estruturais do nó raiz. A geometria interna, materiais e texturas dos dois conjuntos mantidos não são alterados;
- o GLB anterior foi preservado em `../../showroom3d/.backup-modelos/casa-before-new-glb.glb` para reversão local;
- esta atualização não fez commit, push, deploy ou publicação.

## Atualização — acabamento visual do ModelView (26/08/2026)

- o `showroom3d/src/main.js` recebeu calibração de renderização para aproximar a leitura do mockup: resolução interna do canvas limitada entre 1,5× e 2× o DPR do dispositivo, exposição reduzida para `0,9`, luz principal quente em `1,8`, luz de preenchimento azulada suave em `0,32`, sombra com `normalBias` e reflexo dos materiais reduzido para `0,65`;
- a base do terreno passou a usar tons mais contrastantes (`0x5f5d57` na borda/base e `0x476841` no gramado), sem alterar suas dimensões ou a geometria das casas;
- verificação visual no navegador em `http://localhost:5173/`: status `Modelo pronto`, painel de erro oculto, casas da direita mantidas e centralizadas, medidas `10,0 m × 30,0 m × 5,2 m`; resolução interna observada no canvas: `1623 × 975` para uma área CSS de `866 × 520`;
- o mockup de vista superior gerado nesta conversa é somente uma referência visual; nenhum arquivo de imagem foi incluído no projeto e o botão de vista superior ainda não foi implementado;
- `npm test` com o limite padrão de 5 segundos expirou no teste pesado de coordenadas do conversor, sem assertion failure; a mesma suíte passou com `npm test -- --testTimeout=15000`: **19/19 testes**;
- `npm run build`: passou sem erro; permanece o aviso conhecido de bundle acima de 500 kB;
- não houve commit, push, deploy ou publicação.

## Atualização — escala de apresentação 4x (26/08/2026)

- a escala visual do showroom foi alterada para `4x` em `showroom3d/src/main.js`, por meio do grupo `palco-de-apresentacao-4x`;
- o grupo aplica o mesmo fator ao modelo GLB, ao terreno gerado e ao piso de sombra, como uma maquete quatro vezes maior, sem alterar vértices, materiais, texturas ou o arquivo GLB de origem;
- as caixas usadas para exibir as medidas continuam sendo calculadas no espaço original em metros antes da escala visual. O painel permanece com `10,0 m × 30,0 m × 5,2 m`;
- `showroom3d/public/modelos/casa-meta.json` registra `presentationAlignment.scale: 4` para deixar explícita a escala de apresentação, enquanto `houseDimensionsMeters` permanece inalterado;
- o terreno continua sendo gerado localmente com `43,37 m × 35,68 m`; no palco de apresentação 4x, sua representação visual acompanha a mesma escala, sem mudar a relação entre casa, gramado e borda;
- câmera, controles orbitais, luzes e sombra foram ajustados para operar com o palco ampliado. A escala vale para duas casas, uma casa, vista externa e vista de cima;
- esta mudança é diferente de um zoom de câmera: preserva a proporção casa/terreno e amplia uniformemente a maquete exibida;
- verificação visual no navegador em `http://localhost:5173/`: status `Modelo pronto`, medidas preservadas em `10,0 m × 30,0 m × 5,2 m`, duas casas e terreno renderizados; a captura do canvas mostrou a maquete ocupando mais do quadro, sem alteração aparente de geometria ou materiais;
- as quatro combinações dos controles foram exercitadas no navegador (`2 casas`/`1 casa` × `Vista externa`/`Vista de cima`), com retorno correto ao estado inicial e sem erro de aplicação;
- `npm test -- --testTimeout=15000`: **19/19 testes** passaram;
- `npm run build`: passou sem erro; permanece o aviso conhecido de bundle acima de 500 kB;
- não houve commit, push, deploy ou publicação.

## Atualização — respiro da câmera na escala 4x (26/08/2026)

- a escala 4x deixava a câmera externa muito próxima da estrutura porque o cálculo de distância ainda usava a referência métrica original;
- `showroom3d/src/main.js` agora aplica uma compensação de distância proporcional ao palco ampliado (`escalaPalco / 2`), preservando a escala visual 4x do conjunto e dando mais respiro ao enquadramento;
- o ajuste vale para duas casas, uma casa e a vista superior, sem alterar GLB, materiais, terreno ou medidas exibidas;
- verificação no navegador em `http://localhost:5173/`: status `Modelo pronto`, medidas `10,0 m × 30,0 m × 5,2 m`, vista superior alternada e retorno à vista externa confirmados;
- `npm test -- --testTimeout=15000`: **19/19 testes** passaram;
- `npm run build`: passou sem erro; permanece o aviso conhecido de bundle acima de 500 kB;
- não houve commit, push, deploy ou publicação.

## Atualização — vista de cima em corte, reversível (26/08/2026)

- foi implementado em `showroom3d/index.html` o botão `Vista de cima`, que alterna para `Voltar à vista externa` sem trocar de página;
- a vista de cima mantém somente uma das duas casas lado a lado do conjunto já filtrado. A seleção é feita pela maior lacuna entre os centros dos blocos no eixo X, e não por IDs fixos do GLB;
- o GLB exportado separa cada unidade em três grupos estruturais. A compactação de geometrias em `showroom3d/src/main.js` passou a preservar esses grupos, permitindo ocultar uma casa inteira mesmo depois da otimização de draw calls;
- o corte usa um plano horizontal de apresentação em aproximadamente 2,55 m, com a câmera elevada. Os grupos acima desse nível são ocultados por inteiro e a base permanece apoiada no piso; não foram criados ambientes internos, paredes novas ou peças soltas;
- ao voltar para a vista externa, todas as visibilidades e planos de corte são restaurados, a câmera retorna ao enquadramento normal e o terreno conserva suas dimensões originais (aprox. 43,37 m × 35,68 m);
- o botão e o corte funcionaram no showroom direto e dentro do iframe da galeria. No navegador, o status alternou entre `Modelo pronto` e `Vista de cima ativa`, e o atributo `aria-pressed` mudou corretamente para `true`/`false`;
- verificação visual no navegador: a vista ativa mostrou uma única unidade, paredes rebaixadas por um corte contínuo, portas/janelas e terreno visíveis, sem geometria voando ou deslocamento da câmera após a correção da matriz mundial;
- a nota de acessibilidade foi atualizada para deixar claro que a vista em corte é somente uma apresentação, não uma planta ou navegação interna;
- `npm test -- --testTimeout=15000`: **19/19 testes** passaram;
- `npm run build`: passou sem erro; permanece o aviso conhecido de bundle acima de 500 kB;
- não houve commit, push, deploy ou publicação.

## Atualização — seleção independente e corte sem paredes ocas (26/08/2026)

- o botão da cena agora separa duas escolhas independentes: `2 casas`/`1 casa` e `Vista de cima`/`Vista externa`. O estado inicial é `2 casas` com cobertura;
- a vista de cima aplica-se às duas casas por padrão. Se `1 casa` for selecionado, as mesmas duas opções continuam disponíveis para somente essa unidade: com cobertura ou vista superior;
- o clipping de fragmentos foi removido. Ele deixava a seção das paredes aberta/oca e podia gerar instabilidade visual nas faces cortadas;
- no modo superior, os grupos completos de cobertura/volumes altos são ocultados e os grupos da base permanecem inteiros, preservando os topos fechados originais das paredes e evitando peças voando;
- o mapa de sombras passou a ser atualizado somente quando câmera ou seleção mudam (`shadowMap.autoUpdate = false`), com `bias`, `normalBias` e raio recalibrados para reduzir piscadas durante a navegação;
- a compactação continua preservando os grupos arquitetônicos de cada unidade, por isso a troca entre uma e duas casas não desfaz a otimização de renderização;
- verificação visual no navegador: `2 casas + Vista de cima` mostrou as duas unidades sem cobertura e sem seção oca; `1 casa + Vista de cima` mostrou uma unidade; `1 casa + Vista externa` restaurou a cobertura; o status e os textos dos controles acompanharam cada estado;
- ainda não foi implementado um modo seguro de `remover paredes`, `mostrar somente aberturas` ou `mostrar somente móveis`. No GLB atual, grandes grupos arquitetônicos (incluindo paredes) não possuem nomes semânticos confiáveis; ocultar por aproximação poderia remover portas/janelas, criar vazios ou repetir o bug. Para essa etapa, o ideal é exportar do SketchUp com tags/camadas separadas para paredes, cobertura, aberturas e mobiliário;
- `npm test -- --testTimeout=15000`: **19/19 testes** passaram;
- `npm run build`: passou sem erro; permanece o aviso conhecido de bundle acima de 500 kB;
- não houve commit, push, deploy ou publicação.

## Base reutilizável para próximos projetos (26/08/2026)

- foi criado `plans/showroom-3d/PADRAO-3D-REUTILIZAVEL.md` como referência persistente do padrão visual e técnico aprovado neste primeiro projeto;
- o documento registra as regras de escala em metros, alinhamento no piso, cores/contraste, terreno, sombras estáveis, preservação de grupos, seleção de uma/duas casas e prevenção de paredes ocas/geometria voando;
- também registra a especificação da futura visão interna em escala humana: planta como fonte de verdade, câmera na altura dos olhos, campo de visão confortável, pontos por cômodo e limites de circulação;
- a visão interna ainda não foi implementada. Ela depende da planta cotada e de um GLB que contenha a geometria interna necessária;
- para novos GLBs, a regra é inspecionar a hierarquia antes de ocultar ou compactar qualquer elemento e pedir tags/camadas separadas do SketchUp quando paredes, cobertura, aberturas e móveis não estiverem semanticamente separados;
- este arquivo é a memória persistente do projeto para handoffs e chats futuros; não é uma alteração global do agente fora deste projeto.

## Atualização — planta baixa e altura interna de referência (26/08/2026)

- a planta fornecida `Planta_Baixa - Queno 03-07-26 -ajustado.pdf` foi lida e renderizada para inspeção visual;
- ela é uma prancha térrea em escala 1:50 com duas unidades espelhadas e ambientes identificados como dormitório, banho, serviço, cozinha, jantar/estar, varanda, quiosque, garagem e áreas permeáveis;
- o GLB ativo continua sendo `showroom3d/public/modelos/casa.glb`; a versão mobile continua em `showroom3d/public/modelos/casa-direita-mobile.glb`;
- a altura global informada por Andrew é `2,65 m` e foi registrada como referência de pé-direito/volume interno para a futura visão em primeira pessoa;
- essa medida não deve ser usada para deformar ou reescalar o GLB automaticamente. Primeiro devem ser comparadas a escala, a orientação, as portas, os corredores e os limites dos cômodos entre planta e modelo;
- a visão interna ainda não foi implementada nesta etapa. O próximo trabalho deve criar pontos de entrada por cômodo em escala humana, com câmera aproximadamente entre 1,60 m e 1,70 m, campo de visão confortável e limites que impeçam atravessar paredes;
- não houve alteração de código nesta atualização; não houve commit, push, deploy ou publicação.

## Atualização — enquadramento externo ampliado (26/08/2026)

- o zoom inicial da vista externa deixou de usar o terreno inteiro como caixa de enquadramento, pois isso fazia duas casas de aproximadamente 10 m × 30 m parecerem pequenas;
- `showroom3d/src/main.js` agora enquadra a caixa espacial das casas com margem de aproximadamente 1,1 m. O terreno continua sendo gerado com as mesmas dimensões físicas (aprox. 43,37 m × 35,68 m), sem reescala ou deformação;
- a mudança vale para duas casas e para uma casa, tanto na vista externa quanto no iframe da galeria. A escala do modelo e as medidas exibidas continuam `10,0 m × 30,0 m × 5,2 m`;
- verificação visual no navegador: showroom direto e galeria mostraram as casas maiores no quadro, com gramado/borda ainda visíveis; status `Modelo pronto` e painel de erro oculto;
- `npm test -- --testTimeout=15000`: **19/19 testes** passaram;
- `npm run build`: passou sem erro; permanece o aviso conhecido de bundle acima de 500 kB;
- não houve commit, push, deploy ou publicação.

## Atualização — tema escuro global e primeira pintura do iframe (26/08/2026)

- a causa do flash reportado no botão `Abrir experiência 3D` foi confirmada: o `showroom3d/index.html` não tinha estilo crítico inline e só recebia o CSS pelo `import './ui/estilos.css'` do módulo; antes da execução do módulo, o navegador pintava o HTML cru, mostrando link azul, texto preto e botão nativo;
- `mockups/galeria-casas/mockup.html` agora declara `data-theme="dark"` e usa os tokens escuros como padrão, cobrindo Linktree, galeria e painel em desktop e mobile;
- `showroom3d/src/ui/tokens.css` agora usa o tema escuro como padrão e mantém uma sobrescrita clara explícita para o botão de tema existente;
- `showroom3d/index.html` recebeu uma tela inicial escura inline que esconde o shell até o CSS do app estar disponível; `showroom3d/src/main.js` libera o shell com `app-ready` e mantém o fundo da cena escuro também no desktop; o fallback visual do canvas foi ajustado em `showroom3d/src/ui/estilos.css`;
- nenhuma geometria, textura, material do GLB, filtro do conjunto da direita, terreno, câmera orbital ou escopo externo foi alterado;
- verificação visual no navegador em viewport mobile `390×844`: Linktree escuro, galeria escura e iframe sem HTML cru; o modelo carregou com terreno e sem painel de erro;
- verificação visual no navegador em desktop: Linktree/galeria/showroom escuros; showroom direto chegou a `Modelo pronto`, com dimensões `10,0 m × 30,0 m × 5,2 m`, terreno e conjunto da direita visíveis;
- `npm test -- --testTimeout=15000`: **19/19 testes** passaram;
- `npm run build`: passou sem erro; bundle JavaScript de `627,00 kB` (gzip `161,04 kB`), permanecendo o aviso conhecido acima de 500 kB;
- não houve commit, push, deploy ou publicação.

## Atualização — acesso da galeria pelo celular (26/08/2026)

- `mockups/galeria-casas/mockup.html` agora monta o iframe do ModelView usando o hostname atual da galeria e a porta `5173`; assim, quando a galeria é aberta pelo IP da rede, o 3D não tenta mais acessar o `localhost` do celular;
- os servidores locais foram iniciados nas interfaces de rede (`0.0.0.0`): galeria na porta `4174` e showroom na porta `5173`;
- IP Wi-Fi observado neste computador: `192.168.1.84`;
- link local para testar no celular, com computador e celular na mesma rede Wi-Fi: `http://192.168.1.84:4174/mockups/galeria-casas/mockup.html`;
- verificação no navegador pela URL de rede: o botão `Abrir experiência 3D` criou o iframe `http://192.168.1.84:5173/?embed=1` e o slot ficou carregado;
- `npm test -- --testTimeout=15000`: **19/19 testes** passaram;
- `npm run build`: passou sem erro; permanece o aviso conhecido de bundle acima de 500 kB;
- para a placa do cliente, o endereço final ainda precisa ser público e HTTPS; o IP acima serve apenas para teste dentro da rede local;
- não houve commit, push, deploy ou publicação.

## Atualização — otimização de desempenho do ModelView (26/08/2026)

- o ModelView estava usando resolução interna de até 2× e mantendo milhares de malhas separadas; isso deixava a navegação mais pesada sem produzir uma diferença visual proporcional;
- `showroom3d/src/main.js` agora limita o pixel ratio a `1,5` e compacta as geometrias visíveis do par da direita por material/atributos compatíveis, preservando mapas, cores, portas, janelas e transparências;
- na verificação do navegador, a área CSS `866 × 520` voltou a renderizar em `1082 × 650` (DPR observado `1,25`), com status `Modelo pronto`, painel de erro oculto e medidas `10,0 m × 30,0 m × 5,2 m`;
- `npm test -- --testTimeout=15000`: **19/19 testes** passaram. O limite ampliado é necessário porque o teste de coordenadas do conversor leva mais de 5 segundos em algumas execuções;
- `npm run build`: passou sem erro; o bundle aumentou para `626,45 kB` porque a compactação usa o utilitário de geometria do Three.js. O aviso conhecido de bundle acima de 500 kB permanece;
- não houve commit, push, deploy ou publicação.

## Atualização — leitura mobile e integração do 3D na galeria (26/08/2026)

- causa objetiva identificada nas capturas do Android: `mockups/galeria-casas/mockup.html` não declarava a meta `viewport`; o navegador tratava a página como uma área desktop reduzida. Foi adicionada `width=device-width, initial-scale=1, viewport-fit=cover`;
- no mobile, a galeria agora usa tipografia, espaçamento e alvos de toque maiores, reduz a distância vertical do Linktree, esconde a observação interna do protótipo e dá ao bloco 3D uma área de aproximadamente 360–420 px de altura, em vez de um quadro baixo demais;
- o texto do bloco 3D foi alinhado ao escopo real do showroom: somente rotação, aproximação, terreno e proporções externas; não promete ambientes internos nem planta interativa;
- criada a versão `showroom3d/public/modelos/casa-direita-mobile.glb`: mantém somente os seis nós estruturais do conjunto da direita, recomprime as imagens embutidas para JPEG com qualidade 82 e preserva a versão completa `casa.glb` para telas maiores;
- tamanho verificado: `casa.glb` = 41.811.908 bytes; `casa-direita-mobile.glb` = 21.649.000 bytes, redução de 46,4% na cópia mobile. As duas versões permanecem autocontidas, sem URI externa;
- `showroom3d/src/main.js` seleciona automaticamente o GLB mobile quando a tela tem até 640 px ou quando a página está em `?embed=1`; no desktop continua carregando `casa.glb` e aplicando a filtragem existente do par da direita;
- no embed, o fundo da cena passou para um marrom escuro compatível com a galeria, a exposição foi reduzida para `0,78`, o reflexo dos materiais para `0,45`, a luz principal ficou mais quente e o enquadramento passou a priorizar a casa. Materiais neutros muito claros recebem apenas uma correção sutil de contraste; geometria, escala e materiais texturizados não são reescritos;
- verificação funcional no navegador: a galeria abriu o iframe `http://localhost:5173/?embed=1`, o slot ficou com aproximadamente `461,6 px` de altura, o status interno chegou a `Modelo pronto`, as medidas foram `10,0 m × 30,0 m × 5,2 m` e o painel de erro permaneceu oculto;
- verificação visual no navegador: o embed mostrou o par da direita maior no quadro, gramado e borda do terreno visíveis e fundo escuro integrado à galeria; o showroom direto continuou carregando a versão completa com status `Modelo pronto` e as mesmas medidas;
- para a validação final, o servidor da galeria foi iniciado de forma restrita, servindo somente `mockups/galeria-casas`; nessa configuração o endereço é `http://localhost:4174/mockup.html` ou, na rede local, `http://192.168.1.84:4174/mockup.html`;
- limitação real: a ferramenta de navegador usada nesta sessão não oferece emulação de viewport de celular; a meta viewport e as regras responsivas foram verificadas no código, e o visual foi conferido em navegador de desktop. A confirmação final em um aparelho físico ainda é recomendada;
- `npm test -- --testTimeout=15000`: **19/19 testes** passaram;
- `npm run build`: passou sem erro; permanece o aviso conhecido de bundle acima de 500 kB;
- não houve commit, push, deploy ou publicação.

## Atualização — nitidez no afastamento e plano da câmera interna (26/08/2026)

- o desfoque percebido no outzoom foi reproduzido visualmente no ModelView e a causa foi confirmada como o `Fog` da cena, configurado para começar em `40` e terminar em `220` unidades;
- `showroom3d/src/main.js` agora usa fundo sólido sem nevoeiro (`scene.fog = null`), preservando o contraste das paredes, bordas, portas e terreno quando a câmera é afastada;
- verificação visual em `http://localhost:5173/`: após um outzoom equivalente ao teste anterior, o modelo permaneceu nítido, o status ficou `Modelo pronto`, o painel de erro permaneceu oculto e as medidas continuaram `10,0 m × 30,0 m × 5,2 m`;
- foi criado [PLANO-CAMERA-INTERNA.md](PLANO-CAMERA-INTERNA.md) com o plano da futura navegação interna por cômodos, incluindo auditoria do GLB contra a planta, câmera na altura dos olhos, pontos por ambiente, navegação segura, colisão, mobile e critérios de aceite;
- a câmera interna continua somente planejada. Antes de implementá-la, é necessário confirmar que o GLB contém geometria interna e grupos semânticos suficientes; a escala visual 4x não deve ser usada para deformar nem para calcular a escala humana;
- as combinações externas foram preservadas e testadas: `2 casas`/`1 casa` e `Vista externa`/`Vista de cima`;
- `npm test -- --testTimeout=15000`: **19/19 testes** passaram;
- `npm run build`: passou sem erro; permanece o aviso conhecido de bundle acima de 500 kB;
- não houve commit, push, deploy ou publicação.

## Atualização — primeira versão da vista interna guiada (26/08/2026)

- foi implementado em `showroom3d/index.html`, `showroom3d/src/main.js` e `showroom3d/src/ui/estilos.css` o modo `Vista interna`, sem trocar de página e sem remover a vista externa existente;
- a vista interna usa o mesmo GLB ativo, volta temporariamente o palco para a escala métrica `1x` e posiciona a câmera a `1,65 m` do piso, usando `68°` de campo de visão para uma leitura mais próxima de primeira pessoa. A referência de altura global interna registrada para o projeto continua sendo `2,65 m`;
- na primeira pessoa, o terreno e o piso de sombra ficam ocultos e os grupos superiores acima da referência de `2,65 m` são ocultados inteiros. Isso evita que o teto bloqueie a visão sem cortar faces ou criar paredes ocas/triângulos soltos;
- a navegação é guiada por pontos, não por livre circulação: o painel oferece `Garagem`, `Varanda`, `Jantar e estar`, `Dormitório 1`, `Banheiro`, `Cozinha`, `Serviço`, `Dormitório 2` e `Quiosque` para cada unidade. Há `9` pontos por casa (`18` com `2 casas`) e `9` pontos quando `1 casa` está selecionada;
- cada ponto é ajustado dentro da caixa espacial da unidade por uma busca de espaço livre com raios horizontais, rejeitando posições que nasçam dentro de paredes. A troca entre ambientes usa transição de `520 ms`; o arraste controla apenas o olhar e as setas/WASD ajustam a direção, sem permitir atravessar a geometria;
- a seleção `1 casa`/`2 casas` continua independente da vista: no modo interno ela foi movida para dentro do painel para não ficar coberta pelos botões em telas estreitas. `Vista de cima` fica desabilitada durante a primeira pessoa e volta a funcionar ao sair;
- foi corrigido um conflito descoberto no teste visual: `OrbitControls.update()` continuava reaplicando a câmera externa mesmo com `enabled=false`. O ciclo agora atualiza os controles orbitais somente fora da vista interna;
- verificação visual no navegador em `http://localhost:5173/`: entrada e saída da vista interna, `1 casa`/`2 casas`, seletor de ambientes, troca por `Próximo`, dormitório, sala, banheiro e cozinha foram exercitados. A câmera permaneceu na escala humana, sem voar para longe, sem atravessar o piso e sem alterar o enquadramento externo ao retornar;
- limitação real da primeira versão: o GLB não fornece catálogo semântico confiável nem câmeras/portais exportados por cômodo. Por isso os nomes e posições são uma aproximação orientada pela planta e pela caixa da unidade, não uma garantia centimétrica de cada ambiente. Para o acabamento definitivo, o próximo GLB deve vir com Tags/Layers ou câmeras nomeadas para paredes, cobertura, aberturas, móveis e ambientes;
- `npm test -- --testTimeout=15000`: **19/19 testes** passaram;
- `npm run build`: passou sem erro; permanece o aviso conhecido de bundle acima de 500 kB (bundle JavaScript gerado de `639,54 kB`, gzip `165,14 kB`);
- não houve commit, push, deploy ou publicação.

## Atualização — escala visual dobrada e terreno mantido na vista interna (26/08/2026)

- a escala visual do palco externo passou de `4x` para `8x` em `showroom3d/src/main.js`; o metadata `showroom3d/public/modelos/casa-meta.json` agora registra `presentationAlignment.scale: 8`;
- a escala métrica exibida não mudou: o painel continua mostrando `10,0 m × 30,0 m × 5,2 m`. O fator altera somente a maquete de apresentação, não os vértices, o GLB ou as medidas do projeto;
- a vista interna passou de palco `1x` para palco `2x`. Os pontos de entrada continuam sendo calculados em metros e transformados junto com a maquete, preservando a posição relativa dentro da casa e a referência de câmera a `1,65 m` do piso;
- o terreno deixou de ser ocultado na vista interna. Ele continua com suas dimensões completas (aprox. `43,37 m × 35,68 m`) e aparece quando o olhar alcança as aberturas/áreas externas; o piso imediatamente sob a câmera continua sendo o piso arquitetônico do GLB quando ela está dentro da casa;
- o piso de sombra permanece oculto na primeira pessoa para não criar uma segunda superfície escura sobre o terreno. A luz interna foi ampliada para acompanhar o palco `2x`, evitando que a escala maior escureça a leitura dos ambientes;
- a câmera externa, a distância de enquadramento, o campo de visão interno e as luzes foram recalculados para a nova escala. A seleção de uma/duas casas, a vista superior e o retorno à vista externa permanecem reversíveis;
- verificação visual no navegador em `http://localhost:5173/`: palco externo `8x` carregado com terreno e duas casas; vista interna `2x` carregada com câmera na altura dos olhos, painel de ambientes e terreno habilitado; retorno externo e status do modelo preservados;
- limitação real: em primeira pessoa, paredes e portas naturalmente podem esconder o gramado até o visitante olhar através de uma abertura ou sair para uma área externa. A vista interna não força o terreno a aparecer através de paredes, pois isso criaria uma composição sem sentido físico;
- `npm test -- --testTimeout=15000`: **19/19 testes** passaram;
- `npm run build`: passou sem erro; permanece o aviso conhecido de bundle acima de 500 kB (bundle JavaScript gerado de `639,66 kB`, gzip `165,19 kB`);
- não houve commit, push, deploy ou publicação.
