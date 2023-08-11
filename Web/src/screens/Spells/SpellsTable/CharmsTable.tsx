import { useEffect, useState } from "react";

import {
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableBody,
} from "@mui/material";

import { api } from "../../../lib/axios";
import { StyledTableCell, StyledTableItem, StyledTitle } from "../Spells.styles";

type SpellsProps = {
  pronounce: string;
  description: string;
  effect?: string | null;
  mastery: string;
  damage?: string | null;
  type: string;
};

export const CharmsTable = () => {
  const [spells, setSpells] = useState([]);

  useEffect(() => {
    api.get("/spells").then((response) => setSpells(response.data));
  }, []);
  return (
    <>
      <StyledTitle textAlign={"center"}>Encatamentos</StyledTitle>
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <StyledTableCell>Pronuncia</StyledTableCell>
              <StyledTableCell>Descrição</StyledTableCell>
              <StyledTableCell>Efeito</StyledTableCell>
              <StyledTableCell>Maestria</StyledTableCell>
              <StyledTableCell>Dano</StyledTableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {spells.map((spell: SpellsProps) => {
              return spell.type === "charm" ? (
                <TableRow key={spell.pronounce}>
                  <StyledTableItem>{spell.pronounce}</StyledTableItem>
                  <StyledTableItem>{spell.description}</StyledTableItem>
                  <StyledTableItem>{spell.effect}</StyledTableItem>
                  <StyledTableItem>{spell.mastery}</StyledTableItem>
                  <StyledTableItem>{spell.damage}</StyledTableItem>
                </TableRow>
              ) : null;
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </>
  );
};
