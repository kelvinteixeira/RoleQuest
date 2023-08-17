import {
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableBody,
} from "@mui/material";

import {
  StyledTableCell,
  StyledTableItem,
  StyledTopic,
} from "../PlayerCard.styles";

export type FightAttributesTableProps = {
  id: string;
  strengh: string;
  dexterity: string;
  agility: string;
  inteligence: string;
  vigor: string;
  magicForce: string;
  magicResistence: string;
  life: string;
  initiative: string;
  actions: string;
};
const firstTableHeader = [
  "Força",
  "Destreza",
  "Agilidade",
  "Inteligência",
  "Vigor",
];
const secondTableHeader = ["Vida", "Iniciativa", "Ações", "FM", "RM"];

export const FightAttributesTable = (props: FightAttributesTableProps) => {
  return (
    <>
      <StyledTopic textAlign={"center"}>Atributos de combate</StyledTopic>
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              {firstTableHeader.map((head, index) => (
                <StyledTableCell align="center" key={index}>{head}</StyledTableCell>
              ))}
            </TableRow>
          </TableHead>

          <TableBody>
            <TableRow>
              <StyledTableItem align="center">{props.strengh}</StyledTableItem>
              <StyledTableItem align="center">{props.dexterity}</StyledTableItem>
              <StyledTableItem align="center">{props.agility}</StyledTableItem>
              <StyledTableItem align="center">{props.inteligence}</StyledTableItem>
              <StyledTableItem align="center">{props.vigor}</StyledTableItem>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              {secondTableHeader.map((head, index) => (
                <StyledTableCell align="center" key={index}>{head}</StyledTableCell>
              ))}
            </TableRow>
          </TableHead>

          <TableBody>
            <TableRow>
              <StyledTableItem align="center">{props.life}</StyledTableItem>
              <StyledTableItem align="center">{props.initiative}</StyledTableItem>
              <StyledTableItem align="center">{props.actions}</StyledTableItem>
              <StyledTableItem align="center">{props.magicForce}</StyledTableItem>
              <StyledTableItem align="center">{props.magicResistence}</StyledTableItem>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
    </>
  );
};
