import { useState, useEffect } from "react";
import { api } from "../../lib/axios";
import { StyledBox, StyledTitle } from "./PlayerCard.styles";
import {
  FightAttributesTableProps,
  FightAttributesTable,
} from "./PlayerCardTables/FightAttributesTable";
import {
  SocialAttributesTableProps,
  SocialAttributesTable,
} from "./PlayerCardTables/SocialAttributesTable";
import {
  MagicalAttributesTableProps,
  MagicalAttributesTable,
} from "./PlayerCardTables/MagicalAttributesTable";
import {
  QualitiesTable,
  QualitiesTableProps,
} from "./PlayerCardTables/QualitiesTable";
import {
  DefectsTable,
  DefectsTableProps,
} from "./PlayerCardTables/DefectsTable";
import {
  AntecedentsTable,
  AntecedentsTableProps,
} from "./PlayerCardTables/AntecedentsTable";

type CharacterItems = {
  id: string;
  playerName: string;
  fightAttributes: FightAttributesTableProps;
  socialAttributes: SocialAttributesTableProps;
  magicalAttributes: MagicalAttributesTableProps;
  qualities: QualitiesTableProps[];
  defects: DefectsTableProps[];
  antecedents: AntecedentsTableProps[];
};

export const PlayerCard = () => {
  const [characters, setCharacters] = useState([]);

  useEffect(() => {
    api.get("/characters").then((response) => setCharacters(response.data));
  }, []);
  return (
    <>
      {characters.map((character: CharacterItems) => (
        <StyledBox className="scroll-hidden" key={character.id}>
          <StyledTitle textAlign={"center"}>
            Ficha de {character.playerName}
          </StyledTitle>
          <FightAttributesTable
            {...character.fightAttributes}
            key={character.fightAttributes.id}
            
          />
          <SocialAttributesTable
            {...character.socialAttributes}
            key={character.socialAttributes.id}
          />
          <MagicalAttributesTable
            {...character.magicalAttributes}
            key={character.magicalAttributes.id}
          />
          {character.qualities.map((qualitie) => (
            <QualitiesTable {...qualitie} key={qualitie.id} />
          ))}

          {character.qualities.map((defect) => (
            <DefectsTable {...defect} key={defect.id} />
          ))}
          {character.antecedents.map((antecedent) => (
            <AntecedentsTable {...antecedent} key={antecedent.id} />
          ))}
        </StyledBox>
      ))}
    </>
  );
};
