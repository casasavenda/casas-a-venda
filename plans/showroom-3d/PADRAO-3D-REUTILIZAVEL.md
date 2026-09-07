# Padrão 3D reutilizável — Casas Feitoria

Data de registro: 26/08/2026

Este documento registra o padrão aprovado no primeiro showroom 3D para ser reaplicado em novos projetos de casas e novos arquivos GLB. Ele deve ser lido junto com `HANDOFF.md` antes de qualquer nova alteração no visualizador.

## Padrão visual aprovado

- preservar as cores, texturas, portas, janelas, materiais e proporções que vierem do arquivo SketchUp/GLB;
- trabalhar com unidades reais em metros, sem reescalar a geometria para alterar medidas; uma escala visual de apresentação pode ser aplicada separadamente;
- centralizar a apresentação nos eixos horizontais e apoiar a menor coordenada vertical no piso `Y = 0`;
- manter um terreno visual coerente, com gramado, borda/base cinza e dimensões definidas pelo projeto;
- usar contraste entre paredes, pisos, madeira, vidros, esquadrias e terreno para que os volumes não pareçam uma massa cinza única;
- evitar qualquer geometria voando, deslocada, triangular ou desconectada da casa;
- enquadrar a câmera externa pela caixa da casa, com uma margem controlada de terreno, sem usar o lote inteiro para definir o zoom inicial;
- quando necessário para leitura no celular ou na galeria, aplicar a escala de apresentação uniformemente ao palco inteiro (casa + terreno + piso), mantendo o metadata e as medidas reais inalterados;
- evitar clipping que atravesse paredes sólidas. Quando uma cobertura ou volume precisar desaparecer, ocultar grupos completos e fechados do modelo;
- não aceitar paredes ocas em vistas superiores. Se uma seção for realmente necessária, ela precisa ter tampas/capas geométricas válidas ou ser exportada separadamente pelo SketchUp;
- manter sombras estáveis durante o giro, sem recalcular o mapa a cada frame quando a cena for estática;
- preservar grupos arquitetônicos durante otimizações de draw calls, para que seja possível alternar unidades sem quebrar a geometria;
- validar no showroom direto e dentro da galeria, incluindo o caminho mobile/embed.

## Controles de apresentação aprovados

O visualizador atual usa duas escolhas independentes:

- quantidade: `2 casas` ou `1 casa`;
- cobertura: `Vista externa` ou `Vista de cima`.

As quatro combinações devem continuar possíveis em novos modelos quando a estrutura do GLB permitir:

1. duas casas com cobertura;
2. uma casa com cobertura;
3. duas casas sem cobertura, mantendo as paredes fechadas;
4. uma casa sem cobertura, mantendo as paredes fechadas.

## Regra para novos GLBs

Antes de esconder ou reclassificar qualquer peça:

1. inspecionar a hierarquia, nomes, grupos, caixas espaciais, materiais e unidades do GLB;
2. identificar quais grupos formam cada unidade completa da casa;
3. confirmar quais grupos são cobertura, volumes superiores, paredes, pisos, aberturas e mobiliário;
4. preferir tags/camadas exportadas do SketchUp a filtros por índices ou nomes frágeis;
5. só compactar geometrias depois de preservar a associação de cada grupo à sua unidade;
6. validar alinhamento, piso, dimensões, câmera, materiais, sombras e desempenho no navegador.

Se o GLB não separar semanticamente paredes, cobertura, aberturas e móveis, não inventar uma remoção por aproximação. Registrar a limitação e pedir uma exportação do SketchUp com tags/camadas separadas ou arquivos separados.

## Visão interna planejada — escala humana

A visão interna será uma etapa separada do showroom externo. Ela deve seguir estes critérios:

- usar a planta e as medidas reais como fonte de verdade para escala e posições;
- posicionar a câmera na altura aproximada dos olhos de uma pessoa, inicialmente entre `1,60 m` e `1,70 m`, ajustando conforme a intenção do projeto;
- usar campo de visão humano confortável, sem exagerar a perspectiva nem afastar a câmera para caber o cômodo inteiro;
- criar um ponto de entrada e um alvo de visão por cômodo, com enquadramento próprio para sala, dormitórios, banheiro e demais ambientes;
- manter portas, corredores e paredes como limites de circulação, sem permitir que a câmera atravesse a arquitetura;
- preferir navegação por pontos/portais entre cômodos quando a planta não tiver corredores largos, para manter a experiência previsível no celular;
- usar `near` curto e `far` compatível com a casa, evitando que o ambiente desapareça ou fique minúsculo por causa de uma caixa delimitadora muito grande;
- testar cada ambiente com a posição, altura, escala visual e campo de visão conferidos contra a planta;
- não chamar a experiência de planta editável nem prometer precisão construtiva além das medidas fornecidas.

## Dados necessários para implementar a visão interna

- planta da casa com medidas legíveis e escala, em PDF, imagem ou arquivo equivalente;
- GLB que contenha os elementos internos realmente desejados: paredes, pisos, portas, janelas, forros e móveis;
- nomes dos cômodos e a correspondência entre cada nome da planta e o espaço no GLB;
- indicação de quais ambientes devem ter ponto de entrada no primeiro teste;
- confirmação de que as medidas da planta e do GLB usam a mesma unidade ou informação para conversão.

Sem geometria interna no GLB, a planta pode orientar posições e dimensões, mas não é seguro reconstruir móveis, revestimentos ou ambientes automaticamente dentro do showroom.

## Dados confirmados da primeira planta

- arquivo de referência: `Planta_Baixa - Queno 03-07-26 -ajustado.pdf`;
- a prancha é uma planta baixa térrea em escala `1:50` e representa duas unidades espelhadas;
- os ambientes identificados incluem dormitório, banho, serviço, cozinha, jantar/estar, varanda, quiosque, garagem e áreas permeáveis;
- a altura global informada por Andrew é `2,65 m`. Ela será usada como referência do pé-direito/volume interno da navegação, sem alterar automaticamente a escala ou a geometria do GLB;
- antes de criar os pontos internos, cruzar orientação, largura, profundidade, portas, corredores e posições dos cômodos da planta com o GLB ativo `showroom3d/public/modelos/casa.glb`;
- se a altura real do GLB divergir de `2,65 m`, registrar a diferença e decidir com Andrew se o arquivo deve ser corrigido na origem ou apenas se a câmera deve usar a altura de olhos adequada.

## Limites permanentes do projeto

- não voltar ao parser completo do Sweet Home 3D;
- não substituir o pipeline SketchUp/GLB sem evidência;
- não transformar o modo de apresentação em editor arquitetônico;
- não fazer commit, push, deploy ou publicação sem pedido explícito.
