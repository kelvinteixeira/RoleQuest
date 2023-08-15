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
  maestry: string;
  damage?: string | null;
  type: string;
};

const tableHeader = ["Pronuncia", "Descrição", "Efeito", "Maestria", "Dano"];

export const HexesTable = () => {
  const [spells, setSpells] = useState([]);

  useEffect(() => {
    api.get("/spells").then((response) => setSpells(response.data));
  }, []);
  return (
    <>
      <StyledTitle textAlign={"center"}>Azarações</StyledTitle>
      <TableContainer>
        <Table>
        <TableHead>
            <TableRow>
              {tableHeader.map((head, index) => (
                <StyledTableCell key={index}>{head}</StyledTableCell>
              ))}
            </TableRow>
          </TableHead>

          <TableBody>
            {spells.map((spell: SpellsProps) => {
              return spell.type === "hex" ? (
                <TableRow key={spell.pronounce}>
                  <StyledTableItem>{spell.pronounce}</StyledTableItem>
                  <StyledTableItem>{spell.description}</StyledTableItem>
                  <StyledTableItem>{spell.effect}</StyledTableItem>
                  <StyledTableItem>{spell.maestry}</StyledTableItem>
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
