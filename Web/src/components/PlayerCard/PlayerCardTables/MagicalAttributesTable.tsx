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

export type MagicalAttributesTableProps = {
  id: string;
  fly: string;
  potions: string;
  dada: string;
  herbology: string;
  spells: string;
  animalEmpaty: string;
  transfiguration: string;
  hexes: string;
};

const firstTableHeader = ["Voo", "Poções", "DADA", "Herbologia"];

const secondTableHeader = [
  "Feitiços",
  "Empatia com animais",
  "Transfiguração",
  "Axarações",
];

export const MagicalAttributesTable = (props: MagicalAttributesTableProps) => {
  return (
    <>
      <StyledTopic textAlign={"center"}>Atributos Mágicos</StyledTopic>
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
              <StyledTableItem align="center">{props.fly}</StyledTableItem>
              <StyledTableItem align="center">{props.potions}</StyledTableItem>
              <StyledTableItem align="center">{props.dada}</StyledTableItem>
              <StyledTableItem align="center">{props.herbology}</StyledTableItem>
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
              <StyledTableItem align="center">{props.spells}</StyledTableItem>
              <StyledTableItem align="center">{props.animalEmpaty}</StyledTableItem>
              <StyledTableItem align="center">{props.transfiguration}</StyledTableItem>
              <StyledTableItem align="center">{props.hexes}</StyledTableItem>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
    </>
  );
};
