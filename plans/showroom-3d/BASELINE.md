# Baseline de referência — Showroom externo 3D

Data: 25/08/2026

## Status

Esta é a versão estrutural aprovada e a direção visual aprovada para o showroom externo da casa. O GLB já contém a paleta aplicada; antes de alterar o modelo, o conversor ou a apresentação, leia este arquivo e `HANDOFF.md` e faça uma conferência visual local.

## O que deve ser preservado

- O showroom apresenta somente o exterior de uma casa.
- Não implementar ambientes internos, edição de paredes, câmeras internas ou etapas da construção.
- A fonte ativa é `showroom3d/public/modelos/CASA-GEMINADA-BRUNO.obj`.
- O OBJ está em metros e é convertido com unidade `meters` e escala de entrega `1`.
- As dimensões verificadas da casa são aproximadamente **5,0 m × 30,0 m × 5,2 m**.
- O terreno de apresentação mede **12 m × 35 m**, fica centralizado sob a casa e fica somente **1 cm** abaixo da base para evitar z-fighting sem criar aparência de modelo flutuando; uma base cinza de **12,24 m × 35,24 m × 0,08 m** forma a borda visível sob a grama.

## Pipeline aprovado

```text
OBJ do SketchUp
  → triangulação correta de faces poligonais côncavas
  → OBJLoader
  → filtro dos níveis sem paredes room_56_* / room_57_*
  → materiais de apresentação preservados por grupo/face
  → capa visual nas faces horizontais superiores dos grupos arquitetônicos
  → terreno centralizado com base de acabamento
  → casa.glb
  → model-viewer no navegador
```

O OBJ do SketchUp contém faces com muitos vértices. A triangulação em leque do `OBJLoader` criava diagonais incorretas; o conversor agora projeta cada face no próprio plano, triangula respeitando o contorno e corrige a orientação dos triângulos.

As paredes, lajes e volumes arquitetônicos usam faces visíveis dos dois lados porque o OBJ possui algumas orientações invertidas. A transparência é reservada aos vidros das janelas; paredes não devem usar `opacity` menor que `1` nem material transparente.

## Paleta visual aplicada

- `house_facade` — off-white quente `#ded6ca` para os volumes principais da casa.
- `boundary_wall` — concreto cinza médio `#89867f` para a base/muros.
- `kiosk_graphite` — grafite `#414542` para o bloco do quiosque.
- `wall_cap` — grafite `#4b4d49` aplicado às faces horizontais superiores do muro, da casa superior e do quiosque.
- `site_base` — cinza `#77766f` na base fina que aparece como borda da grama.
- portas, esquadrias e vidros preservam os materiais específicos de cada grupo do OBJ; os vidros translúcidos recebem aliases de vidro azul/cinza.

Essa separação é feita pelas malhas reais `Mesh214`, `Mesh215` e `Mesh216`. Não usar a imagem conceitual gerada por IA para inferir posições de janelas ou paredes.

O conversor não reduz mais objetos com vários materiais ao primeiro material: os grupos de faces do OBJ são exportados com seus materiais correspondentes. Isso mantém madeira de portas, perfis metálicos e vidros que antes podiam perder a cor.

O metadata também registra `cameraTargetMeters` e `cameraDistanceMeters`; o showroom usa esses valores para iniciar com o lote mais próximo, sem depender do enquadramento automático do terreno inteiro.

## Comando oficial de regeneração

Na pasta `showroom3d/`:

```powershell
node scripts/converter-projeto-obj-glb.mjs public/modelos/CASA-GEMINADA-BRUNO.obj public/modelos/casa.glb public/modelos/casa-meta.json meters
```

## Critérios de aceite visuais

Após qualquer alteração, validar em `http://localhost:5173/`:

1. O status aparece como `Modelo pronto` e não há painel de erro.
2. As paredes externas são opacas e continuam visíveis ao orbitar a casa.
3. Somente portas, janelas e vidros previstos podem parecer transparentes.
4. Não existem triângulos diagonais soltos nem superfícies triangulares geradas por triangulação incorreta.
5. A casa fica apoiada no terreno verde, sem flutuar.
6. A casa continua com aproximadamente **5,0 m × 30,0 m × 5,2 m**.
7. O terreno continua com **12 m × 35 m** e centralizado.
8. A paleta separa visualmente casa, muros e quiosque sem alterar a geometria.
9. `npm test` e `npm run build` passam.

## Limitações conhecidas

- O `.mtl` e as texturas originais não foram fornecidos; a conversão usa uma paleta por nome de material.
- O terreno de 12 m × 35 m é uma medida visual provisória e deve ser trocado se a medida real do lote for informada.
- O resultado é uma apresentação externa estilizada, não um render arquitetônico fotorealista.
- Não há interiores, edição, etapas, câmeras internas ou AR nesta etapa.

## Regra para próximos chats

Não recomeçar o projeto nem substituir o pipeline por um parser completo de Sweet Home 3D. Preserve o `casa.glb` que já foi validado e só regenerar o modelo quando houver uma mudança explícita na fonte ou no conversor. Depois de qualquer mudança, atualizar `HANDOFF.md` com fatos verificados, resultado real do navegador, `npm test` e `npm run build`.
