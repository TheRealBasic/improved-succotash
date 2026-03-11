export type InteractionCue = 'tap' | 'connect' | 'error';

export const playInteractionSfx = (cue: InteractionCue): void => {
  // placeholder hook for future WebAudio or asset playback
  console.debug(`[sfx] ${cue}`);
};
