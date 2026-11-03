import type { ID, ISODateString, Timestamps } from "./common";
import type { SystemId } from "./system";

/** What the user usually does at the table. Per-campaign roles live on CampaignMember. */
export type PlayStyle = "game_master" | "player" | "both";

export interface UserProfile extends Timestamps {
  id: ID;
  email: string;
  displayName: string;
  username: string;
  avatarUrl: string | null;
  /** CSS color used for the generated avatar when there is no image. */
  avatarColor: string;
  bio: string;
  playStyle: PlayStyle;
  favoriteSystemIds: SystemId[];
  timezone: string;
  onboardingCompleted: boolean;
}

export interface AuthSession {
  userId: ID;
  email: string;
  accessToken: string;
  expiresAt: ISODateString;
}

export type SignUpInput = {
  email: string;
  password: string;
  displayName: string;
};

export type ProfileUpdate = Partial<
  Pick<UserProfile, "displayName" | "username" | "avatarColor" | "avatarUrl" | "bio" | "playStyle" | "favoriteSystemIds" | "timezone" | "onboardingCompleted">
>;
