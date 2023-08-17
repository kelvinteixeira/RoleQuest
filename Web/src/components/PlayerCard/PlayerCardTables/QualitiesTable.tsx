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

export type QualitiesTableProps = {
  id: string,
  title: string;
  description: string;
};

const firstTableHeader = ["Título", "Descrição"];

export const QualitiesTable = (props: QualitiesTableProps) => {
  return (
    <>
      <StyledTopic textAlign={"center"}>Qualidades</StyledTopic>
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              {firstTableHeader.map((head, index) => (
                <StyledTableCell key={index}>{head}</StyledTableCell>
              ))}
            </TableRow>
          </TableHead>

          <TableBody>
            <TableRow>
              <StyledTableItem>{props.title}</StyledTableItem>
              <StyledTableItem>{props.description}</StyledTableItem>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
    </>
  );
};
