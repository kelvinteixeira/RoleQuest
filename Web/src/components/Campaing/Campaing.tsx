import { Box, Container, Typography, styled, Grid } from "@mui/material";
import { api } from "../../lib/axios";
import { useState, useEffect } from "react";
import backgroundVideo from "../../assets/images/backgroundCamaping.mp4";

type CampaingProps = {
  title: string;
  ambient: string;
  description: string;
  actual: boolean;
};

export const Campaing = () => {
  const [campaings, setCampaings] = useState([]);

  useEffect(() => {
    api.get("/campaings").then((response) => setCampaings(response.data));
  }, []);
  return (
    <Container>
      <video autoPlay muted loop>
        <source src={backgroundVideo} type="video/mp4" />
      </video>
      {campaings.map((campaing: CampaingProps) => {
        return campaing.actual ? (
          <StyledBox className="scroll-hidden">
            <StyledTypography
              textAlign={"center"}
              variant="body1"
              sx={{
                color: "#c09554",
                fontSize: 70,
                fontFamily: "HarryPotter !important",
                textShadow: "inherit",
              }}
            >
              {campaing.title}
            </StyledTypography>

            <StyledTypographyParagraph
              variant="body1"
              paddingBottom={1}
              sx={{
                color: "#c09554",
                fontSize: 40,
                fontFamily: "HarryPotter !important",
              }}
            >
              Ambientação:{" "}
              <StyledTypographyParagraph
                sx={{
                  color: "#fff",
                  fontSize: 30,
                  fontFamily: "HarryPotter !important",
                }}
              >
                {campaing.ambient}
              </StyledTypographyParagraph>
            </StyledTypographyParagraph>
            <StyledTypographyParagraph
              variant="body1"
              sx={{
                color: "#c09554",
                fontSize: 40,
                fontFamily: "HarryPotter !important",
              }}
            >
              Sinopse:{" "}
              <StyledTypographyParagraph
                sx={{
                  color: "#fff",
                  fontSize: 30,
                  fontFamily: "HarryPotter !important",
                }}
              >
                {campaing.description}
              </StyledTypographyParagraph>
            </StyledTypographyParagraph>
          </StyledBox>
        ) : null;
      })}
    </Container>
  );
};

const StyledBox = styled(Box)`
  margin-top: 2rem;
  max-height: 28rem;
  padding: 1rem;
  font-family: "HarryPotter";
  background: rgba(90, 86, 60, 0.1);
  -webkit-backdrop-filter: blur(15px);
  backdrop-filter: blur(5px);
  box-shadow: 0 8px 32px 0 #8d550b5e;
  overflow: scroll;
`;


const StyledTypography = styled(Typography) `
  -webkit-text-stroke-width: 2px;
  -webkit-text-stroke-color: #000;
`
const StyledTypographyParagraph = styled(Typography) `
  -webkit-text-stroke-width: .5px;
  -webkit-text-stroke-color: #8d550b5e;
`