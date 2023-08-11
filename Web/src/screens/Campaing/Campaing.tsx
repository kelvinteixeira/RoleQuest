import { useState, useEffect } from "react";

import { Container } from "@mui/material";

import { api } from "../../lib/axios";

import backgroundVideo from "../../assets/videos/backgroundCampaing.mp4";

import {
  StyledBox,
  StyledTitle,
  StyledTopic,
  StyledParagraphy,
} from "./Campaing.styles";

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
            <StyledTitle textAlign={"center"}>{campaing.title}</StyledTitle>

            <StyledTopic variant="body1" paddingBottom={1}>
              Ambientação:{" "}
              <StyledParagraphy>{campaing.ambient}</StyledParagraphy>
            </StyledTopic>
            <StyledTopic variant="body1">
              Sinopse:{" "}
              <StyledParagraphy>{campaing.description}</StyledParagraphy>
            </StyledTopic>
          </StyledBox>
        ) : null;
      })}
    </Container>
  );
};
