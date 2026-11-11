"use client";

import { makeCreation } from "@/features/systems/rules/creation-kit";
import { makePanel } from "@/features/systems/rules/panel";

export const TresDeTPanel = makePanel({
  title: "3D&T Victory",
  note: "Vantagens e desvantagens entram em Habilidades, com o custo em pontos.",
  auto: "PV, PM e PA seguem Resistência e Poder.",
});

export const tresDeTCreation = makeCreation({
  label: "3D&T Victory",
  summary: "Depois do básico, um guia distribui os pontos de personagem entre Poder, Habilidade e Resistência.",
  scores: {
    extras: [{ key: "budget", label: "Pontos de personagem", initial: 10, min: 1, max: 60, hint: "o mestre define a escala da campanha" }],
    methods: [
      {
        key: "points",
        label: "Pontos",
        kind: "pointbuy",
        min: 0,
        max: 5,
        start: 0,
        cost: { 0: 0, 1: 1, 2: 2, 3: 3, 4: 4, 5: 5 },
        budget: (s) => s.extra.budget ?? 10,
        hint: "Cada ponto numa característica custa 1 ponto de personagem. O que sobrar vai para vantagens, na ficha.",
      },
    ],
  },
});
