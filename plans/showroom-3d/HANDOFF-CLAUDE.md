# Handoff para Claude — Showroom externo 3D

Data: 25/08/2026

## Objetivo deste handoff

Continuar o trabalho do showroom 3D externo da casa sem recomeçar o projeto, sem implementar interiores e sem usar imagens geradas por IA para deduzir a geometria.

Antes de qualquer alteração, ler:

1. `plans/showroom-3d/HANDOFF.md`
2. `plans/showroom-3d/BASELINE.md`
3. `showroom3d/index.html`
4. `showroom3d/src/main.js`
5. `showroom3d/scripts/converter-projeto-obj-glb.mjs`
6. `showroom3d/public/modelos/casa-meta.json`

## Pedido visual mais recente de Andrew

Andrew forneceu uma foto de referência arquitetônica e quer usar somente a paleta de cores dela no modelo real do SketchUp.

A próxima alteração desejada deve ser **color-only**:

- manter exatamente as paredes, volumes, portas, janelas, quiosque, terreno e câmera do projeto real;
- usar fachada em bege/taupe quente;
- usar muros em creme claro;
- usar portas e esquadrias em grafite/preto;
- usar madeira marrom quente na porta existente;
- usar vidro fumê acinzentado, sem azul muito forte;
- usar grama verde escura natural;
- usar piso/base em concreto bege-acinzentado;
- manter iluminação quente apenas se isso puder ser feito no material/apresentação sem alterar a geometria.

Não adicionar novas paredes, capas espessas, telhados, cômodos, árvores, carros, calçadas, portões ou fachadas que não existam no OBJ.

## Fonte real da geometria

- OBJ ativo: `showroom3d/public/modelos/CASA-GEMINADA-BRUNO.obj`
- Unidade do OBJ: metros
- Conversão oficial:

```powershell
node scripts/converter-projeto-obj-glb.mjs public/modelos/CASA-GEMINADA-BRUNO.obj public/modelos/casa.glb public/modelos/casa-meta.json meters
```

- GLB carregado pela página: `showroom3d/public/modelos/casa.glb`
- Metadata: `showroom3d/public/modelos/casa-meta.json`
- Dimensões verificadas da casa: aproximadamente **5,00 m × 30,00 m × 5,20 m**
- Terreno verde: **12 m × 35 m**, centralizado
- Base cinza atual: **12,24 m × 35,24 m × 0,08 m**
- Escala de entrega: `1`

## Estado técnico atual

O conversor atual já contém:

- triangulação própria para faces OBJ côncavas, evitando diagonais incorretas;
- `THREE.DoubleSide` nas faces arquitetônicas, pois há orientações invertidas no OBJ;
- filtro de `room_56_*` e `room_57_*`, que eram superfícies de níveis sem paredes;
- preservação de materiais por grupo/face, em vez de reduzir objetos ao primeiro material;
- materiais separados para `boundary_wall`, `house_facade` e `kiosk_graphite` pelas malhas reais `Mesh214`, `Mesh215` e `Mesh216`;
- transparência somente em materiais de vidro;
- `cameraTargetMeters` e `cameraDistanceMeters` no metadata para o enquadramento inicial.

### Atenção sobre mudanças anteriores

Uma base cinza de terreno (`site_base`) e uma capa visual nas faces horizontais (`wall_cap`) foram adicionadas em uma rodada anterior para melhorar o acabamento. Andrew agora pediu para usar a foto de referência **somente para cores**. Portanto, não aumentar, duplicar ou redesenhar esses elementos; se ele confirmar que quer apenas cores, revisar se `site_base`/`wall_cap` devem permanecer visualmente discretos.

## Imagens geradas por IA

As prévias geradas anteriormente foram apenas conceitos. Algumas alteraram paredes, capas, portas ou proporções mesmo quando receberam instruções para preservar a geometria.

Regras:

- não usar nenhuma prévia de IA como fonte de coordenadas, posição de janela ou formato de parede;
- não copiar a arquitetura da foto de referência, que é de outro projeto;
- se for necessário gerar nova imagem, usar a captura real do navegador como referência de geometria e a foto apenas como referência de cor;
- antes de aplicar uma nova paleta no GLB, mostrar a proposta a Andrew quando ele pedir uma prévia.

## Critérios de aceite da próxima alteração

1. A geometria observada no SketchUp e no GLB não muda.
2. Não aparece uma segunda casa, parede voando ou triângulo diagonal.
3. Não há paredes transparentes; somente vidros podem ser translúcidos.
4. A casa continua apoiada no terreno.
5. Porta, esquadrias e vidro ficam visualmente diferenciados.
6. A fachada e os muros não ficam com a mesma cor chapada.
7. A página mostra `Modelo pronto` em `http://localhost:5173/`.
8. `npm test` passa com 10 testes.
9. `npm run build` passa; o aviso de bundle acima de 500 kB é conhecido e não bloqueia a entrega.
10. Atualizar `plans/showroom-3d/HANDOFF.md` com os resultados reais.

## Escopo que não deve voltar

- ambientes internos;
- câmeras internas;
- edição de paredes;
- seleção/ocultação de cômodos na experiência atual;
- etapas da construção;
- parser completo do Sweet Home 3D;
- AR, deploy, publicação ou login.

## Verificações já realizadas

- `npm test`: passou — 10/10 testes.
- `npm run build`: passou.
- navegador local: status `Modelo pronto`, GLB carregado e nenhum erro de aplicação capturado na última recarga.
- não houve commit, push, merge, deploy ou publicação.

## Comandos de validação

Na pasta `showroom3d/`:

```powershell
npm run dev
npm test
npm run build
```

Abrir:

- `http://localhost:5173/`
- `http://localhost:5173/?embed=1`

