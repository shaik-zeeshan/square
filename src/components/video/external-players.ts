export type ExternalPlayerId = "system-default" | "iina" | "vlc";

export interface ExternalPlayerMeta {
  id: ExternalPlayerId;
  label: string;
  /** Value passed to `openUrl(url, openWith)`. `undefined` means system default. */
  openWith: string | undefined;
  iconUrl?: string;
}

export const EXTERNAL_PLAYERS: ExternalPlayerMeta[] = [
  {
    id: "system-default",
    label: "System Default",
    openWith: undefined,
  },
  {
    id: "iina",
    label: "IINA",
    openWith: "IINA",
  },
  {
    id: "vlc",
    label: "VLC",
    openWith: "VLC",
  },
];

export function getPlayerMeta(id: ExternalPlayerId): ExternalPlayerMeta {
  return EXTERNAL_PLAYERS.find((p) => p.id === id) ?? EXTERNAL_PLAYERS[0];
}
