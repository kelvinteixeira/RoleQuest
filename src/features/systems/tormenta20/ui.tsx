"use client";

import { makeCreation } from "@/features/systems/rules/creation-kit";
import { makeNumberFields, makePanel } from "@/features/systems/rules/panel";
import { t20Build, type T20Build } from "./rules";

export const T20Panel = makePanel({
  title: "Tormenta20",
  note: "PV e PM crescem pela classe escolhida (cadastrada pelo grupo, com PV/PM iniciais e por nível). Perícias somam metade do nível; treinadas somam o treino.",
  auto: "PV e PM máximos seguem a classe, o nível e a Constituição.",
  Extra: makeNumberFields<T20Build>("Defesa", [{ key: "defenseBonus", label: "Bônus de armadura, escudo e outros", min: -20, max: 50 }], t20Build),
});

export const t20Creation = makeCreation({
  label: "Tormenta20",
  summary: "Depois do básico, um guia monta a ficha: classe (das cadastradas pela mesa), atributos por pontos e perícias treinadas.",
  classes: { hint: "Classes cadastradas pela mesa: as perícias delas já vêm treinadas e PV/PM seguem os valores cadastrados." },
  scores: {
    methods: [
      {
        key: "points",
        label: "Pontos",
        kind: "pointbuy",
        min: -1,
        max: 4,
        start: 0,
        cost: { [-1]: -1, 0: 0, 1: 1, 2: 2, 3: 4, 4: 7 },
        budget: 10,
        hint: "Atributos começam em 0. Você tem 10 pontos: subir para 1, 2, 3 e 4 custa 1, 2, 4 e 7; baixar para −1 devolve 1. Some os modificadores da raça depois, na ficha.",
      },
    ],
    total: (_s, _k, v) => (v >= 0 ? `+${v}` : `${v}`),
  },
  skills: { kind: "train", count: (s) => Math.max(0, s.scores.int ?? 0), hint: "Além das perícias da classe, escolha uma por ponto de Inteligência. Confira na sua classe se ela dá escolhas extras." },
});

