import { styled, Grid, Card } from "@mui/material";

export const StyledGrid = styled(Grid)`
  height: 80vh;
`;

export const StyledCard = styled(Card)`
  display: flex;
  flex-direction: column;
  width: 25rem;
  padding: 2rem;
  font-family: "HarryPotter";

  background: rgba(100, 126, 110, 0.1);
  -webkit-backdrop-filter: blur(15px);
  backdrop-filter: blur(5px);
  box-shadow: 0 8px 32px 0 #1f872d5e;
`;