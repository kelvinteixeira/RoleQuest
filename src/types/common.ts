export type ID = string;

/** ISO-8601 timestamp, e.g. "2026-11-03T19:30:00.000Z". */
export type ISODateString = string;

export type Timestamps = {
  createdAt: ISODateString;
  updatedAt: ISODateString;
};
