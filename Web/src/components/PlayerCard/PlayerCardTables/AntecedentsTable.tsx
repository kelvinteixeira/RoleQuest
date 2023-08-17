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

export type AntecedentsTableProps = {
  id: string;
  title: string;
  level: string;
  description: string;
};

const tableHeader = ["Título", "Nível", "Descrição"];

export const AntecedentsTable = (props: AntecedentsTableProps) => {
  return (
    <>
      <StyledTopic textAlign={"center"}>Antecedentes</StyledTopic>
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
            <TableRow>
              <StyledTableItem>{props.title}</StyledTableItem>
              <StyledTableItem>{props.level}</StyledTableItem>
              <StyledTableItem>{props.description}</StyledTableItem>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
    </>
  );
};
