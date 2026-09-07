# Handoff limpo — próximo chat do projeto Casas Feitoria

Data: 26/08/2026

## Prompt para copiar no chat novo

Você é o agente de implementação do projeto em:

`C:\Users\Andrew\Documents\projeto casas`

Responda em português do Brasil. Não faça commit, push, deploy, publicação ou alteração fora do escopo pedido.

Antes de alterar qualquer código, leia completamente:

1. `plans/showroom-3d/HANDOFF.md`
2. `plans/showroom-3d/HANDOFF-CHAT-NOVO.md`
3. `showroom3d/index.html`
4. `showroom3d/src/main.js`
5. `showroom3d/src/ui/estilos.css`
6. `mockups/galeria-casas/mockup.html`
7. `showroom3d/public/modelos/casa-meta.json`

Não recomece o projeto, não volte ao parser completo do Sweet Home 3D e não substitua o pipeline atual sem evidência. O conversor antigo `showroom3d/scripts/converter-projeto-obj-glb.mjs` não existe mais; ele foi substituído pelo pipeline baseado no SketchUp e no GLB.

## Estado atual confirmado

- O showroom é somente externo: a vista de cima é uma apresentação sem cobertura, não ambientes internos navegáveis, edição de paredes, câmeras internas, etapas da construção ou planta interativa.
- O modelo ativo completo é `showroom3d/public/modelos/casa.glb`, gerado a partir do SketchUp.
- O GLB completo tem 41.811.908 bytes, é autocontido e mantém as texturas embutidas.
- O modelo contém quatro conjuntos arquitetônicos; a apresentação mantém apenas o conjunto da direita, composto pelas duas casas selecionadas pelo usuário.
- Os controles do visualizador são independentes: `2 casas`/`1 casa` e `Vista de cima`/`Vista externa`, permitindo as quatro combinações.
- Dimensões exibidas após o filtro: largura `10,0 m`, profundidade `30,0 m`, altura `5,2 m`.
- O terreno continua com as mesmas dimensões de apresentação: aproximadamente `43,37 m × 35,68 m`, com gramado, borda cinza e base.
- `showroom3d/public/modelos/casa-direita-mobile.glb` é a cópia otimizada para celular/embed: 21.649.000 bytes, redução verificada de 46,4%, somente com o conjunto da direita e texturas recomprimidas em JPEG qualidade 82.
- `showroom3d/src/main.js` escolhe automaticamente o GLB mobile em telas de até 640 px ou com `?embed=1`; desktop continua usando `casa.glb`.
- No embed, o fundo do 3D é marrom escuro, a exposição é menor, a iluminação é quente e o enquadramento prioriza a casa para combinar com a galeria.
- A galeria recebeu meta `viewport`, tipografia e alvos de toque maiores, Linktree menos distante e quadro 3D mobile com aproximadamente 360–420 px.
- A descrição do 3D não promete ambientes internos; fala somente de rotação, aproximação, terreno e proporções externas.
- O showroom também oferece uma `Vista de cima` em corte: mantém uma unidade, oculta a cobertura/volumes acima do corte horizontal e rebaixa as paredes de forma contínua, sem edição de planta ou ambientes internos navegáveis.

## Arquivos relevantes da última alteração

- `showroom3d/src/main.js`: seleção do GLB mobile, enquadramento mobile, calibração de iluminação/contraste e botão reversível de vista de cima em corte.
- `showroom3d/src/main.js`: seleção do GLB mobile, enquadramento mobile, calibração de iluminação/contraste, seleção independente de uma/duas casas e vista superior sem clipping.
- `mockups/galeria-casas/mockup.html`: meta viewport, ajustes mobile e texto externo do 3D.
- `showroom3d/public/modelos/casa-direita-mobile.glb`: asset mobile otimizado.
- `showroom3d/scripts/preparar-glb-mobile.mjs`: poda estrutural do GLB para o conjunto da direita.
- `showroom3d/scripts/recomprimir-texturas-glb.ps1`: recompressão das texturas da cópia mobile.
- `plans/showroom-3d/HANDOFF.md`: histórico completo e fatos anteriores.

## Validações já realizadas

- Navegador: galeria abriu o iframe `http://localhost:5173/?embed=1`.
- Navegador: status interno chegou a `Modelo pronto`, painel de erro oculto e dimensões `10,0 m × 30,0 m × 5,2 m`.
- Navegador: embed mostrou a casa maior no quadro, gramado/borda visíveis e fundo escuro integrado.
- Navegador: showroom direto continuou carregando o modelo completo sem erro.
- Navegador: o botão `Vista de cima` funcionou no showroom direto e dentro do iframe da galeria; alternou para `Voltar à vista externa`, ativou `aria-pressed="true"` e mostrou uma unidade apoiada no terreno, sem peças voando.
- Navegador: as quatro combinações de seleção foram verificadas; `2 casas + Vista de cima` manteve as duas unidades, `1 casa + Vista de cima` manteve uma, e o retorno à vista externa restaurou a cobertura.
- `npm test -- --testTimeout=15000`: 19/19 testes passaram.
- `npm run build`: passou; permanece somente o aviso conhecido de bundle acima de 500 kB.
- Não houve commit, push, deploy ou publicação.

## Atualização mais recente — vista de cima em corte (26/08/2026)

- a implementação está em `showroom3d/src/main.js`, `showroom3d/index.html` e `showroom3d/src/ui/estilos.css`;
- a câmera sobe para uma leitura superior, mantém uma única unidade do conjunto da direita e usa um plano horizontal de corte em aproximadamente 2,55 m;
- a seleção das três partes da casa é espacial, pela maior separação dos centros no eixo X. Isso evita depender da numeração dos nós em uma próxima exportação do SketchUp;
- a compactação de geometria agora mantém os meshes compactados dentro do grupo arquitetônico correspondente, permitindo ligar/desligar a casa sem perder a otimização;
- a troca é reversível e não altera o arquivo GLB nem as dimensões do terreno;
- limitação real: o corte é uma apresentação externa em Three.js. Ele não gera uma planta interna, não cria cômodos navegáveis e não substitui edição arquitetônica.

## Atualização mais recente — seleção independente e paredes fechadas (26/08/2026)

- o padrão voltou a ser `2 casas` com cobertura;
- o botão `2 casas`/`1 casa` controla somente a quantidade de unidades; o botão `Vista de cima`/`Vista externa` controla somente a cobertura e o enquadramento;
- a vista superior agora oculta grupos completos acima da base, sem cortar triângulos com plano de clipping. Isso preserva o topo fechado das paredes e evita o aspecto oco;
- o mapa de sombras deixou de ser recalculado a cada frame e só é atualizado após mudança de enquadramento/seleção, reduzindo instabilidade durante o giro;
- a remoção de paredes, aberturas ou móveis não foi ativada: os grupos de paredes do GLB não têm separação semântica confiável. Essa etapa precisa de tags/camadas separadas no SketchUp ou exports separados para não reintroduzir geometrias erradas.

## Limitação que deve ser respeitada

A ferramenta de navegador usada na última sessão não ofereceu emulação real de viewport de celular. A meta viewport e as regras responsivas foram conferidas no código, mas a confirmação final deve ser feita em um aparelho físico usando a URL de rede abaixo.

## Links de teste atuais

Os servidores precisam estar ativos e o computador/celular devem estar na mesma rede Wi-Fi:

- Galeria servida de forma restrita: `http://192.168.1.84:4174/mockup.html`
- Showroom 3D direto: `http://192.168.1.84:5173/`

O servidor da galeria usado na última validação foi limitado à pasta `mockups/galeria-casas`; por isso o caminho de teste atual é `/mockup.html`, e não `/mockups/galeria-casas/mockup.html`.

## Atualização mais recente — tema escuro global e primeira pintura do iframe (26/08/2026)

- Linktree, galeria e painel do mockup agora usam o tema escuro como padrão em desktop e mobile;
- showroom direto e showroom embutido também iniciam no tema escuro;
- a primeira pintura do iframe agora usa uma tela escura inline e esconde o HTML do shell até o app estar pronto, evitando o flash de link azul, texto preto e botão nativo mostrado no print;
- a causa confirmada era a ausência de CSS crítico no `index.html`: o CSS só entrava quando o módulo `main.js` era executado;
- modelo, filtro das casas da direita, terreno e escopo externo permanecem inalterados;
- navegador: mobile `390×844` e desktop verificados; iframe sem HTML cru, status `Modelo pronto`, dimensões `10,0 m × 30,0 m × 5,2 m`, terreno visível e painel de erro oculto;
- `npm test -- --testTimeout=15000`: **19/19 testes** passaram;
- `npm run build`: passou sem erro; permanece o aviso conhecido de bundle acima de 500 kB;
- não houve commit, push, deploy ou publicação.

## Regra para a próxima alteração

Primeiro reproduza o problema e identifique a causa com evidência. Depois altere somente o arquivo necessário, valide visualmente no navegador, rode `npm test -- --testTimeout=15000` e `npm run build`, e atualize este handoff com o resultado real. Não declare que algo foi corrigido sem verificar.
