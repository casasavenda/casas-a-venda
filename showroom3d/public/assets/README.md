# Modelos 3D de apresentação

Coloque aqui arquivos `.glb` com as texturas incorporadas e registre cada um em
`modelos.json`. O arquivo `.sh3d` continua sendo a fonte da planta, paredes,
medidas e aberturas; estes modelos são uma camada visual adicional.

Exemplo:

```json
{
  "version": 1,
  "models": [
    {
      "id": "sofa-sala",
      "name": "Sofá da sala",
      "model": "/assets/sofa-linho.glb",
      "room": "SALA/COZINHA",
      "position": { "x": 0.8, "y": 0, "z": -1.2 },
      "rotationY": 1.57,
      "dimensions": { "width": 2.1, "height": 0.85, "depth": 0.9 },
      "material": { "roughness": 0.86, "envMapIntensity": 0.55 }
    }
  ]
}
```

As coordenadas de `position` usam metros no mesmo sistema da planta normalizada.
