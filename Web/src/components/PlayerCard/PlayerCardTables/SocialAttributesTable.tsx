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

export type SocialAttributesTableProps = {
  id: string;
  manipulation: string;
  intimidation: string;
  charisma: string;
  perception: string;
  courage: string;
  ambition: string;
  loyalty: string;
  wisdom: string;
};

const firstTableHeader = ["Coragem", "Ambição", "Lealdade", "Sabedoria"];

const secondTableHeader = [
  "Manipulação",
  "Intimidação",
  "Carisma",
  "Percepção",
];

export const SocialAttributesTable = (props: SocialAttributesTableProps) => {
  return (
    <>
      <StyledTopic textAlign={"center"}>Atributos Sociais</StyledTopic>
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
              <StyledTableItem align="center">{props.courage}</StyledTableItem>
              <StyledTableItem align="center">{props.ambition}</StyledTableItem>
              <StyledTableItem align="center">{props.loyalty}</StyledTableItem>
              <StyledTableItem align="center">{props.wisdom}</StyledTableItem>
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
              <StyledTableItem align="center">{props.manipulation}</StyledTableItem>
              <StyledTableItem align="center">{props.intimidation}</StyledTableItem>
              <StyledTableItem align="center">{props.charisma}</StyledTableItem>
              <StyledTableItem align="center">{props.perception}</StyledTableItem>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
    </>
  );
};
