# Plano de implementação — câmera interna por cômodos

Status: primeira versão guiada implementada em 26/08/2026; calibração centimétrica dos pontos ainda pendente.

## Objetivo

Criar uma experiência interna em primeira pessoa, inspirada na sensação de escala do Street View, para que o visitante escolha uma casa e entre nos cômodos sem a câmera ficar pequena, atravessar paredes ou perder a proporção real.

O modo interno será separado do modo externo atual. A vista externa, a escala visual 4x, o terreno e os controles existentes não devem ser quebrados.

## Fonte de verdade

- Planta: `C:\Users\Andrew\Downloads\Planta_Baixa - Queno 03-07-26 -ajustado.pdf`.
- Modelo: `showroom3d/public/modelos/casa.glb` e sua versão leve `showroom3d/public/modelos/casa-direita-mobile.glb`.
- Altura global informada: `2,65 m`.
- Altura inicial da câmera: aproximadamente `1,65 m`, ajustável após comparar portas, vãos e pé-direito com a planta e o GLB.

## Etapa 1 — auditoria antes do código

1. Medir a caixa, a orientação, o piso e os vãos do GLB sem aplicar a escala visual 4x.
2. Conferir a planta em escala 1:50 e mapear as duas unidades espelhadas.
3. Verificar se o GLB contém paredes internas, pisos, portas, janelas, forros e eventuais móveis necessários.
4. Identificar uma hierarquia semântica para casa, cômodo, abertura e mobiliário.
5. Se o GLB não separar os ambientes, solicitar nova exportação do SketchUp com Tags/Camadas ou componentes nomeados. Não criar paredes ou móveis por aproximação, pois isso repetiria os bugs de paredes ocas e peças desalinhadas.

## Etapa 2 — pontos de entrada

Criar pontos de entrada e alvos de visão para cada ambiente de cada unidade, começando por:

- jantar/estar;
- cozinha;
- dormitórios;
- banho;
- serviço;
- varanda;
- quiosque;
- garagem, se a área for navegável no GLB.

Ambientes maiores podem ter mais de um ponto. Cada ponto deve registrar casa, cômodo, posição da câmera, alvo inicial, altura e limites de circulação. Áreas permeáveis e o terreno não são cômodos internos.

## Etapa 3 — experiência de navegação

- adicionar um modo `Vista interna` separado da vista externa;
- manter a seleção `1 casa`/`2 casas` antes de escolher o cômodo;
- apresentar uma lista ou seletor de cômodos com nomes legíveis;
- usar transição curta entre pontos, em vez de teletransportar sem contexto;
- no desktop, permitir olhar ao redor com mouse/touchpad;
- no celular, priorizar arrastar para olhar e botões grandes para trocar de cômodo;
- impedir atravessar paredes, pisos e limites do cômodo;
- disponibilizar retorno claro para `Vista externa`.

## Etapa 4 — escala e câmera

- usar coordenadas reais do GLB, sem aplicar a escala visual 4x à câmera interna;
- posicionar a câmera entre `1,60 m` e `1,70 m`, começando em `1,65 m`;
- usar `PerspectiveCamera` com FOV inicial entre `65°` e `72°`, evitando a sensação de cômodo minúsculo ou lente exagerada;
- configurar `near` curto, aproximadamente `0,05 m`, e `far` compatível com a casa;
- manter o piso como referência de `Y = 0` e conferir que a câmera não flutua;
- limitar pitch para evitar olhar através do teto ou do piso.

## Etapa 5 — colisão e limites

A primeira versão deve preferir navegação por pontos/portais ou uma malha de circulação validada, em vez de caminhada livre sem colisão. Para cada cômodo:

- confirmar área livre para a câmera;
- confirmar passagem pelas portas;
- manter uma margem mínima das paredes;
- bloquear posições fora do piso navegável;
- impedir entrada em volumes que não estejam presentes no GLB.

## Etapa 6 — acabamento e desempenho

- reutilizar materiais, cores e iluminação aprovados no showroom;
- evitar criar luzes por cômodo em excesso;
- manter a resolução e a versão mobile compatíveis com o desempenho já validado;
- preservar paredes fechadas, sem clipping que gere faces ocas;
- manter sombras estáveis e sem piscar durante a rotação.

## Critérios de aceite

1. Cada cômodo publicado tem um ponto de entrada identificável nas duas unidades.
2. A câmera começa em escala humana, apoiada no piso e com proporção confortável.
3. O visitante consegue olhar ao redor sem ver paredes ocas, triângulos ou peças voando.
4. A câmera não atravessa paredes, portas fechadas, piso ou teto.
5. A troca entre cômodos é clara no desktop e no celular.
6. `Vista externa`, seleção de uma/duas casas e vista superior continuam funcionando.
7. O GLB e as medidas reais não são alterados para compensar a câmera.
8. Cada ambiente é verificado visualmente contra a planta e contra o modelo no navegador.

## Riscos e dependências

- O GLB atual foi organizado para apresentação externa e não possui, até o momento, um catálogo confiável de cômodos para navegação.
- A planta descreve os ambientes, mas não substitui a geometria interna do GLB.
- A altura `2,65 m` é uma referência informada, não autorização para deformar o modelo.
- A implementação só deve começar depois da auditoria de escala, orientação e hierarquia; se faltarem paredes, portas ou pisos internos, a dependência é uma nova exportação do SketchUp.
