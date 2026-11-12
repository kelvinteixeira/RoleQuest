"use client";

import { makeCreation } from "@/features/systems/rules/creation-kit";
import { makeNumberFields, makePanel } from "@/features/systems/rules/panel";
import { ordemBuild, type OrdemBuild } from "./rules";

export const OrdemPanel = makePanel({
  title: "Ordem Paranormal",
  note: "PV, PE e SAN crescem a cada 5% de NEX pela classe cadastrada (valores iniciais e por NEX). O nível da ficha é o NEX.",
  auto: "PV, PE e SAN máximos seguem a classe, o NEX, Vigor e Presença.",
  Extra: makeNumberFields<OrdemBuild>("Defesa", [{ key: "defenseBonus", label: "Bônus de proteção e outros", min: -20, max: 50 }], ordemBuild),
});

export const ordemCreation = makeCreation({
  label: "Ordem Paranormal",
  summary: "Depois do básico, um guia monta a ficha: classe (das cadastradas pela mesa), atributos e perícias treinadas.",
  classes: { hint: "Classes cadastradas pela mesa: as perícias delas já vêm treinadas e PV/PE/SAN seguem os valores cadastrados." },
  scores: {
    methods: [
      {
        key: "points",
        label: "Pontos",
        kind: "pointbuy",
        min: 0,
        max: 3,
        start: 1,
        cost: { 0: -1, 1: 0, 2: 1, 3: 2 },
        budget: 4,
        hint: "Atributos começam em 1, com 4 pontos para distribuir (máximo 3). Reduzir um atributo a 0 dá 1 ponto a mais.",
      },
    ],
    validate: (scores) => (Object.values(scores).filter((v) => v === 0).length > 1 ? "Só um atributo pode ficar em 0." : null),
  },
  skills: { kind: "train", count: (s) => Math.max(0, s.scores.int ?? 0), trainedBonus: 5, hint: "Além das perícias da classe e da origem, escolha uma por ponto de Intelecto. Treinadas recebem +5." },
});
